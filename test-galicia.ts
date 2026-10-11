import 'dotenv/config';
import fs from 'node:fs';
import { bankExtractorGalicia } from './src/mastra/agents/bank-extractors/galicia';
import { extractorOutputSchema } from './src/mastra/agents/bank-extractors/types';
import LlamaCloud from '@llamaindex/llama-cloud';

const apiKey = process.env.LLAMA_CLOUD_API_KEY!;
const client = new LlamaCloud({ apiKey });

const path = process.argv[2] ?? 'src/mastra/public/workspace/galicia-1.pdf';

const fileObj = await client.files.create({
  file: fs.createReadStream(path) as any,
  purpose: 'parse',
});
console.log('uploaded fileId=', fileObj.id);

const result = await client.parsing.parse({
  file_id: fileObj.id,
  tier: 'cost_effective',
  version: 'latest',
  expand: ['markdown_full', 'text_full'],
});
const markdown = (result as any).markdown_full ?? '';
console.log('markdown length=', markdown.length);
fs.writeFileSync('/tmp/galicia-markdown.md', markdown);

const prompt = `Extrae los movimientos bancarios del siguiente markdown:\n\n${markdown}`;

console.log('--- agent raw generate (no schema) ---');
try {
  const res = await bankExtractorGalicia.generate(prompt);
  console.log('finishReason=', res.finishReason);
  console.log('text=', String(res.text).slice(0, 1500));
} catch (e) {
  console.error('ERROR raw:', e);
}

console.log('--- structured output attempt ---');
try {
  const res = await bankExtractorGalicia.generate(prompt, {
    structuredOutput: { schema: extractorOutputSchema },
  });
  console.log('finishReason=', res.finishReason);
  console.log('object=', JSON.stringify(res.object)?.slice(0, 1500));
  console.log('text=', String(res.text).slice(0, 800));
} catch (e) {
  console.error('ERROR structured:', e);
}

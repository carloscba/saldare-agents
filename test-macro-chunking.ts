import 'dotenv/config';
import fs from 'node:fs';
import { bankExtractors } from './src/mastra/agents/bank-extractors/registry';
import { extractMovementsChunked, splitByPage } from './src/mastra/agents/bank-extractors/chunk';
import LlamaCloud from '@llamaindex/llama-cloud';

const path = process.argv[2] ?? 'src/mastra/public/workspace/Macro/resumen.pdf';
const bank = 'macro';

const apiKey = process.env.LLAMA_CLOUD_API_KEY!;
const client = new LlamaCloud({ apiKey });

console.log('uploading', path);
const fileObj = await client.files.create({
  file: fs.createReadStream(path) as any,
  purpose: 'parse',
});
console.log('fileId=', fileObj.id);

const result = await client.parsing.parse({
  file_id: fileObj.id,
  tier: 'cost_effective',
  version: 'latest',
  expand: ['markdown_full', 'text_full'],
});

const markdown = (result as any).markdown_full ?? '';
console.log('markdown length=', markdown.length);
console.log('chunks=', splitByPage(markdown).length);

const cfg = bankExtractors[bank];
const start = Date.now();
const extracted = await extractMovementsChunked({
  agent: cfg.agent,
  markdown,
  context: cfg.context?.(markdown),
});
const elapsed = Date.now() - start;

console.log('movimientos extraídos:', extracted.movimientos.length);
console.log('tiempo:', `${elapsed}ms`);
console.log('primero:', JSON.stringify(extracted.movimientos[0], null, 2));
console.log('último:', JSON.stringify(extracted.movimientos.at(-1), null, 2));

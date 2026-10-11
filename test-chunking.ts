import 'dotenv/config';
import fs from 'node:fs';
import { bankExtractors } from './src/mastra/agents/bank-extractors/registry';
import { extractMovementsChunked } from './src/mastra/agents/bank-extractors/chunk';

async function testBank(bank: 'galicia' | 'macro', path: string) {
  const markdown = fs.readFileSync(path, 'utf-8');
  const cfg = bankExtractors[bank];

  console.log(`\n=== ${bank} ===`);
  console.log('markdown length:', markdown.length);

  const start = Date.now();
  const result = await extractMovementsChunked({
    agent: cfg.agent,
    markdown,
    context: cfg.context?.(markdown),
  });
  const elapsed = Date.now() - start;

  console.log('movimientos extraídos:', result.movimientos.length);
  console.log('tiempo:', `${elapsed}ms`);
  console.log('primero:', JSON.stringify(result.movimientos[0], null, 2));
  console.log('último:', JSON.stringify(result.movimientos.at(-1), null, 2));
}

await testBank('galicia', '/tmp/galicia-markdown.md');
await testBank('macro', 'data/# Macro.md');

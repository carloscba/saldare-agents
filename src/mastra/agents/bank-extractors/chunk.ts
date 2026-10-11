import type { Agent } from '@mastra/core/agent';
import { extractorOutputSchema, type MovimientoRow } from './types';

/**
 * Separa un markdown de extracto bancario en chunks autocontenidos.
 * LlamaCloud usa `---` como separador de páginas; cada chunk debe contener
 * al menos una <table> para ser procesado.
 */
export function splitByPage(markdown: string): string[] {
  return markdown
    .split(/^---\s*$/gm)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0 && chunk.includes('<table>'));
}

export type ExtractMovementsOptions = {
  agent: Agent;
  markdown: string;
  /** Contexto a anteponer a cada chunk (ej. "Número de cuenta: ..."). */
  context?: string;
};

/**
 * Extrae movimientos de un markdown largo dividiéndolo en chunks y delegando
 * en el agente de banco para cada chunk. El resultado se consolida en un
 * único arreglo en el orden original.
 */
export async function extractMovementsChunked({
  agent,
  markdown,
  context,
}: ExtractMovementsOptions): Promise<{ movimientos: MovimientoRow[] }> {
  const chunks = splitByPage(markdown);
  const prefix = context ? `${context}\n\n` : '';

  const movimientos: MovimientoRow[] = [];

  for (const chunk of chunks) {
    const prompt = `${prefix}Extrae los movimientos bancarios del siguiente markdown:\n\n${chunk}`;
    const result = await agent.generate(prompt, {
      structuredOutput: {
        schema: extractorOutputSchema,
        jsonPromptInjection: 'inline',
      },
    });

    const object = result.object as { movimientos?: MovimientoRow[] } | undefined;
    if (object?.movimientos) {
      movimientos.push(...object.movimientos);
    }
  }

  return { movimientos };
}

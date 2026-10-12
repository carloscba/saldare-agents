import type { Agent } from '@mastra/core/agent';
import { categorizerOutputSchema, type MovimientoRow, type CategorizedMovimientoRow } from './types';
import type { MovementCategory } from '../../categories';

const BATCH_SIZE = 25;
const UNKNOWN_CATEGORY: MovementCategory = 'Desconocida';

export async function categorizeMovements({
  agent,
  movimientos,
}: {
  agent: Agent;
  movimientos: MovimientoRow[];
}): Promise<{ movimientos: CategorizedMovimientoRow[] }> {
  if (movimientos.length === 0) return { movimientos: [] };

  const resultados: CategorizedMovimientoRow[] = [];

  for (let i = 0; i < movimientos.length; i += BATCH_SIZE) {
    const batch = movimientos.slice(i, i + BATCH_SIZE);
    const prompt = `Clasificá los siguientes movimientos bancarios respetando el orden y agregando el campo "categoria". Si no podés determinar una categoría, usá "Desconocida":\n\n${JSON.stringify(batch, null, 2)}`;

    const res = await agent.generate(prompt, {
      structuredOutput: {
        schema: categorizerOutputSchema,
        jsonPromptInjection: 'inline',
      },
    });

    const object = res.object as { movimientos?: CategorizedMovimientoRow[] } | undefined;
    const returned = object?.movimientos ?? [];

    for (let j = 0; j < batch.length; j++) {
      resultados.push(returned[j] ?? { ...batch[j], categoria: UNKNOWN_CATEGORY });
    }
  }

  return { movimientos: resultados };
}

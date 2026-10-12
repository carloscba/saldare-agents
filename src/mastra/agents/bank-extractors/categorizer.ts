import { Agent } from '@mastra/core/agent';
import { opencodeGoHeaders } from '../opencode-headers';
import { movementCategories } from '../../categories';
import { categorizationExamples } from './categorization-examples';

export const movementCategorizer = new Agent({
  id: 'movement-categorizer',
  name: 'Movement Categorizer',
  description: 'Clasifica movimientos bancarios en categorías contables cerradas.',
  model: [
    {
      id: 'categorizer',
      model: 'opencode-go/deepseek-v4-flash',
      headers: opencodeGoHeaders,
    },
  ],
  instructions: `
Objetivo: Clasificar cada movimiento bancario en exactamente una categoría contable.

Categorías válidas (usa una de estas y solo estas):
${movementCategories.join('\n')}

Ejemplos de referencia (descripción => categoría conciliada). Usalos como guía de criterio de clasificación; no exigen coincidencia exacta con la descripción:
${categorizationExamples.map((e) => `- "${e.descripcion}" => ${e.categoria}`).join('\n')}

Reglas:
1. Analizá la descripción del movimiento y el signo (débito = egreso, crédito = ingreso).
2. Asigná la categoría más específica posible, siguiendo el criterio de los ejemplos de referencia.
3. Devolvé el movimiento completo (todos sus campos originales) agregando la clave "categoria".
4. Mantené el orden original de los movimientos. No agregues, elimines ni reordenes filas.
5. Si una descripción es ambigua o no tenés certeza suficiente, usá \`Desconocida\`.
6. La categoría \`Desconocida\` es válida y debe usarse cuando no sea posible determinar una de las categorías conocidas (todas salvo \`Desconocida\`).
`,
});

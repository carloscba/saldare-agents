import { z } from 'zod';
import { movementCategorySchema } from '../../categories';

export const movimientoRowSchema = z.object({
  cuenta: z
    .string()
    .describe('Número de cuenta (NRO) al que pertenece el movimiento, p. ej. "3-320-0941456600-5".'),
  fecha: z.string().describe('Fecha del movimiento, p. ej. "03/01/23".'),
  descripcion: z.string().describe('Descripción del movimiento.'),
  referencia: z.string().describe('Referencia. Puede estar vacía.'),
  debitos: z.string().describe('Importe débito tal como figura en el extracto. Puede estar vacío.'),
  creditos: z.string().describe('Importe crédito tal como figura en el extracto. Puede estar vacío.'),
  saldo: z.string().describe('Saldo tal como figura en el extracto, sin recalcular.'),
});

export const extractorOutputSchema = z.object({
  movimientos: z
    .array(movimientoRowSchema)
    .describe('Todos los movimientos de todas las tablas extraídas, consolidados en un solo arreglo.'),
});

export const EXTRACTOR_OUTPUT_CONTRACT = `
FORMATO DE SALIDA (obligatorio e inamovible)
Devuelve tu respuesta final como UN ÚNICO objeto JSON válido, sin bloques de markdown (\`\`\`json), sin comentarios, sin texto antes ni después. La estructura exacta es:

{
  "movimientos": [
    {
      "cuenta": "...",
      "fecha": "...",
      "descripcion": "...",
      "referencia": "...",
      "debitos": "...",
      "creditos": "...",
      "saldo": "..."
    }
  ]
}

Reglas:
- "movimientos" es un arreglo de objetos; consolidá TODOS los movimientos de TODAS las tablas en este único arreglo.
- Si no hay movimientos, devolvé { "movimientos": [] }.
- Siempre devolvé el objeto con la clave "movimientos". NUNCA devuelvas un arreglo suelto ni envuelvas la respuesta en otra clave.
- Todos los campos son STRINGS (texto). Los montos van como string, tal como figuran en el extracto (ej. "13.635,00"), SIN símbolo de moneda. Si un campo no tiene valor, usá la cadena vacía "".
- No agregues claves adicionales ni modifiques los nombres de los campos.
`;

export type MovimientoRow = z.infer<typeof movimientoRowSchema>;

export function movementsToCsv(
  movimientos: z.infer<typeof extractorOutputSchema>['movimientos']
): string {
  const header = ['CUENTA', 'FECHA', 'DESCRIPCION', 'REFERENCIA', 'DEBITOS', 'CREDITOS', 'SALDO'];
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = movimientos.map((m) =>
    [m.cuenta, m.fecha, m.descripcion, m.referencia, m.debitos, m.creditos, m.saldo]
      .map(escape)
      .join(',')
  );
  return [header.map(escape).join(','), ...rows].join('\n');
}

export const categorizedMovimientoRowSchema = movimientoRowSchema.extend({
  categoria: movementCategorySchema,
});

export const categorizerOutputSchema = z.object({
  movimientos: z.array(categorizedMovimientoRowSchema),
});

export type CategorizedMovimientoRow = z.infer<typeof categorizedMovimientoRowSchema>;

export function categorizedMovementsToCsv(
  movimientos: CategorizedMovimientoRow[]
): string {
  const header = ['CUENTA', 'FECHA', 'DESCRIPCION', 'REFERENCIA', 'DEBITOS', 'CREDITOS', 'SALDO', 'CATEGORIA'];
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = movimientos.map((m) =>
    [m.cuenta, m.fecha, m.descripcion, m.referencia, m.debitos, m.creditos, m.saldo, m.categoria]
      .map(escape)
      .join(',')
  );
  return [header.map(escape).join(','), ...rows].join('\n');
}

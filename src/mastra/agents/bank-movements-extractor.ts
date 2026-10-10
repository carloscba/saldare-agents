import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { opencodeGoHeaders } from './opencode-headers';

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

export const bankMovementsExtractor = new Agent({
  id: 'bank-movements-extractor',
  name: 'Bank Movements Extractor',
  description:
    'Extrae los movimientos bancarios del markdown de un extracto procesado por LlamaCloud.',
  model: [
    {
      id: 'extractor',
      model: 'opencode-go/kimi-k2.7-code',
      headers: opencodeGoHeaders,
    },
  ],
  instructions: `Eres un extractor de movimientos bancarios. Recibes el markdown de un extracto bancario (producido por LlamaCloud) que contiene tablas HTML.

Tarea:
1. Identifica únicamente las tablas de movimientos (columnas FECHA, DESCRIPCION, REFERENCIA, DEBITOS, CREDITOS, SALDO).
   Ignora la tabla de "Información de su/s Cuenta/s" (TIPO CUENTA, SUCURSAL, MONEDA, CUENTA, CBU).
2. Para cada fila de movimiento, asóciala a su número de cuenta (NRO) tomado del encabezado previo
   (p. ej. "CUENTA CORRIENTE BANCARIA NRO.: 3-320-0941456600-5").
3. Consolida TODOS los movimientos de TODAS las tablas en un único arreglo "movimientos".
   - Excluye las filas de resumen (SALDO ULTIMO EXTRACTO, SALDO FINAL, TOTAL COBRADO...).
   - Si una fila trae fecha y descripción fusionadas en una celda (p. ej. "03/01/23 TELECOM ARG.STET-FRANCE SA"),
     sepáralas en "fecha" y "descripcion" respectivas.
   - Conserva las celdas vacías (referencia, debitos, creditos) sin inventar valores.
   - NO recalcules ni modifiques los valores de débitos, créditos ni saldo.
4. Si el markdown no contiene movimientos, devuelve "movimientos": [].
`,
});

export type MovimientoRow = z.infer<typeof movimientoRowSchema>;
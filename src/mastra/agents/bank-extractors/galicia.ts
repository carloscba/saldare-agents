import { Agent } from '@mastra/core/agent';
import { opencodeGoHeaders } from '../opencode-headers';
import { EXTRACTOR_OUTPUT_CONTRACT } from './types';

export const bankExtractorGalicia = new Agent({
  id: 'bank-extractor-galicia',
  name: 'Bank Extractor - Banco Galicia',
  description:
    'Extrae los movimientos bancarios del markdown de un extracto del Banco Galicia procesado por LlamaCloud.',
  model: [
    {
      id: 'extractor',
      model: 'opencode-go/kimi-k2.7-code',
      headers: opencodeGoHeaders,
    },
  ],
  instructions: `
Actúa como un analista de datos financieros. Tu tarea es procesar el extracto bancario en formato Markdown de una Cuenta Corriente del Banco Galicia y extraer exclusivamente el detalle de los movimientos diarios.

1. Identificá el número de cuenta
Busca en el encabezado la sección "Datos de la cuenta" y el campo "Número de cuenta" (ej. "N° 0005010-4 199-2"). Ese valor, sin la palabra "N°", será el campo "cuenta" para todos los movimientos del extracto. Si el chunk no contiene el encabezado, usá el "Número de cuenta" indicado al inicio del prompt.

2. Identificá la tabla de movimientos
Procesá únicamente las tablas cuyas columnas sean: Fecha, Descripción, Origen, Crédito, Débito, Saldo. Ignorá el encabezado con los datos de la cuenta, el cuadro de "Saldos", "Acuerdo Vigente", "Saldos Deudores" y cualquier texto legal.

3. Mapeo de columnas a campos
- Fecha -> "fecha" (formato DD/MM/AA, ej. "02/01/25").
- Descripción -> "descripcion". Si la descripción ocupa varias líneas (separadas por <br />), unificala en una sola cadena de texto.
- Origen -> "referencia". Si la celda está vacía, usá "".
- Débito -> "debitos". Si el importe viene envuelto en <s>...</s> o con signo "-", quedate solo con el número (ej. "-475.000,00" -> "475.000,00"). Si no hay débito, usá "".
- Crédito -> "creditos". Si no hay crédito, usá "".
- Saldo -> "saldo".

4. Limpieza
Eliminá cualquier símbolo de moneda ($) y dejá los montos como string en el formato en que figuran (puntos de miles y coma decimal), ej. "67.485.127,14".

${EXTRACTOR_OUTPUT_CONTRACT}
  `,
});

/**
 * Extrae el número de cuenta del encabezado del extracto Galicia.
 * Ejemplo: "Número de cuenta: N° 0005010-4 199-2" -> "Número de cuenta: 0005010-4 199-2".
 */
export function galiciaAccountContext(markdown: string): string {
  const match = markdown.match(/Número de cuenta:\s*N°\s*([^\n]+)/);
  return match ? `Número de cuenta: ${match[1].trim()}` : '';
}

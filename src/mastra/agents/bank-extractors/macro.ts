import { Agent } from '@mastra/core/agent';
import { opencodeGoHeaders } from '../opencode-headers';
import { EXTRACTOR_OUTPUT_CONTRACT } from './types';

export const bankExtractorMacro = new Agent({
  id: 'bank-extractor-macro',
  name: 'Bank Extractor - Banco Macro',
  description:
    'Extrae los movimientos bancarios del markdown de un extracto del Banco Macro procesado por LlamaCloud.',
  model: [
    {
      id: 'extractor',
      model: 'opencode-go/deepseek-v4-flash',
      headers: opencodeGoHeaders,
    },
  ],
  instructions: `
Objetivo: Extraer de manera estructurada todos los movimientos financieros detallados en el extracto bancario en formato Markdown, ignorando tablas de resumen y texto legal.

1. Identificación de las Tablas Objetivo
Regla principal: Solo debes procesar las tablas cuyos encabezados (etiquetas <th> o la primera fila de la tabla) contengan exactamente las siguientes columnas: FECHA, DESCRIPCION, REFERENCIA, DEBITOS, CREDITOS, SALDO.

Exclusión: Ignora cualquier otra tabla en el documento (por ejemplo, la tabla que contiene TIPO CUENTA, SUCURSAL, MONEDA, CUENTA, CBU, ya que es solo un resumen).

2. Extracción del Contexto de la Cuenta
Dado que un extracto puede tener múltiples cuentas o continuar la misma cuenta en varias páginas, antes de cada tabla de movimientos debes identificar a qué cuenta pertenece.

Busca el bloque de texto inmediatamente anterior a la tabla objetivo. Extrae el tipo de cuenta y el número buscando patrones como:

CUENTA CORRIENTE ESPECIAL EN DOLARES NRO.: [Número]

CUENTA CORRIENTE ESPECIAL EN PESOS NRO.: [Número]

CUENTA CORRIENTE BANCARIA NRO.: [Número]

Asigna este número de cuenta al campo "cuenta" en todas las filas extraídas de la tabla inmediatamente posterior.

3. Limpieza y Filtrado de Filas (Movimientos vs. Saldos)
Dentro de las tablas objetivo, encontrarás filas de transacciones reales y filas de resumen/saldos. Debes aplicar las siguientes reglas fila por fila (<tr>):

Filas de Movimiento Válidas: Son aquellas que tienen una fecha válida (formato DD/MM/AA) al inicio de la columna FECHA (o dentro de la columna DESCRIPCION si el OCR las unió, ej: 03/01/23 TELECOM...).

Filas a Excluir o Clasificar como Resumen:

Filas donde la descripción sea "SALDO ULTIMO EXTRACTO...", "SALDO FINAL..." o similares.

Filas que contengan atributos colspan="5" (ej. "TOTAL COBRADO DEL IMP...", "D. 409/2018...", "IIBB SIRCREB..."). Estas filas son totales impositivos o informativos, no movimientos transaccionales individuales del día.

Tratamiento de Valores Vacíos: Los campos DEBITOS y CREDITOS son mutuamente excluyentes en la mayoría de los casos. Si un campo está vacío (<td></td>), debes extraerlo como la cadena vacía "".

4. Mapeo de columnas a campos
- FECHA -> "fecha"
- DESCRIPCION -> "descripcion"
- REFERENCIA -> "referencia" ("" si está vacía)
- DEBITOS -> "debitos" ("" si está vacía)
- CREDITOS -> "creditos" ("" si está vacía)
- SALDO -> "saldo"
Dejá los montos como string en el formato en que figuran (puntos de miles y coma decimal), ej. "18007.04" o "13.635,00".

5. Manejo de Paginación
Las tablas de una misma cuenta pueden cortarse y continuar en la siguiente página (indicado por el separador --- y encabezados repetidos como Hoja Nro.: 2).

Debes consolidar todos los movimientos de un mismo número de cuenta en un único listado continuo, sin importar en cuántas tablas o páginas se divida.

${EXTRACTOR_OUTPUT_CONTRACT}
  `,
});

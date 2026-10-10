# Design: Bank Movements Extractor

## Resumen

Se modifica el agente `bankMovementsExtractor` para que, usando el modelo `opencode-go/kimi-k2.7-code`, extraiga los movimientos bancarios del markdown producido por `llamaCloudParse` (spec `llama-cloud-tool`) y devuelva una **lista estructurada y consolidada** de filas de movimiento de todas las tablas. Un **serializer determinista** (`movementsToCsv`) convierte esas filas en **un único CSV consolidado** (RFC 4180) que es el resultado final del workflow.

## Decisión de arquitectura: agente para extraer + serializer determinista para el CSV

La extracción de los movimientos requiere **razonamiento de LLM** porque el markdown de los extractos bancarios es irregular:

- Las filas de movimiento a veces tienen la fecha y la descripción fusionadas en una única celda (`<td>03/01/23 TELECOM ARG.STET-FRANCE SA</td>`).
- Las tablas contienen filas de resumen (`SALDO ULTIMO EXTRACTO`, `SALDO FINAL`, `TOTAL COBRADO`) que no son movimientos.
- Cada tabla de movimientos está precedida por un encabezado textual (`CUENTA CORRIENTE ... NRO.: 3-320-0941456600-5`) que la identifica, y puede haber varias cuentas/tablas por extracto.

Sin embargo, **escribir CSV exacto (RFC 4180) es frágil para un LLM** (escapado de comillas, separadores y saltos de línea), por lo que el LLM no genera el CSV: devuelve filas estructuradas tipadas con Zod y la serialización CSV se resuelve con una función determinista.

| Opción | Descripción | Veredicto |
|--------|-------------|-----------|
| Tool determinista | Parsear el HTML de las tablas con lógica imperativa. Frágil ante variaciones de formato y celdas fusionadas. | ❌ |
| Agente que escribe el CSV como texto libre | Riesgo de errores de escaping (RFC 4180) e inconsistencias de formato. | ❌ |
| **Agente con structured output (filas) + serializer TS** | El LLM normaliza y consolida en filas tipadas; una función determinista arma el CSV. Etapa de extracción robusta y CSV siempre válido. | ✅ Correcto |

El agente es el único punto de razonamiento; el workflow existente se limita a encadenar parseo → extracción → serialización CSV.

## Arquitectura

```mermaid
flowchart LR
    subgraph llamaCloudWorkflow
        A["input: filePath + opciones"] --> B["tool: llamaCloudUpload (upload)"]
        B -->|fileId| C["map: fileId + opciones"]
        C --> D["tool: llamaCloudParse (parse)"]
        D -->|markdown + text| E["map: prompt = markdown"]
        E --> F["agent: bankMovementsExtractor"]
        F -->|movimientos[]| G["map: movementsToCsv(movimientos)"]
        G -->|csv| H["output: { markdown, text, csv }"]
    end
    F -->|structuredOutput| I["Zod: extractorOutputSchema"]
```

## Dependencia

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `@mastra/core` | 1.75.0 (ya instalado) | API `Agent`, `Workflow.agent()` (`@mastra/core/workflows`) |
| `zod` | ^4.4.3 (ya instalado) | Esquemas de salida |

No se agregan dependencias nuevas: el serializer CSV es una función TypeScript pura (RFC 4180).

## Configuración

- **Modelo**: `opencode-go/kimi-k2.7-code` (verificado en el provider registry).
- **API key**: el provider `opencode-go` requiere la variable `OPENCODE_API_KEY` (endpoint `https://opencode.ai/zen/go/v1`). Se lee de entorno, nunca hardcodeada.
- **`.env.example`**: agregar `OPENCODE_API_KEY=`.
- El agente **no tiene tools ni workspace**: es una tarea pura de extracción, por lo que el structured output nativo del modelo aplica sin el conflicto tools + structured output.

## Agente: `bankMovementsExtractor`

Se modifica `src/mastra/agents/bank-movements-extractor.ts`:

```typescript
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

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
      model: 'opencode-go/kimi-k2.7-code',
      headers: {
        'x-opencode-session': process.env.OPENCODE_RUN_ID || 'saldare-session',
      },
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
```

### Justificación

- **`id`**: `bank-movements-extractor` (kebab-case, consistente con los ids de tools/workflow existentes).
- **Sin `memory` ni `workspace`**: no son necesarios para una extracción puntual y reducen latencia/costo.
- **`instructions` en español**: alineado con el contenido de los extractos y con las reglas del proyecto (artefactos en español).
- **`movementsToCsv` ubicado en el módulo del agente**: la "tarea de conversión a CSV" queda asociada al extractor, es determinista y no introduce dependencias.

## Salida estructurada (structured output)

Se define el esquema con Zod y se aplica como `structuredOutput` en el paso del workflow:

```typescript
import { z } from 'zod';

export const extractorOutputSchema = z.object({
  movimientos: z
    .array(
      z.object({
        cuenta: z.string().describe('Número de cuenta (NRO), p. ej. "3-320-0941456600-5".'),
        fecha: z.string().describe('Fecha del movimiento, p. ej. "03/01/23".'),
        descripcion: z.string().describe('Descripción del movimiento.'),
        referencia: z.string().describe('Referencia. Puede estar vacía.'),
        debitos: z.string().describe('Importe débito. Puede estar vacío.'),
        creditos: z.string().describe('Importe crédito. Puede estar vacío.'),
        saldo: z.string().describe('Saldo tal cual figura en el extracto.'),
      })
    )
    .describe('Todos los movimientos de todas las tablas, consolidados en un solo arreglo.'),
});
```

> Los valores monetarios y fechas se modelan como `string` para preservar el formato original del extracto (puntos separadores de miles, comas decimales y fechas `DD/MM/AA`) sin recalcular ni reformatear.

## Serialización CSV (`movementsToCsv`)

- Encabezado fijo: `CUENTA, FECHA, DESCRIPCION, REFERENCIA, DEBITOS, CREDITOS, SALDO`.
- Cada fila corresponde a un movimiento de la lista consolidada; el orden es el de `movimientos` (orden del extracto).
- Serialización RFC 4180: todos los campos se envuelven en comillas dobles y las comillas embebidas se escapan como `""`. Esto garantiza un CSV siempre válido aunque la descripción contenga comas, comillas o saltos de línea.
- Sin movimientos → solo el encabezado.

## Integración al workflow `llamaCloudWorkflow`

Se modifica `src/mastra/workflows/llama-cloud-workflow.ts`. El output final pasa de `{ markdown, text, movimientos }` a `{ markdown, text, csv }`:

```typescript
import { createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { llamaCloudUpload, llamaCloudParse } from '../tools/llama-cloud-tool';
import { bankMovementsExtractor } from '../agents/bank-movements-extractor';
import { extractorOutputSchema, movementsToCsv } from '../agents/bank-movements-extractor';

// ... inputSchema sin cambios (filePath + opciones) ...

export const llamaCloudWorkflow = createWorkflow({
  id: 'llama-cloud-workflow',
  inputSchema,
  outputSchema: z.object({
    markdown: z.string().describe('Contenido completo en markdown.'),
    text: z.string().describe('Contenido completo en texto plano.'),
    csv: z
      .string()
      .describe(
        'CSV consolidado (RFC 4180) con una fila por movimiento de todas las tablas: columnas CUENTA | FECHA | DESCRIPCION | REFERENCIA | DEBITOS | CREDITOS | SALDO.'
      ),
  }),
})
  .tool(llamaCloudUpload, {}, { id: 'upload' })
  .map(async ({ inputData, getInitData }) => ({
    fileId: inputData.fileId,
    tier: getInitData<InputType>().tier,
    version: getInitData<InputType>().version,
    expand: getInitData<InputType>().expand,
    pollingInterval: getInitData<InputType>().pollingInterval,
    timeout: getInitData<InputType>().timeout,
  }))
  .tool(llamaCloudParse, {}, { id: 'parse' })
  .map(async ({ inputData }) => ({
    prompt: `Extrae los movimientos bancarios del siguiente markdown:\n\n${inputData.markdown}`,
  }))
  .agent(bankMovementsExtractor, {
    structuredOutput: { schema: extractorOutputSchema },
  })
  .map(async ({ inputData, getStepResult }) => {
    const { markdown, text } = getStepResult<{ markdown: string; text: string }>('parse');
    return {
      markdown,
      text,
      csv: movementsToCsv(inputData.movimientos),
    };
  })
  .commit();
```

### Justificación del cambio en el pipeline

1. **`.agent(bankMovementsExtractor, { structuredOutput })`** — su output pasa a ser el shape de `extractorOutputSchema` (`{ movimientos }`), una lista consolidada de filas tipadas.
2. **`.map()` final** — recompone `markdown` y `text` (de `getStepResult('parse')`) y genera el **CSV consolidado** llamando `movementsToCsv(inputData.movimientos)`. El output expuesto es `{ markdown, text, csv }`.

> **Observabilidad**: el `fileId`/`name` de la subida y el `markdown` del parseo quedan disponibles en `run.steps` (`upload`, `parse`) sin contaminar el output final.

## Registro en `src/mastra/index.ts`

El agente ya está registrado; no requiere cambios:

```typescript
import { bankMovementsExtractor } from './agents/bank-movements-extractor';

export const mastra = new Mastra({
  // ...
  agents: { agent, bankMovementsExtractor },
  // ...
});
```

## Manejo de errores

- **markdown vacío o sin movimientos** → el agente devuelve `{ movimientos: [] }`; `movementsToCsv([])` devuelve el CSV con solo el encabezado y el workflow finaliza con éxito (Story 3 AC3).
- **API key faltante (`OPENCODE_API_KEY`)** → el model router lanza al invocar el modelo; el paso `agent` falla y el workflow termina con estado `failed`.
- **Validación de salida** → si el modelo no respeta el esquema, `structuredOutput` lanza (estrategia por defecto `strict`). Se puede mitigar con `jsonPromptInjection: 'auto'` si el modelo lo requiriera.

## Ubicación del código

```
src/mastra/
├── index.ts                              # registro del agente (sin cambios)
├── agents/
│   ├── agent.ts                          # existente
│   └── bank-movements-extractor.ts       # MODIFICADO: nuevo schema + movementsToCsv + instructions
├── workflows/
│   └── llama-cloud-workflow.ts           # MODIFICADO: output csv + movementsToCsv
└── tools/
    └── llama-cloud-tool.ts               # existente (sin cambios)
```

## Verificación

1. Compilación sin errores: `npx tsc --noEmit`.
2. Registro visible: `npx mastra api agent list --pretty` debe listar `bank-movements-extractor`.
3. Studio: el agente aparece en `http://localhost:4111` y el workflow `llama-cloud-workflow` muestra el grafo `upload → map → parse → map → agent → map`.
4. Prueba aislada del serializer: importar `movementsToCsv` con filas de ejemplo (tipo `data/table.csv`) y verificar encabezado, orden de columnas (CUENTA primero) y escape (RFC 4180).
5. Ejecución end-to-end con un PDF de prueba:
   ```bash
   npx mastra api workflow run start llama-cloud-workflow \
     '{"inputData":{"filePath":"ruta/al/documento.pdf"}}'
   ```
   Debe devolver `{ markdown, text, csv }`, donde `csv` es un CSV con el encabezado y una fila por movimiento de todas las tablas (consolidado).
6. Validar casos borde: extracto sin movimientos (CSV con solo encabezado), filas con fecha+descripción fusionadas (quedan separadas), filas de resumen (excluidas), varias cuentas (consolidadas con su `CUENTA`).
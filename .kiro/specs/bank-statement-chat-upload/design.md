# Design: Bank Statement Chat Upload

## Resumen

Se habilita el procesamiento de un extracto bancario (PDF) a partir de un adjunto en el chat del agente en Mastra Studio, sin perder el camino actual basado en `filePath`. La solución se basa en una **tool wrapper** (`processBankStatement`) que resuelve el archivo (desde argumentos o desde el adjunto del mensaje del usuario) y ejecuta el workflow existente `llamaCloudWorkflow`. A su vez, la tool de subida (`llamaCloudUpload`) y el workflow se amplían para aceptar el contenido del archivo como bytes (base64) además de una ruta local.

## Decisión de arquitectura: tool wrapper que reutiliza el workflow

Se evaluaron dos formas de atacar el problema:

| Opción | Descripción | Veredicto |
|--------|-------------|-----------|
| Agente orquesta tools individuales (`llamaCloudUpload` → `llamaCloudParse` → `extract`) | Agrega una tool de extracción y deja que el LLM decida la secuencia. Expone más pasos en el chat, pero duplica la lógica de extracción/CSV que ya vive en el workflow. | ❌ Duplicación |
| **Tool wrapper que ejecuta `llamaCloudWorkflow`** | Una sola tool (`processBankStatement`) resuelve el archivo y corre todo el workflow determinista. Reutiliza upload, parseo y extracción sin cambiar el workflow salvo ampliar su input. | ✅ Correcto |

El wrapper se ejecuta dentro del contexto del agente, por lo que puede leer el adjunto del mensaje vía `context.agent.getMessages()` y disparar el workflow vía `context.mastra.getWorkflow('llamaCloudWorkflow')`.

## Arquitectura

### Flujo del chat (adjunto)

```mermaid
flowchart LR
    U["Usuario arrastra PDF en Studio chat"] -->|experimental_attachments| A["Agente: agent"]
    A -->|tool call| P["tool: processBankStatement"]
    P -->|lee adjunto| R["utils/resolveAttachment"]
    P -->|start({ file })| W["workflow: llamaCloudWorkflow"]
    subgraph llamaCloudWorkflow
        W --> U2["tool: llamaCloudUpload"]
        U2 -->|fileId| M["map + tool: llamaCloudParse"]
        M -->|markdown| E["agent: bankMovementsExtractor"]
        E --> C["map: movementsToCsv"]
    end
    P -->|{ markdown, text, csv }| A
    A -->|responde CSV| U
```

### Flujo CLI / Studio Workflows (sin cambios de comportamiento)

```mermaid
flowchart LR
    CLI["CLI / Studio Workflows"] -->|{ filePath }| W["workflow: llamaCloudWorkflow"]
    W --> U["tool: llamaCloudUpload"]
    U -->|fileId| M["map + tool: llamaCloudParse"]
    M -->|markdown| E["agent: bankMovementsExtractor"]
    E --> C["map: movementsToCsv"]
    C -->|{ markdown, text, csv }| CLI
```

## Dependencias

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `@mastra/core` | 1.75.0 (ya instalado) | `createTool`, `ToolExecutionContext`, workflow/agent APIs |
| `@llamaindex/llama-cloud` | ^2.18.0 (ya instalado) | `toFile` para convertir base64 → `File` de LlamaCloud |
| `zod` | ^4.4.3 (ya instalado) | Esquemas de entrada/salida |

No se agregan dependencias nuevas.

## Cambios por archivo

### 1. `src/mastra/tools/llama-cloud-tool.ts`

`llamaCloudUpload` amplía su `inputSchema` para aceptar `file` o `filePath`:

```typescript
const fileInputSchema = z.object({
  name: z.string(),
  data: z.string().describe('Contenido del PDF codificado en base64.'),
});

export const llamaCloudUpload = createTool({
  inputSchema: z
    .object({
      filePath: z.string().optional().describe('Ruta local absoluta o relativa del PDF.'),
      file: fileInputSchema.optional().describe('PDF codificado en base64.'),
    })
    .refine((data) => data.filePath || data.file, {
      message: 'Debe proporcionar filePath o file.',
    }),
  // execute: elige fs.createReadStream o toFile(Buffer.from(data, 'base64'), ...)
});
```

### 2. `src/mastra/workflows/llama-cloud-workflow.ts`

`inputSchema` agrega `file` y mantiene `filePath` opcional:

```typescript
const inputSchema = z
  .object({
    filePath: z.string().optional().describe('Ruta local absoluta o relativa del PDF.'),
    file: z
      .object({
        name: z.string(),
        data: z.string().describe('Contenido del PDF codificado en base64.'),
      })
      .optional(),
    tier: z.enum([...]).optional(),
    version: z.string().optional(),
    expand: z.array(z.string()).optional(),
    pollingInterval: z.number().optional(),
    timeout: z.number().optional(),
  })
  .refine((data) => data.filePath || data.file, {
    message: 'Debe proporcionar filePath o file.',
  });
```

La cadena de pasos no cambia.

### 3. `src/mastra/utils/attachments.ts` (nuevo)

Helper `resolveUploadedFile(context)`:

1. Obtiene `messages = context.agent.getMessages() ?? []`.
2. Busca el último mensaje con `role === 'user'`.
3. Dentro de `message.content.experimental_attachments`, busca un adjunto PDF (`contentType === 'application/pdf'` o `name` termina en `.pdf`).
4. Si `url` empieza con `data:` → extrae la parte base64.
5. Si `url` es http(s) → `fetch(url)` → `ArrayBuffer` → base64.
6. Devuelve `{ name, data }` (base64) o lanza error descriptivo.

### 4. `src/mastra/tools/process-bank-statement.ts` (nuevo)

Tool `processBankStatement`:

```typescript
export const processBankStatement = createTool({
  id: 'process_bank_statement',
  inputSchema: z.object({
    filePath: z.string().optional(),
    file: z.object({ name: z.string(), data: z.string() }).optional(),
    tier: z.enum([...]).optional(),
    version: z.string().optional(),
    expand: z.array(z.string()).optional(),
    pollingInterval: z.number().optional(),
    timeout: z.number().optional(),
  }),
  outputSchema: z.object({ markdown: z.string(), text: z.string(), csv: z.string() }),
  execute: async (input, context) => {
    const resolvedFile = input.file || input.filePath
      ? input.file
      : await resolveUploadedFile(context.agent);
    const mastra = context.mastra;
    const workflow = mastra.getWorkflow('llamaCloudWorkflow');
    const run = await workflow.createRun();
    const result = await run.start({
      inputData: { ...input, file: resolvedFile },
    });
    if (result.status !== 'success') {
      throw new Error(result.error?.message ?? 'Workflow failed');
    }
    return result.result;
  },
});
```

> Nota: si `input.file` o `input.filePath` están presentes se usan directamente; si no, se resuelve el adjunto. Para `filePath`, el workflow recibe `filePath`; para `file` (base64), recibe `file`.

### 5. `src/mastra/index.ts`

Agregar `processBankStatement` a `tools`:

```typescript
import { processBankStatement } from './tools/process-bank-statement';

export const mastra = new Mastra({
  ...,
  tools: {
    ...,
    processBankStatement,
  },
});
```

### 6. `src/mastra/agents/agent.ts`

Agregar la tool al agente `agent` y actualizar `instructions`:

```typescript
tools: {
  ...,
  process_bank_statement: processBankStatement,
},
```

En `instructions`, añadir una sección similar a:

> "Cuando el usuario adjunte un PDF de extracto bancario, invoca la tool `process_bank_statement` (sin pasar `filePath` si hay un adjunto) para subirlo, parsearlo y extraer los movimientos en CSV. Devuelve el CSV al usuario."

## Manejo de errores

- Sin archivo válido: la tool wrapper lanza error antes de correr el workflow.
- Adjunto no PDF: error descriptivo.
- Workflow falla: el wrapper propaga `result.error.message`.
- `filePath` inexistente: `llamaCloudUpload` mantiene su error actual.

## Consideraciones de seguridad / rendimiento

- El contenido base64 viaja por el cuerpo del mensaje y luego al workflow. Para PDFs grandes, esto puede crecer el payload; es aceptable para el alcance actual (extractos bancarios de unos pocos MB).
- `toFile` no escribe a disco, solo construye un objeto `File` en memoria para el SDK de LlamaCloud.
- No se persiste el archivo en el servidor; se transmite directamente a LlamaCloud.

## Verificación

1. `npx tsc --noEmit` sin errores.
2. `npx mastra api workflow run start llama-cloud-workflow '{"inputData":{"filePath":"..."}}'` sigue funcionando.
3. En Studio, adjuntar PDF en el chat del agente y verificar que devuelve CSV.
4. Llamar a `process_bank_statement` con `file` base64 y verificar que devuelve CSV.

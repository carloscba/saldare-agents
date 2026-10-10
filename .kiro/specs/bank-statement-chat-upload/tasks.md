# Tasks: Bank Statement Chat Upload

## Task 1: Ampliar `llamaCloudUpload` para aceptar bytes

- [x] 1.1 Actualizar `inputSchema` de `llamaCloudUpload` en `src/mastra/tools/llama-cloud-tool.ts`
  - `filePath: z.string().optional()`
  - `file: z.object({ name: z.string(), data: z.string() }).optional()`
  - `.refine()` exigiendo `filePath || file`
- [x] 1.2 Actualizar `execute` para elegir la fuente del archivo
  - Si `filePath`: `fs.createReadStream(filePath)` (comportamiento actual)
  - Si `file`: `toFile(Buffer.from(data, 'base64'), name, { type: 'application/pdf' })` y subirlo
- [x] 1.3 Importar `toFile` desde `@llamaindex/llama-cloud`

## Task 2: Ampliar el input del workflow

- [x] 2.1 En `src/mastra/workflows/llama-cloud-workflow.ts`, actualizar `inputSchema`
  - `filePath` pasa a opcional
  - Agregar `file: { name, data }` opcional
  - `.refine()` exigiendo `filePath || file`
- [x] 2.2 Confirmar que los pasos `upload`, `map`, `parse`, `agent`, `map` final no requieren cambios de lógica (solo el upload recibe el input ampliado)

## Task 3: Crear helper de resolución de adjuntos

- [x] 3.1 Crear `src/mastra/utils/attachments.ts`
- [x] 3.2 Implementar `resolveUploadedFile(context)`:
  - Leer mensajes desde `context.agent.getMessages()`
  - Buscar último mensaje `user` con `experimental_attachments`
  - Seleccionar adjunto PDF por `contentType` o extensión `.pdf`
  - Normalizar data URL o URL alojada a `{ name, data }` (base64)
  - Lanzar errores descriptivos cuando no hay adjunto

## Task 4: Crear tool `processBankStatement`

- [x] 4.1 Crear `src/mastra/tools/process-bank-statement.ts`
- [x] 4.2 Definir `inputSchema` con `filePath?`, `file?` y opciones de parseo
- [x] 4.3 Definir `outputSchema: { markdown, text, csv }`
- [x] 4.4 En `execute`:
  - Resolver archivo: explícito (`file`/`filePath`) o adjunto desde contexto
  - Obtener workflow vía `context.mastra.getWorkflow('llamaCloudWorkflow')`
  - Crear run y ejecutar `.start({ inputData })`
  - Devolver `result.result` o lanzar error del workflow

## Task 5: Registrar la tool y actualizar el agente

- [x] 5.1 Importar y registrar `processBankStatement` en `src/mastra/index.ts` dentro de `tools`
- [x] 5.2 Importar y agregar `process_bank_statement` a las `tools` del agente `agent` en `src/mastra/agents/agent.ts`
- [x] 5.3 Actualizar `instructions` del agente `agent` para:
  - Detectar un PDF adjunto de extracto bancario
  - Invocar `process_bank_statement`
  - Devolver el CSV resultante al usuario

## Task 6: Verificar

- [x] 6.1 Compilación sin errores: `npx tsc --noEmit`
- [ ] 6.2 Regresión CLI con `filePath`: `npx mastra api workflow run start llama-cloud-workflow '{"inputData":{"filePath":"..."}}'`
- [ ] 6.3 Prueba CLI/workflow con `file` base64
- [ ] 6.4 Prueba end-to-end en Studio: adjuntar PDF en el chat del agente y verificar CSV
- [ ] 6.5 Validar casos borde:
  - Sin `filePath` ni `file` ni adjunto → error descriptivo
  - Adjunto no PDF → error descriptivo
  - `filePath` inexistente → error actual de `llamaCloudUpload`

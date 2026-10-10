# Tasks: LlamaCloud Tool

## Task 1: Instalar dependencia

- [x] 1.1 Agregar `@llamaindex/llama-cloud` a `package.json`
  - `npm install @llamaindex/llama-cloud`
- [x] 1.2 Verificar que la dependencia aparece en `node_modules`

## Task 2: Crear el archivo de tools

- [x] 2.1 Crear `src/mastra/tools/llama-cloud-tool.ts`
- [x] 2.2 Instanciar el cliente compartido `new LlamaCloud({ apiKey: process.env.LLAMA_CLOUD_API_KEY })`
  - Validación lazy (`getClient()`) para no romper el build si falta la env var.
- [x] 2.3 Implementar `llamaCloudUpload` (sube PDF y devuelve `fileId`)
  - Valida que el archivo existe antes de subirlo.
- [x] 2.4 Implementar `llamaCloudParse` (parsea `fileId` y devuelve `markdown`/`text`)
  - Soporte para `tier`, `version`, `expand`, `pollingInterval`, `timeout`.

## Task 3: Registrar las tools

- [x] 3.1 Importar `llamaCloudUpload` y `llamaCloudParse` en `src/mastra/index.ts`
- [x] 3.2 Agregarlas al objeto `tools` del `Mastra` constructor
- [x] 3.3 Importarlas en `src/mastra/agents/agent.ts`
- [x] 3.4 Agregarlas al objeto `tools` del agente

## Task 4: Configurar entorno

- [x] 4.1 Agregar `LLAMA_CLOUD_API_KEY=llx-...` a `.env.example`
- [ ] 4.2 Documentar en `README.md` (opcional) el uso de las nuevas tools

## Task 5: Verificar

- [x] 5.1 Verificar compilación sin errores de tipos
  - `npm run build` bloqueado porque hay un dev server corriendo (PID 8825).
  - `npx tsc --noEmit` ejecutado con éxito.
- [x] 5.2 Confirmar que las tools aparecen registradas
  - `npx mastra api tool list --pretty` muestra `llama_cloud_upload` y `llama_cloud_parse`.
- [ ] 5.3 Probar manualmente con un PDF de ejemplo: upload → parse → obtener markdown/texto
  - Requiere `LLAMA_CLOUD_API_KEY` válida y un PDF de prueba.

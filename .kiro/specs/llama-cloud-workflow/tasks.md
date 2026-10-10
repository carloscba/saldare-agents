# Tasks: LlamaCloud Workflow

## Task 1: Crear el archivo del workflow

- [x] 1.1 Crear `src/mastra/workflows/llama-cloud-workflow.ts`
- [x] 1.2 Definir el `inputSchema` del workflow con Zod (`filePath` obligatorio; `tier`, `version`, `expand`, `pollingInterval`, `timeout` opcionales)
- [x] 1.3 Definir el `outputSchema` del workflow (`markdown` y `text`)
- [x] 1.4 Componer el paso declarativo `.tool(llamaCloudUpload, {}, { id: 'upload' })`
- [x] 1.5 Agregar el paso `.map()` que propaga `fileId` (del paso anterior) y las opciones opcionales desde `getInitData()`
- [x] 1.6 Componer el paso declarativo `.tool(llamaCloudParse, {}, { id: 'parse' })`
- [x] 1.7 Cerrar la cadena con `.commit()` y exportar `llamaCloudWorkflow`

## Task 2: Registrar el workflow

- [x] 2.1 Importar `llamaCloudWorkflow` en `src/mastra/index.ts`
- [x] 2.2 Agregarlo al objeto `workflows` del constructor `Mastra`
- [x] 2.3 No modificar `src/mastra/agents/agent.ts` (el flujo no requiere agentes; opcionalmente puede invocarse vía `mastra.getWorkflow`)

## Task 3: Verificar

- [x] 3.1 Verificar compilación sin errores de tipos
  - `npx tsc --noEmit`
- [x] 3.2 Confirmar que el workflow aparece registrado
  - `npx mastra api workflow list --pretty` lista `llama-cloud-workflow`
- [x] 3.3 Confirmar que el workflow aparece en el tab **Workflows** de Mastra Studio en `http://localhost:4111`
- [x] 3.4 Probar manualmente con un PDF de ejemplo (upload → parse → markdown/texto)
  - Requiere `LLAMA_CLOUD_API_KEY` válida y un PDF de prueba
  - `npx mastra api workflow run start llama-cloud-workflow '{"inputData":{"filePath":"ruta/al/documento.pdf"}}'`
- [x] 3.5 Validar el manejo de errores: `filePath` inexistente devuelve estado `failed` con mensaje descriptivo; API key ausente está cubierto por el error lanzado desde `llamaCloudUpload`
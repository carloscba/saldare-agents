# Requirements: LlamaCloud Workflow

## Overview

Este documento especifica los requerimientos para crear un workflow de Mastra que procesa un archivo PDF mediante LlamaCloud de principio a fin: sube el archivo con la tool `llamaCloudUpload` y lo parsea con la tool `llamaCloudParse`, en un único flujo orquestado. Reutiliza las tools ya existentes de la spec `llama-cloud-tool` sin duplicar su lógica.

## User Stories

### Story 1: Procesar un PDF completo con un solo input

**As a** developer
**I want** ejecutar un workflow de Mastra que reciba la ruta local de un PDF
**So that** el sistema suba el archivo a LlamaCloud y lo parsea, devolviendo el markdown y el texto plano

#### Acceptance Criteria

1. When el workflow recibe un `filePath` válido, the system shall ejecutar la tool `llamaCloudUpload` para subir el PDF y obtener su `fileId`.
2. When la subida es exitosa, the system shall ejecutar la tool `llamaCloudParse` con ese `fileId` y esperar la finalización del parseo.
3. When el parseo finaliza correctamente, the system shall retornar el `markdown` y el `text` extraídos del documento.
4. When el `filePath` no existe o no es legible, the system shall fallar el workflow con un error descriptivo.

### Story 2: Configurar opciones de parseo

**As a** developer
**I want** pasar opciones de parseo configurables al workflow (`tier`, `version`, `expand`, `pollingInterval`, `timeout`)
**So that** pueda controlar el nivel de calidad y el comportamiento de polling del parseo

#### Acceptance Criteria

1. When el workflow recibe `tier`, the system shall pasarlo a la tool `llamaCloudParse`, respetando los valores válidos (`fast`, `cost_effective`, `agentic`, `agentic_plus`).
2. When el workflow recibe `version`, `expand`, `pollingInterval` o `timeout`, the system shall pasarlos a la tool `llamaCloudParse`.
3. When no se especifican opciones, the system shall usar los valores por defecto de la tool `llamaCloudParse` (`tier: 'cost_effective'`, `expand: ['markdown_full', 'text_full']`).

### Story 3: Reutilizar las tools existentes

**As a** developer
**I want** que el workflow componga las tools `llamaCloudUpload` y `llamaCloudParse` ya registradas
**So that** no se duplique lógica de negocio y la arquitectura se mantenga consistente con la spec `llama-cloud-tool`

#### Acceptance Criteria

1. The workflow shall importar y usar las tools directamente desde `src/mastra/tools/llama-cloud-tool.ts`.
2. The workflow shall capturar el `fileId` devuelto por la subida y pasarlo a la tool de parseo mediante un paso de mapeo.
3. The workflow expose los resultados del paso de subida (`fileId`, `name`) en `run.steps` para observabilidad, sin requerirlos en el output.

### Story 4: Ejecutar el workflow desde Studio y CLI

**As a** developer
**I want** poder iniciar el workflow desde Mastra Studio o la CLI
**So that** pueda probarlo y verificar cada paso sin escribir código adicional

#### Acceptance Criteria

1. When el dev server está corriendo, the system shall mostrar el workflow en el tab **Workflows** de Mastra Studio en `http://localhost:4111`.
2. When se ejecuta el workflow con un `inputData` que cumple el `inputSchema`, the system shall visualizar en tiempo real el estado de cada paso (upload → parse).
3. When se ejecuta `npx mastra api workflow run start llama-cloud-workflow '{"inputData":{"filePath":"..."}}'`, the system shall ejecutar el workflow y devolver el resultado.

## Non-Functional Requirements

1. El workflow debe registrar sus pasos con la API de `@mastra/core/workflows` (`createWorkflow`, `.tool()`, `.map()`, `.commit()`).
2. Los esquemas de entrada y salida del workflow deben definirse con Zod, reutilizando los schemas de las tools existentes.
3. El `inputSchema` del workflow debe ser compatible con el `inputSchema` de la tool `llamaCloudUpload` (el `filePath` es el único campo obligatorio).
4. El `outputSchema` del workflow debe coincidir con el `outputSchema` de la tool `llamaCloudParse` (`markdown` y `text`).
5. El workflow debe registrarse en `src/mastra/index.ts` siguiendo el patrón existente, en el objeto `workflows`.
6. La API key de LlamaCloud (`LLAMA_CLOUD_API_KEY`) debe seguir leyéndose desde variables de entorno mediante el cliente compartido de las tools; el workflow no debe hardcodearla.
7. El workflow no debe requerir agentes nuevos: el flujo es determinista y se compone únicamente de tools.
8. La verificación de tipos (`npx tsc --noEmit`) debe completarse sin errores.
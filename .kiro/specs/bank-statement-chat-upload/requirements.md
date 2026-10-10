# Requirements: Bank Statement Chat Upload

## Overview

Este documento especifica los requerimientos para habilitar la carga de un extracto bancario (PDF) directamente desde el chat del agente en Mastra Studio, de forma que el usuario pueda adjuntar el archivo en lugar de proveer una ruta local. El flujo se apoya en el workflow existente `llamaCloudWorkflow` (spec `llama-cloud-workflow`) mediante una tool wrapper `processBankStatement` que lo invoca, manteniendo la compatibilidad con la ruta local `filePath` para los usos de CLI y Studio (tab Workflows).

## User Stories

### Story 1: Subir un PDF a partir de su contenido (bytes)

**As a** developer
**I want** que la tool `llamaCloudUpload` acepte el contenido del PDF (nombre + datos en base64) además de la ruta local
**So that** el archivo pueda subirse a LlamaCloud sin requerir un archivo en el sistema de archivos del servidor

#### Acceptance Criteria

1. When la tool recibe `filePath`, the system shall mantener el comportamiento actual: leer el archivo del disco y subirlo con `purpose: "parse"`.
2. When la tool recibe `file` (objeto con `name` y `data` base64), the system shall construir el archivo a partir de esos bytes y subirlo con `purpose: "parse"`.
3. When la tool no recibe `filePath` ni `file`, the system shall fallar con un error descriptivo.
4. The system shall devolver `{ fileId, name }` en ambos casos.

### Story 2: Aceptar archivo subido en el workflow

**As a** developer
**I want** que el `inputSchema` del workflow `llamaCloudWorkflow` acepte `file` además de `filePath`
**So that** el workflow pueda procesar un PDF subido como contenido sin una ruta local

#### Acceptance Criteria

1. When el workflow recibe `filePath`, the system shall mantener el flujo actual (`upload → parse → extract → csv`).
2. When el workflow recibe `file`, the system shall ejecutar el mismo flujo usando el contenido del archivo.
3. When no se especifica ni `filePath` ni `file`, the system shall fallar la validación de entrada.

### Story 3: Procesar un extracto desde el chat con una tool wrapper

**As a** developer
**I want** una tool `processBankStatement` que invoque el workflow `llamaCloudWorkflow` de principio a fin
**So that** el agente del chat pueda procesar un PDF y devolver el CSV sin duplicar la lógica del workflow

#### Acceptance Criteria

1. The system shall definir `processBankStatement` en un archivo bajo `src/mastra/tools/`.
2. When la tool recibe `file` o `filePath`, the system shall ejecutar `mastra.getWorkflow('llamaCloudWorkflow')` con esos datos y devolver `{ markdown, text, csv }`.
3. When la tool recibe opciones de parseo (`tier`, `version`, `expand`, `pollingInterval`, `timeout`), the system shall reenviarlas al workflow.
4. The system shall acceder a la instancia Mastra a través del contexto de ejecución de la tool (`context.mastra`) para resolver el workflow.

### Story 4: Resolver el adjunto PDF desde el contexto del agente

**As a** developer
**I want** que, si la tool no recibe `file` ni `filePath`, obtenga el PDF desde el adjunto del último mensaje del usuario
**So that** el usuario pueda simplemente arrastrar el PDF en el chat sin escribir rutas ni manualmente codificar el archivo

#### Acceptance Criteria

1. When el usuario adjunta un PDF en el chat, the system shall localizar el adjunto en `experimental_attachments` del último mensaje `user` mediante `context.agent.getMessages()`.
2. When el adjunto es una data URL (`data:...;base64,...`), the system shall decodificarlo a base64.
3. When el adjunto es una URL alojada, the system shall descargarlo y codificarlo a base64.
4. When no hay adjunto PDF disponible, the system shall fallar con un error descriptivo.

### Story 5: Habilitar la tool en el agente del chat

**As a** developer
**I want** que `processBankStatement` esté registrado en la instancia Mastra y disponible para el agente del chat
**So that** el usuario pueda procesar un extracto conversando con el agente en Studio

#### Acceptance Criteria

1. The system shall registrar `processBankStatement` en `src/mastra/index.ts` dentro del objeto `tools`.
2. The system shall agregar la tool al agente `agent` (`src/mastra/agents/agent.ts`) y describir en sus `instructions` que, ante un PDF de extracto adjunto, debe invocar `process_bank_statement` y devolver el CSV.
3. When el dev server está corriendo, the system shall permitir adjuntar un PDF en el chat de Studio en `http://localhost:4111` y obtener el CSV de movimientos.

### Story 6: Mantener la compatibilidad con `filePath`

**As a** developer
**I want** que el camino existente basado en `filePath` siga funcionando
**So that** los usos actuales (CLI, tab Workflows de Studio) no se rompan

#### Acceptance Criteria

1. When se ejecuta `npx mastra api workflow run start llama-cloud-workflow '{"inputData":{"filePath":"..."}}'`, the system shall devolver el resultado incluyendo el CSV.
2. When el workflow recibe `file` en lugar de `filePath`, the system shall devolver el mismo resultado.
3. The system shall no alterar el `outputSchema` del workflow.

## Non-Functional Requirements

1. La tool `processBankStatement` debe reutilizar el workflow existente `llamaCloudWorkflow` y no duplicar la lógica de subida, parseo o extracción.
2. La tool `llamaCloudUpload` debe reutilizar el cliente de LlamaCloud compartido y no hardcodear credenciales.
3. Los esquemas de entrada/salida deben definirse con Zod.
4. La lectura del adjunto debe encapsularse en un helper reutilizable (p. ej. `src/mastra/utils/`).
5. Todos los nuevos recursos (tool) deben registrarse en `src/mastra/index.ts` siguiendo el patrón existente.
6. No se deben agregar dependencias nuevas; se usará `toFile` y `File` de `@llamaindex/llama-cloud` y `node:buffer`.
7. La verificación de tipos (`npx tsc --noEmit`) debe completarse sin errores.
8. El contenido de los artefactos de la spec (requirements, design, tasks) debe estar en español.

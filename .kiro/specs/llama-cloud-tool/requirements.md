# Requirements: LlamaCloud Tool

## Overview

Este documento especifica los requerimientos para crear dos tools de Mastra que permiten procesar archivos PDF mediante LlamaCloud: una para subir el archivo y otra para parsearlo. LlamaCloud es la plataforma de procesamiento de documentos de LlamaIndex que convierte PDFs en texto plano y markdown estructurado.

## User Stories

### Story 1: Subir un PDF a LlamaCloud

**As a** developer
**I want** ejecutar una tool de Mastra que tome la ruta local de un PDF y lo suba a LlamaCloud
**So that** obtenga un `fileId` reutilizable para parsearlo después

#### Acceptance Criteria

1. When la tool recibe un `filePath` válido, the system shall leer el archivo del disco y subirlo a LlamaCloud con `purpose: "parse"`.
2. When la subida es exitosa, the system shall retornar el `fileId` generado por LlamaCloud.
3. When el `filePath` no existe o no es legible, the system shall lanzar un error descriptivo.
4. When la API key no está configurada, the system shall lanzar un error indicando que falta `LLAMA_CLOUD_API_KEY`.

### Story 2: Parsear un archivo ya subido

**As a** developer
**I want** ejecutar una tool de Mastra que tome un `fileId` y lo parse con opciones configurables
**So that** obtenga el markdown y el texto plano del documento

#### Acceptance Criteria

1. When la tool recibe un `fileId` válido, the system shall invocar el parseo de LlamaCloud (submit + poll + get) y esperar su finalización.
2. When el parseo finaliza correctamente, the system shall retornar el `markdown` y el `text` extraídos.
3. When el parseo falla o es cancelado (estado `FAILED` o `CANCELLED`), the system shall lanzar un error.
4. When se especifican opciones (`tier`, `version`, `expand`, `pollingInterval`, `timeout`), the system shall respetarlas en la llamada.

### Story 3: Re-parsear sin re-subir

**As a** developer
**I want** poder parsear el mismo `fileId` varias veces con opciones distintas
**So that** pueda comparar resultados sin subir el archivo de nuevo

#### Acceptance Criteria

1. When las tools están separadas (upload vs parse), the system shall permitir ejecutar parse múltiples veces sobre el mismo `fileId`.
2. The tool de parse no debe requerir el `filePath`; solo el `fileId`.

## Non-Functional Requirements

1. La API key de LlamaCloud (`LLAMA_CLOUD_API_KEY`) debe leerse desde variables de entorno, nunca hardcodearse en el código.
2. Las tools deben registrarse en `src/mastra/index.ts` siguiendo el patrón existente (`startScheduleTool`, `stopScheduleTool`).
3. Los esquemas de entrada/salida deben definirse con Zod, siguiendo la API `createTool` de `@mastra/core/tools`.
4. La dependencia `@llamaindex/llama-cloud` debe agregarse a `package.json`.

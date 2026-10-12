# Requirements: Movement Categorization

## Overview

Este documento especifica el requerimiento para agregar al workflow `llamaCloudWorkflow` un paso de **categorización automática** de movimientos bancarios. Posterior a la extracción de movimientos (spec `bank-extractor-registry`) y antes de escribir el CSV final, cada movimiento debe clasificarse en una categoría contable cerrada. El CSV con la columna `CATEGORIA` debe guardarse en disco como una nueva versión del archivo con el sufijo `_categorias`.

Las categorías deben vivir en un **módulo centralizado** para facilitar su reutilización en otros agentes, tools o workflows futuros.

## User Stories

### Story 1: Categorías centralizadas

**As a** developer
**I want** que la lista de categorías contables sea una única fuente de verdad
**So that** pueda reutilizarse desde el agente categorizador, el serializer CSV y cualquier futuro consumidor

#### Acceptance Criteria

1. The system shall crear el módulo `src/mastra/categories.ts` con el arreglo `movementCategories` que contenga las siguientes 16 categorías: `Bonificaciones`, `Cheques emitidos`, `Cobro de cheques`, `Comisiones`, `Compras`, `Efectivo`, `Impuestos`, `Inversiones`, `Pagos a proveedores`, `Seguros`, `Servicios`, `Tarjetas`, `Transferencias propias`, `Transferencias recibidas`, `Ventas`, `Desconocida`.
2. The system shall derivar de `movementCategories` el tipo `MovementCategory` y el esquema Zod `movementCategorySchema`.
3. The system shall **no** hardcodear la lista de categorías en el prompt del agente ni en el serializer CSV.

### Story 2: Agente categorizador

**As a** developer
**I want** un agente de Mastra especializado en clasificar movimientos bancarios
**So that** la categorización sea una unidad observable, reusable y testeable en Mastra Studio

#### Acceptance Criteria

1. The system shall crear el agente `movement-categorizer` bajo `src/mastra/agents/bank-extractors/categorizer.ts`.
2. The agent shall usar el modelo `opencode-go/deepseek-v4-flash` con los headers `opencodeGoHeaders`.
3. The system shall definir un esquema de salida estructurada (`categorizerOutputSchema`) con movimientos que extiendan `movimientoRowSchema` agregando el campo `categoria: movementCategorySchema`.
4. The agent shall recibir los movimientos extraídos y devolverlos en el mismo orden con la categoría asignada a cada uno.
5. When el agente no puede determinar la categoría de un movimiento, the system shall asignar `Desconocida`.

### Story 3: Categorización como paso del workflow

**As a** developer
**I want** que `llamaCloudWorkflow` ejecute la categorización como un paso declarativo posterior al extractor de banco
**So that** quede visible en el grafo y sea trazable junto con el resto del pipeline

#### Acceptance Criteria

1. The system shall agregar un paso `movement-categorizer` (creado con `createStep`) después del `.branch()` de extractores y antes del paso de escritura del CSV.
2. The step shall recibir como input `{ movimientos: MovimientoRow[] }` (reshaped desde la salida de la rama ejecutada).
3. The step shall usar el helper `categorizeMovements` para clasificar los movimientos en lotes, manteniendo el orden y la cantidad de filas.
4. The system shall manejar el caso de lista vacía: `categorizeMovements([])` devuelve `{ movimientos: [] }` sin llamar al modelo.
5. The system shall reconciliar lotes cuyo modelo devuelva menos filas de las esperadas, completando las filas faltantes con la categoría `Desconocida` y preservando el orden.

### Story 4: CSV categorizado en disco

**As a** user
**I want** que el workflow genere y guarde un archivo CSV con la columna `CATEGORIA`
**So that** tenga una versión categorizada del extracto lista para usar

#### Acceptance Criteria

1. The system shall generar el CSV categorizado con la función `categorizedMovementsToCsv`, que respete el formato RFC 4180 y agregue la columna `CATEGORIA` al final del encabezado (`CUENTA,FECHA,DESCRIPCION,REFERENCIA,DEBITOS,CREDITOS,SALDO,CATEGORIA`).
2. The system shall escribir el archivo en disco con nombre `<base>_categorias.csv`, donde `<base>` se deriva del nombre del archivo de entrada sin extensión.
3. When el input es `filePath`, the system shall escribir el archivo en el mismo directorio que el PDF.
4. When el input es `file` (base64), the system shall escribir el archivo en la carpeta `workspace/` de Mastra (raíz del proyecto), usando `file.name`.
5. The system shall mantener el CSV original (sin categoria) como string en el output del workflow.

### Story 5: Tool `processBankStatement` expone el resultado categorizado

**As a** developer
**I want** que la tool wrapper `processBankStatement` refleje los nuevos outputs
**So that** los consumidores del chat/CLI reciban tanto el CSV como la ruta del archivo guardado

#### Acceptance Criteria

1. The system shall actualizar el `outputSchema` de `processBankStatement` para incluir `csvCategorias` (string) y `csvCategoriasPath` (string).
2. The system shall actualizar la descripción de la tool para mencionar el CSV categorizado y su archivo `*_categorias.csv`.
3. The `execute` no requiere cambios lógicos; sigue devolviendo `result.result` del workflow.

### Story 6: Registro y verificación

**As a** developer
**I want** que el nuevo agente esté registrado y que la solución compile
**So that** pueda ejecutarse desde Studio y CLI sin errores

#### Acceptance Criteria

1. The system shall registrar `movementCategorizer` en `src/mastra/index.ts` dentro del objeto `agents`.
2. The system shall compilar sin errores con `npx tsc --noEmit`.
3. When se ejecuta el workflow end-to-end, the system shall devolver `{ markdown, text, csv, csvCategorias, csvCategoriasPath }` y el archivo `<base>_categorias.csv` debe existir en disco.

## Non-Functional Requirements

1. El agente categorizador debe usar el modelo `opencode-go/deepseek-v4-flash` (verificado en el provider registry).
2. Las categorías deben modelarse con Zod y usarse como structured output.
3. El CSV categorizado debe generarse con el serializer determinista TypeScript (RFC 4180), sin dependencias nuevas.
4. La categorización debe procesarse por lotes para evitar exceder el contexto del modelo cuando hay muchos movimientos.
5. No se deben hardcodear credenciales ni claves de API en el código.
6. La verificación de tipos (`npx tsc --noEmit`) debe completarse sin errores.
7. El contenido de los artefactos de la spec (requirements, design, tasks) debe estar en español.

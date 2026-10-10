# Requirements: Bank Movements Extractor

## Overview

Este documento especifica los requerimientos para crear un agente de Mastra que extrae los movimientos bancarios del markdown producido por `llamaCloudParse` (spec `llama-cloud-tool`). El agente utiliza el modelo `opencode-go/kimi-k2.7-code` y se integra al workflow existente `llamaCloudWorkflow` (spec `llama-cloud-workflow`), tomando el markdown devuelto por la tool de parseo.

El resultado final es **un único CSV consolidado** con una fila por movimiento de todas las tablas extraídas, incluyendo el número de cuenta como primera columna.

## User Stories

### Story 1: Extraer los movimientos de todas las tablas del markdown

**As a** developer
**I want** un agente que reciba el markdown producido por `llamaCloudParse` y extraiga los movimientos bancarios de todas las tablas
**So that** obtenga una única lista consolidada de movimientos provenientes de todas las cuentas (columnas `CUENTA`, `FECHA`, `DESCRIPCION`, `REFERENCIA`, `DEBITOS`, `CREDITOS`, `SALDO`)

#### Acceptance Criteria

1. When el agente recibe un markdown que contiene tablas de movimientos bancarios, the system shall extraer cada fila de movimiento y consolidarla en una sola lista, una fila por movimiento.
2. When el markdown contiene la tabla de "Información de su/s Cuenta/s" (TIPO CUENTA, SUCURSAL, MONEDA, CUENTA, CBU), the system shall no incluirla como movimientos; solo las filas de las tablas con columnas de movimientos.
3. When una tabla de movimientos no contiene filas de movimiento, the system shall omitirla de la consolidación.
4. When el extracto contiene varias tablas de movimientos (una por cuenta), the system shall consolidar todos los movimientos en una sola salida sin perder la asociación a su número de cuenta (`CUENTA`).

### Story 2: Normalizar filas y excluir resúmenes

**As a** developer
**I want** que los movimientos extraídos contengan únicamente movimientos reales, con celdas normalizadas
**So that** los datos queden listos para su procesamiento posterior sin filas de resumen ni celdas fusionadas

#### Acceptance Criteria

1. When una tabla contiene filas de resumen (`SALDO ULTIMO EXTRACTO`, `SALDO FINAL`, `TOTAL COBRADO DEL IMP.S/CREDS. Y DEBS.`), the system shall excluirlas de la salida.
2. When una fila presenta la fecha y la descripción fusionadas en una única celda (p. ej. `<td>03/01/23 TELECOM ARG.STET-FRANCE SA</td>`), the system shall separarlas en sus columnas `FECHA` y `DESCRIPCION` respectivas.
3. When una fila de movimiento tiene celdas vacías (debitos o créditos), the system shall preservar la estructura de columnas con la celda vacía, sin inventar valores.
4. The system shall conservar la columna `SALDO` tal como aparece en el extracto, sin recalcularla.
5. The system shall asociar cada movimiento a su número de cuenta (NRO) tomado del encabezado previo a cada tabla (p. ej. `CUENTA CORRIENTE BANCARIA NRO.: 3-320-0941456600-5`).

### Story 3: Devolver un único CSV consolidado

**As a** developer
**I want** que la salida final sea un CSV consolidado de todos los movimientos extraídos
**So that** el resultado sea directamente consumible por sistemas de procesamiento posterior (una fila por movimiento de todas las tablas)

#### Acceptance Criteria

1. When hay uno o más movimientos extraídos, the system shall devolver un CSV con fila de encabezado `CUENTA,FECHA,DESCRIPCION,REFERENCIA,DEBITOS,CREDITOS,SALDO` y una fila por movimiento de todas las tablas.
2. The system shall generar el CSV de forma determinista a partir de las filas estructuradas extraídas (serialización RFC 4180: campos entrecomillados y comillas embebidas escapadas como `""`), no por texto libre del LLM.
3. When no hay movimientos extraídos (markdown vacío o sin movimientos), the system shall devolver un CSV con únicamente el encabezado, sin fallar el workflow.
4. The system shall conservar los valores monetarios y las fechas tal como aparecen en el extracto, sin recalcularlos ni reformatearlos.

### Story 4: Integrarse al workflow `llamaCloudWorkflow`

**As a** developer
**I want** que el agente extractor se incorpore al workflow existente `llamaCloudWorkflow` como paso posterior al parseo
**So that** un único flujo procese el PDF y devuelva tanto el markdown parseado como el CSV consolidado de movimientos

#### Acceptance Criteria

1. When el workflow ejecuta el paso `parse` de `llamaCloudParse`, the system shall alimentar al agente extractor con el campo `markdown` de su salida (mediante un paso `map` o equivalente).
2. When el agente finaliza, the system shall exponer el CSV consolidado como parte del resultado del workflow.
3. The workflow `llamaCloudWorkflow` shall incorporar el paso de agente con la API declarativa `.agent()` de `@mastra/core/workflows`.
4. When el `markdown` está vacío o no contiene tablas de movimientos, the system shall devolver un CSV con solo el encabezado sin fallar el workflow.

### Story 5: Registrar y ejecutar el agente

**As a** developer
**I want** que el agente esté registrado en la instancia Mastra y sea ejecutable desde Studio y CLI
**So that** pueda probarlo y verificarlo sin escribir código adicional

#### Acceptance Criteria

1. The system shall definir el agente en un archivo bajo `src/mastra/agents/` (p. ej. `bank-movements-extractor.ts`) con su `id`, `name` e `instructions`.
2. The system shall registrar el agente en `src/mastra/index.ts` dentro del objeto `agents`.
3. When el dev server está corriendo, the system shall mostrar el agente en Mastra Studio en `http://localhost:4111`.
4. When se ejecuta `npx mastra api workflow run start llama-cloud-workflow '{"inputData":{"filePath":"..."}}'`, the system shall devolver el resultado incluyendo el CSV consolidado de movimientos.

## Non-Functional Requirements

1. El agente debe usar el modelo `opencode-go/kimi-k2.7-code` (provisto por el model router de Mastra; verificado en el provider registry).
2. La salida del agente debe definirse con Zod y devolverse como structured output (una lista consolidada de filas de movimiento) para garantizar tipado y validación.
3. El agente debe integrarse al workflow mediante la API declarativa `.agent()` de `@mastra/core/workflows`, reutilizando el `markdown` de `llamaCloudParse` sin duplicar la lógica de parseo.
4. No se deben hardcodear credenciales ni claves de API en el código.
5. El flujo de extracción no debe recalcular valores monetarios (débitos, créditos o saldos): solo extrae y normaliza los datos presentes en el markdown.
6. El CSV se debe generar de forma determinista con un serializer TypeScript (RFC 4180) a partir de las filas estructuradas; sin agregar dependencias nuevas.
7. La verificación de tipos (`npx tsc --noEmit`) debe completarse sin errores.
8. El contenido de los artefactos de la spec (requirements, design, tasks) debe estar en español.
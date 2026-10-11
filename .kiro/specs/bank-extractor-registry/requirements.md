# Requirements: Bank Extractor Registry

## Overview

Este documento especifica los requerimientos para reorganizar la extracción de movimientos bancarios en una arquitectura **un agente por banco** con un **registro extensible** y un **enrutamiento por parámetro `bank`** en el workflow. Hoy existe un único agente (`bankMovementsExtractor`, spec `bank-movements-extractor`) especializado en el formato del Banco Francés. El objetivo es poder soportar múltiples bancos, cada uno con su propio agente de extracción, y que el workflow `llamaCloudWorkflow` (spec `llama-cloud-workflow`) decida de forma determinista qué agente usar según el banco indicado.

Todos los agentes de banco producen un **mismo esquema normalizado** de movimientos (`CUENTA | FECHA | DESCRIPCION | REFERENCIA | DEBITOS | CREDITOS | SALDO`) y comparten un único serializer CSV (`movementsToCsv`), de modo que el resultado sea idéntico independientemente del banco.

## User Stories

### Story 1: Esquema normalizado y serializer CSV compartidos

**As a** developer
**I want** que el esquema de movimiento y el serializer CSV vivan en un módulo compartido e independiente del banco
**So that** todos los agentes de banco produzcan exactamente la misma estructura de salida y un único CSV consolidado

#### Acceptance Criteria

1. The system shall extraer del archivo actual del agente (`bank-movements-extractor.ts`) los símbolos `movimientoRowSchema`, `extractorOutputSchema`, `movementsToCsv` y el tipo `MovimientoRow` a un módulo compartido bajo `src/mastra/agents/bank-extractors/`.
2. The system shall mantener el esquema de movimiento con las columnas `cuenta`, `fecha`, `descripcion`, `referencia`, `debitos`, `creditos`, `saldo` (todas `string`, sin recalcular ni reformatear valores).
3. The system shall conservar `extractorOutputSchema` como `{ movimientos: array de movimientoRow }`.
4. The system shall conservar el serializer `movementsToCsv` (RFC 4180: encabezado `CUENTA,FECHA,DESCRIPCION,REFERENCIA,DEBITOS,CREDITOS,SALDO`, campos entrecomillados, comillas escapadas como `""`, sin movimientos → solo encabezado).

### Story 2: Un agente por banco

**As a** developer
**I want** un agente de extracción por banco, cada uno con instrucciones específicas de su formato de extracto
**So that** la lógica de cada banco quede aislada y sea fácil agregar nuevos bancos sin tocar los existentes

#### Acceptance Criteria

1. The system shall crear un agente por banco bajo `src/mastra/agents/bank-extractors/` (inicialmente `frances.ts` para el Banco Francés) con su propio `id`, `name`, `description` e `instructions`.
2. The system shall mantener las instrucciones de extracción específicas del Banco Francés (tablas de movimientos con columnas `FECHA/DESCRIPCION/REFERENCIA/DEBITOS/CREDITOS/SALDO`, encabezado `CUENTA CORRIENTE ... NRO.: ...`, exclusión de filas de resumen, separación de fecha+descripción fusionadas, conservación de celdas vacías y valores originales) en el agente de Francés.
3. Each bank agent shall usar el mismo modelo (`opencode-go/kimi-k2.7-code`) y el esquema compartido de `types.ts`.
4. The system shall eliminar el archivo monolítico `src/mastra/agents/bank-movements-extractor.ts` una vez migrado su contenido.

### Story 3: Registro extensible banco → agente

**As a** developer
**I want** un registro único que mapee cada `bank` a su agente y derive el enum de bancos soportados
**So that** el workflow y las tools validen el parámetro `bank` contra una única fuente de verdad

#### Acceptance Criteria

1. The system shall definir un array `bankIds` (inicialmente `['frances']`) como fuente de verdad de los bancos soportados.
2. The system shall definir `bankIdSchema = z.enum(bankIds)` y el tipo `BankId` derivado de `bankIds`.
3. The system shall definir un registro `bankExtractors: Record<BankId, Agent>` que mapee cada banco a su agente extractor.
4. Agregar un banco nuevo shall requerir únicamente: un nuevo agente bajo `bank-extractors/`, agregar su id a `bankIds` y una entrada en `bankExtractors` (más la rama de ruteo del Story 4).

### Story 4: El workflow enruta por `bank`

**As a** developer
**I want** que `llamaCloudWorkflow` reciba el parámetro `bank` y ejecute el agente extractor correspondiente mediante branching determinista
**So that** un mismo workflow procese extractos de distintos bancos eligiendo el agente correcto

#### Acceptance Criteria

1. The system shall agregar al `inputSchema` del workflow el campo `bank: bankIdSchema` (obligatorio, sin default).
2. The system shall reemplazar el paso único `.agent(bankMovementsExtractor, ...)` por un `.branch()` que enrute según `bank`, con un paso por banco creado mediante `createStep(agent, { structuredOutput: { schema: extractorOutputSchema } })`.
3. All branch steps shall compartir el mismo `inputSchema` (`{ prompt }`) y `outputSchema` (`extractorOutputSchema`) para cumplir la restricción de `.branch()`.
4. When `bank` no corresponde a ningún banco soportado, the system shall fallar de forma clara (error descriptivo o validación del enum que rechace el input antes de ejecutar).
5. The system shall reensamblar la salida final `{ markdown, text, csv }` mediante el `.map()` posterior al branch, leyendo los movimientos de la rama ejecutada y aplicando `movementsToCsv`.
6. The system shall mantener el output final del workflow (`markdown`, `text`, `csv`) sin cambios respecto de la spec `bank-movements-extractor`.

### Story 5: Tool y agente general exponen `bank`

**As a** developer
**I want** que la tool `process_bank_statement` y el agente general acepten/requieran el banco y lo reenvíen al workflow
**So that** los llamadores (chat, CLI) indiquen explícitamente de qué banco es el extracto

#### Acceptance Criteria

1. The system shall agregar el campo `bank: bankIdSchema` (obligatorio) al `inputSchema` de `process_bank_statement`.
2. When la tool ejecuta el workflow, the system shall incluir `bank` en el `inputData` del `run.start()`.
3. The system shall actualizar las instrucciones del agente general (`agent.ts`) para que solicite el banco (cuando corresponda) al invocar `process_bank_statement`.

### Story 6: Registrar agentes y verificar

**As a** developer
**I want** que todos los agentes de banco estén registrados en la instancia Mastra y que la solución compile y ejecute
**So that** puedan probarse desde Studio y CLI sin código adicional

#### Acceptance Criteria

1. The system shall registrar cada agente de banco en `src/mastra/index.ts` dentro del objeto `agents` (importándolos desde el registry o listándolos explícitamente).
2. When el dev server está corriendo, the system shall mostrar cada agente de banco en Mastra Studio.
3. The system shall compilar sin errores con `npx tsc --noEmit`.
4. When se ejecuta `npx mastra api workflow run start llama-cloud-workflow '{"inputData":{"filePath":"...","bank":"frances"}}'`, the system shall devolver `{ markdown, text, csv }` con el CSV consolidado.

## Non-Functional Requirements

1. Los agentes de banco deben usar el modelo `opencode-go/kimi-k2.7-code` (provisto por el model router de Mastra).
2. La salida de cada agente debe definirse con Zod y devolverse como structured output usando el esquema compartido `extractorOutputSchema`.
3. El enrutamiento debe ser determinista (parámetro `bank`), sin llamada adicional de LLM para clasificar el banco.
4. No se deben hardcodear credenciales ni claves de API en el código.
5. El flujo de extracción no debe recalcular valores monetarios ni reformatear fechas.
6. El CSV se debe generar con el serializer determinista TypeScript (RFC 4180), sin dependencias nuevas.
7. La verificación de tipos (`npx tsc --noEmit`) debe completarse sin errores.
8. El contenido de los artefactos de la spec (requirements, design, tasks) debe estar en español.

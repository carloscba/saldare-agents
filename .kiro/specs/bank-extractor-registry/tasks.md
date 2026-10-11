# Tasks: Bank Extractor Registry

## Task 1: Módulo compartido `types.ts`

- [ ] 1.1 Crear `src/mastra/agents/bank-extractors/types.ts`
  - Mover `movimientoRowSchema`, `extractorOutputSchema`, `MovimientoRow` y `movementsToCsv` desde `bank-movements-extractor.ts` (sin cambios de comportamiento)

## Task 2: Agente Banco Francés `frances.ts`

- [ ] 2.1 Crear `src/mastra/agents/bank-extractors/frances.ts`
  - `id: 'bank-extractor-frances'`, `name`, `description` e `instructions` específicos del Banco Francés
  - Modelo `opencode-go/kimi-k2.7-code` con `opencodeGoHeaders`
  - Migrar las instrucciones actuales del Francés tal cual

## Task 3: Registro `registry.ts` + `index.ts`

- [ ] 3.1 Crear `src/mastra/agents/bank-extractors/registry.ts`
  - `bankIds = ['frances'] as const`
  - `type BankId = (typeof bankIds)[number]`
  - `bankIdSchema = z.enum(bankIds)`
  - `bankExtractors: Record<BankId, Agent> = { frances: bankExtractorFrances }`
- [ ] 3.2 Crear `src/mastra/agents/bank-extractors/index.ts` re-exportando `types.ts` y `registry.ts`

## Task 4: Workflow `llama-cloud-workflow.ts`

- [ ] 4.1 Agregar `bank: bankIdSchema` (obligatorio) al `inputSchema`
- [ ] 4.2 Reemplazar `.agent(bankMovementsExtractor, ...)` por `.branch()` con `createStep(bankExtractors.frances, { structuredOutput: { schema: extractorOutputSchema } })`
- [ ] 4.3 Actualizar el `.map()` final para leer los movimientos de la rama ejecutada (`bank-extractor-${bank}`) y generar `{ markdown, text, csv }` con `movementsToCsv`
- [ ] 4.4 Quitar los imports del agente monolítico (usar `bank-extractors`)

## Task 5: Tool `process-bank-statement.ts`

- [ ] 5.1 Agregar `bank: bankIdSchema` (obligatorio) al `inputSchema`
- [ ] 5.2 Incluir `bank` en el `inputData` del `run.start()`

## Task 6: Agente general `agent.ts` y registro en `index.ts`

- [ ] 6.1 Actualizar las instrucciones del agente general para solicitar el `bank` al invocar `process_bank_statement`
- [ ] 6.2 En `src/mastra/index.ts`, reemplazar el import/registro de `bankMovementsExtractor` por los agentes del registry (clave = `agent.id`)
- [ ] 6.3 Eliminar `src/mastra/agents/bank-movements-extractor.ts`

## Task 7: Verificar

- [ ] 7.1 Compilación sin errores: `npx tsc --noEmit`
- [ ] 7.2 Agente registrado: `npx mastra api agent list` lista `bank-extractor-frances`
- [ ] 7.3 Serializer aislado `movementsToCsv` (encabezado, CUENTA primero, escape RFC 4180)
- [ ] 7.4 End-to-end con `bank: "frances"`:
  ```bash
  npx mastra api workflow run start llama-cloud-workflow \
    '{"inputData":{"filePath":"ruta/al/documento.pdf","bank":"frances"}}'
  ```
- [ ] 7.5 Caso borde: `bank` omitido o inválido → error de validación sin ejecutar

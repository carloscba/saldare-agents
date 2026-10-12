# Tasks: Movement Categorization

## Task 1: Módulo centralizado de categorías

- [ ] 1.1 Crear `src/mastra/categories.ts`
  - Definir `movementCategories` con las 16 categorías exactas, incluyendo `Desconocida` como última categoría de fallback.
  - Derivar `MovementCategory` y `movementCategorySchema`.
- [ ] 1.2 Verificar que `movementCategorySchema` sea reutilizable desde agentes y serializers.

## Task 2: Tipos y serializer categorizado

- [ ] 2.1 Modificar `src/mastra/agents/bank-extractors/types.ts`
  - Importar `movementCategorySchema` desde `../../categories`.
  - Crear `categorizedMovimientoRowSchema` extendiendo `movimientoRowSchema`.
  - Crear `categorizerOutputSchema`.
  - Exportar `type CategorizedMovimientoRow`.
  - Crear `categorizedMovementsToCsv` con header `...,SALDO,CATEGORIA`.
- [ ] 2.2 Verificar que `movementsToCsv` original no cambie de comportamiento.

## Task 3: Agente categorizador

- [ ] 3.1 Crear `src/mastra/agents/bank-extractors/categorizer.ts`
  - `id: 'movement-categorizer'`.
  - Modelo `opencode-go/deepseek-v4-flash` con `opencodeGoHeaders`.
  - Instrucciones que usen `movementCategories`, exijan preservar orden y campos, e indiquen que se use `Desconocida` cuando no se pueda determinar una categoría.

## Task 4: Helper de categorización por lotes

- [ ] 4.1 Crear `src/mastra/agents/bank-extractors/categorize.ts`
  - Función `categorizeMovements({ agent, movimientos })`.
  - Lotes de ~25 movimientos.
  - Llamar `agent.generate(..., { structuredOutput: { schema: categorizerOutputSchema } })`.
  - Reconciliar lotes que devuelvan menos/más filas de las esperadas, completando las faltantes con `Desconocida` y truncando las sobrantes.
  - Manejar lista vacía sin llamar al modelo.

## Task 5: Re-exports

- [ ] 5.1 Actualizar `src/mastra/agents/bank-extractors/index.ts`
  - Exportar símbolos de `categories` (si aplica), `categorizer`, `categorize` y los nuevos tipos.

## Task 6: Workflow `llama-cloud-workflow.ts`

- [ ] 6.1 Importar `movementCategorizer`, `categorizeMovements`/`categorizeStep`, `categorizedMovementsToCsv`, `node:fs`, `node:path`.
- [ ] 6.2 Crear `categorizeStep` con `createStep` (input `{ movimientos }`, output `categorizerOutputSchema`).
- [ ] 6.3 Crear `saveCategorizedCsvStep` con `createStep` para escribir `<base>_categorias.csv`.
- [ ] 6.4 Actualizar el `outputSchema` del workflow a `{ markdown, text, csv, csvCategorias, csvCategoriasPath }`.
- [ ] 6.5 Insertar en la cadena después del `.branch()`:
  - `.map(...)` para reshapear `{ 'bank-extractor-X': { movimientos } }` → `{ movimientos }`.
  - `.then(categorizeStep)`.
  - `.map(...)` para generar `csvCategorias` + derivar `baseName`/`outputDir` (`dirname(filePath)` para `filePath`; `path.join(process.cwd(), 'workspace')` para `file`).
  - `.then(saveCategorizedCsvStep)`.
  - `.map(...)` final para armar el output.
- [ ] 6.6 Asegurar que `csv` siga siendo el CSV original (sin categoria).

## Task 7: Tool `process-bank-statement.ts`

- [ ] 7.1 Actualizar `outputSchema` para incluir `csvCategorias` y `csvCategoriasPath`.
- [ ] 7.2 Actualizar `description` mencionando el CSV categorizado y el archivo guardado.

## Task 8: Registro en `src/mastra/index.ts`

- [ ] 8.1 Importar `movementCategorizer`.
- [ ] 8.2 Registrarlo en el objeto `agents`.

## Task 9: Agente general (opcional)

- [ ] 9.1 Actualizar instrucciones de `src/mastra/agents/agent.ts` para mencionar la ruta `*_categorias.csv` al devolver el resultado.

## Task 10: Verificar

- [ ] 10.1 Compilación sin errores: `npx tsc --noEmit`.
- [ ] 10.2 Registro de agente: `npx mastra api agent list --pretty` muestra `movement-categorizer`.
- [ ] 10.3 Serializer aislado: `categorizedMovementsToCsv` produce header correcto y escape RFC 4180.
- [ ] 10.4 End-to-end con `filePath`:
  ```bash
  npx mastra api workflow run start llama-cloud-workflow \
    '{"inputData":{"filePath":"ruta/al/extracto.pdf","bank":"macro"}}'
  ```
  - Verificar output incluye `csvCategoriasPath`.
  - Verificar que existe `<base>_categorias.csv` junto al PDF.
- [ ] 10.5 End-to-end con `file` (base64):
  - Verificar que se crea `<base>_categorias.csv` en la carpeta `workspace/` de Mastra.
- [ ] 10.6 Caso borde sin movimientos: el workflow finaliza con éxito y el archivo contiene solo el header.
- [ ] 10.7 Caso de fallback `Desconocida`:
  - Verificar que un movimiento ambiguo/esperado como no clasificable termina con `categoria: Desconocida`.
  - Verificar que si el modelo devuelve menos filas que un lote, las filas faltantes se completan con `Desconocida`.

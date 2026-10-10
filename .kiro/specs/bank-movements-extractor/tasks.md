# Tasks: Bank Movements Extractor

## Task 1: Configurar entorno

- [x] 1.1 Agregar `OPENCODE_API_KEY=` a `.env.example`
- [x] 1.2 Agregar `OPENCODE_API_KEY=` a `.env` (local; nunca versionar el valor real)

## Task 2: Actualizar el agente extractor

- [x] 2.1 Reemplazar `movimientoTableSchema`/`extractorOutputSchema` por `movimientoRowSchema` + `extractorOutputSchema` (`{ movimientos: array de { cuenta, fecha, descripcion, referencia, debitos, creditos, saldo } }`)
- [x] 2.2 Agregar y exportar `movementsToCsv(movimientos): string`
  - Columnas: `CUENTA | FECHA | DESCRIPCION | REFERENCIA | DEBITOS | CREDITOS | SALDO`
  - RFC 4180: todos los campos entrecomillados, comillas embebidas escapadas con `""`
  - Sin movimientos → solo encabezado
- [x] 2.3 Actualizar `instructions` del agente
  - Asociar cada fila a su NRO de cuenta
  - Consolidar todas las tablas en un único arreglo `movimientos`
  - Excluir filas de resumen, separar fecha+descripción fusionadas, conservar celdas vacías y valores originales
  - Sin movimientos → `movimientos: []`
- [x] 2.4 Actualizar `description` del agente (extracción de movimientos consolidados)

## Task 3: Actualizar el workflow

- [x] 3.1 Importar `movementsToCsv` en `src/mastra/workflows/llama-cloud-workflow.ts`
- [x] 3.2 Cambiar `outputSchema` del workflow: `movimientos` → `csv: z.string()`
- [x] 3.3 Actualizar `.map()` final para devolver `{ markdown, text, csv }` usando `movementsToCsv(inputData.movimientos)`

## Task 4: Verificar

- [x] 4.1 Verificar compilación sin errores de tipos
  - `npx tsc --noEmit` ✅
- [x] 4.2 Confirmar que el agente aparece registrado
  - `npx mastra api agent list` lista `bank-movements-extractor` ✅
- [x] 4.3 Prueba aislada del serializer `movementsToCsv` con filas de ejemplo (encabezado, columna CUENTA primero, escape RFC 4180) ✅
- [ ] 4.4 Probar end-to-end con un PDF de ejemplo (requiere `LLAMA_CLOUD_API_KEY` y `OPENCODE_API_KEY` válidas)
- [ ] 4.5 Validar casos borde:
  - Extracto sin movimientos → CSV con solo encabezado (no falla)
  - Filas con fecha+descripción fusionadas → quedan separadas
  - Filas de resumen → excluidas
  - Varias cuentas/tablas → consolidadas en un único CSV con su `CUENTA`
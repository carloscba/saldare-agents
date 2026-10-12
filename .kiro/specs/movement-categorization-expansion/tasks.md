# Tasks: Movement Categorization Expansion

## Task 1: Ampliar categorías

- [ ] 1.1 Modificar `src/mastra/categories.ts`
  - Agregar las 13 categorías nuevas (`Acreditaciones`, `SIRCREB`, `Rescate`, `Débitos y créditos`, `IVA`, `Percepción IVA`, `Suscripción`, `Rentas`, `Municipalidad`, `Sueldos`, `AFIP plan de pagos`, `Rechazo acreditaciones`, `VEP IVA`) antes de `Desconocida`.
  - Mantener `Desconocida` como última categoría de fallback.
- [ ] 1.2 Verificar que `movementCategories` tenga 29 elementos.

## Task 2: Generar módulo de ejemplos

- [ ] 2.1 Crear `src/mastra/agents/bank-extractors/categorization-examples.ts`
  - Exportar `CategorizationExample` (descripcion: string, categoria: MovementCategory).
  - Exportar `categorizationExamples` con los 117 pares únicos del CSV, categorías canonicalizadas.
- [ ] 2.2 Verificar que el archivo no importe `node:fs` (constantes embebidas).

## Task 3: Actualizar agente categorizador

- [ ] 3.1 Modificar `src/mastra/agents/bank-extractors/categorizer.ts`
  - Importar `categorizationExamples`.
  - Inyectar la lista de categorías y la sección de ejemplos en las instrucciones.
  - Corregir la referencia a "15 categorías conocidas".

## Task 4: Verificar

- [ ] 4.1 Compilación sin errores: `npx tsc --noEmit`.
- [ ] 4.2 Confirmar que `categorizationExamples` tiene 117 pares y que `movementCategories` tiene 29 valores.
- [ ] 4.3 (Opcional) Registro de agente: `npx mastra api agent list --pretty` muestra `movement-categorizer`.

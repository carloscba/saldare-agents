# Design: Movement Categorization Expansion

## Resumen

Se amplía la lista de categorías contables de `src/mastra/categories.ts` mediante la **unión** de las 16 categorías genéricas existentes con las categorías del CSV curado de conciliación (`src/mastra/public/workspace/galicia/categorias.csv`). Los 117 pares únicos descripción → categoría del CSV se embeber como constantes TypeScript en un módulo nuevo y se inyectan en las instrucciones del agente `movement-categorizer` como ejemplos few-shot.

La taxonomía resultante es **global** (se aplica a macro y galicia). No se modifican el flujo del workflow, el serializer ni la tool `processBankStatement`, ya que todos derivan de `movementCategorySchema`.

## Decisión de arquitectura

| Opción | Descripción | Veredicto |
|--------|-------------|-----------|
| Embeber ejemplos como constantes TS generadas del CSV | Determinista, bundleable, sin I/O en runtime. El CSV queda como fuente; un script regenera el módulo. | ✅ Correcto |
| Leer el CSV en runtime con `node:fs` | Añade dependencia de filesystem y rutas frágiles tras el bundle. | ❌ |
| Solo derivar la lista sin ejemplos | Pierde el criterio de conciliación curado (precision drop). | ❌ |

Se elige **embeder como constantes** para mantener el categorizador autocontenido y determinista.

## Taxonomía resultante

El CSV aporta 16 categorías canonicalizadas, de las cuales 3 solapan con las existentes (`Pagos a proveedores`, `Comisiones`, `Seguros`). Se agregan 13 nuevas:

| Raw CSV | Canónica |
|---------|----------|
| acreditaciones | `Acreditaciones` |
| sircreb | `SIRCREB` |
| rescate | `Rescate` |
| pagos a proveedores / Pagos a proveedores | `Pagos a proveedores` (ya existente) |
| debitos y creditos | `Débitos y créditos` |
| comisiones | `Comisiones` (ya existente) |
| iva | `IVA` |
| percepcion iva | `Percepción IVA` |
| Seguros | `Seguros` (ya existente) |
| suscripcion | `Suscripción` |
| rentas | `Rentas` |
| municipalidad | `Municipalidad` |
| sueldos | `Sueldos` |
| afip plan de pagos | `AFIP plan de pagos` |
| rechazo acreditaciones | `Rechazo acreditaciones` |
| vep iva | `VEP IVA` |

`movementCategories` pasa de 16 → 29 (las 15 conocidas originales + 13 nuevas + `Desconocida`).

## Módulo de ejemplos: `agents/bank-extractors/categorization-examples.ts`

```typescript
import type { MovementCategory } from '../../categories';

export interface CategorizationExample {
  descripcion: string;
  categoria: MovementCategory;
}

export const categorizationExamples: CategorizationExample[] = [
  { descripcion: "COM. DEPOSITO DE CHEQUE 1013618", categoria: 'Comisiones' },
  { descripcion: "ING. BRUTOS S/ CRED REG.RECAU.SIRCREB", categoria: 'SIRCREB' },
  // ... 117 pares únicos
];
```

Generado una vez desde el CSV mediante un script que:
1. Lee el CSV (separador TAB), saltea el encabezado.
2. Normaliza la categoría con un mapa `raw.toLowerCase() → canonical`.
3. Deduplica por descripción (primer aparición).
4. Ordena alfabéticamente por descripción y emite el archivo TS.

## Agente categorizador: `agents/bank-extractors/categorizer.ts`

Se importa `categorizationExamples` y se amplían las instrucciones:

```typescript
import { categorizationExamples } from './categorization-examples';

instructions: `
Objetivo: Clasificar cada movimiento bancario en exactamente una categoría contable.

Categorías válidas (usa una de estas y solo estas):
${movementCategories.join('\n')}

Ejemplos de referencia (descripción => categoría conciliada). Usalos como guía de criterio de clasificación; no exigen coincidencia exacta con la descripción:
${categorizationExamples.map((e) => `- "${e.descripcion}" => ${e.categoria}`).join('\n')}

Reglas:
1. Analizá la descripción del movimiento y el signo (débito = egreso, crédito = ingreso).
2. Asigná la categoría más específica posible, siguiendo el criterio de los ejemplos de referencia.
3. Devolvé el movimiento completo (todos sus campos originales) agregando la clave "categoria".
4. Mantené el orden original de los movimientos. No agregues, elimines ni reordenes filas.
5. Si una descripción es ambigua o no tenés certeza suficiente, usá \`Desconocida\`.
6. La categoría \`Desconocida\` es válida y debe usarse cuando no sea posible determinar una de las categorías conocidas (todas salvo \`Desconocida\`).
`,
```

## Archivos afectados

```
src/mastra/
├── categories.ts                                   # MODIFICADO: +13 categorías
└── agents/bank-extractors/
    ├── categorization-examples.ts                  # NUEVO: 117 pares embebidos
    └── categorizer.ts                              # MODIFICADO: ejemplos + reglas
```

Sin cambios: `types.ts`, `categorize.ts`, `registry.ts`, `index.ts`, `workflows/llama-cloud-workflow.ts`, `tools/process-bank-statement.ts`.

## Manejo de errores

- **Categoría del CSV no normalizada** → el script generador aborta con error (no genera el módulo).
- **Categoría fuera del enum** → `MovementCategory` (tipo) y `movementCategorySchema` (runtime) rechazan valores inválidos en tiempo de compilación/ejecución.
- **Descripciones con comillas/backslashes/tabs** → verificado que no existen; el generador usa `JSON.stringify` para escapar de todos modos.

## Verificación

1. Compilación: `npx tsc --noEmit`.
2. `movementCategories` contiene exactamente 29 categorías y `categorizationExamples` contiene 117 pares.
3. Registro: `npx mastra api agent list --pretty` lista `movement-categorizer`.
4. End-to-end (opcional): ejecutar `llama-cloud-workflow` sobre un extracto Galicia y verificar que las categorías asignadas respetan la taxonomía ampliada.

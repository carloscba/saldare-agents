# Requirements: Movement Categorization Expansion

## Overview

Este documento especifica el requerimiento para **ampliar la lista de categorías contables** del workflow de categorización (spec `movement-categorization`) a partir de un archivo curado de conciliación (`src/mastra/public/workspace/galicia/categorias.csv`) que mapea descripciones reales de movimientos del Banco Galicia a su categoría conciliada.

La lista resultante es la **unión** de las 16 categorías genéricas actuales con las categorías del CSV curado. Además, los pares descripción → categoría del CSV se incorporan como **ejemplos few-shot** en el agente categorizador para mejorar la precisión. La taxonomía aplica **globalmente** (macro y galicia).

## User Stories

### Story 1: Categorías ampliadas

**As a** developer
**I want** que la lista de categorías incluya las categorías de conciliación del CSV curado
**So that** el modelo clasifique con la taxonomía real usada por el negocio

#### Acceptance Criteria

1. The system shall mantener las 16 categorías existentes y **agregar** 13 nuevas, totalizando 29 categorías (28 conocidas + `Desconocida`).
2. The system shall canonicalizar los nombres del CSV: unificar mayúsculas/minúsculas, corregir tildes y deduplicar variantes (p. ej. `pagos a proveedores`/`Pagos a proveedores` → `Pagos a proveedores`, `sircreb` → `SIRCREB`).
3. The system shall derivar `MovementCategory` y `movementCategorySchema` desde `movementCategories` sin hardcodear la lista en prompt ni serializer.

### Story 2: Ejemplos few-shot embebidos

**As a** developer
**I want** que el agente categorizador reciba los pares descripción → categoría del CSV como ejemplos de referencia
**So that** la clasificación siga el criterio de conciliación curado

#### Acceptance Criteria

1. The system shall crear el módulo `src/mastra/agents/bank-extractors/categorization-examples.ts` que exporte `categorizationExamples` con los pares únicos descripción → categoría (117 pares) extraídos del CSV, con categorías canonicalizadas.
2. The system shall embeber los ejemplos como constantes TypeScript (sin lectura de archivos en runtime).
3. The system shall tipar `categoria` con `MovementCategory` para que el compilador valide cada valor contra el enum.

### Story 3: Agente categorizador actualizado

**As a** developer
**I want** que las instrucciones del agente incluyan la lista ampliada y los ejemplos few-shot
**So that** el modelo disponga del contexto de conciliación al clasificar

#### Acceptance Criteria

1. The system shall inyectar `movementCategories` y `categorizationExamples` en las instrucciones del agente `movement-categorizer`.
2. The system shall actualizar las reglas para indicar que se siga el criterio de los ejemplos y que `Desconocida` es la categoría de fallback.
3. The system shall eliminar la referencia obsoleta a "15 categorías conocidas".

## Non-Functional Requirements

1. Los nombres de categoría deben estar correctamente acentuados (UTF-8).
2. No se deben agregar dependencias nuevas.
3. No se deben hardcodear credenciales ni claves de API.
4. La verificación de tipos (`npx tsc --noEmit`) debe completarse sin errores.
5. El contenido de los artefactos de la spec (requirements, design, tasks) debe estar en español.

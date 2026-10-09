# Requirements: Mastra Project Setup

## Overview

Este documento especifica los requerimientos para crear un nuevo proyecto Mastra desde cero. Mastra es un framework para aplicaciones y agentes de AI construido sobre un stack moderno de TypeScript.

## User Stories

### Story 1: Crear proyecto Mastra

**As a** developer  
**I want** crear un nuevo proyecto Mastra con el proveedor LLM configurado  
**So that** pueda comenzar a construir agentes, workflows y tools

#### Acceptance Criteria

1. When the developer ejecuta `npm create mastra@latest mastra-saldare -- --llm google`, the system shall crear un proyecto Mastra con la estructura de directorios estándar.
2. When the provider specified is not one of the supported values, the system shall ask again and list the supported values: `openai`, `anthropic`, `google`, `xai`.
3. When the project creation completes, the system shall install Mastra skills for detected coding assistants.
4. When the project creation completes, the system shall initialize Git when appropriate.

### Story 2: Iniciar dev server

**As a** developer  
**I want** iniciar el servidor de desarrollo en segundo plano  
**So that** pueda acceder a Mastra Studio

#### Acceptance Criteria

1. When the developer ejecuta `npx bgproc start -n mastra-saldare -w -- npm run dev` from the project directory, the system shall start the dev server as a background process.
2. The dev server shall be accessible on port 4111.

### Story 3: Acceder a Mastra Studio

**As a** developer  
**I want** acceder a Mastra Studio en el navegador  
**So that** pueda construir, probar y gestionar agentes, workflows y tools

#### Acceptance Criteria

1. When the dev server is running, the system shall serve Mastra Studio at `http://localhost:4111`.
2. Studio shall allow building, testing, and managing agents, workflows, and tools.

### Story 4: Model Router

**As a** developer  
**I want** conocer sobre el Mastra model router  
**So that** pueda acceder a miles de modelos disponibles

#### Acceptance Criteria

1. The documentation shall mention that the Mastra model router provides access to thousands of models at https://mastra.ai/models.

## Non-Functional Requirements

1. The project name shall default to `my-mastra-app` when not specified.
2. The provider shall be required; valid options are `openai`, `anthropic`, `google`, `xai`.

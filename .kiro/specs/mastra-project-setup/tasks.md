# Tasks: Mastra Project Setup

## Task 1: Crear proyecto Mastra ✅

- [x] 1.1 Crear el proyecto Mastra con el proveedor LLM `google` en la carpeta raíz del repo (`/Users/carloscordoba/carloscba/saldare-agents`)
  - El comando `npm create mastra@latest mastra-saldare -- --llm google` crea un subdirectorio; como el requisito es usar la raíz del repo, se generó con `create-mastra mastra-saldare --llm google` y luego se movió el contenido al raíz. Git omitido porque el repo ya está inicializado.
- [x] 1.2 Verificar que el proyecto se creó correctamente y que la estructura de directorios existe
  - Estructura en la raíz: `package.json` (`mastra-saldare`, `google` como LLM), `src/mastra/{index.ts,agents/agent.ts,tools/schedule-tools.ts}`, `AGENTS.md`, `README.md`, `tsconfig.json`, `.env.example`, `.gitignore`, `.agents/skills/`, `node_modules`.
- [x] 1.3 Confirmar que Git fue inicializado y que las Mastra skills se instalaron
  - Skills instaladas para OpenCode (`.agents/skills/mastra`, `.agents/skills/mastra-factory`, `skills-lock.json`). Git omitido porque el proyecto está dentro de un repo existente.

## Task 2: Iniciar dev server ✅

- [x] 2.1 El directorio del proyecto es la raíz del repo (no se requiere `cd`)
- [x] 2.2 Ejecutar `npx bgproc start -n mastra-saldare -w -- npm run dev`
- [x] 2.3 Verificar que el proceso está corriendo en segundo plano
  - Proceso `mastra-saldare` (pid 72482) corriendo con `cwd` = raíz del repo, puerto 4111.

## Task 3: Acceder a Mastra Studio ✅

- [x] 3.1 Abrir `http://localhost:4111` en el navegador
- [x] 3.2 Confirmar que Studio carga correctamente
  - Verificado con `curl`: `http://localhost:4111` y `http://localhost:4111/api` responden HTTP 200.

## Task 4: Documentar Model Router ✅

- [x] 4.1 Confirmar que se mencionó que el Mastra model router provee acceso a miles de modelos en https://mastra.ai/models
  - Sección "Models" añadida en `README.md`: "The [Mastra model router](https://mastra.ai/models) provides access to thousands of models, including OpenAI, Anthropic, Google, and xAI".

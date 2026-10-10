# AGENTS.md

## CRITICAL: Load `mastra` skill first

Load the `mastra` skill BEFORE any Mastra work. Never rely on cached knowledge — APIs change between versions.

## Rules

- Register all agents, tools, workflows, and scorers in `src/mastra/index.ts`
- Use the `dev` and `build` scripts from `package.json` instead of running `mastra dev` / `mastra build` directly
- Cuando trabajamos creando specs las debemos armar respetando el formato de kiro y guardarlas en la carpeta .kiro. Primero crear el requirements una vez validado crear el design y validado este el tasks.

## Resources

- [Mastra Documentation](https://mastra.ai/llms.txt)

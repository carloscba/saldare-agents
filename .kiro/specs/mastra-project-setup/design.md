# Design: Mastra Project Setup

## Resumen

Este documento describe el diseño técnico para crear un nuevo proyecto Mastra con el proveedor Google (Gemini) como LLM configurado.

## Parámetros del Proyecto

| Parámetro | Valor |
|-----------|-------|
| Nombre | `mastra-saldare` |
| Provider | `google` |
| Puerto Dev Server | 4111 |

## Estructura del Proyecto

El comando `npm create mastra@latest` generará una estructura estándar de proyecto Mastra con TypeScript, incluyendo:
- Configuración de Mastra
- Agentes iniciales
- Tools y workflows base
- Configuración del proveedor LLM seleccionado

## Comandos de Inicialización

### Paso 1: Crear el proyecto

```bash
npm create mastra@latest mastra-saldare -- --llm google
```

### Paso 2: Iniciar el dev server

```bash
cd mastra-saldare && npx bgproc start -n mastra-saldare -w -- npm run dev
```

El flag `-n` asigna un nombre al proceso en background, `-w` espera a que el proceso esté listo.

## Consideraciones

- Si el proveedor no es soportado, se debe re-preguntar listando los valores válidos.
- El comando de creación instala automáticamente Mastra skills para coding assistants detectados.
- Git se inicializa cuando es apropiado.
- Studio está disponible en `http://localhost:4111` una vez el dev server está corriendo.

## Referencias

- Mastra Model Router: https://mastra.ai/models
- Proporciona acceso a miles de modelos a través del router de Mastra.

import { MASTRA_THREAD_ID_KEY, type RequestContext } from '@mastra/core/request-context';

/**
 * Devuelve los headers que OpenCode Go (models.dev / opencode-go) exige:
 * un session id estable por conversación en x-opencode-session.
 * Si el contexto no trae threadId, usa un fallback estático para que
 * el header siempre esté presente y el request no sea rechazado.
 */
export const opencodeGoHeaders = ({ requestContext }: { requestContext: RequestContext }) => ({
  'x-opencode-session': String(requestContext.get(MASTRA_THREAD_ID_KEY) ?? 'saldare-agent'),
});

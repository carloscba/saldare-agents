import { z } from 'zod';
import type { Agent } from '@mastra/core/agent';
import { bankExtractorMacro } from './macro';
import { bankExtractorGalicia, galiciaAccountContext } from './galicia';

export const bankIds = ['macro', 'galicia'] as const;

export type BankId = (typeof bankIds)[number];

export const bankIdSchema = z.enum(bankIds);

export type BankExtractorConfig = {
  agent: Agent;
  /**
   * Contexto a anteponer a cada chunk cuando se extrae por páginas.
   * Devuelve una cadena vacía si el chunk ya es autocontenido (ej. Macro
   * repite el encabezado de cuenta en cada página).
   */
  context?: (markdown: string) => string;
};

export const bankExtractors: Record<BankId, BankExtractorConfig> = {
  macro: { agent: bankExtractorMacro },
  galicia: { agent: bankExtractorGalicia, context: galiciaAccountContext },
};

import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { llamaCloudUpload, llamaCloudParse } from '../tools/llama-cloud-tool';
import {
  bankIdSchema,
  bankExtractors,
  bankIds,
  type BankId,
} from '../agents/bank-extractors';
import { extractMovementsChunked } from '../agents/bank-extractors/chunk';
import {
  extractorOutputSchema,
  movementsToCsv,
  type MovimientoRow,
} from '../agents/bank-extractors/types';

const fileInputSchema = z.object({
  name: z.string(),
  data: z.string().describe('Contenido del PDF codificado en base64.'),
});

const inputSchema = z
  .object({
    filePath: z
      .string()
      .optional()
      .describe('Ruta local absoluta o relativa del PDF.'),
    file: fileInputSchema
      .optional()
      .describe('PDF codificado en base64 (name + data).'),
    bank: bankIdSchema.describe('Banco del extracto (ej. "macro").'),
    tier: z
      .enum(['fast', 'cost_effective', 'agentic', 'agentic_plus'])
      .optional()
      .describe('Tier de parseo.'),
    version: z.string().optional().describe('Versión del tier.'),
    expand: z
      .array(z.string())
      .optional()
      .describe(
        'Campos a expandir en la respuesta (ej. markdown_full, text_full).'
      ),
    pollingInterval: z
      .number()
      .optional()
      .describe('Intervalo inicial de polling en segundos.'),
    timeout: z.number().optional().describe('Tiempo máximo de espera en segundos.'),
  })
  .refine((data) => data.filePath || data.file, {
    message: 'Debe proporcionar filePath o file.',
  });

type InputType = z.infer<typeof inputSchema>;

const extractorStepInputSchema = z.object({
  markdown: z.string(),
});

function makeExtractorStep(bank: BankId) {
  const { agent, context } = bankExtractors[bank];

  return createStep({
    id: `bank-extractor-${bank}`,
    inputSchema: extractorStepInputSchema,
    outputSchema: extractorOutputSchema,
    execute: async ({ inputData }) => {
      return extractMovementsChunked({
        agent,
        markdown: inputData.markdown,
        context: context?.(inputData.markdown),
      });
    },
  });
}

export const llamaCloudWorkflow = createWorkflow({
  id: 'llama-cloud-workflow',
  inputSchema,
  outputSchema: z.object({
    markdown: z.string().describe('Contenido completo en markdown.'),
    text: z.string().describe('Contenido completo en texto plano.'),
    csv: z
      .string()
      .describe(
        'CSV consolidado (RFC 4180) con una fila por movimiento de todas las tablas: columnas CUENTA | FECHA | DESCRIPCION | REFERENCIA | DEBITOS | CREDITOS | SALDO.'
      ),
  }),
})
  .tool(llamaCloudUpload, {}, { id: 'upload' })
  .map(async ({ inputData, getInitData }) => ({
    fileId: inputData.fileId,
    tier: getInitData<InputType>().tier,
    version: getInitData<InputType>().version,
    expand: getInitData<InputType>().expand,
    pollingInterval: getInitData<InputType>().pollingInterval,
    timeout: getInitData<InputType>().timeout,
  }))
  .tool(llamaCloudParse, {}, { id: 'parse' })
  .map(async ({ inputData }) => ({
    markdown: inputData.markdown,
  }))
  .branch(
    bankIds.map((bank) => [
      async ({ getInitData }) => getInitData<InputType>().bank === bank,
      makeExtractorStep(bank),
    ])
  )
  .map(async ({ inputData, getStepResult, getInitData }) => {
    const { markdown, text } = getStepResult<{ markdown: string; text: string }>('parse');
    const bank = getInitData<InputType>().bank;
    const stepId = `bank-extractor-${bank}`;
    const result = (inputData as Record<string, { movimientos: MovimientoRow[] } | undefined>)[
      stepId
    ];
    return {
      markdown,
      text,
      csv: movementsToCsv(result?.movimientos ?? []),
    };
  })
  .commit();

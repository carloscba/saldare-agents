import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { llamaCloudUpload, llamaCloudParse } from '../tools/llama-cloud-tool';
import {
  bankIdSchema,
  bankExtractors,
  bankIds,
  movementCategorizer,
  categorizeMovements,
  categorizedMovementsToCsv,
  type BankId,
} from '../agents/bank-extractors';
import { extractMovementsChunked } from '../agents/bank-extractors/chunk';
import {
  extractorOutputSchema,
  movimientoRowSchema,
  movementsToCsv,
  categorizerOutputSchema,
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

const categorizeStepInputSchema = z.object({
  movimientos: z.array(movimientoRowSchema),
});

const categorizeStep = createStep({
  id: 'movement-categorizer',
  inputSchema: categorizeStepInputSchema,
  outputSchema: categorizerOutputSchema,
  execute: async ({ inputData }) =>
    categorizeMovements({ agent: movementCategorizer, movimientos: inputData.movimientos }),
});

const saveCategorizedCsvInputSchema = z.object({
  csvCategorias: z.string(),
  baseName: z.string(),
  outputDir: z.string(),
});

const saveCategorizedCsvStep = createStep({
  id: 'save-categorized-csv',
  inputSchema: saveCategorizedCsvInputSchema,
  outputSchema: z.object({
    csvCategorias: z.string(),
    csvCategoriasPath: z.string(),
  }),
  execute: async ({ inputData }) => {
    const filePath = path.join(inputData.outputDir, `${inputData.baseName}_categorias.csv`);
    fs.mkdirSync(inputData.outputDir, { recursive: true });
    fs.writeFileSync(filePath, inputData.csvCategorias, 'utf-8');
    return { csvCategorias: inputData.csvCategorias, csvCategoriasPath: filePath };
  },
});

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
    csvCategorias: z.string().describe('CSV con columna CATEGORIA al final.'),
    csvCategoriasPath: z.string().describe('Ruta del archivo <base>_categorias.csv guardado en disco.'),
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
  .map(async ({ inputData, getInitData }) => {
    const bank = getInitData<InputType>().bank;
    const stepId = `bank-extractor-${bank}`;
    const result = (inputData as Record<string, { movimientos: MovimientoRow[] } | undefined>)[
      stepId
    ];
    return { movimientos: result?.movimientos ?? [] };
  })
  .then(categorizeStep)
  .map(async ({ inputData, getInitData }) => {
    const init = getInitData<InputType>();
    let baseName: string;
    let outputDir: string;
    if (init.filePath) {
      outputDir = path.dirname(init.filePath);
      baseName = path.basename(init.filePath, path.extname(init.filePath));
    } else {
      outputDir = path.join(process.cwd(), 'workspace');
      baseName = path.basename(init.file!.name, path.extname(init.file!.name));
    }
    return {
      csvCategorias: categorizedMovementsToCsv(inputData.movimientos),
      baseName,
      outputDir,
    };
  })
  .then(saveCategorizedCsvStep)
  .map(async ({ getStepResult, getInitData }) => {
    const { markdown, text } = getStepResult<{ markdown: string; text: string }>('parse');
    const bank = getInitData<InputType>().bank;
    const extractorResult = getStepResult<{ movimientos: MovimientoRow[] }>(`bank-extractor-${bank}`);
    const saveResult = getStepResult<{ csvCategorias: string; csvCategoriasPath: string }>('save-categorized-csv');
    return {
      markdown,
      text,
      csv: movementsToCsv(extractorResult?.movimientos ?? []),
      csvCategorias: saveResult.csvCategorias,
      csvCategoriasPath: saveResult.csvCategoriasPath,
    };
  })
  .commit();

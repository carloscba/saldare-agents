import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const fileInputSchema = z.object({
  name: z.string(),
  data: z.string().describe('Contenido del PDF codificado en base64.'),
});

export const processBankStatement = createTool({
  id: 'process_bank_statement',
  description:
    'Procesa un extracto bancario (PDF): lo sube a LlamaCloud, lo parsea y extrae los movimientos en un CSV consolidado. Recibe una ruta local (filePath) o el contenido del PDF en base64 (file).',
  inputSchema: z.object({
    filePath: z
      .string()
      .optional()
      .describe('Ruta local absoluta o relativa del PDF.'),
    file: fileInputSchema
      .optional()
      .describe('PDF codificado en base64 (name + data).'),
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
  }),
  outputSchema: z.object({
    markdown: z.string().describe('Contenido completo en markdown.'),
    text: z.string().describe('Contenido completo en texto plano.'),
    csv: z
      .string()
      .describe(
        'CSV consolidado (RFC 4180) con una fila por movimiento de todas las tablas: columnas CUENTA | FECHA | DESCRIPCION | REFERENCIA | DEBITOS | CREDITOS | SALDO.'
      ),
  }),
  execute: async (input, context) => {
    let fileInput: { filePath?: string; file?: { name: string; data: string } };

    if (input.filePath) {
      fileInput = { filePath: input.filePath };
    } else if (input.file) {
      fileInput = { file: input.file };
    } else {
      throw new Error(
        'No se proporcionó una ruta de archivo (filePath) ni el contenido del PDF (file). Indicá la ruta local del PDF, por ejemplo workspace/statement.pdf.'
      );
    }

    const mastra = context.mastra;
    if (!mastra) {
      throw new Error('No se encontró la instancia de Mastra en el contexto.');
    }

    const workflow = mastra.getWorkflow('llamaCloudWorkflow');
    const run = await workflow.createRun();

    const result = await run.start({
      inputData: {
        ...fileInput,
        tier: input.tier,
        version: input.version,
        expand: input.expand,
        pollingInterval: input.pollingInterval,
        timeout: input.timeout,
      },
    });

    if (result.status !== 'success') {
      const message =
        result.status === 'failed'
          ? result.error.message
          : `El workflow finalizó con estado ${result.status}.`;
      throw new Error(message ?? 'El workflow falló al procesar el extracto.');
    }

    return result.result;
  },
});

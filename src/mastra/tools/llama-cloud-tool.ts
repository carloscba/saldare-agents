import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import fs from 'node:fs';
import LlamaCloud, { toFile } from '@llamaindex/llama-cloud';

let client: LlamaCloud | null = null;

function getClient(): LlamaCloud {
  if (!client) {
    const apiKey = process.env.LLAMA_CLOUD_API_KEY;
    if (!apiKey) {
      throw new Error('Missing LLAMA_CLOUD_API_KEY environment variable');
    }
    client = new LlamaCloud({ apiKey });
  }
  return client;
}

const fileInputSchema = z.object({
  name: z.string().describe('Nombre del archivo incluyendo extensión.'),
  data: z.string().describe('Contenido del archivo codificado en base64.'),
});

export const llamaCloudUpload = createTool({
  id: 'llama_cloud_upload',
  description:
    'Sube un archivo PDF a LlamaCloud y devuelve su fileId. Puede recibir una ruta local o el contenido del archivo en base64.',
  inputSchema: z
    .object({
      filePath: z
        .string()
        .optional()
        .describe('Ruta local absoluta o relativa del PDF.'),
      file: fileInputSchema
        .optional()
        .describe('Archivo codificado en base64 (name + data).'),
    })
    .refine((data) => data.filePath || data.file, {
      message: 'Debe proporcionar filePath o file.',
    }),
  outputSchema: z.object({
    fileId: z.string().describe('ID del archivo generado por LlamaCloud.'),
    name: z.string().describe('Nombre del archivo subido.'),
  }),
  execute: async ({ filePath, file }) => {
    let fileToUpload: any;

    if (filePath) {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      fileToUpload = fs.createReadStream(filePath);
    } else if (file) {
      const buffer = Buffer.from(file.data, 'base64');
      fileToUpload = await toFile(buffer, file.name, { type: 'application/pdf' });
    } else {
      throw new Error('Debe proporcionar filePath o file.');
    }

    const fileObj = await getClient().files.create({
      file: fileToUpload,
      purpose: 'parse',
    });

    return {
      fileId: fileObj.id,
      name: fileObj.name,
    };
  },
});

export const llamaCloudParse = createTool({
  id: 'llama_cloud_parse',
  description:
    'Parsea un archivo ya subido a LlamaCloud y devuelve markdown y texto plano.',
  inputSchema: z.object({
    fileId: z.string().describe('ID del archivo devuelto por llama_cloud_upload.'),
    tier: z
      .enum(['fast', 'cost_effective', 'agentic', 'agentic_plus'])
      .optional()
      .describe('Tier de parseo.'),
    version: z.string().optional().describe('Versión del tier.'),
    expand: z
      .array(z.string())
      .optional()
      .describe('Campos a expandir en la respuesta (ej. markdown_full, text_full).'),
    pollingInterval: z
      .number()
      .optional()
      .describe('Intervalo inicial de polling en segundos.'),
    timeout: z.number().optional().describe('Tiempo máximo de espera en segundos.'),
  }),
  outputSchema: z.object({
    markdown: z.string().describe('Contenido completo en markdown.'),
    text: z.string().describe('Contenido completo en texto plano.'),
  }),
  execute: async ({ fileId, tier, version, expand, pollingInterval, timeout }) => {
    const result = await getClient().parsing.parse(
      {
        file_id: fileId,
        tier: tier ?? 'cost_effective',
        version: version ?? 'latest',
        expand: expand ?? ['markdown_full', 'text_full'],
      },
      {
        pollingInterval,
        timeout,
      }
    );

    return {
      markdown: result.markdown_full ?? '',
      text: result.text_full ?? '',
    };
  },
});

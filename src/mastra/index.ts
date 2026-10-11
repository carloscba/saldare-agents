import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { DuckDBStore } from '@mastra/duckdb';
import { MastraCompositeStore } from '@mastra/core/storage';
import {
  MastraStorageExporter,
  MastraPlatformExporter,
  Observability,
  SensitiveDataFilter,
} from '@mastra/observability';
import { agent } from './agents/agent';
import { bankExtractors } from './agents/bank-extractors';
import { startScheduleTool, stopScheduleTool } from './tools/schedule-tools';
import { llamaCloudUpload, llamaCloudParse } from './tools/llama-cloud-tool';
import { processBankStatement } from './tools/process-bank-statement';
import { llamaCloudWorkflow } from './workflows/llama-cloud-workflow';

export const mastra = new Mastra({
  bundler: {
    externals: ['@duckdb/node-bindings'],
  },
  agents: {
    agent,
    ...Object.fromEntries(Object.values(bankExtractors).map((cfg) => [cfg.agent.id, cfg.agent])),
  },
  tools: { startScheduleTool, stopScheduleTool, llamaCloudUpload, llamaCloudParse, processBankStatement },
  workflows: { llamaCloudWorkflow },
  storage: new MastraCompositeStore({
    id: 'composite-storage',
    default: new LibSQLStore({
      id: 'mastra-storage',
      url: process.env.TURSO_DATABASE_URL || 'file:./mastra.db',
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    }),
    domains: {
      observability: await new DuckDBStore().getStore('observability'),
    },
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [new MastraStorageExporter(), new MastraPlatformExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
});

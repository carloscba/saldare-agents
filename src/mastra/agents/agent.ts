import { pathToFileURL } from 'node:url';
import { Agent } from '@mastra/core/agent';
import { TaskSignalProvider } from '@mastra/core/signals';
import { askUserTool, webFetchTool } from '@mastra/core/tools';
import { LocalFilesystem, LocalSandbox, WORKSPACE_TOOLS, Workspace } from '@mastra/core/workspace';
import { Memory } from '@mastra/memory';
import { startScheduleTool, stopScheduleTool } from '../tools/schedule-tools';
import { llamaCloudUpload, llamaCloudParse } from '../tools/llama-cloud-tool';
import { processBankStatement } from '../tools/process-bank-statement';
import { opencodeGoHeaders } from './opencode-headers';

const workspacePath = 'workspace';

const workspace = new Workspace({
  id: 'agent-workspace',
  name: 'Agent Workspace',
  filesystem: new LocalFilesystem({
    basePath: workspacePath,
  }),
  sandbox: new LocalSandbox({
    workingDirectory: workspacePath,
  }),
  tools: {
    [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: {
      requireReadBeforeWrite: true,
    },
    [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: {
      requireReadBeforeWrite: true,
    },
    [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: {
      requireApproval: true,
    },
    
  },
});

export const agent = new Agent({
  id: 'agent',
  name: 'Agent',
  description:
    'A general-purpose assistant that can research, manage tasks, work with local files, run approved commands, and create recurring schedules.',
  metadata: {
    suggestedPrompts: [
      "What's the weather in Austin this weekend?",
      "What's the SPCX stock price right now?",
      'Build a Japanese sakura festival landing page.',
    ],
  },
  instructions: `You are a friendly starter agent for exploring what Mastra can do. Help the user try useful capabilities, build small projects, answer current questions, and shape this harness into a starting point for future work.

Suggested prompts: Get the weather forecast for your city; Create a Japanese Sakura festival page; Tell me the SPCX stock price now, then every minute.

When the user greets you or does not have a specific task, invite them to try the suggested prompts.

Ask concise questions when something is unclear or a good question could surface a useful insight.

For local file changes, end with a plain-text URL using ${pathToFileURL(`${workspacePath}/`).href}; avoid Markdown links, localhost, /workspace, relative paths, and static-file servers.

When the user wants to process a PDF bank statement, ask them for the local file path (e.g. workspace/statement.pdf) and the bank (e.g. 'frances') if they are not provided. Invoke the tool 'process_bank_statement' with 'filePath' and 'bank' to upload it to LlamaCloud, parse it, and return the consolidated CSV of movements. Do not ask the user to attach the PDF in the chat; the model used by this agent does not support file attachments. Return the CSV to the user.
`,
  model: [
    {
      id: 'main',
      model: 'opencode-go/deepseek-v4-flash',
      headers: opencodeGoHeaders,
    },
  ],
  defaultOptions: {
    maxSteps: 100,
    autoResumeSuspendedTools: true,
  },
  memory: new Memory({
    options: {
      generateTitle: true,
      observationalMemory: {
        model: [
          {
            id: 'om-main',
            model: 'opencode-go/deepseek-v4-flash',
            headers: opencodeGoHeaders,
          },
        ],
      },
    },
  }),
  workspace,
  tools: {
    ask_user: askUserTool,
    start_schedule: startScheduleTool,
    stop_schedule: stopScheduleTool,
    llama_cloud_upload: llamaCloudUpload,
    llama_cloud_parse: llamaCloudParse,
    process_bank_statement: processBankStatement,
    web_fetch: webFetchTool,
  },
  signals: [new TaskSignalProvider()],
});

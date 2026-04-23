import { BrokerClient } from "./client/brokerClient.js";
import { getRunbookStatusTool } from "./tools/getRunbookStatus.js";
import { listRunbooksTool } from "./tools/listRunbooks.js";
import { runRunbookTool } from "./tools/runRunbook.js";
import { loadConfig } from "./util/config.js";

export type ToolResponse = {
  summary: string;
  data: unknown;
};

export type TeleClawPlugin = {
  name: string;
  tools: {
    list_runbooks: () => Promise<ToolResponse>;
    run_runbook: (input: unknown) => Promise<ToolResponse>;
    get_runbook_status: (input: unknown) => Promise<ToolResponse>;
  };
};

export function createTeleClawPlugin(): TeleClawPlugin {
  const config = loadConfig();
  const client = new BrokerClient({ baseUrl: config.brokerUrl, timeoutMs: config.timeoutMs });

  return {
    name: "teleclaw-plugin",
    tools: {
      list_runbooks: () => listRunbooksTool(client),
      run_runbook: (input: unknown) => runRunbookTool(client, input),
      get_runbook_status: (input: unknown) => getRunbookStatusTool(client, input)
    }
  };
}

// Native OpenClaw plugin runtime entrypoint.
// OpenClaw expects `register(api)` (or legacy `activate(api)`) exports.
export function register(api: any): void {
  const plugin = createTeleClawPlugin();

  api.registerTool({
    name: "list_runbooks",
    description: "List allowlisted TeleClaw runbooks from the broker",
    parameters: { type: "object", additionalProperties: false, properties: {} },
    execute: async () => {
      const out = await plugin.tools.list_runbooks();
      return {
        content: [{ type: "text", text: out.summary }],
        structuredContent: out.data
      };
    }
  });

  api.registerTool({
    name: "run_runbook",
    description: "Execute an allowlisted TeleClaw runbook by ID with typed inputs",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["runbook_id"],
      properties: {
        runbook_id: { type: "string", minLength: 1 },
        input: { type: "object", additionalProperties: { type: "string" } }
      }
    },
    execute: async (_id: string, input: unknown) => {
      const out = await plugin.tools.run_runbook(input);
      return {
        content: [{ type: "text", text: out.summary }],
        structuredContent: out.data
      };
    }
  });

  api.registerTool({
    name: "get_runbook_status",
    description: "Fetch runbook job status from the TeleClaw broker",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["job_id"],
      properties: {
        job_id: { type: "string", minLength: 1 }
      }
    },
    execute: async (_id: string, input: unknown) => {
      const out = await plugin.tools.get_runbook_status(input);
      return {
        content: [{ type: "text", text: out.summary }],
        structuredContent: out.data
      };
    }
  });
}

// Legacy alias still recognized by OpenClaw loader.
export const activate = register;

export default {
  id: "@teleclaw/openclaw-plugin",
  name: "TeleClaw OpenClaw Plugin",
  register
};

if (process.argv[1] && process.argv[1].endsWith("index.ts")) {
  console.log("TeleClaw plugin loaded. Exposed tools: list_runbooks, run_runbook, get_runbook_status");
}

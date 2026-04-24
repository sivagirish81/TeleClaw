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

type ExecuteArgs = [unknown] | [string, unknown];

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

function normalizeToolInput(args: ExecuteArgs): unknown {
  if (args.length === 1) {
    return args[0];
  }
  return args[1];
}

function toToolResult(out: ToolResponse) {
  return {
    content: [{ type: "text", text: out.summary }],
    structuredContent: out.data
  };
}

// Native OpenClaw plugin runtime entrypoint.
// OpenClaw expects `register(api)` (or legacy `activate(api)`) exports.
export function register(api: any): void {
  const plugin = createTeleClawPlugin();

  const registerList = (name: string) =>
    api.registerTool({
      name,
      description: "List allowlisted TeleClaw runbooks from the broker",
      parameters: { type: "object", additionalProperties: false, properties: {} },
      execute: async (...args: ExecuteArgs) => {
        const _input = normalizeToolInput(args);
        void _input;
        return toToolResult(await plugin.tools.list_runbooks());
      }
    });

  const registerRun = (name: string) =>
    api.registerTool({
      name,
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
      execute: async (...args: ExecuteArgs) => toToolResult(await plugin.tools.run_runbook(normalizeToolInput(args)))
    });

  const registerStatus = (name: string) =>
    api.registerTool({
      name,
      description: "Fetch runbook job status from the TeleClaw broker",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["job_id"],
        properties: {
          job_id: { type: "string", minLength: 1 }
        }
      },
      execute: async (...args: ExecuteArgs) => toToolResult(await plugin.tools.get_runbook_status(normalizeToolInput(args)))
    });

  // Canonical, low-collision names.
  registerList("teleclaw_list_runbooks");
  registerRun("teleclaw_run_runbook");
  registerStatus("teleclaw_get_runbook_status");

  // Backward-compatible aliases.
  registerList("list_runbooks");
  registerRun("run_runbook");
  registerStatus("get_runbook_status");
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

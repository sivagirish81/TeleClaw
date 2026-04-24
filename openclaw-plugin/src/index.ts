import { BrokerClient } from "./client/brokerClient.js";
import { getRunbookStatusTool } from "./tools/getRunbookStatus.js";
import { listRunbooksTool } from "./tools/listRunbooks.js";
import { runRunbookTool } from "./tools/runRunbook.js";
import { loadConfig } from "./util/config.js";

console.error("[teleclaw] module evaluated");

export type ToolResponse = {
  summary: string;
  data: unknown;
};

function toToolResult(out: ToolResponse) {
  return {
    content: [{ type: "text", text: out.summary }],
    structuredContent: out.data
  };
}

function getClient(ctx: any) {
  const fallback = loadConfig();
  const brokerUrl = ctx?.pluginConfig?.brokerUrl || fallback.brokerUrl;
  return new BrokerClient({
    baseUrl: brokerUrl,
    timeoutMs: fallback.timeoutMs
  });
}

export function register(api: any): void {
  console.error("[teleclaw] register called", {
    hasRegisterTool: typeof api?.registerTool === "function",
    apiKeys: Object.keys(api || {}).sort()
  });

  const r1 = api.registerTool({
    name: "teleclaw_list_runbooks",
    description: "List allowlisted TeleClaw runbooks from the broker",
    parameters: { type: "object", additionalProperties: false, properties: {} },
    execute: async (_input: unknown, ctx: any) => {
      console.error("[teleclaw] tool invoked: teleclaw_list_runbooks");
      const client = getClient(ctx);
      return toToolResult(await listRunbooksTool(client));
    }
  });
  console.error("[teleclaw] registered tool teleclaw_list_runbooks ->", r1);

  const r2 = api.registerTool({
    name: "teleclaw_run_runbook",
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
    execute: async (input: unknown, ctx: any) => {
      console.error("[teleclaw] tool invoked: teleclaw_run_runbook", JSON.stringify(input));
      const client = getClient(ctx);
      return toToolResult(await runRunbookTool(client, input));
    }
  });
  console.error("[teleclaw] registered tool teleclaw_run_runbook ->", r2);

  const r3 = api.registerTool({
    name: "teleclaw_get_runbook_status",
    description: "Fetch runbook job status from the TeleClaw broker",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["job_id"],
      properties: {
        job_id: { type: "string", minLength: 1 }
      }
    },
    execute: async (input: unknown, ctx: any) => {
      console.error("[teleclaw] tool invoked: teleclaw_get_runbook_status", JSON.stringify(input));
      const client = getClient(ctx);
      return toToolResult(await getRunbookStatusTool(client, input));
    }
  });
  console.error("[teleclaw] registered tool teleclaw_get_runbook_status ->", r3);
}

export const activate = register;

export default {
  id: "@teleclaw/openclaw-plugin",
  name: "TeleClaw OpenClaw Plugin",
  register
};

if (process.argv[1] && process.argv[1].endsWith("index.ts")) {
  console.log("TeleClaw plugin loaded. Exposed tools: teleclaw_list_runbooks, teleclaw_run_runbook, teleclaw_get_runbook_status");
}

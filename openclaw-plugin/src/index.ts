import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { Type } from "@sinclair/typebox";

import { BrokerClient } from "./client/brokerClient.js";
import { getRunbookStatusTool } from "./tools/getRunbookStatus.js";
import { listRunbooksTool } from "./tools/listRunbooks.js";
import { runRunbookTool } from "./tools/runRunbook.js";
import { loadConfig } from "./util/config.js";

type ToolResponse = {
  summary: string;
  data: unknown;
};

function toToolResult(out: ToolResponse) {
  return {
    content: [{ type: "text", text: out.summary }],
    structuredContent: out.data
  };
}

export default definePluginEntry({
  id: "@teleclaw/openclaw-plugin",
  name: "TeleClaw OpenClaw Plugin",
  description: "Run allowlisted TeleClaw runbooks through the local broker",

  register(api: any) {
    console.error("[teleclaw] capability register called");

    const fallback = loadConfig();
    const client = new BrokerClient({
      baseUrl: api.pluginConfig?.brokerUrl ?? fallback.brokerUrl,
      timeoutMs: fallback.timeoutMs
    });

    api.registerTool({
      name: "teleclaw_ping",
      description: "Debug ping tool",
      parameters: Type.Object({}),
      async execute(_id: string, _params: {}) {
        console.error("[teleclaw] tool invoked: teleclaw_ping");
        return {
          content: [{ type: "text", text: "pong from teleclaw" }]
        };
      }
    });

    api.registerTool({
      name: "teleclaw_list_runbooks",
      description: "List allowlisted TeleClaw runbooks from the broker",
      parameters: Type.Object({}),
      async execute(_id: string, _params: {}) {
        console.error("[teleclaw] tool invoked: teleclaw_list_runbooks");
        return toToolResult(await listRunbooksTool(client));
      }
    });

    api.registerTool({
      name: "teleclaw_run_runbook",
      description: "Execute an allowlisted TeleClaw runbook by ID with typed inputs",
      parameters: Type.Object({
        runbook_id: Type.String({ minLength: 1 }),
        input: Type.Optional(Type.Record(Type.String(), Type.String()))
      }),
      async execute(
        _id: string,
        params: { runbook_id: string; input?: Record<string, string> }
      ) {
        console.error("[teleclaw] tool invoked: teleclaw_run_runbook", JSON.stringify(params));
        return toToolResult(await runRunbookTool(client, params));
      }
    });

    api.registerTool({
      name: "teleclaw_get_runbook_status",
      description: "Fetch runbook job status from the TeleClaw broker",
      parameters: Type.Object({
        job_id: Type.String({ minLength: 1 })
      }),
      async execute(_id: string, params: { job_id: string }) {
        console.error("[teleclaw] tool invoked: teleclaw_get_runbook_status", JSON.stringify(params));
        return toToolResult(await getRunbookStatusTool(client, params));
      }
    });

    console.error("[teleclaw] capability tools registered");
  }
});

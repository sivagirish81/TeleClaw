import { Type } from "@sinclair/typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { BrokerClient } from "./client/brokerClient.js";
import { getRunbookStatusTool } from "./tools/getRunbookStatus.js";
import { listRunbooksTool } from "./tools/listRunbooks.js";
import { runRunbookTool } from "./tools/runRunbook.js";
import { loadConfig } from "./util/config.js";

function toToolResult(out: { summary: string; data: unknown }) {
  return {
    content: [{ type: "text", text: out.summary }],
    structuredContent: out.data
  };
}

function makeClient() {
  const config = loadConfig();
  return new BrokerClient({
    baseUrl: config.brokerUrl,
    timeoutMs: config.timeoutMs
  });
}

export default definePluginEntry({
  id: "@teleclaw/openclaw-plugin",
  name: "TeleClaw OpenClaw Plugin",
  description: "Run allowlisted TeleClaw runbooks through the local broker",
  register(api: any) {
    api.registerTool({
      name: "teleclaw_list_runbooks",
      description: "List allowlisted TeleClaw runbooks from the broker",
      parameters: Type.Object({}),
      async execute(_id: string, _params: unknown) {
        console.error("[teleclaw] tool invoked: teleclaw_list_runbooks");
        const client = makeClient();
        return toToolResult(await listRunbooksTool(client));
      }
    });

    api.registerTool({
      name: "teleclaw_run_runbook",
      description: "Execute an allowlisted TeleClaw runbook",
      parameters: Type.Object({
        runbook_id: Type.String({ minLength: 1 }),
        input: Type.Optional(Type.Record(Type.String(), Type.String()))
      }),
      async execute(_id: string, params: unknown) {
        console.error("[teleclaw] tool invoked: teleclaw_run_runbook", JSON.stringify(params));
        const client = makeClient();
        return toToolResult(await runRunbookTool(client, params));
      }
    });

    api.registerTool({
      name: "teleclaw_get_runbook_status",
      description: "Fetch TeleClaw runbook status",
      parameters: Type.Object({
        job_id: Type.String({ minLength: 1 })
      }),
      async execute(_id: string, params: unknown) {
        console.error("[teleclaw] tool invoked: teleclaw_get_runbook_status", JSON.stringify(params));
        const client = makeClient();
        return toToolResult(await getRunbookStatusTool(client, params));
      }
    });

    api.registerTool({
      name: "teleclaw_ping",
      description: "Debug ping tool",
      parameters: Type.Object({}),
      async execute(_id: string, _params: unknown) {
        console.error("[teleclaw] tool invoked: teleclaw_ping");
        return {
          content: [{ type: "text", text: "pong from teleclaw" }]
        };
      }
    });
  }
});

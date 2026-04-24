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

type CommandContext = {
  argv?: string[];
  args?: string[];
  input?: string;
  raw?: string;
};

function toToolResult(out: ToolResponse) {
  return {
    content: [{ type: "text", text: out.summary }],
    structuredContent: out.data
  };
}

function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function parseKeyValueArgs(ctx: CommandContext): Record<string, string> {
  const tokens = [
    ...(Array.isArray(ctx.argv) ? ctx.argv : []),
    ...(Array.isArray(ctx.args) ? ctx.args : []),
    ...(typeof ctx.input === "string" ? ctx.input.split(/\s+/) : []),
    ...(typeof ctx.raw === "string" ? ctx.raw.split(/\s+/) : [])
  ].filter(Boolean);

  const out: Record<string, string> = {};
  for (const token of tokens) {
    const [k, ...rest] = token.split("=");
    if (!k || rest.length === 0) {
      continue;
    }
    out[k.trim()] = rest.join("=").trim();
  }
  return out;
}

function registerCommandCompat(
  api: any,
  name: string,
  description: string,
  execute: (ctx?: CommandContext) => Promise<{ content: string }> | { content: string }
): void {
  if (typeof api?.registerCommand !== "function") {
    console.error(`[teleclaw] registerCommand unavailable; skipping command ${name}`);
    return;
  }

  const commandDef = {
    id: name,
    name,
    command: name,
    description,
    parameters: Type.Object({}),
    async execute(ctx?: CommandContext) {
      return execute(ctx);
    },
    async run(ctx?: CommandContext) {
      return execute(ctx);
    },
    async handler(ctx?: CommandContext) {
      return execute(ctx);
    }
  };

  const attempts: Array<() => void> = [
    () => api.registerCommand(commandDef),
    () => api.registerCommand(name, commandDef),
    () => api.registerCommand(name, async (ctx: CommandContext) => execute(ctx))
  ];

  for (const attempt of attempts) {
    try {
      attempt();
      console.error(`[teleclaw] command registered: ${name}`);
      return;
    } catch (error) {
      console.error(`[teleclaw] command registration attempt failed for ${name}`, error);
    }
  }

  console.error(`[teleclaw] failed to register command ${name}`);
}

function registerRuntime(api: any): void {
  console.error("[teleclaw] runtime register called");

  const fallback = loadConfig();
  const client = new BrokerClient({
    baseUrl: api?.pluginConfig?.brokerUrl ?? fallback.brokerUrl,
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

  registerCommandCompat(
    api,
    "teleclaw-ping",
    "Ping TeleClaw plugin connectivity",
    async () => ({ content: "pong from teleclaw" })
  );

  registerCommandCompat(
    api,
    "teleclaw-runbooks",
    "List allowlisted TeleClaw runbooks",
    async () => {
      const out = await listRunbooksTool(client);
      return { content: `${out.summary}\n\n${formatJson(out.data)}` };
    }
  );

  registerCommandCompat(
    api,
    "teleclaw-run",
    "Run a TeleClaw runbook. Example: /teleclaw-run runbook_id=k8s.release_diagnose namespace=mock-app workload=mock-web log_tail_lines=100",
    async (ctx?: CommandContext) => {
      const kv = parseKeyValueArgs(ctx ?? {});
      const runbookId = kv.runbook_id ?? kv.runbook ?? kv.id;

      if (!runbookId) {
        return {
          content:
            "Missing runbook_id. Example: /teleclaw-run runbook_id=k8s.release_diagnose namespace=mock-app workload=mock-web log_tail_lines=100"
        };
      }

      delete kv.runbook_id;
      delete kv.runbook;
      delete kv.id;

      const out = await runRunbookTool(client, {
        runbook_id: runbookId,
        input: kv
      });

      return { content: `${out.summary}\n\n${formatJson(out.data)}` };
    }
  );

  registerCommandCompat(
    api,
    "teleclaw-status",
    "Get TeleClaw job status. Example: /teleclaw-status job_id=job-abc123",
    async (ctx?: CommandContext) => {
      const kv = parseKeyValueArgs(ctx ?? {});
      const jobId = kv.job_id ?? kv.id;

      if (!jobId) {
        return {
          content: "Missing job_id. Example: /teleclaw-status job_id=job-abc123"
        };
      }

      const out = await getRunbookStatusTool(client, { job_id: jobId });
      return { content: `${out.summary}\n\n${formatJson(out.data)}` };
    }
  );

  console.error("[teleclaw] tools and commands registered");
}

export default definePluginEntry({
  id: "@teleclaw/openclaw-plugin",
  name: "TeleClaw OpenClaw Plugin",
  description: "Run allowlisted TeleClaw runbooks through the local broker",
  registerFull(api: any) {
    registerRuntime(api);
  },
  register(api: any) {
    // Backward compatibility for runtimes still calling register.
    registerRuntime(api);
  }
});

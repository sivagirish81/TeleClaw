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

type CommandResponse = {
  text: string;
  data?: unknown;
};

function toToolResult(out: ToolResponse) {
  return {
    content: [{ type: "text", text: out.summary }],
    structuredContent: out.data
  };
}

function toCommandResult(out: CommandResponse) {
  return {
    text: out.text,
    message: out.text,
    content: [{ type: "text", text: out.text }],
    structuredContent: out.data
  };
}

function formatJSON(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function ensureRegistrationAPI(api: any): asserts api is {
  registerTool: (tool: any) => void;
  registerCommand: (...args: any[]) => void;
  pluginConfig?: { brokerUrl?: string };
} {
  if (typeof api?.registerTool !== "function") {
    throw new Error("[teleclaw] registerTool is unavailable in this OpenClaw runtime");
  }
  if (typeof api?.registerCommand !== "function") {
    throw new Error("[teleclaw] registerCommand is unavailable in this OpenClaw runtime");
  }
}

function registerRuntime(api: any): void {
  if ((globalThis as any).__teleclawRuntimeRegistered) {
    console.error("[teleclaw] runtime already registered; skipping duplicate hook");
    return;
  }
  (globalThis as any).__teleclawRuntimeRegistered = true;

  ensureRegistrationAPI(api);

  const fallback = loadConfig();
  const brokerUrl = api.pluginConfig?.brokerUrl ?? fallback.brokerUrl;
  const client = new BrokerClient({
    baseUrl: brokerUrl,
    timeoutMs: fallback.timeoutMs
  });

  let lastJobID: string | undefined;
  const registeredTools: string[] = [];
  const registeredCommands: string[] = [];

  const registerTool = (toolDef: any) => {
    try {
      api.registerTool(toolDef);
      registeredTools.push(toolDef.name);
    } catch (err) {
      console.error(`[teleclaw] registerTool failed for ${toolDef.name}`, err);
    }
  };

  const registerCommand = (commandDef: any) => {
    try {
      api.registerCommand(commandDef);
      registeredCommands.push(commandDef.name);
      return;
    } catch (err) {
      console.error(`[teleclaw] registerCommand(object) failed for ${commandDef.name}`, err);
    }

    try {
      api.registerCommand(commandDef.name, commandDef);
      registeredCommands.push(commandDef.name);
      return;
    } catch (err) {
      console.error(`[teleclaw] registerCommand(name, object) failed for ${commandDef.name}`, err);
    }

    console.error(`[teleclaw] unable to register command ${commandDef.name}`);
  };

  registerTool({
    name: "teleclaw_ping",
    description: "Debug ping tool",
    parameters: Type.Object({}),
    async execute(_id: string, _params: {}) {
      console.error("[teleclaw] tool invoked: teleclaw_ping");
      return { content: [{ type: "text", text: "pong from teleclaw" }] };
    }
  });

  registerTool({
    name: "teleclaw_list_runbooks",
    description: "List allowlisted TeleClaw runbooks from the broker",
    parameters: Type.Object({}),
    async execute(_id: string, _params: {}) {
      console.error("[teleclaw] tool invoked: teleclaw_list_runbooks");
      return toToolResult(await listRunbooksTool(client));
    }
  });

  registerTool({
    name: "teleclaw_run_runbook",
    description: "Execute an allowlisted TeleClaw runbook by ID with typed inputs",
    parameters: Type.Object({
      runbook_id: Type.String({ minLength: 1 }),
      input: Type.Optional(Type.Record(Type.String(), Type.String()))
    }),
    async execute(_id: string, params: { runbook_id: string; input?: Record<string, string> }) {
      console.error("[teleclaw] tool invoked: teleclaw_run_runbook", JSON.stringify(params));
      const out = await runRunbookTool(client, params);
      const maybeJobID = (out.data as Record<string, unknown> | undefined)?.job_id;
      if (typeof maybeJobID === "string" && maybeJobID.trim() !== "") {
        lastJobID = maybeJobID;
      }
      return toToolResult(out);
    }
  });

  registerTool({
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

  // Compatibility aliases so tool calls from older prompts/config still work.
  registerTool({
    name: "list_runbooks",
    description: "Alias for teleclaw_list_runbooks",
    parameters: Type.Object({}),
    async execute(_id: string, _params: {}) {
      console.error("[teleclaw] tool invoked: list_runbooks");
      return toToolResult(await listRunbooksTool(client));
    }
  });

  registerTool({
    name: "run_runbook",
    description: "Alias for teleclaw_run_runbook",
    parameters: Type.Object({
      runbook_id: Type.String({ minLength: 1 }),
      input: Type.Optional(Type.Record(Type.String(), Type.String()))
    }),
    async execute(_id: string, params: { runbook_id: string; input?: Record<string, string> }) {
      console.error("[teleclaw] tool invoked: run_runbook", JSON.stringify(params));
      const out = await runRunbookTool(client, params);
      const maybeJobID = (out.data as Record<string, unknown> | undefined)?.job_id;
      if (typeof maybeJobID === "string" && maybeJobID.trim() !== "") {
        lastJobID = maybeJobID;
      }
      return toToolResult(out);
    }
  });

  registerTool({
    name: "get_runbook_status",
    description: "Alias for teleclaw_get_runbook_status",
    parameters: Type.Object({
      job_id: Type.String({ minLength: 1 })
    }),
    async execute(_id: string, params: { job_id: string }) {
      console.error("[teleclaw] tool invoked: get_runbook_status", JSON.stringify(params));
      return toToolResult(await getRunbookStatusTool(client, params));
    }
  });

  const registerCommandPair = (primary: string, alias: string, build: () => any) => {
    const a = build();
    a.id = primary;
    a.name = primary;
    a.command = primary;
    registerCommand(a);

    const b = build();
    b.id = alias;
    b.name = alias;
    b.command = alias;
    registerCommand(b);
  };

  registerCommandPair("teleclaw-ping", "teleclaw_ping", () => ({
    id: "teleclaw-ping",
    name: "teleclaw-ping",
    command: "teleclaw-ping",
    description: "Ping TeleClaw plugin connectivity",
    parameters: Type.Object({}),
    async execute(_params: {}) {
      console.error("[teleclaw] command invoked: teleclaw-ping");
      return toCommandResult({ text: "pong from teleclaw" });
    }
  }));

  registerCommandPair("teleclaw-runbooks", "teleclaw_runbooks", () => ({
    id: "teleclaw-runbooks",
    name: "teleclaw-runbooks",
    command: "teleclaw-runbooks",
    description: "List allowlisted TeleClaw runbooks",
    parameters: Type.Object({}),
    async execute(_params: {}) {
      console.error("[teleclaw] command invoked: teleclaw-runbooks");
      const out = await listRunbooksTool(client);
      return toCommandResult({ text: `${out.summary}\n\n${formatJSON(out.data)}`, data: out.data });
    }
  }));

  registerCommandPair("teleclaw-run", "teleclaw_run", () => ({
    id: "teleclaw-run",
    name: "teleclaw-run",
    command: "teleclaw-run",
    description: "Run the Kubernetes diagnose flow for mock-app/mock-web",
    parameters: Type.Object({}),
    async execute(_params: {}) {
      console.error("[teleclaw] command invoked: teleclaw-run");
      const payload = {
        runbook_id: "k8s.release_diagnose",
        input: {
          namespace: "mock-app",
          workload: "mock-web",
          log_tail_lines: "100"
        }
      };
      const out = await runRunbookTool(client, payload);
      const maybeJobID = (out.data as Record<string, unknown> | undefined)?.job_id;
      if (typeof maybeJobID === "string" && maybeJobID.trim() !== "") {
        lastJobID = maybeJobID;
      }
      return toCommandResult({ text: `${out.summary}\n\n${formatJSON(out.data)}`, data: out.data });
    }
  }));

  registerCommandPair("teleclaw-status", "teleclaw_status", () => ({
    id: "teleclaw-status",
    name: "teleclaw-status",
    command: "teleclaw-status",
    description: "Get status of the latest TeleClaw run",
    parameters: Type.Object({}),
    async execute(_params: {}) {
      console.error("[teleclaw] command invoked: teleclaw-status");
      if (!lastJobID) {
        return toCommandResult({ text: "No run tracked yet. Run /teleclaw-run first." });
      }
      const out = await getRunbookStatusTool(client, { job_id: lastJobID });
      return toCommandResult({ text: `${out.summary}\n\n${formatJSON(out.data)}`, data: out.data });
    }
  }));

  console.error(
    "[teleclaw] runtime registered",
    JSON.stringify({ brokerUrl, tools: registeredTools, commands: registeredCommands })
  );
}

export default definePluginEntry({
  id: "@teleclaw/openclaw-plugin",
  name: "TeleClaw OpenClaw Plugin",
  description: "Run allowlisted TeleClaw runbooks through the local broker",
  registerFull(api: any) {
    registerRuntime(api);
  },
  register(api: any) {
    registerRuntime(api);
  }
});

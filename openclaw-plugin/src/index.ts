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
  commandBody?: string;
  params?: Record<string, unknown>;
};

type CommandResult = {
  text: string;
  data?: unknown;
};

function toToolResult(out: ToolResponse) {
  return {
    content: [{ type: "text", text: out.summary }],
    structuredContent: out.data
  };
}

function toCommandResult(out: CommandResult) {
  return {
    text: out.text,
    message: out.text,
    content: [{ type: "text", text: out.text }],
    structuredContent: out.data
  };
}

function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function coerceCommandContext(args: unknown[]): CommandContext {
  const ctx: CommandContext = {};

  for (const arg of args) {
    if (!arg) {
      continue;
    }

    if (typeof arg === "string") {
      ctx.raw = [ctx.raw, arg].filter(Boolean).join(" ");
      continue;
    }

    if (typeof arg !== "object") {
      continue;
    }

    const obj = arg as Record<string, unknown>;

    if (Array.isArray(obj.argv)) {
      ctx.argv = obj.argv.filter((x): x is string => typeof x === "string");
    }
    if (Array.isArray(obj.args)) {
      ctx.args = obj.args.filter((x): x is string => typeof x === "string");
    }
    if (typeof obj.input === "string") {
      ctx.input = obj.input;
    }
    if (typeof obj.raw === "string") {
      ctx.raw = obj.raw;
    }
    if (typeof obj.commandBody === "string") {
      ctx.commandBody = obj.commandBody;
    }

    if (obj.params && typeof obj.params === "object" && !Array.isArray(obj.params)) {
      ctx.params = obj.params as Record<string, unknown>;
      const nestedBody = (ctx.params as Record<string, unknown>).commandBody;
      if (typeof nestedBody === "string") {
        ctx.commandBody = nestedBody;
      }
    }

    if (!ctx.params) {
      ctx.params = obj;
    }
  }

  return ctx;
}

function parseArgString(argString: string, allowedKeys?: Set<string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const token of argString.split(/\s+/).filter(Boolean)) {
    const [k, ...rest] = token.split("=");
    if (!k || rest.length === 0) {
      continue;
    }
    const key = k.trim();
    if (allowedKeys && !allowedKeys.has(key)) {
      continue;
    }
    out[key] = rest.join("=").trim();
  }
  return out;
}

function parseKeyValueArgs(ctx: CommandContext, allowedKeys?: Set<string>): Record<string, string> {
  const out: Record<string, string> = {};

  if (ctx.params) {
    for (const [key, value] of Object.entries(ctx.params)) {
      if (value == null) {
        continue;
      }
      if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
        continue;
      }
      if (allowedKeys && !allowedKeys.has(key)) {
        continue;
      }
      out[key] = String(value);
    }
  }

  const tokenSources = [
    ...(Array.isArray(ctx.argv) ? ctx.argv : []),
    ...(Array.isArray(ctx.args) ? ctx.args : []),
    ...(typeof ctx.input === "string" ? ctx.input.split(/\s+/) : []),
    ...(typeof ctx.raw === "string" ? ctx.raw.split(/\s+/) : [])
  ].filter(Boolean);

  for (const token of tokenSources) {
    const [k, ...rest] = token.split("=");
    if (!k || rest.length === 0) {
      continue;
    }
    const key = k.trim();
    if (allowedKeys && !allowedKeys.has(key)) {
      continue;
    }
    out[key] = rest.join("=").trim();
  }

  return out;
}

function extractCommandTail(commandBody: string, commandName: string): string | null {
  const body = commandBody.trim();
  const slashPrefix = `/${commandName}`;
  const barePrefix = commandName;

  if (body === slashPrefix || body === barePrefix) {
    return "";
  }
  if (body.startsWith(`${slashPrefix} `)) {
    return body.slice(slashPrefix.length).trim();
  }
  if (body.startsWith(`${barePrefix} `)) {
    return body.slice(barePrefix.length).trim();
  }
  return null;
}

function extractTailFromContext(ctx: CommandContext, commandNames: string[]): string {
  const candidates = [ctx.commandBody, ctx.raw, ctx.input];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }
    for (const name of commandNames) {
      const tail = extractCommandTail(candidate, name);
      if (tail !== null) {
        return tail;
      }
    }
  }

  return "";
}

function registerCommandCompat(
  api: any,
  names: string[],
  description: string,
  execute: (ctx: CommandContext) => Promise<CommandResult>
): void {
  if (typeof api?.registerCommand !== "function") {
    console.error(`[teleclaw] registerCommand unavailable; skipping command ${names.join(",")}`);
    return;
  }

  const primary = names[0];
  if (!primary) {
    return;
  }

  const invoke = async (...args: unknown[]) => {
    const ctx = coerceCommandContext(args);
    console.error(`[teleclaw] command invoked: ${primary}`, JSON.stringify(ctx));
    return toCommandResult(await execute(ctx));
  };

  for (const name of names) {
    const commandDef = {
      id: name,
      name,
      command: name,
      description,
      async execute(...args: unknown[]) {
        return invoke(...args);
      },
      async run(...args: unknown[]) {
        return invoke(...args);
      },
      async handler(...args: unknown[]) {
        return invoke(...args);
      }
    };

    const attempts: Array<() => void> = [
      () => api.registerCommand(name, description, (...args: unknown[]) => invoke(...args)),
      () => api.registerCommand(name, (...args: unknown[]) => invoke(...args)),
      () => api.registerCommand(commandDef),
      () => api.registerCommand(name, commandDef)
    ];

    let registered = false;
    for (const attempt of attempts) {
      try {
        attempt();
        console.error(`[teleclaw] command registered: ${name}`);
        registered = true;
        break;
      } catch (error) {
        console.error(`[teleclaw] command registration attempt failed for ${name}`, error);
      }
    }

    if (!registered) {
      console.error(`[teleclaw] failed to register command ${name}`);
    }
  }
}

function registerToolCompat(api: any, toolDef: any): void {
  if (typeof api?.registerTool !== "function") {
    console.error(`[teleclaw] registerTool unavailable; skipping ${toolDef?.name ?? "unknown"}`);
    return;
  }

  try {
    api.registerTool(toolDef);
    console.error(`[teleclaw] tool registered: ${toolDef.name}`);
  } catch (error) {
    console.error(`[teleclaw] failed to register tool ${toolDef.name}`, error);
  }
}

function registerRuntime(api: any): void {
  if ((globalThis as any).__teleclawRuntimeRegistered) {
    console.error("[teleclaw] runtime already registered; skipping duplicate hook");
    return;
  }
  (globalThis as any).__teleclawRuntimeRegistered = true;

  const fallback = loadConfig();
  const brokerUrl = api?.pluginConfig?.brokerUrl ?? fallback.brokerUrl;
  const client = new BrokerClient({
    baseUrl: brokerUrl,
    timeoutMs: fallback.timeoutMs
  });

  console.error("[teleclaw] runtime register called", JSON.stringify({ brokerUrl }));

  registerToolCompat(api, {
    name: "teleclaw_ping",
    description: "Debug ping tool",
    parameters: Type.Object({}),
    async execute(_id: string, _params: {}) {
      console.error("[teleclaw] tool invoked: teleclaw_ping");
      return { content: [{ type: "text", text: "pong from teleclaw" }] };
    }
  });

  registerToolCompat(api, {
    name: "teleclaw_list_runbooks",
    description: "List allowlisted TeleClaw runbooks from the broker",
    parameters: Type.Object({}),
    async execute(_id: string, _params: {}) {
      console.error("[teleclaw] tool invoked: teleclaw_list_runbooks");
      return toToolResult(await listRunbooksTool(client));
    }
  });

  registerToolCompat(api, {
    name: "teleclaw_run_runbook",
    description: "Execute an allowlisted TeleClaw runbook by ID with typed inputs",
    parameters: Type.Object({
      runbook_id: Type.String({ minLength: 1 }),
      input: Type.Optional(Type.Record(Type.String(), Type.String()))
    }),
    async execute(_id: string, params: { runbook_id: string; input?: Record<string, string> }) {
      console.error("[teleclaw] tool invoked: teleclaw_run_runbook", JSON.stringify(params));
      return toToolResult(await runRunbookTool(client, params));
    }
  });

  registerToolCompat(api, {
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

  // Legacy aliases for model routing compatibility.
  registerToolCompat(api, {
    name: "list_runbooks",
    description: "Alias for teleclaw_list_runbooks",
    parameters: Type.Object({}),
    async execute(_id: string, _params: {}) {
      console.error("[teleclaw] tool invoked: list_runbooks");
      return toToolResult(await listRunbooksTool(client));
    }
  });

  registerToolCompat(api, {
    name: "run_runbook",
    description: "Alias for teleclaw_run_runbook",
    parameters: Type.Object({
      runbook_id: Type.String({ minLength: 1 }),
      input: Type.Optional(Type.Record(Type.String(), Type.String()))
    }),
    async execute(_id: string, params: { runbook_id: string; input?: Record<string, string> }) {
      console.error("[teleclaw] tool invoked: run_runbook", JSON.stringify(params));
      return toToolResult(await runRunbookTool(client, params));
    }
  });

  registerToolCompat(api, {
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

  registerCommandCompat(
    api,
    ["teleclaw-ping", "teleclaw_ping"],
    "Ping TeleClaw plugin connectivity",
    async () => ({ text: "pong from teleclaw" })
  );

  registerCommandCompat(
    api,
    ["teleclaw-runbooks", "teleclaw_runbooks"],
    "List allowlisted TeleClaw runbooks",
    async () => {
      const out = await listRunbooksTool(client);
      return { text: `${out.summary}\n\n${formatJson(out.data)}`, data: out.data };
    }
  );

  registerCommandCompat(
    api,
    ["teleclaw-run", "teleclaw_run"],
    "Run a TeleClaw runbook",
    async (ctx) => {
      const allowedRunKeys = new Set([
        "runbook_id",
        "runbook",
        "id",
        "namespace",
        "workload",
        "log_tail_lines",
        "selector",
        "tail_lines",
        "host",
        "journal_lines"
      ]);

      let kv = parseKeyValueArgs(ctx, allowedRunKeys);
      const tail = extractTailFromContext(ctx, ["teleclaw-run", "teleclaw_run"]);
      if (tail) {
        kv = { ...kv, ...parseArgString(tail, allowedRunKeys) };
      }

      const runbookId = kv.runbook_id ?? kv.runbook ?? kv.id;
      if (!runbookId) {
        return {
          text:
            "Missing runbook_id. Example: /teleclaw-run runbook_id=k8s.release_diagnose namespace=mock-app workload=mock-web log_tail_lines=100"
        };
      }

      delete kv.runbook_id;
      delete kv.runbook;
      delete kv.id;

      const payload = {
        runbook_id: runbookId,
        input: kv
      };

      console.error("[teleclaw] calling broker", JSON.stringify({ brokerUrl, payload }));
      const out = await runRunbookTool(client, payload);
      return { text: `${out.summary}\n\n${formatJson(out.data)}`, data: out.data };
    }
  );

  registerCommandCompat(
    api,
    ["teleclaw-status", "teleclaw_status"],
    "Get TeleClaw job status",
    async (ctx) => {
      const allowedStatusKeys = new Set(["job_id", "id"]);
      let kv = parseKeyValueArgs(ctx, allowedStatusKeys);
      const tail = extractTailFromContext(ctx, ["teleclaw-status", "teleclaw_status"]);
      if (tail) {
        kv = { ...kv, ...parseArgString(tail, allowedStatusKeys) };
      }

      const jobId = kv.job_id ?? kv.id;
      if (!jobId) {
        return { text: "Missing job_id. Example: /teleclaw-status job_id=job-abc123" };
      }

      const out = await getRunbookStatusTool(client, { job_id: jobId });
      return { text: `${out.summary}\n\n${formatJson(out.data)}`, data: out.data };
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
    registerRuntime(api);
  }
});

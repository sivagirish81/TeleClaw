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

function toToolResult(out: ToolResponse) {
  return {
    content: [{ type: "text", text: out.summary }],
    structuredContent: out.data
  };
}

function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function toCommandTextResult(text: string, data?: unknown) {
  return {
    text,
    message: text,
    content: [{ type: "text", text }],
    structuredContent: data
  };
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
      const nestedBody = (ctx.params as Record<string, unknown>)["commandBody"];
      if (typeof nestedBody === "string") {
        ctx.commandBody = nestedBody;
      }
    }
    if (!ctx.params && !Array.isArray(obj) && typeof obj === "object") {
      ctx.params = obj;
    }
  }

  return ctx;
}

function parseKeyValueArgs(ctx: CommandContext): Record<string, string> {
  const tokens = [
    ...(Array.isArray(ctx.argv) ? ctx.argv : []),
    ...(Array.isArray(ctx.args) ? ctx.args : []),
    ...(typeof ctx.input === "string" ? ctx.input.split(/\s+/) : []),
    ...(typeof ctx.raw === "string" ? ctx.raw.split(/\s+/) : [])
  ].filter(Boolean);

  const out: Record<string, string> = {};

  if (ctx.params) {
    for (const [key, value] of Object.entries(ctx.params)) {
      if (value == null) {
        continue;
      }
      if (key === "commandBody" || key === "command" || key === "name") {
        continue;
      }
      out[key] = String(value);
    }
  }

  for (const token of tokens) {
    const [k, ...rest] = token.split("=");
    if (!k || rest.length === 0) {
      continue;
    }
    out[k.trim()] = rest.join("=").trim();
  }
  return out;
}

function parseArgString(argString: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const token of argString.split(/\s+/).filter(Boolean)) {
    const [k, ...rest] = token.split("=");
    if (!k || rest.length === 0) {
      continue;
    }
    out[k.trim()] = rest.join("=").trim();
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

function extractTailFromContext(ctx: CommandContext, commandName: string): string | null {
  const candidates = [ctx.commandBody, ctx.raw, ctx.input];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }
    const tail = extractCommandTail(candidate, commandName);
    if (tail !== null) {
      return tail;
    }
  }

  if (Array.isArray(ctx.argv) && ctx.argv.length > 0) {
    const tail = extractCommandTail(ctx.argv.join(" "), commandName);
    if (tail !== null) {
      return tail;
    }
  }
  if (Array.isArray(ctx.args) && ctx.args.length > 0) {
    const tail = extractCommandTail(ctx.args.join(" "), commandName);
    if (tail !== null) {
      return tail;
    }
  }

  return null;
}

function registerCommandCompat(
  api: any,
  name: string,
  description: string,
  execute: (ctx?: CommandContext) => Promise<{ text: string; data?: unknown }> | { text: string; data?: unknown }
): void {
  if (typeof api?.registerCommand !== "function") {
    console.error(`[teleclaw] registerCommand unavailable; skipping command ${name}`);
    return;
  }

  const invoke = async (...args: unknown[]) => {
    const ctx = coerceCommandContext(args);
    console.error(`[teleclaw] command invoked: ${name}`, JSON.stringify(ctx));
    const out = await execute(ctx);
    return toCommandTextResult(out.text, out.data);
  };

  const commandDef = {
    id: name,
    name,
    command: name,
    description,
    parameters: Type.Object({}),
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
    () => api.registerCommand(commandDef),
    () => api.registerCommand(name, commandDef),
    () => api.registerCommand(name, description, (...args: unknown[]) => invoke(...args)),
    () => api.registerCommand(name, (...args: unknown[]) => invoke(...args))
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
  if ((globalThis as any).__teleclawRuntimeRegistered) {
    console.error("[teleclaw] runtime already registered; skipping duplicate hook");
    return;
  }
  (globalThis as any).__teleclawRuntimeRegistered = true;
  console.error("[teleclaw] runtime register called");

  const fallback = loadConfig();
  const brokerUrl = api?.pluginConfig?.brokerUrl ?? fallback.brokerUrl;
  const client = new BrokerClient({
    baseUrl: brokerUrl,
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
    async () => {
      console.error("[teleclaw] command returning to chat: teleclaw-ping");
      return { text: "pong from teleclaw" };
    }
  );

  registerCommandCompat(
    api,
    "teleclaw-runbooks",
    "List allowlisted TeleClaw runbooks",
    async () => {
      const out = await listRunbooksTool(client);
      console.error("[teleclaw] command returning to chat: teleclaw-runbooks");
      return { text: `${out.summary}\n\n${formatJson(out.data)}`, data: out.data };
    }
  );

  registerCommandCompat(
    api,
    "teleclaw-run",
    "Run a TeleClaw runbook. Example: /teleclaw-run runbook_id=k8s.release_diagnose namespace=mock-app workload=mock-web log_tail_lines=100",
    async (ctx?: CommandContext) => {
      console.error(
        "[teleclaw] command invoked: teleclaw-run",
        ctx?.commandBody ?? ctx?.raw ?? ctx?.input ?? ""
      );

      let kv = parseKeyValueArgs(ctx ?? {});
      if (ctx) {
        const tail = extractTailFromContext(ctx, "teleclaw-run");
        if (tail !== null) {
          kv = { ...kv, ...parseArgString(tail) };
        }
      }

      console.error("[teleclaw] parsed args", JSON.stringify(kv));
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
      console.error("[teleclaw] calling broker", brokerUrl, JSON.stringify(payload));
      const out = await runRunbookTool(client, payload);
      console.error("[teleclaw] broker response", JSON.stringify(out.data));
      console.error("[teleclaw] command returning to chat");

      return { text: `${out.summary}\n\n${formatJson(out.data)}`, data: out.data };
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
          text: "Missing job_id. Example: /teleclaw-status job_id=job-abc123"
        };
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
    // Backward compatibility for runtimes still calling register.
    registerRuntime(api);
  }
});

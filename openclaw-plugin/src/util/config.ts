export type PluginConfig = {
  brokerUrl: string;
  timeoutMs: number;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): PluginConfig {
  const brokerUrl = env.TELECLAW_BROKER_URL ?? "http://127.0.0.1:8080";
  const timeoutMs = Number(env.TELECLAW_REQUEST_TIMEOUT_MS ?? "10000");

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("TELECLAW_REQUEST_TIMEOUT_MS must be a positive number");
  }

  return { brokerUrl, timeoutMs };
}

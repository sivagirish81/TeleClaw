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

if (process.argv[1] && process.argv[1].endsWith("index.ts")) {
  console.log("TeleClaw plugin loaded. Exposed tools: list_runbooks, run_runbook, get_runbook_status");
}

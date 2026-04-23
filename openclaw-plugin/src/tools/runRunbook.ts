import { BrokerClient } from "../client/brokerClient.js";
import { runRunbookInputSchema } from "../schemas/runbook.js";

export async function runRunbookTool(client: BrokerClient, input: unknown) {
  const parsed = runRunbookInputSchema.parse(input);
  const data = await client.runRunbook(parsed);

  return {
    summary: data.summary ?? `Submitted runbook ${parsed.runbook_id}`,
    data
  };
}

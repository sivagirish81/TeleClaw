import { BrokerClient } from "../client/brokerClient.js";
import { getRunbookStatusInputSchema } from "../schemas/runbook.js";

export async function getRunbookStatusTool(client: BrokerClient, input: unknown) {
  const parsed = getRunbookStatusInputSchema.parse(input);
  const data = await client.getRunbookStatus(parsed.job_id);

  return {
    summary: data.summary ?? `Fetched status for ${parsed.job_id}`,
    data
  };
}

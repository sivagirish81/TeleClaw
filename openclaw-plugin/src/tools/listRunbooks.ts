import { BrokerClient } from "../client/brokerClient.js";

export async function listRunbooksTool(client: BrokerClient) {
  const data = await client.listRunbooks();
  const runbooks = Array.isArray(data.runbooks) ? data.runbooks : [];

  return {
    summary: `Found ${runbooks.length} runbooks.`,
    data
  };
}

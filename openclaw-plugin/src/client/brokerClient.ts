export type BrokerClientOptions = {
  baseUrl: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

export class BrokerClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: BrokerClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async listRunbooks(): Promise<any> {
    return this.request("GET", "/v1/runbooks");
  }

  async runRunbook(payload: { runbook_id: string; input: Record<string, string> }): Promise<any> {
    return this.request("POST", "/v1/runbooks/execute", payload);
  }

  async getRunbookStatus(jobId: string): Promise<any> {
    return this.request("GET", `/v1/jobs/${encodeURIComponent(jobId)}`);
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ? `Broker error: ${data.error}` : `Broker request failed (${res.status})`);
      }
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }
}

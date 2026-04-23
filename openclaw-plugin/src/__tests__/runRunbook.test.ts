import { describe, expect, it, vi } from "vitest";
import { BrokerClient } from "../client/brokerClient.js";
import { runRunbookTool } from "../tools/runRunbook.js";

describe("runRunbookTool", () => {
  it("formats broker execute request correctly", async () => {
    const mockFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      return {
        ok: true,
        status: 202,
        json: async () => ({ job_id: "job-123", summary: "ok" })
      } as Response;
    });

    const client = new BrokerClient({
      baseUrl: "http://127.0.0.1:8080",
      timeoutMs: 1000,
      fetchImpl: mockFetch as unknown as typeof fetch
    });

    const response = await runRunbookTool(client, {
      runbook_id: "k8s.release_diagnose",
      input: { namespace: "payments", workload: "checkout" }
    });

    expect(response.data).toEqual({ job_id: "job-123", summary: "ok" });

    const call = mockFetch.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:8080/v1/runbooks/execute");
    expect(call?.[1]?.method).toBe("POST");
    expect(call?.[1]?.body).toBe(
      JSON.stringify({
        runbook_id: "k8s.release_diagnose",
        input: { namespace: "payments", workload: "checkout" }
      })
    );
  });
});

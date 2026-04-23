import { z } from "zod";

export const runRunbookInputSchema = z.object({
  runbook_id: z.string().min(1),
  input: z.record(z.string()).default({})
});

export const getRunbookStatusInputSchema = z.object({
  job_id: z.string().min(1)
});

export type RunRunbookInput = z.infer<typeof runRunbookInputSchema>;
export type GetRunbookStatusInput = z.infer<typeof getRunbookStatusInputSchema>;

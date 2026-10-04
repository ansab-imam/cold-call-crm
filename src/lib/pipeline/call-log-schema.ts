import { z } from "zod";

// One record per call made — the backup/history trail; the lead's own
// callStatus and callOutcome fields are just "where things stand right
// now." An admin can correct a mistaken entry after the fact (wrong
// outcome logged, a typo in notes); editedAt/editedBy record that it
// happened without hiding who logged the call originally.
export const callLogEntrySchema = z.object({
  id: z.string(),
  leadId: z.string(),
  loggedAt: z.string(),
  loggedBy: z.string(),
  callStatus: z.string().nullable(),
  callOutcome: z.string().nullable(),
  // Which reach-out this is for the lead — the rep's own explicit count,
  // not something inferred from how many times a call happened to be
  // logged (a lead can sit for a while between attempts).
  attemptNumber: z.number(),
  notes: z.string().nullable(),
  nextActionDate: z.string().nullable(),
  editedAt: z.string().nullable().default(null),
  editedBy: z.string().nullable().default(null),
});

export type CallLogEntry = z.infer<typeof callLogEntrySchema>;

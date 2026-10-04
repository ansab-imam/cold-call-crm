import { z } from "zod";

// ---------------------------------------------------------------------------
// The ONE master lead structure. Every import — no matter the source file's
// column names or order — is converted into exactly this shape. Nothing that
// arrives on a row is ever discarded: anything we can't confidently map to a
// named field below is preserved in `rawData`/`dataFlags` instead of being
// dropped.
// ---------------------------------------------------------------------------

export const STAGES = [
  "New",
  "Attempted",
  "Contacted",
  "Qualifying",
  "Not Interested",
  "Bad Data",
] as const;
export type Stage = (typeof STAGES)[number];

export const SENIORITIES = [
  "C-Level",
  "VP",
  "Director",
  "Manager",
  "Individual Contributor",
  "Unknown",
] as const;
export type Seniority = (typeof SENIORITIES)[number];

export const FIT_LABELS = ["High", "Medium", "Low", "Unscored"] as const;
export type FitLabel = (typeof FIT_LABELS)[number];

export const PRIORITIES = ["Urgent", "High", "Normal", "Low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PHONE_STATUSES = [
  "Unverified",
  "Valid",
  "Invalid",
  "Disconnected",
  "Do Not Call",
] as const;
export type PhoneStatus = (typeof PHONE_STATUSES)[number];

export const EMAIL_STATUSES = [
  "Unverified",
  "Valid",
  "Invalid",
  "Catch-All",
  "Bounced",
] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const EMAIL_TYPES = ["Work", "Personal", "Generic", "Unknown"] as const;
export type EmailType = (typeof EMAIL_TYPES)[number];

export const EMPLOYEE_BANDS = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001-5000",
  "5001+",
  "Unknown",
] as const;
export type EmployeeBand = (typeof EMPLOYEE_BANDS)[number];

export const leadSchema = z.object({
  // System
  id: z.string(),
  leadCode: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  importBatchId: z.string().nullable(),

  // Company
  companyName: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  websiteDomain: z.string().nullable(),
  industry: z.string().nullable(),
  subIndustry: z.string().nullable(),
  employeeCount: z.number().nullable(),
  employeeBand: z.enum(EMPLOYEE_BANDS).nullable(),
  companyLinkedin: z.string().nullable(),
  googleMaps: z.string().nullable(),
  companyDescription: z.string().nullable(),

  // Contact
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  fullName: z.string().nullable(),
  jobTitle: z.string().nullable(),
  seniority: z.enum(SENIORITIES).nullable(),
  isDecisionMaker: z.boolean().nullable(),
  titleInferred: z.boolean().nullable(),
  contactLinkedin: z.string().nullable(),

  // Contact channels
  primaryPhone: z.string().nullable(),
  primaryPhoneRaw: z.string().nullable(),
  mobilePhone: z.string().nullable(),
  mobilePhoneRaw: z.string().nullable(),
  additionalPhone: z.string().nullable(),
  additionalPhoneRaw: z.string().nullable(),
  phoneStatus: z.enum(PHONE_STATUSES).nullable(),
  email: z.string().nullable(),
  emailType: z.enum(EMAIL_TYPES).nullable(),
  emailStatus: z.enum(EMAIL_STATUSES).nullable(),

  // Location
  city: z.string().nullable(),
  stateRegion: z.string().nullable(),
  country: z.string().nullable(),
  timezone: z.string().nullable(),
  locationSource: z.string().nullable(),

  // Qualification
  fitScore: z.number().nullable(),
  fitLabel: z.enum(FIT_LABELS).nullable(),
  priority: z.enum(PRIORITIES).nullable(),
  tags: z.array(z.string()),

  // Pipeline
  product: z.string().nullable(),
  stage: z.enum(STAGES),
  // What actually happened on the call, and what it resulted in — two
  // separate questions. Options are admin-managed in Settings (open strings
  // here, not a fixed enum, since the list can change over time).
  callStatus: z.string().nullable(),
  callOutcome: z.string().nullable(),
  // A live, always-editable comment — never touched by import, only ever
  // written by hand. Distinct from a logged call's own notes, which are a
  // permanent snapshot in Call Log.
  callNotes: z.string().nullable(),
  // Which Opportunities board column this lead sits in — null until it's
  // been promoted there (Settings decides which Call Outcome triggers that).
  // Admin-managed column ids, not a fixed enum, since Settings lets the
  // board be renamed/reordered.
  opportunityStage: z.string().nullable(),
  assignedTo: z.string().nullable(),
  assignedAt: z.string().nullable(),
  // Why a rep handed this lead to someone else — required whenever a
  // non-admin changes an already-assigned lead's owner, so there's a record
  // of it without needing a separate audit log.
  reassignReason: z.string().nullable(),
  reassignedBy: z.string().nullable(),
  reassignedAt: z.string().nullable(),
  nextActionDate: z.string().nullable(),
  attemptCount: z.number(),
  doNotCall: z.boolean(),
  // Marked invalid (bad data, wrong campaign fit, etc.) instead of deleted
  // — pulls it out of Pipeline/My Calls/Opportunities but keeps it around,
  // findable in Invalid Leads, in case it fits a different campaign later.
  isInvalid: z.boolean(),
  invalidReason: z.string().nullable(),
  invalidAt: z.string().nullable(),
  invalidBy: z.string().nullable(),

  // Source
  leadSource: z.string().nullable(),
  sourceFile: z.string().nullable(),
  sourceSheet: z.string().nullable(),
  sourceRow: z.number().nullable(),
  legacyId: z.string().nullable(),

  // Notes
  researchNotes: z.string().nullable(),
  dataFlags: z.array(z.string()),
  rawData: z.record(z.string(), z.unknown()),
  // Admin-defined columns (Settings → Custom Fields, or created on the fly
  // during import) that don't fit any built-in field — keyed by the custom
  // field's id, shown as real Pipeline columns, not buried in rawData.
  customFields: z.record(z.string(), z.string().nullable()),
});

export type Lead = z.infer<typeof leadSchema>;

// Fields a lead must have (post-mapping) before an import batch may commit.
// Deliberately loose on "how to reach them": a lead you haven't fully
// researched yet (no phone or email found, only a website or company page)
// is still a real, useful Pipeline row — that's what Data Flags are for.
export const REQUIRED_FIELD_GROUPS: { label: string; anyOf: (keyof Lead)[] }[] = [
  { label: "Company name", anyOf: ["companyName"] },
  {
    label: "A way to reach or find the lead (phone, email, website, or company page)",
    anyOf: ["primaryPhone", "email", "websiteUrl", "companyLinkedin", "googleMaps"],
  },
];

export const importBatchSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  fileName: z.string(),
  sheetName: z.string().nullable(),
  rowCount: z.number(),
  insertedCount: z.number(),
  skippedDuplicateCount: z.number(),
  columnMappings: z.array(
    z.object({
      sourceHeader: z.string(),
      targetField: z.string().nullable(),
      confidence: z.number(),
    })
  ),
  undone: z.boolean(),
});

export type ImportBatch = z.infer<typeof importBatchSchema>;

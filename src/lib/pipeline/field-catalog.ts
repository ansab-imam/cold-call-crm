import type { Lead } from "./schema";

export type FieldKind =
  | "text"
  | "longtext"
  | "email"
  | "phone"
  | "url"
  | "linkedin"
  | "maps"
  | "number"
  | "boolean"
  | "date"
  | "enum"
  | "tags";

export type FieldGroup =
  | "Company"
  | "Contact"
  | "Contact Channels"
  | "Location"
  | "Qualification"
  | "Pipeline"
  | "Source"
  | "Notes";

export type FieldDef = {
  key: keyof Lead;
  label: string;
  group: FieldGroup;
  kind: FieldKind;
  /** Header text variants (lowercased, punctuation-insensitive) that count as a strong match. */
  synonyms: string[];
  editableInTable?: boolean;
  required?: boolean;
};

// Every column a spreadsheet import can be mapped onto. This list — and only
// this list — defines the master Pipeline structure. Columns from an upload
// that don't match anything here still survive: see rawData in schema.ts.
export const FIELD_CATALOG: FieldDef[] = [
  // Company
  { key: "companyName", label: "Company Name", group: "Company", kind: "text", synonyms: ["company", "company name", "account name", "organization", "org", "business name", "employer", "business", "business / company", "business company"] },
  { key: "websiteUrl", label: "Website URL", group: "Company", kind: "url", synonyms: ["website", "website url", "url", "company website", "domain url", "site"] },
  { key: "websiteDomain", label: "Website Domain", group: "Company", kind: "text", synonyms: ["domain", "company domain", "website domain"] },
  { key: "industry", label: "Industry", group: "Company", kind: "text", synonyms: ["industry", "sector", "vertical"] },
  { key: "subIndustry", label: "Sub-Industry", group: "Company", kind: "text", synonyms: ["sub industry", "sub-industry", "niche", "sub sector"] },
  { key: "employeeCount", label: "Employee Count", group: "Company", kind: "number", synonyms: ["employees", "employee count", "headcount", "company size", "# employees", "num employees"] },
  { key: "employeeBand", label: "Employee Band", group: "Company", kind: "enum", synonyms: ["employee band", "company size range", "size range"] },
  { key: "companyLinkedin", label: "Company LinkedIn", group: "Company", kind: "linkedin", synonyms: ["company linkedin", "linkedin company", "company linkedin url", "organization linkedin"] },
  { key: "googleMaps", label: "Google Maps", group: "Company", kind: "maps", synonyms: ["google maps", "maps url", "gmb", "google business profile", "map link"] },
  { key: "companyDescription", label: "Company Description", group: "Company", kind: "longtext", synonyms: ["company description", "about", "description", "company bio", "summary"] },

  // Contact
  { key: "firstName", label: "First Name", group: "Contact", kind: "text", synonyms: ["first name", "firstname", "given name", "fname"] },
  { key: "lastName", label: "Last Name", group: "Contact", kind: "text", synonyms: ["last name", "lastname", "surname", "family name", "lname"] },
  { key: "fullName", label: "Full Name", group: "Contact", kind: "text", synonyms: ["full name", "name", "contact name", "lead name", "contact person", "contact"] },
  { key: "jobTitle", label: "Job Title", group: "Contact", kind: "text", synonyms: ["title", "job title", "position", "role", "designation"] },
  { key: "seniority", label: "Seniority", group: "Contact", kind: "enum", synonyms: ["seniority", "seniority level", "level"] },
  { key: "isDecisionMaker", label: "Is Decision Maker", group: "Contact", kind: "boolean", synonyms: ["decision maker", "is decision maker", "dm"] },
  { key: "titleInferred", label: "Title Inferred", group: "Contact", kind: "boolean", synonyms: ["title inferred", "inferred title"] },
  { key: "contactLinkedin", label: "Contact LinkedIn", group: "Contact", kind: "linkedin", synonyms: ["linkedin", "linkedin url", "contact linkedin", "personal linkedin", "profile url"] },

  // Contact channels
  { key: "primaryPhone", label: "Primary Phone", group: "Contact Channels", kind: "phone", synonyms: ["phone", "phone number", "primary phone", "office phone", "work phone", "direct dial", "telephone"] },
  { key: "mobilePhone", label: "Mobile Phone", group: "Contact Channels", kind: "phone", synonyms: ["mobile", "mobile phone", "cell", "cell phone", "personal phone"] },
  { key: "additionalPhone", label: "Additional Phone", group: "Contact Channels", kind: "phone", synonyms: ["additional phone", "other phone", "phone 2", "alt phone", "secondary phone"] },
  { key: "phoneStatus", label: "Phone Status", group: "Contact Channels", kind: "enum", synonyms: ["phone status", "number status"] },
  { key: "email", label: "Email", group: "Contact Channels", kind: "email", synonyms: ["email", "email address", "e-mail", "work email"] },
  { key: "emailType", label: "Email Type", group: "Contact Channels", kind: "enum", synonyms: ["email type"] },
  { key: "emailStatus", label: "Email Status", group: "Contact Channels", kind: "enum", synonyms: ["email status", "email verification", "verification status"] },

  // Location
  { key: "city", label: "City", group: "Location", kind: "text", synonyms: ["city", "town"] },
  { key: "stateRegion", label: "State/Region", group: "Location", kind: "text", synonyms: ["state", "region", "state/region", "province"] },
  { key: "country", label: "Country", group: "Location", kind: "text", synonyms: ["country", "nation"] },
  { key: "timezone", label: "Timezone", group: "Location", kind: "text", synonyms: ["timezone", "time zone", "tz"] },
  { key: "locationSource", label: "Location Source", group: "Location", kind: "text", synonyms: ["location source"] },

  // Qualification
  { key: "fitScore", label: "Fit Score", group: "Qualification", kind: "number", synonyms: ["fit score", "score", "lead score"] },
  { key: "fitLabel", label: "Fit Label", group: "Qualification", kind: "enum", synonyms: ["fit label", "fit", "grade"] },
  { key: "priority", label: "Priority", group: "Qualification", kind: "enum", synonyms: ["priority"] },
  { key: "tags", label: "Tags", group: "Qualification", kind: "tags", synonyms: ["tags", "labels", "categories"] },

  // Pipeline
  { key: "product", label: "Product", group: "Pipeline", kind: "text", synonyms: ["product", "product interest", "campaign"] },
  { key: "stage", label: "Stage", group: "Pipeline", kind: "enum", synonyms: ["stage", "status", "lead status"], editableInTable: true },
  { key: "assignedTo", label: "Assigned To", group: "Pipeline", kind: "text", synonyms: ["assigned to", "owner", "rep", "sdr", "assignee"], editableInTable: true },
  { key: "assignedAt", label: "Assigned On", group: "Pipeline", kind: "date", synonyms: ["assigned on", "assigned date", "assignment date"] },
  { key: "nextActionDate", label: "Next Action Date", group: "Pipeline", kind: "date", synonyms: ["next action date", "next follow up", "follow up date", "callback date"], editableInTable: true },
  { key: "attemptCount", label: "Attempt Count", group: "Pipeline", kind: "number", synonyms: ["attempt count", "attempts", "call attempts"] },
  { key: "doNotCall", label: "Do Not Call", group: "Pipeline", kind: "boolean", synonyms: ["do not call", "dnc"], editableInTable: true },

  // Source
  { key: "leadSource", label: "Lead Source", group: "Source", kind: "text", synonyms: ["lead source", "source", "channel"] },
  { key: "sourceFile", label: "Source File", group: "Source", kind: "text", synonyms: ["source file", "file name", "import file"] },
  { key: "sourceSheet", label: "Source Sheet", group: "Source", kind: "text", synonyms: ["source sheet", "sheet name", "tab"] },
  { key: "sourceRow", label: "Source Row", group: "Source", kind: "number", synonyms: ["source row", "row number", "row"] },
  { key: "legacyId", label: "Legacy ID", group: "Source", kind: "text", synonyms: ["legacy id", "old id", "external id", "record id"] },

  // Notes
  { key: "researchNotes", label: "Research Notes", group: "Notes", kind: "longtext", synonyms: ["notes", "research notes", "comments", "remarks", "description", "description / lead fit", "lead fit", "description lead fit"] },
  { key: "dataFlags", label: "Data Flag / Reason", group: "Notes", kind: "tags", synonyms: ["data flag", "data flag reason", "data flag / reason", "flag", "flag reason", "reason"] },
];

// Fields that are computed/system-owned and should never appear as an import
// mapping target even though they exist on the Lead type.
export const NON_MAPPABLE_KEYS: (keyof Lead)[] = [
  "id",
  "leadCode",
  "createdAt",
  "updatedAt",
  "importBatchId",
  "websiteDomain",
  "primaryPhoneRaw",
  "mobilePhoneRaw",
  "additionalPhoneRaw",
  "rawData",
];

export const MAPPABLE_FIELDS = FIELD_CATALOG;

export const FIELD_BY_KEY = new Map(FIELD_CATALOG.map((f) => [f.key, f]));

export const FIELD_GROUPS_ORDER: FieldGroup[] = [
  "Company",
  "Contact",
  "Contact Channels",
  "Location",
  "Qualification",
  "Pipeline",
  "Source",
  "Notes",
];

// Explicitly excluded from Pipeline per spec: call activity belongs to the
// Call Log module and is only ever linked back to a lead by id, never stored
// as a Pipeline column.
export const CALL_ACTIVITY_HEADER_HINTS = [
  "call status",
  "call date",
  "attempt number",
  "response",
  "warm lead",
  "call comments",
  "call outcome",
  "call notes",
];

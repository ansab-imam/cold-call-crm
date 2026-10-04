import { nanoid } from "nanoid";
import type { ColumnMapping } from "./mapping";
import { matchColumns } from "./mapping";
import {
  canonicalizeIndustry,
  employeeBandFromCount,
  extractDomain,
  looksLikeLinkedin,
  looksLikeMapsUrl,
  normalizePhone,
  splitFullName,
  toIsoDate,
} from "./normalize";
import { REQUIRED_FIELD_GROUPS, STAGES, type Lead } from "./schema";
import { FIELD_BY_KEY } from "./field-catalog";

export type DraftLead = Omit<Lead, "id" | "createdAt" | "updatedAt"> & {
  _rowIndex: number;
  _flags: string[];
};

const URLISH_FIELDS: (keyof Lead)[] = [
  "websiteUrl",
  "companyLinkedin",
  "contactLinkedin",
  "googleMaps",
];

export function emptyLead(): Omit<Lead, "id" | "createdAt" | "updatedAt"> {
  return {
    importBatchId: null,
    companyName: null,
    websiteUrl: null,
    websiteDomain: null,
    industry: null,
    subIndustry: null,
    employeeCount: null,
    employeeBand: null,
    companyLinkedin: null,
    googleMaps: null,
    companyDescription: null,
    firstName: null,
    lastName: null,
    fullName: null,
    jobTitle: null,
    seniority: null,
    isDecisionMaker: null,
    titleInferred: null,
    contactLinkedin: null,
    primaryPhone: null,
    primaryPhoneRaw: null,
    mobilePhone: null,
    mobilePhoneRaw: null,
    additionalPhone: null,
    additionalPhoneRaw: null,
    phoneStatus: null,
    email: null,
    emailType: null,
    emailStatus: null,
    city: null,
    stateRegion: null,
    country: null,
    timezone: null,
    locationSource: null,
    fitScore: null,
    fitLabel: null,
    priority: null,
    tags: [],
    product: null,
    stage: "New",
    callStatus: null,
    callOutcome: null,
    callNotes: null,
    opportunityStage: null,
    assignedTo: null,
    assignedAt: null,
    reassignReason: null,
    reassignedBy: null,
    reassignedAt: null,
    nextActionDate: null,
    attemptCount: 0,
    doNotCall: false,
    isInvalid: false,
    invalidReason: null,
    invalidAt: null,
    invalidBy: null,
    leadSource: null,
    sourceFile: null,
    sourceSheet: null,
    sourceRow: null,
    legacyId: null,
    researchNotes: null,
    dataFlags: [],
    rawData: {},
    customFields: {},
    leadCode: nanoid(8).toUpperCase(),
  };
}

function reclassifyUrlish(field: keyof Lead, value: string): keyof Lead {
  const isLinkedin = looksLikeLinkedin(value);
  const isMaps = looksLikeMapsUrl(value);
  // A column shared between company and contact LinkedIn URLs (e.g. a single
  // "Google Maps / LinkedIn" column) still tells them apart from the URL
  // shape itself: linkedin.com/company/... is the business page, everything
  // else under linkedin.com/in/... (or unrecognized) is the person.
  const linkedinTarget = /linkedin\.com\/company\//i.test(value)
    ? "companyLinkedin"
    : "contactLinkedin";
  if ((field === "googleMaps" || field === "websiteUrl") && isLinkedin) {
    return linkedinTarget;
  }
  if (
    (field === "websiteUrl" ||
      field === "contactLinkedin" ||
      field === "companyLinkedin") &&
    isMaps
  ) {
    return "googleMaps";
  }
  return field;
}

function assignPhone(
  lead: Record<string, unknown>,
  rawFieldKey: "primaryPhone" | "mobilePhone" | "additionalPhone",
  value: string,
  flags: string[]
) {
  const parts = value
    .split(/[,;]| or /i)
    .map((p) => p.trim())
    .filter(Boolean);
  const order: ("primaryPhone" | "mobilePhone" | "additionalPhone")[] = [
    "primaryPhone",
    "mobilePhone",
    "additionalPhone",
  ];
  let slot = order.indexOf(rawFieldKey);
  for (const part of parts) {
    const result = normalizePhone(part);
    if (slot < order.length) {
      const key = order[slot];
      if (!lead[key]) {
        lead[key] = result.e164 ?? null;
        lead[`${key}Raw`] = result.raw;
        if (!result.valid) {
          flags.push(`${key}: couldn't fully validate "${part}"`);
        }
        slot++;
        continue;
      }
    }
    flags.push(`Extra phone number found and kept in Raw Data: ${part}`);
    const raw = lead.rawData as Record<string, unknown>;
    raw.extraPhones = [...((raw.extraPhones as string[]) ?? []), part];
  }
}

export function transformRow(
  headers: string[],
  rowValues: string[],
  mappings: ColumnMapping[],
  ctx: { fileName: string; sheetName: string | null; rowIndex: number }
): DraftLead {
  const lead = emptyLead() as unknown as Record<string, unknown>;
  const flags: string[] = [];
  lead.sourceFile = ctx.fileName;
  lead.sourceSheet = ctx.sheetName;
  lead.sourceRow = ctx.rowIndex;
  lead.leadSource = "Import";

  for (const mapping of mappings) {
    const raw = (rowValues[mapping.columnIndex] ?? "").trim();
    if (!raw) continue;

    if (mapping.customFieldKey) {
      const custom = lead.customFields as Record<string, string>;
      custom[mapping.customFieldKey] = raw;
      continue;
    }

    if (!mapping.targetField) {
      const raw2 = lead.rawData as Record<string, unknown>;
      raw2[mapping.sourceHeader] = rowValues[mapping.columnIndex];
      if (mapping.isCallActivity) {
        flags.push(
          `"${mapping.sourceHeader}" looks like call activity — kept in Raw Data, not shown as a Pipeline column`
        );
      }
      continue;
    }

    let field = mapping.targetField;
    if (URLISH_FIELDS.includes(field)) {
      field = reclassifyUrlish(field, raw);
    }
    const def = FIELD_BY_KEY.get(field);

    switch (field) {
      case "primaryPhone":
      case "mobilePhone":
      case "additionalPhone":
        assignPhone(lead, field, raw, flags);
        break;
      case "employeeCount": {
        const n = Number(raw.replace(/,/g, ""));
        if (!Number.isNaN(n)) {
          lead.employeeCount = n;
          if (!lead.employeeBand) lead.employeeBand = employeeBandFromCount(n);
        }
        break;
      }
      case "fitScore":
      case "sourceRow": {
        const n = Number(raw.replace(/,/g, ""));
        if (!Number.isNaN(n)) lead[field] = n;
        break;
      }
      case "isDecisionMaker":
      case "titleInferred":
      case "doNotCall":
        lead[field] = ["true", "yes", "y", "1"].includes(raw.toLowerCase());
        break;
      case "industry": {
        const { canonical } = canonicalizeIndustry(raw);
        lead.industry = canonical;
        break;
      }
      case "nextActionDate": {
        const iso = toIsoDate(raw);
        lead.nextActionDate = iso;
        if (!iso) flags.push(`Couldn't parse date for Next Action Date: "${raw}"`);
        break;
      }
      case "tags":
        lead.tags = raw.split(/[,|;]/).map((t) => t.trim()).filter(Boolean);
        break;
      case "dataFlags": {
        // A flag column from the source file (e.g. "No phone number — find
        // one before calling") is data quality context, same as the flags we
        // generate ourselves during import — so it goes in the same bucket
        // rather than overwriting it.
        const existing = lead.dataFlags as string[];
        lead.dataFlags = raw
          .split(/[|;\n]/)
          .map((t) => t.trim())
          .filter(Boolean)
          .reduce((acc, t) => (acc.includes(t) ? acc : [...acc, t]), existing);
        break;
      }
      case "websiteUrl":
        lead.websiteUrl = raw;
        lead.websiteDomain = extractDomain(raw);
        break;
      case "stage": {
        const match = STAGES.find(
          (s) => s.toLowerCase() === raw.toLowerCase()
        );
        lead.stage = match ?? "New";
        if (!match) flags.push(`Unrecognized stage "${raw}" — defaulted to New`);
        break;
      }
      default:
        if (def?.kind === "boolean") {
          lead[field] = ["true", "yes", "y", "1"].includes(raw.toLowerCase());
        } else {
          lead[field] = raw;
        }
    }
  }

  // Cross-fill full name <-> first/last, never overwriting an explicit value.
  if (lead.fullName && !lead.firstName && !lead.lastName) {
    const split = splitFullName(lead.fullName as string);
    lead.firstName = split.firstName;
    lead.lastName = split.lastName;
  } else if (!lead.fullName && (lead.firstName || lead.lastName)) {
    lead.fullName = [lead.firstName, lead.lastName].filter(Boolean).join(" ");
  }

  return { ...(lead as Omit<Lead, "id" | "createdAt" | "updatedAt">), _rowIndex: ctx.rowIndex, _flags: flags };
}

export type DedupeKeyable = Pick<
  Lead,
  "email" | "primaryPhone" | "websiteDomain" | "fullName"
>;

export function dedupeKeys(lead: DedupeKeyable): string[] {
  const keys: string[] = [];
  if (lead.email) keys.push(`email:${lead.email.toLowerCase()}`);
  if (lead.primaryPhone) keys.push(`phone:${lead.primaryPhone}`);
  // Same website = same lead, full stop — regardless of what name or
  // contact is attached. websiteDomain is already normalized (lowercase,
  // "www." stripped) by extractDomain, so this compares cleanly.
  if (lead.websiteDomain) {
    keys.push(`website:${lead.websiteDomain.toLowerCase()}`);
  }
  return keys;
}

export type RequiredFieldIssue = { rowIndex: number; missing: string[] };

export function checkRequiredFields(lead: DraftLead): string[] {
  const missing: string[] = [];
  for (const group of REQUIRED_FIELD_GROUPS) {
    const satisfied = group.anyOf.some((key) => {
      const v = (lead as unknown as Record<string, unknown>)[key];
      return v !== null && v !== undefined && v !== "";
    });
    if (!satisfied) missing.push(group.label);
  }
  return missing;
}

export function buildMappingPreview(headers: string[], rows: string[][]) {
  const sampleRowsByColumn: string[][] = headers.map((_, colIdx) =>
    rows.slice(0, 50).map((r) => r[colIdx] ?? "")
  );
  return matchColumns(headers, sampleRowsByColumn);
}

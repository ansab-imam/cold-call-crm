import { parsePhoneNumberWithError } from "libphonenumber-js";

export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[_\-/]+/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i;
const LINKEDIN_RE = /linkedin\.com/i;
const MAPS_RE = /(google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i;
const PHONE_CHARS_RE = /^[\d\s()+\-.ext]+$/i;

export function looksLikeEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function looksLikeUrl(value: string): boolean {
  return URL_RE.test(value.trim());
}

export function looksLikeLinkedin(value: string): boolean {
  return LINKEDIN_RE.test(value);
}

export function looksLikeMapsUrl(value: string): boolean {
  return MAPS_RE.test(value);
}

export function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return (
    digits.length >= 7 &&
    digits.length <= 15 &&
    PHONE_CHARS_RE.test(value.trim())
  );
}

export function looksLikeDate(value: string): boolean {
  if (!value.trim()) return false;
  const t = Date.parse(value);
  return !Number.isNaN(t);
}

export function looksLikeNumber(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value.trim().replace(/,/g, ""));
}

export function looksLikeBoolean(value: string): boolean {
  return ["true", "false", "yes", "no", "y", "n", "1", "0"].includes(
    value.trim().toLowerCase()
  );
}

export function toBoolean(value: string): boolean {
  return ["true", "yes", "y", "1"].includes(value.trim().toLowerCase());
}

/** Extracts a bare registrable-ish domain from any URL-like string, keeping the original untouched elsewhere. */
export function extractDomain(value: string): string | null {
  if (!value) return null;
  let v = value.trim();
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  try {
    const host = new URL(v).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

export type PhoneNormalizeResult = {
  e164: string | null;
  raw: string;
  valid: boolean;
};

/** Normalizes a phone number to E.164 digits (no leading "+" — a deliberate
 * house rule here, every stored number is plain digits only) while always
 * preserving the original text in `raw`. Defaults to US when no country
 * code is present, since that covers this workspace's expected lead base;
 * ambiguous numbers are just flagged invalid rather than guessed at. */
export function normalizePhone(
  raw: string,
  defaultCountry: "US" = "US"
): PhoneNormalizeResult {
  const trimmed = raw.trim();
  if (!trimmed) return { e164: null, raw, valid: false };
  try {
    const parsed = parsePhoneNumberWithError(trimmed, defaultCountry);
    if (parsed && parsed.isValid()) {
      return { e164: parsed.number.replace(/^\+/, ""), raw, valid: true };
    }
    return { e164: null, raw, valid: false };
  } catch {
    return { e164: null, raw, valid: false };
  }
}

/** Splits a "Full Name" string into first/last as best-effort; never loses data — the original stays in fullName regardless. */
export function splitFullName(full: string): {
  firstName: string | null;
  lastName: string | null;
} {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

export function toIsoDate(value: string): string | null {
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

// Canonical industry list + a synonym → canonical lookup. Anything that
// doesn't match stays exactly as the source file wrote it (never blanked).
export const CANONICAL_INDUSTRIES = [
  "Software & Technology",
  "Financial Services",
  "Healthcare",
  "Manufacturing",
  "Retail & E-commerce",
  "Real Estate",
  "Construction",
  "Automotive",
  "Professional Services",
  "Education",
  "Hospitality & Travel",
  "Logistics & Transportation",
  "Media & Entertainment",
  "Telecommunications",
  "Energy & Utilities",
  "Government & Public Sector",
  "Non-Profit",
  "Insurance",
  "Legal",
  "Agriculture",
];

const INDUSTRY_SYNONYMS: Record<string, string> = {
  "software": "Software & Technology",
  "saas": "Software & Technology",
  "it services": "Software & Technology",
  "information technology": "Software & Technology",
  "tech": "Software & Technology",
  "computer software": "Software & Technology",
  "banking": "Financial Services",
  "finance": "Financial Services",
  "financial services": "Financial Services",
  "fintech": "Financial Services",
  "health care": "Healthcare",
  "medical": "Healthcare",
  "hospital & health care": "Healthcare",
  "manufacturing": "Manufacturing",
  "industrial": "Manufacturing",
  "retail": "Retail & E-commerce",
  "e-commerce": "Retail & E-commerce",
  "ecommerce": "Retail & E-commerce",
  "real estate": "Real Estate",
  "construction": "Construction",
  "building materials": "Construction",
  "automotive": "Automotive",
  "auto": "Automotive",
  "consulting": "Professional Services",
  "professional services": "Professional Services",
  "education": "Education",
  "higher education": "Education",
  "hospitality": "Hospitality & Travel",
  "travel": "Hospitality & Travel",
  "logistics": "Logistics & Transportation",
  "transportation": "Logistics & Transportation",
  "trucking": "Logistics & Transportation",
  "media": "Media & Entertainment",
  "entertainment": "Media & Entertainment",
  "telecom": "Telecommunications",
  "telecommunications": "Telecommunications",
  "energy": "Energy & Utilities",
  "utilities": "Energy & Utilities",
  "oil & gas": "Energy & Utilities",
  "government": "Government & Public Sector",
  "public sector": "Government & Public Sector",
  "non-profit": "Non-Profit",
  "nonprofit": "Non-Profit",
  "insurance": "Insurance",
  "legal": "Legal",
  "law practice": "Legal",
  "agriculture": "Agriculture",
  "farming": "Agriculture",
};

export function canonicalizeIndustry(value: string): {
  canonical: string | null;
  matched: boolean;
} {
  const key = value.trim().toLowerCase();
  if (!key) return { canonical: null, matched: false };
  const hit = INDUSTRY_SYNONYMS[key];
  if (hit) return { canonical: hit, matched: true };
  const exact = CANONICAL_INDUSTRIES.find(
    (c) => c.toLowerCase() === key
  );
  if (exact) return { canonical: exact, matched: true };
  return { canonical: value.trim(), matched: false };
}

export function employeeBandFromCount(count: number): string {
  if (count <= 10) return "1-10";
  if (count <= 50) return "11-50";
  if (count <= 200) return "51-200";
  if (count <= 500) return "201-500";
  if (count <= 1000) return "501-1000";
  if (count <= 5000) return "1001-5000";
  return "5001+";
}

import type { Lead } from "./schema";

// Every placeholder a template can use. Keep this list and the Settings
// page's reference table in sync — this IS the documentation for what a
// template author can reference.
function buildTokenValues(lead: Lead): Record<string, string> {
  return {
    firstName: lead.firstName ?? "",
    lastName: lead.lastName ?? "",
    fullName: lead.fullName ?? "",
    jobTitle: lead.jobTitle ?? "",
    seniority: lead.seniority ?? "",
    companyName: lead.companyName ?? "",
    industry: lead.industry ?? "",
    subIndustry: lead.subIndustry ?? "",
    employeeCount: lead.employeeCount != null ? String(lead.employeeCount) : "",
    employeeBand: lead.employeeBand ?? "",
    companyDescription: lead.companyDescription ?? "",
    city: lead.city ?? "",
    stateRegion: lead.stateRegion ?? "",
    country: lead.country ?? "",
    location: [lead.city, lead.stateRegion].filter(Boolean).join(", "),
    product: lead.product ?? "",
    researchNotes: lead.researchNotes ?? "",
    tags: lead.tags.join(", "),
    priority: lead.priority ?? "",
    fitLabel: lead.fitLabel ?? "",
    email: lead.email ?? "",
    primaryPhone: lead.primaryPhone ?? "",
    websiteUrl: lead.websiteUrl ?? "",
    assignedTo: lead.assignedTo ?? "",
  };
}

export const AVAILABLE_TEMPLATE_TOKENS = [
  "firstName", "lastName", "fullName", "jobTitle", "seniority",
  "companyName", "industry", "subIndustry", "employeeCount", "employeeBand",
  "companyDescription", "city", "stateRegion", "country", "location",
  "product", "researchNotes", "tags", "priority", "fitLabel",
  "email", "primaryPhone", "websiteUrl", "assignedTo",
] as const;

const TOKEN_RE = /\{\{\s*([a-zA-Z]+)\s*(?:\|([^}]*))?\}\}/g;

// Pure string substitution — no AI call, no external dependency. Supports
// `{{token}}` and `{{token|fallback text}}` for when a lead is missing that
// field. Deterministic: the same lead + template always produces the same
// output.
export function renderTemplate(template: string, lead: Lead): string {
  const values = buildTokenValues(lead);
  return template.replace(TOKEN_RE, (match, token: string, fallback?: string) => {
    const value = values[token];
    if (value) return value;
    return fallback !== undefined ? fallback : "";
  });
}

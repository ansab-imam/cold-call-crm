// The column format you actually work with — kept exactly as-is (same names,
// same order) so a file you fill in always re-imports cleanly. This is what
// "Download sample" hands out.
export const TEMPLATE_HEADERS = [
  "Industry",
  "Business / Company",
  "Contact Person",
  "Job Title",
  "Email",
  "Phone",
  "Mobile Phone",
  "Website",
  "Google Maps / LinkedIn",
  "Lead Source",
  "Employees",
  "Description / Lead Fit",
  "Data Flag / Reason",
] as const;

export const TEMPLATE_EXAMPLE_ROW = [
  "Legal Services",
  "Example Law Group",
  "Jordan Ellis",
  "Office Manager",
  "jordan@example.com",
  "+1 (555) 010-2000",
  "",
  "https://example.com/",
  "https://www.linkedin.com/in/example/",
  "Manual Entry",
  "12",
  "Small local firm, warm intro from a referral partner.",
  "",
];

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildTemplateCsv(): string {
  const lines = [
    TEMPLATE_HEADERS.map(csvEscape).join(","),
    TEMPLATE_EXAMPLE_ROW.map(csvEscape).join(","),
  ];
  return lines.join("\r\n") + "\r\n";
}

import "server-only";
import { readStore, withStore } from "@/lib/db";

// Admin-defined (or created-on-the-fly during import) extra columns that
// don't fit any built-in Pipeline field. Kept as a small registry — not
// just inferred from data — so the same column name maps consistently
// across every future import and shows up as a real, named Pipeline column.
export type CustomFieldDef = {
  key: string;
  label: string;
  createdAt: string;
};

const CUSTOM_FIELDS_KEY = "custom-fields";

export async function getCustomFields(): Promise<CustomFieldDef[]> {
  return readStore<CustomFieldDef[]>(CUSTOM_FIELDS_KEY, []);
}

function slugify(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || "field";
}

export async function createCustomField(label: string): Promise<CustomFieldDef> {
  return withStore<CustomFieldDef[]>(CUSTOM_FIELDS_KEY, [], (fields) => {
    const existing = fields.find((f) => f.label.toLowerCase() === label.trim().toLowerCase());
    if (existing) return fields;

    const base = slugify(label);
    let key = base;
    let n = 2;
    while (fields.some((f) => f.key === key)) {
      key = `${base}_${n}`;
      n++;
    }
    fields.push({ key, label: label.trim(), createdAt: new Date().toISOString() });
    return fields;
  }).then((fields) => {
    const match =
      fields.find((f) => f.label.toLowerCase() === label.trim().toLowerCase()) ??
      fields[fields.length - 1];
    return match;
  });
}

export async function deleteCustomField(key: string): Promise<CustomFieldDef[]> {
  return withStore<CustomFieldDef[]>(CUSTOM_FIELDS_KEY, [], (fields) =>
    fields.filter((f) => f.key !== key)
  );
}

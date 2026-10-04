import {
  FIELD_CATALOG,
  NON_MAPPABLE_KEYS,
  CALL_ACTIVITY_HEADER_HINTS,
  type FieldDef,
} from "./field-catalog";
import {
  normalizeHeader,
  looksLikeEmail,
  looksLikePhone,
  looksLikeLinkedin,
  looksLikeMapsUrl,
  looksLikeUrl,
} from "./normalize";
import type { Lead } from "./schema";

const MAPPABLE = FIELD_CATALOG.filter(
  (f) => !NON_MAPPABLE_KEYS.includes(f.key)
);

function tokenSet(s: string): Set<string> {
  return new Set(normalizeHeader(s).split(" ").filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function headerScore(header: string, field: FieldDef): number {
  const normHeader = normalizeHeader(header);
  const candidates = [field.label, ...field.synonyms];
  let best = 0;
  for (const c of candidates) {
    const normC = normalizeHeader(c);
    if (normHeader === normC) return 1;
    const score = jaccard(tokenSet(normHeader), tokenSet(normC));
    if (score > best) best = score;
  }
  return best;
}

export type ValueKind =
  | "email"
  | "phone"
  | "linkedin"
  | "maps"
  | "url"
  | "unknown";

export function detectValueKind(samples: string[]): ValueKind {
  const nonEmpty = samples.map((s) => s.trim()).filter(Boolean).slice(0, 30);
  if (nonEmpty.length === 0) return "unknown";
  const counts: Record<ValueKind, number> = {
    email: 0,
    phone: 0,
    linkedin: 0,
    maps: 0,
    url: 0,
    unknown: 0,
  };
  for (const v of nonEmpty) {
    if (looksLikeLinkedin(v)) counts.linkedin++;
    else if (looksLikeMapsUrl(v)) counts.maps++;
    else if (looksLikeEmail(v)) counts.email++;
    else if (looksLikeUrl(v)) counts.url++;
    else if (looksLikePhone(v)) counts.phone++;
    else counts.unknown++;
  }
  const [kind, count] = (Object.entries(counts) as [ValueKind, number][]).sort(
    (a, b) => b[1] - a[1]
  )[0];
  return count / nonEmpty.length >= 0.6 ? kind : "unknown";
}

const VALUE_KIND_TO_FIELD: Partial<Record<ValueKind, keyof Lead>> = {
  email: "email",
  phone: "primaryPhone",
  linkedin: "contactLinkedin",
  maps: "googleMaps",
  url: "websiteUrl",
};

export type ColumnMapping = {
  sourceHeader: string;
  columnIndex: number;
  targetField: keyof Lead | null;
  // Set instead of targetField when this column is mapped to an admin-
  // defined custom field rather than a built-in one.
  customFieldKey?: string | null;
  confidence: number;
  reason: string;
  isCallActivity: boolean;
};

const HEADER_MATCH_THRESHOLD = 0.6;
const VALUE_FALLBACK_CONFIDENCE = 0.55;

export function matchColumns(
  headers: string[],
  sampleRowsByColumn: string[][]
): ColumnMapping[] {
  const suggestions: ColumnMapping[] = headers.map((header, columnIndex) => {
    const normHeader = normalizeHeader(header);
    const isCallActivity = CALL_ACTIVITY_HEADER_HINTS.some(
      (hint) => normHeader === hint || normHeader.includes(hint)
    );
    if (isCallActivity) {
      return {
        sourceHeader: header,
        columnIndex,
        targetField: null,
        confidence: 1,
        reason:
          "Looks like call activity, which belongs in the Call Log, not Pipeline",
        isCallActivity: true,
      };
    }

    let best: { field: FieldDef; score: number } | null = null;
    for (const field of MAPPABLE) {
      const score = headerScore(header, field);
      if (!best || score > best.score) best = { field, score };
    }

    const samples = sampleRowsByColumn[columnIndex] ?? [];
    const valueKind = detectValueKind(samples);

    if (best && best.score >= HEADER_MATCH_THRESHOLD) {
      return {
        sourceHeader: header,
        columnIndex,
        targetField: best.field.key,
        confidence: Math.min(0.99, best.score),
        reason: "Matched by column header",
        isCallActivity: false,
      };
    }

    const fallbackField = VALUE_KIND_TO_FIELD[valueKind];
    if (fallbackField) {
      return {
        sourceHeader: header,
        columnIndex,
        targetField: fallbackField,
        confidence: VALUE_FALLBACK_CONFIDENCE,
        reason: `Header text was unclear — matched from the values themselves (look like ${valueKind})`,
        isCallActivity: false,
      };
    }

    return {
      sourceHeader: header,
      columnIndex,
      targetField: null,
      confidence: 0,
      reason: "No confident match — kept in Raw Data",
      isCallActivity: false,
    };
  });

  return resolveCollisions(suggestions);
}

// When several columns land on the same target field (e.g. two phone-looking
// columns both scoring best against "Primary Phone"), keep the strongest
// match on the primary target and shift the others to the next open slot of
// the same kind rather than overwriting one another.
const PHONE_FALLBACK_ORDER: (keyof Lead)[] = [
  "primaryPhone",
  "mobilePhone",
  "additionalPhone",
];

function resolveCollisions(mappings: ColumnMapping[]): ColumnMapping[] {
  const byField = new Map<keyof Lead, ColumnMapping[]>();
  for (const m of mappings) {
    if (!m.targetField) continue;
    const list = byField.get(m.targetField) ?? [];
    list.push(m);
    byField.set(m.targetField, list);
  }

  for (const [field, list] of byField) {
    if (list.length <= 1) continue;
    list.sort((a, b) => b.confidence - a.confidence);
    if (!PHONE_FALLBACK_ORDER.includes(field)) {
      // Keep the best; demote the rest to unmapped (preserved in raw data).
      for (const loser of list.slice(1)) {
        loser.targetField = null;
        loser.confidence = 0;
        loser.reason = `Another column matched "${field}" more strongly — kept in Raw Data`;
      }
      continue;
    }
    // Phone-kind collision: distribute across primary/mobile/additional.
    let slotIdx = PHONE_FALLBACK_ORDER.indexOf(field);
    for (const extra of list.slice(1)) {
      slotIdx += 1;
      if (slotIdx < PHONE_FALLBACK_ORDER.length) {
        const slot = PHONE_FALLBACK_ORDER[slotIdx];
        if (!byField.has(slot)) {
          extra.targetField = slot;
          extra.reason = "Additional phone column — assigned to the next open phone slot";
          continue;
        }
      }
      extra.targetField = null;
      extra.confidence = 0;
      extra.reason = "Extra phone column beyond available phone fields — kept in Raw Data";
    }
  }

  return mappings;
}

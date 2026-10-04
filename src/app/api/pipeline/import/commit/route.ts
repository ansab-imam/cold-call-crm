import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { transformRow, dedupeKeys, checkRequiredFields } from "@/lib/pipeline/import";
import { getAllLeads, insertLeads, saveBatch } from "@/lib/pipeline/store";
import { REQUIRED_FIELD_GROUPS, type Lead } from "@/lib/pipeline/schema";
import type { ColumnMapping } from "@/lib/pipeline/mapping";
import { requireSession } from "@/lib/auth/require-session";

type CommitBody = {
  fileName: string;
  sheetName: string | null;
  headers: string[];
  rows: string[][];
  mappings: ColumnMapping[];
};

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const body = (await request.json()) as CommitBody;
  const { fileName, sheetName, headers, rows, mappings } = body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "Nothing to import." }, { status: 400 });
  }

  // Refuse the whole import if the mapping doesn't cover any of the
  // required-field groups at all — that's a mapping problem, not something
  // per-row skipping can fix.
  for (const group of REQUIRED_FIELD_GROUPS) {
    const covered = mappings.some(
      (m) => m.targetField && group.anyOf.includes(m.targetField as keyof Lead)
    );
    if (!covered) {
      return NextResponse.json(
        {
          error: `No column is mapped to "${group.label}", which every lead needs. Map a column to it before importing.`,
        },
        { status: 400 }
      );
    }
  }

  // Importing only ever adds — a row matching a lead you already have is
  // skipped, nothing existing is ever changed or removed. If you need to
  // get rid of data, delete it directly from Pipeline (admin-only).
  const existingLeads = await getAllLeads();
  const existingByKey = new Map<string, Lead>();
  for (const lead of existingLeads) {
    for (const key of dedupeKeys(lead)) existingByKey.set(key, lead);
  }
  const seenInFile = new Set<string>();

  const batchId = nanoid();
  const now = new Date().toISOString();
  const toInsert: Lead[] = [];
  let skippedDuplicateCount = 0;
  let skippedInvalidCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const draft = transformRow(headers, rows[i], mappings, {
      fileName,
      sheetName,
      rowIndex: i + 2,
    });
    const missing = checkRequiredFields(draft);
    if (missing.length > 0) {
      skippedInvalidCount++;
      continue;
    }

    const keys = dedupeKeys(draft);
    const isDuplicate = keys.some((k) => existingByKey.has(k) || seenInFile.has(k));
    keys.forEach((k) => seenInFile.add(k));

    if (isDuplicate) {
      skippedDuplicateCount++;
      continue;
    }

    const { _rowIndex, _flags, ...leadFields } = draft;
    toInsert.push({
      ...leadFields,
      id: nanoid(),
      createdAt: now,
      updatedAt: now,
      importBatchId: batchId,
      // dataFlags may already hold flags imported from the source file
      // (e.g. a "Data Flag / Reason" column) — add ours, don't replace them.
      dataFlags: [...new Set([...leadFields.dataFlags, ..._flags])],
      sourceRow: _rowIndex,
    });
  }

  if (toInsert.length === 0) {
    return NextResponse.json(
      {
        error:
          "Nothing was imported — every row was either missing required fields or a duplicate.",
      },
      { status: 400 }
    );
  }

  await insertLeads(toInsert);

  await saveBatch({
    id: batchId,
    createdAt: now,
    fileName,
    sheetName,
    rowCount: rows.length,
    insertedCount: toInsert.length,
    skippedDuplicateCount,
    columnMappings: mappings.map((m) => ({
      sourceHeader: m.sourceHeader,
      targetField: m.targetField,
      confidence: m.confidence,
    })),
    undone: false,
  });

  return NextResponse.json({
    batchId,
    insertedCount: toInsert.length,
    skippedDuplicateCount,
    skippedInvalidCount,
  });
}

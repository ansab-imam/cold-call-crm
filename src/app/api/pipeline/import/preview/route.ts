import { NextResponse } from "next/server";
import { parseSpreadsheetFile, ImportFileError } from "@/lib/pipeline/parse-file";
import { buildMappingPreview, transformRow, dedupeKeys, checkRequiredFields } from "@/lib/pipeline/import";
import { getAllLeads } from "@/lib/pipeline/store";
import { requireSession } from "@/lib/auth/require-session";

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = await parseSpreadsheetFile(buffer, file.name);
  } catch (err) {
    const message = err instanceof ImportFileError ? err.message : "Couldn't read that file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { headers, rows, sheetName } = parsed;
  if (headers.length === 0) {
    return NextResponse.json(
      { error: "That file doesn't seem to have a header row." },
      { status: 400 }
    );
  }

  const mappings = buildMappingPreview(headers, rows);

  const existingLeads = await getAllLeads();
  const existingKeys = new Set(existingLeads.flatMap((l) => dedupeKeys(l)));
  const seenInFile = new Set<string>();

  let missingRequiredCount = 0;
  let duplicateCount = 0;
  const sampleDrafts = [];

  for (let i = 0; i < rows.length; i++) {
    const draft = transformRow(headers, rows[i], mappings, {
      fileName: file.name,
      sheetName,
      rowIndex: i + 2, // +1 for 1-index, +1 for header row
    });
    const missing = checkRequiredFields(draft);
    if (missing.length > 0) missingRequiredCount++;

    const keys = dedupeKeys(draft);
    const isDuplicate = keys.some(
      (k) => existingKeys.has(k) || seenInFile.has(k)
    );
    if (isDuplicate) duplicateCount++;
    keys.forEach((k) => seenInFile.add(k));

    if (i < 25) {
      sampleDrafts.push({
        rowIndex: draft._rowIndex,
        companyName: draft.companyName,
        fullName: draft.fullName,
        email: draft.email,
        primaryPhone: draft.primaryPhone,
        missingRequired: missing,
        duplicate: isDuplicate,
        flags: draft._flags,
      });
    }
  }

  return NextResponse.json({
    fileName: file.name,
    sheetName,
    headers,
    rows,
    mappings,
    totalRows: rows.length,
    missingRequiredCount,
    duplicateCount,
    sampleDrafts,
  });
}

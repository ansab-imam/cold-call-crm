import Papa from "papaparse";
import ExcelJS from "exceljs";

export type ParsedSheet = {
  headers: string[];
  rows: string[][];
  sheetName: string | null;
};

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB — plenty for a leads sheet, small enough to keep memory use sane.

export class ImportFileError extends Error {}

export async function parseSpreadsheetFile(
  buffer: Buffer,
  filename: string
): Promise<ParsedSheet> {
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new ImportFileError("That file is larger than the 25MB limit.");
  }
  const ext = filename.toLowerCase().split(".").pop();

  if (ext === "csv") {
    const text = decodeCsvBuffer(buffer);
    const result = Papa.parse<string[]>(text, {
      skipEmptyLines: true,
    });
    if (result.errors.length > 0 && result.data.length === 0) {
      throw new ImportFileError(
        "Couldn't read that CSV file — it may be corrupted."
      );
    }
    const [headerRow, ...rows] = result.data;
    return {
      headers: (headerRow ?? []).map((h: string) => String(h ?? "").trim()),
      rows: rows.map((r: string[]) => r.map((c: string) => String(c ?? ""))),
      sheetName: null,
    };
  }

  if (ext === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new ImportFileError("That workbook doesn't have any sheets.");
    }
    const allRows: string[][] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = (row.values as ExcelJS.CellValue[]).slice(1); // index 0 is unused by ExcelJS
      allRows.push(values.map((v) => cellToString(v)));
    });
    const [headerRow, ...rows] = allRows;
    return {
      headers: (headerRow ?? []).map((h) => h.trim()),
      rows,
      sheetName: worksheet.name,
    };
  }

  throw new ImportFileError(
    "Unsupported file type — please upload a .csv or .xlsx file."
  );
}

// Excel on Windows very commonly exports CSVs as Windows-1252 (or plain
// ANSI), not UTF-8, with no BOM to signal that. Reading such a file as UTF-8
// silently mangles anything above ASCII — smart quotes, em/en dashes, "®" —
// into "�". Decode strictly as UTF-8 first; only fall back to Windows-1252
// if that actually fails, so genuine UTF-8 files are untouched.
function decodeCsvBuffer(buffer: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value && value.result != null) return String(value.result);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((t) => t.text).join("");
    }
    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      return value.hyperlink;
    }
    return "";
  }
  return String(value);
}

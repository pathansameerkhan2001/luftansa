/**
 * Spreadsheet reading/writing for the product import (SheetJS). Used in the
 * browser only (loaded on demand by the import page) and by tests; the server
 * never parses uploaded files.
 */
import * as XLSX from "xlsx";
import type { CellValue } from "./excel-import";

/** Reading stops after this many rows per sheet (the import accepts 2,000). */
export const MAX_SHEET_ROWS = 5000;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = [".xlsx", ".xls"] as const;

export interface SheetData {
  name: string;
  /** matrix[i] is spreadsheet row i + 1, as Excel numbers it. */
  matrix: CellValue[][];
}

export function isAcceptedFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

const toCell = (c: unknown): CellValue =>
  c instanceof Date ? c.toISOString() : typeof c === "string" || typeof c === "number" || typeof c === "boolean" ? c : null;

const ZIP = [0x50, 0x4b, 0x03, 0x04]; // .xlsx (Office Open XML is a zip archive)
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // .xls (Excel 97-2003 compound file)
const startsWith = (bytes: Uint8Array, sig: readonly number[]) => sig.every((b, i) => bytes[i] === b);

/** True only for real Excel workbooks (not text, CSV or other files renamed to .xlsx/.xls). */
export function isExcelWorkbook(data: ArrayBuffer | Uint8Array): boolean {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return startsWith(bytes, ZIP) || startsWith(bytes, OLE);
}

/** Reads every sheet of an .xlsx/.xls file. Throws a readable error for anything else. */
export function readSpreadsheet(data: ArrayBuffer | Uint8Array): SheetData[] {
  if (!isExcelWorkbook(data)) throw new Error("This file is not an Excel workbook. Please upload an Excel file (.xlsx or .xls).");
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(data, { type: "array", sheetRows: MAX_SHEET_ROWS + 1, cellHTML: false, cellFormula: false, cellStyles: false });
  } catch {
    throw new Error("This file could not be read. Please upload an Excel file (.xlsx or .xls).");
  }
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const ref = ws?.["!ref"];
    if (!ws || !ref) return { name, matrix: [] };
    const start = XLSX.utils.decode_range(ref).s.r;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true, blankrows: true });
    // Keep Excel's row numbers when the used range does not start on row 1.
    const matrix: CellValue[][] = [...Array.from({ length: start }, () => [] as CellValue[]), ...rows.map((r) => r.map(toCell))];
    return { name, matrix };
  });
}

/** An .xlsx file with the original columns of the rows to fix, plus a "Problems" column. */
export function buildRowsToFixWorkbook(headers: readonly CellValue[], rows: readonly { rowNumber: number; cells: readonly CellValue[]; problems: string }[]): ArrayBuffer {
  const aoa = [["Row in original file", ...headers, "Problems"], ...rows.map((r) => [r.rowNumber, ...headers.map((_, i) => r.cells[i] ?? null), r.problems])];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 10 }, ...headers.map(() => ({ wch: 18 })), { wch: 70 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rows to fix");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

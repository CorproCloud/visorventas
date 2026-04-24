import * as XLSX from "xlsx";
import Papa from "papaparse";
import type { SalesRecord } from "./types";
import { inferCategory } from "./format";

const toNum = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (v == null) return 0;
  const s = String(v).replace(/,/g, "").replace(/\s/g, "").trim();
  if (!s) return 0;
  const n = Number(s);
  return isFinite(n) ? n : 0;
};

// Heuristic header detection. Works for the user's ERP export and also
// for generic CSV/XLSX with reasonable column names.
const HEADER_HINTS = ["clave", "code", "código", "codigo", "sku", "producto", "descripción", "descripcion", "description"];

function detectHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i] || [];
    const joined = row.map((c) => String(c ?? "").toLowerCase()).join(" | ");
    if (HEADER_HINTS.some((h) => joined.includes(h))) return i;
  }
  return 0;
}

interface ParsedSheet {
  period: string;
  records: SalesRecord[];
}

function parseSheet(sheetName: string, rows: unknown[][]): ParsedSheet {
  const headerIdx = detectHeaderRow(rows);
  const dataRows = rows.slice(headerIdx + 1);
  const records: SalesRecord[] = [];

  // Period: prefer sheet name if it looks like a year, else current year
  const period = /^\d{4}$/.test(sheetName.trim()) ? sheetName.trim() : sheetName;

  for (const row of dataRows) {
    if (!row || row.length === 0) continue;
    // Compact row (some columns are NaN spacers in ERP export)
    const compact = row.filter((c) => c !== null && c !== undefined && String(c).trim() !== "");
    if (compact.length < 4) continue;

    // ERP layout (after compaction): [Clave, Descripción, Unidad, Unidades, PrePromedio, VentaNeta, CostoNeto, Margen, ?Peso, ?Acum]
    const code = String(compact[0] ?? "").trim();
    if (!code || /total|página|pagina|^\d+\.\d+$/i.test(code)) continue;
    if (code.length > 30) continue; // skip junk lines

    const description = String(compact[1] ?? "").trim();
    if (!description) continue;

    const unit = String(compact[2] ?? "").trim();
    const units = toNum(compact[3]);
    const avgPrice = toNum(compact[4]);
    const netSales = toNum(compact[5]);
    const netCost = toNum(compact[6]);
    const marginPct = toNum(compact[7]);
    const weightPct = toNum(compact[8]);

    if (netSales === 0 && units === 0) continue;

    records.push({
      id: `${period}-${code}-${records.length}`,
      period,
      code,
      description,
      unit,
      units,
      avgPrice,
      netSales,
      netCost,
      marginPct,
      weightPct,
      category: inferCategory(description),
    });
  }

  return { period, records };
}

export async function parseExcelFile(file: File): Promise<{ records: SalesRecord[]; periods: string[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const all: SalesRecord[] = [];
  const periods = new Set<string>();

  for (const sheetName of wb.SheetNames) {
    // Skip non-data sheets
    if (/^datos$|^config|^info/i.test(sheetName)) continue;
    const ws = wb.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    const parsed = parseSheet(sheetName, rows);
    if (parsed.records.length > 0) {
      all.push(...parsed.records);
      periods.add(parsed.period);
    }
  }

  return { records: all, periods: Array.from(periods).sort() };
}

export async function parseCsvFile(file: File): Promise<{ records: SalesRecord[]; periods: string[] }> {
  const text = await file.text();
  const result = Papa.parse<unknown[]>(text, { skipEmptyLines: true });
  const rows = result.data as unknown[][];
  const parsed = parseSheet("Dataset", rows);
  return { records: parsed.records, periods: [parsed.period] };
}

export async function parseFile(file: File): Promise<{ records: SalesRecord[]; periods: string[] }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return parseCsvFile(file);
  return parseExcelFile(file);
}

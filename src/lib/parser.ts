import * as XLSX from "xlsx";
import Papa from "papaparse";
import type { Invoice, InvoiceLine } from "./types";
import { inferCategory } from "./format";

// ---------- Helpers ----------
const toNum = (v: unknown): number => {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (v == null) return 0;
  const s = String(v).replace(/,/g, "").replace(/\s/g, "").trim();
  if (!s) return 0;
  const n = Number(s);
  return isFinite(n) ? n : 0;
};

const toStr = (v: unknown): string => {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
};

const isFilled = (v: unknown): boolean => v != null && String(v).trim() !== "";

// Parsea fecha en múltiples formatos (Date, "2025-01-02", "02/01/2025", serial Excel)
function parseDate(v: unknown): string | null {
  if (!isFilled(v)) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 25569 && v < 80000) {
    // Excel serial date
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  // ISO ya
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // dd/mm/yyyy
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const t = Date.parse(s);
  if (!isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

// ---------- Mapa de columnas (índices base 0) según el Excel real ----------
// Encabezado de factura
const COL_FECHA = 0;
const COL_FOLIO = 5;
const COL_CLIENTE_A = 11; // a veces aquí
const COL_CLIENTE_B = 12; // a veces aquí
const COL_NOMBRE = 14;
const COL_SUBTOTAL = 22;
const COL_IEPS = 27;
const COL_IVA = 30;
const COL_IVA_ALT = 31;
const COL_RETISR = 35;
const COL_RETIVA = 39;
const COL_TOTAL = 45;
const COL_SALDO = 51;

// Fila status (fila siguiente al encabezado)
const COL_STATUS_LABEL = 12;
const COL_STATUS_VALUE = 14;
const COL_MONEDA_VALUE = 18;
const COL_AGENTE_VALUE = 31;

// Línea de producto
const COL_LINE_CLAVE = 2;
const COL_LINE_DESC = 13;
const COL_LINE_UNIT = 23;
const COL_LINE_QTY = 25;
const COL_LINE_PRICE = 29;
const COL_LINE_DESC1 = 34;
const COL_LINE_DESC2 = 36;
const COL_LINE_IVA = 38;
const COL_LINE_PEDIMENTO = 51;

// Detección heurística (para CSV o si los índices se desplazan)
function looksLikeInvoiceHeader(row: unknown[]): boolean {
  return parseDate(row[COL_FECHA]) !== null && isFilled(row[COL_FOLIO]) && isFilled(row[COL_NOMBRE]);
}

function looksLikeStatusRow(row: unknown[]): boolean {
  const s = String(row[COL_STATUS_LABEL] ?? "").toLowerCase();
  return s.includes("status");
}

function looksLikeProductLine(row: unknown[]): boolean {
  return (
    !isFilled(row[COL_FECHA]) &&
    isFilled(row[COL_LINE_CLAVE]) &&
    isFilled(row[COL_LINE_DESC]) &&
    toNum(row[COL_LINE_QTY]) > 0
  );
}

function looksLikeTotalsRow(row: unknown[]): boolean {
  const first = String(row[0] ?? "").toLowerCase();
  return first.startsWith("total");
}

// ---------- Parser principal ----------
function parseRows(rows: unknown[][]): Invoice[] {
  const invoices: Invoice[] = [];
  let cur: Invoice | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    if (row.length === 0) continue;
    if (looksLikeTotalsRow(row)) break; // sección final de totales del reporte

    if (looksLikeInvoiceHeader(row)) {
      // Cierra anterior
      if (cur && cur.lines.length > 0) invoices.push(cur);

      const date = parseDate(row[COL_FECHA])!;
      const customerId = toStr(row[COL_CLIENTE_A]) || toStr(row[COL_CLIENTE_B]);
      const folio = toStr(row[COL_FOLIO]).replace(/\s+/g, " ");
      const subtotal = toNum(row[COL_SUBTOTAL]);
      const ivaA = toNum(row[COL_IVA]);
      const ivaB = toNum(row[COL_IVA_ALT]);

      cur = {
        id: `${folio}-${invoices.length}`,
        folio,
        date,
        yearMonth: date.slice(0, 7),
        year: date.slice(0, 4),
        customerId: customerId || "S/C",
        customerName: toStr(row[COL_NOMBRE]) || "Sin nombre",
        status: "",
        currency: "PESOS",
        agentId: "",
        subtotal,
        ieps: toNum(row[COL_IEPS]),
        iva: ivaA || ivaB,
        retIsr: toNum(row[COL_RETISR]),
        retIva: toNum(row[COL_RETIVA]),
        total: toNum(row[COL_TOTAL]),
        balance: toNum(row[COL_SALDO]),
        lines: [],
      };
      continue;
    }

    if (cur && looksLikeStatusRow(row)) {
      cur.status = toStr(row[COL_STATUS_VALUE]);
      cur.currency = toStr(row[COL_MONEDA_VALUE]) || cur.currency;
      cur.agentId = toStr(row[COL_AGENTE_VALUE]);
      continue;
    }

    if (cur && looksLikeProductLine(row)) {
      const qty = toNum(row[COL_LINE_QTY]);
      const price = toNum(row[COL_LINE_PRICE]);
      const d1 = toNum(row[COL_LINE_DESC1]);
      const d2 = toNum(row[COL_LINE_DESC2]);
      const lineGross = qty * price;
      const lineNet = Math.max(0, lineGross - d1 - d2);
      const description = toStr(row[COL_LINE_DESC]);
      const line: InvoiceLine = {
        code: toStr(row[COL_LINE_CLAVE]),
        description,
        unit: toStr(row[COL_LINE_UNIT]),
        quantity: qty,
        unitPrice: price,
        discount1: d1,
        discount2: d2,
        ivaUnit: toNum(row[COL_LINE_IVA]),
        pedimento: toStr(row[COL_LINE_PEDIMENTO]) || undefined,
        lineNet,
        category: inferCategory(description),
      };
      cur.lines.push(line);
    }
  }

  if (cur && cur.lines.length > 0) invoices.push(cur);
  return invoices;
}

// ---------- Entradas públicas ----------
async function readWorkbook(file: File): Promise<unknown[][]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  // Toma todas las hojas y concatena (la mayoría tiene una sola)
  const all: unknown[][] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
    all.push(...rows);
  }
  return all;
}

export async function parseFile(file: File): Promise<Invoice[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    const result = Papa.parse<unknown[]>(text, { skipEmptyLines: true });
    return parseRows(result.data as unknown[][]);
  }
  const rows = await readWorkbook(file);
  return parseRows(rows);
}

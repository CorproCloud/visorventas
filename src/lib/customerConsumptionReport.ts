import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Invoice } from "./types";
import { fmtMoney, fmtDate, fmtMonth } from "./format";
import logoUrl from "@/assets/logo-report.png";

export interface ConsumptionRow {
  customerId: string;
  customerName: string;
  byMonth: Record<string, number>; // "yyyy-mm" -> total
  total: number;
}

export interface ConsumptionReport {
  months: string[]; // sorted yyyy-mm within range
  rows: ConsumptionRow[];
  periodLabel: string;
  totalsByMonth: Record<string, number>;
  grandTotal: number;
}

export function buildConsumptionReport(
  invoices: Invoice[],
  from: string,
  to: string,
): ConsumptionReport {
  const filtered = invoices.filter((i) => i.date >= from && i.date <= to);
  const monthsSet = new Set<string>();
  const map = new Map<string, ConsumptionRow>();

  for (const inv of filtered) {
    monthsSet.add(inv.yearMonth);
    const key = inv.customerId || inv.customerName;
    let row = map.get(key);
    if (!row) {
      row = { customerId: inv.customerId, customerName: inv.customerName, byMonth: {}, total: 0 };
      map.set(key, row);
    }
    row.byMonth[inv.yearMonth] = (row.byMonth[inv.yearMonth] ?? 0) + inv.total;
    row.total += inv.total;
  }

  const months = Array.from(monthsSet).sort();
  const rows = Array.from(map.values()).sort((a, b) => b.total - a.total);
  const totalsByMonth: Record<string, number> = {};
  for (const m of months) totalsByMonth[m] = 0;
  for (const r of rows) for (const m of months) totalsByMonth[m] += r.byMonth[m] ?? 0;
  const grandTotal = rows.reduce((a, r) => a + r.total, 0);

  return {
    months,
    rows,
    periodLabel: `${fmtDate(from)} — ${fmtDate(to)}`,
    totalsByMonth,
    grandTotal,
  };
}

// ============ EXCEL ============
export function exportConsumptionExcel(report: ConsumptionReport): void {
  const headers = [
    "N° Cliente",
    "Nombre",
    ...report.months.map((m) => fmtMonth(m)),
    "Total",
  ];

  const aoa: (string | number)[][] = [headers];
  for (const r of report.rows) {
    aoa.push([
      r.customerId,
      r.customerName,
      ...report.months.map((m) => Math.round((r.byMonth[m] ?? 0) * 100) / 100),
      Math.round(r.total * 100) / 100,
    ]);
  }
  // Totals row
  aoa.push([
    "",
    "TOTAL",
    ...report.months.map((m) => Math.round(report.totalsByMonth[m] * 100) / 100),
    Math.round(report.grandTotal * 100) / 100,
  ]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Column widths
  ws["!cols"] = [
    { wch: 14 },
    { wch: 42 },
    ...report.months.map(() => ({ wch: 14 })),
    { wch: 16 },
  ];
  // Freeze first row and first two columns
  ws["!freeze"] = { xSplit: 2, ySplit: 1 } as never;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Consumo por Cliente");

  // Info sheet
  const info = XLSX.utils.aoa_to_sheet([
    ["Reporte", "Consumo de clientes por mes"],
    ["Período", report.periodLabel],
    ["Clientes", report.rows.length],
    ["Total facturado", report.grandTotal],
    ["Generado", new Date().toLocaleString("es-MX")],
    ["Autor", "Desarrollado por Miguel M. Navarro"],
  ]);
  info["!cols"] = [{ wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, info, "Información");

  const safe = report.periodLabel.replace(/[^\w\-]+/g, "_");
  XLSX.writeFile(wb, `consumo-clientes-${safe}.xlsx`);
}

// ============ PDF ============
let _logoDataUrl: string | null = null;
async function loadLogo(): Promise<string | null> {
  if (_logoDataUrl) return _logoDataUrl;
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    _logoDataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return _logoDataUrl;
  } catch {
    return null;
  }
}

export async function exportConsumptionPDF(report: ConsumptionReport): Promise<void> {
  const doc = new jsPDF({ orientation: "l", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Membrete rojo lateral
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, 18, pageH, "F");

  // Header
  const logo = await loadLogo();
  let textX = 40;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", 40, 24, 44, 44);
      textX = 96;
    } catch { /* noop */ }
  }
  doc.setTextColor(20, 20, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Consumo por Cliente", textX, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 110, 130);
  doc.text(`Período: ${report.periodLabel}`, textX, 62);
  doc.text(
    `Clientes: ${report.rows.length}  ·  Total: ${fmtMoney(report.grandTotal, true)}`,
    pageW - 40,
    46,
    { align: "right" },
  );
  doc.text(
    `Generado: ${new Date().toLocaleDateString("es-MX")}`,
    pageW - 40,
    62,
    { align: "right" },
  );

  // Table
  const head = [[
    "N° Cliente",
    "Nombre",
    ...report.months.map((m) => fmtMonth(m)),
    "Total",
  ]];
  const body = report.rows.map((r) => [
    r.customerId,
    r.customerName.length > 42 ? r.customerName.slice(0, 40) + "…" : r.customerName,
    ...report.months.map((m) => fmtMoney(r.byMonth[m] ?? 0)),
    fmtMoney(r.total),
  ]);
  const foot = [[
    "",
    "TOTAL",
    ...report.months.map((m) => fmtMoney(report.totalsByMonth[m])),
    fmtMoney(report.grandTotal),
  ]];

  autoTable(doc, {
    head,
    body,
    foot,
    startY: 88,
    margin: { left: 30, right: 30, bottom: 40 },
    styles: { fontSize: 7.5, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [30, 41, 99], textColor: 255, fontStyle: "bold", fontSize: 7.5 },
    footStyles: { fillColor: [240, 242, 247], textColor: [20, 20, 30], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 160 },
    },
    didDrawPage: () => {
      // Membrete lateral y pie en todas las páginas
      doc.setFillColor(220, 38, 38);
      doc.rect(0, 0, 18, pageH, "F");
      doc.setTextColor(100, 110, 130);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("Desarrollado por Miguel M. Navarro.", 40, pageH - 20);
      const pageStr = `Página ${doc.getCurrentPageInfo().pageNumber}`;
      doc.text(pageStr, pageW - 40, pageH - 20, { align: "right" });
    },
  });

  const safe = report.periodLabel.replace(/[^\w\-]+/g, "_");
  doc.save(`consumo-clientes-${safe}.pdf`);
}

import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtMoney, fmtNumber } from "./format";
import logoUrl from "@/assets/logo-report.png";

export type ColType = "text" | "money" | "number" | "pct";

export interface TableColumn {
  header: string;
  key: string;
  type?: ColType;
  width?: number; // pt para PDF
  wch?: number; // ancho Excel
}

export interface TableReport {
  title: string;
  fileBase: string;
  periodLabel: string;
  columns: TableColumn[];
  rows: Record<string, string | number>[];
  totals?: Record<string, string | number>;
  summary?: { label: string; value: string }[];
  notes?: string[];
  orientation?: "l" | "p";
}

const fmtCell = (v: unknown, type: ColType = "text"): string => {
  if (v === null || v === undefined || v === "") return type === "text" ? "" : "—";
  const n = typeof v === "number" ? v : Number(v);
  switch (type) {
    case "money":
      return fmtMoney(isFinite(n) ? n : 0);
    case "number":
      return fmtNumber(isFinite(n) ? n : 0);
    case "pct":
      return `${(isFinite(n) ? n : 0).toFixed(1)}%`;
    default:
      return String(v);
  }
};

const round2 = (v: unknown) =>
  typeof v === "number" ? Math.round(v * 100) / 100 : (v as string | number);

// ============ EXCEL ============
export function exportTableExcel(report: TableReport): void {
  const aoa: (string | number)[][] = [report.columns.map((c) => c.header)];
  for (const r of report.rows) {
    aoa.push(report.columns.map((c) => round2(r[c.key] ?? (c.type && c.type !== "text" ? 0 : ""))));
  }
  if (report.totals) {
    aoa.push(report.columns.map((c) => round2(report.totals![c.key] ?? "")));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = report.columns.map((c) => ({ wch: c.wch ?? (c.type === "text" ? 32 : 16) }));
  ws["!freeze"] = { xSplit: 0, ySplit: 1 } as never;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, report.title.slice(0, 28) || "Reporte");

  const infoRows: (string | number)[][] = [
    ["Reporte", report.title],
    ["Período", report.periodLabel],
    ["Registros", report.rows.length],
    ...(report.summary ?? []).map((s) => [s.label, s.value] as (string | number)[]),
    ["Generado", new Date().toLocaleString("es-MX")],
    ["Autor", "Desarrollado por Miguel M. Navarro."],
  ];
  const info = XLSX.utils.aoa_to_sheet(infoRows);
  info["!cols"] = [{ wch: 22 }, { wch: 46 }];
  XLSX.utils.book_append_sheet(wb, info, "Información");

  const safe = report.periodLabel.replace(/[^\w\-]+/g, "_");
  XLSX.writeFile(wb, `${report.fileBase}-${safe}.xlsx`);
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

export async function exportTablePDF(report: TableReport): Promise<void> {
  const doc = new jsPDF({ orientation: report.orientation ?? "l", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, 18, pageH, "F");

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
  doc.text(report.title, textX, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 110, 130);
  doc.text(`Período: ${report.periodLabel}`, textX, 62);

  const summaryLine = (report.summary ?? [])
    .slice(0, 3)
    .map((s) => `${s.label}: ${s.value}`)
    .join("  ·  ");
  if (summaryLine) doc.text(summaryLine, pageW - 40, 46, { align: "right" });
  doc.text(`Generado: ${new Date().toLocaleDateString("es-MX")}`, pageW - 40, 62, { align: "right" });

  let startY = 88;
  if (report.notes?.length) {
    doc.setTextColor(60, 65, 80);
    doc.setFontSize(8.5);
    const wrapped = doc.splitTextToSize(report.notes.join(" "), pageW - 80);
    doc.text(wrapped, 40, startY);
    startY += wrapped.length * 11 + 8;
  }

  const head = [report.columns.map((c) => c.header)];
  const body = report.rows.map((r) => report.columns.map((c) => fmtCell(r[c.key], c.type)));
  const foot = report.totals
    ? [report.columns.map((c) => (report.totals![c.key] !== undefined ? fmtCell(report.totals![c.key], c.type) : ""))]
    : undefined;

  const columnStyles: Record<number, { cellWidth?: number; halign?: "left" | "right" }> = {};
  report.columns.forEach((c, i) => {
    columnStyles[i] = {
      ...(c.width ? { cellWidth: c.width } : {}),
      halign: c.type && c.type !== "text" ? "right" : "left",
    };
  });

  autoTable(doc, {
    head,
    body,
    foot,
    startY,
    margin: { left: 30, right: 30, bottom: 40 },
    styles: { fontSize: 7.5, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [30, 41, 99], textColor: 255, fontStyle: "bold", fontSize: 7.5 },
    footStyles: { fillColor: [240, 242, 247], textColor: [20, 20, 30], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    columnStyles,
    didDrawPage: () => {
      doc.setFillColor(220, 38, 38);
      doc.rect(0, 0, 18, pageH, "F");
      doc.setTextColor(100, 110, 130);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("Desarrollado por Miguel M. Navarro.", 40, pageH - 20);
      doc.text(`Página ${doc.getCurrentPageInfo().pageNumber}`, pageW - 40, pageH - 20, { align: "right" });
    },
  });

  const safe = report.periodLabel.replace(/[^\w\-]+/g, "_");
  doc.save(`${report.fileBase}-${safe}.pdf`);
}

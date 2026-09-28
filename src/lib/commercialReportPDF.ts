import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CommercialAnalysis } from "./commercialAnalysis";
import { fmtDate, fmtMoney, fmtNumber } from "./format";
import logoUrl from "@/assets/logo-report.png";

interface CommercialReportOptions {
  analysis: CommercialAnalysis;
  conclusions: { text: string; level: "ok" | "warn" | "alert" }[];
  from: string;
  to: string;
  deadDays: 30 | 60 | 90;
}

type PDFWithTable = jsPDF & { lastAutoTable?: { finalY: number } };

const RED: [number, number, number] = [220, 38, 38];
const NAVY: [number, number, number] = [30, 41, 99];
const GRAY: [number, number, number] = [100, 110, 130];
const LIGHT: [number, number, number] = [240, 242, 247];
const MARGIN = 42;
const TOP = 94;
const BOTTOM = 44;

let cachedLogo: string | null = null;

async function loadLogo(): Promise<string | null> {
  if (cachedLogo) return cachedLogo;
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    cachedLogo = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return cachedLogo;
  } catch {
    return null;
  }
}

function drawHeader(doc: jsPDF, logo: string | null, from: string, to: string): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(...RED);
  doc.rect(0, 0, 14, pageH, "F");
  let textX = MARGIN;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", MARGIN, 22, 44, 44);
      textX = MARGIN + 56;
    } catch {
      textX = MARGIN;
    }
  }
  doc.setTextColor(20, 20, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Reporte Area Comercial General", textX, 41);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`Periodo: ${fmtDate(from)} - ${fmtDate(to)}`, textX, 57);
  doc.text(`Generado: ${new Date().toLocaleDateString("es-MX")}`, pageW - MARGIN, 41, { align: "right" });
  doc.setDrawColor(225, 228, 235);
  doc.line(MARGIN, 76, pageW - MARGIN, 76);
}

function addPage(doc: jsPDF, logo: string | null, from: string, to: string, first = false): number {
  if (!first) doc.addPage();
  drawHeader(doc, logo, from, to);
  return TOP;
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, MARGIN, y);
  doc.setDrawColor(...RED);
  doc.setLineWidth(1.5);
  doc.line(MARGIN, y + 6, MARGIN + 42, y + 6);
  return y + 22;
}

function paragraph(doc: jsPDF, text: string, y: number, fontSize = 9.5): number {
  const width = doc.internal.pageSize.getWidth() - MARGIN * 2;
  doc.setTextColor(45, 48, 58);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, width);
  doc.text(lines, MARGIN, y);
  return y + lines.length * (fontSize + 3) + 6;
}

function drawKpis(doc: jsPDF, a: CommercialAnalysis, y: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  const gap = 10;
  const width = (pageW - MARGIN * 2 - gap) / 2;
  const height = 68;
  const entries = [
    ["Ventas totales", fmtMoney(a.totalSales, true), isFinite(a.prevDelta) ? `${a.prevDelta >= 0 ? "+" : ""}${a.prevDelta.toFixed(1)}% vs periodo anterior` : `${fmtNumber(a.invoiceCount)} facturas`],
    ["Unidades vendidas", fmtNumber(a.totalUnits), `${fmtNumber(a.products.filter((p) => p.units > 0).length)} productos con venta`],
    ["Cliente top", a.topCustomer?.name ?? "Sin datos", a.topCustomer ? fmtMoney(a.topCustomer.value, true) : ""],
    ["Producto estrella", a.topProduct?.name ?? "Sin datos", a.topProduct ? fmtMoney(a.topProduct.value, true) : ""],
  ];
  entries.forEach(([label, value, sub], index) => {
    const x = MARGIN + (index % 2) * (width + gap);
    const cy = y + Math.floor(index / 2) * (height + gap);
    doc.setFillColor(...LIGHT);
    doc.roundedRect(x, cy, width, height, 5, 5, "F");
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), x + 12, cy + 16);
    doc.setTextColor(...NAVY);
    doc.setFontSize(index > 1 ? 11 : 16);
    const valueLines = doc.splitTextToSize(value, width - 24).slice(0, 2);
    doc.text(valueLines, x + 12, cy + 35);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(sub, width - 24).slice(0, 1), x + 12, cy + 58);
  });
  return y + (height + gap) * 2 + 6;
}

function drawTrend(doc: jsPDF, a: CommercialAnalysis, y: number): number {
  const data = a.trendMonthly;
  const pageW = doc.internal.pageSize.getWidth();
  const chartW = pageW - MARGIN * 2;
  const chartH = 185;
  const baseY = y + chartH;
  doc.setDrawColor(220, 224, 232);
  doc.line(MARGIN, baseY, pageW - MARGIN, baseY);
  if (!data.length) return paragraph(doc, "No hay datos suficientes para mostrar la tendencia mensual.", y + 20);
  const max = Math.max(...data.map((d) => d.ventas), 1);
  const slot = chartW / data.length;
  const barW = Math.max(3, Math.min(24, slot * 0.58));
  data.forEach((d, index) => {
    const h = Math.max(1, (d.ventas / max) * (chartH - 34));
    const x = MARGIN + index * slot + (slot - barW) / 2;
    doc.setFillColor(...NAVY);
    doc.rect(x, baseY - h, barW, h, "F");
    if (data.length <= 18 || index % Math.ceil(data.length / 12) === 0) {
      doc.setTextColor(...GRAY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.text(d.period, x + barW / 2, baseY + 11, { align: "center", angle: 35 });
    }
  });
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(fmtMoney(max, true), MARGIN, y + 6);
  doc.text("Ventas mensuales", pageW - MARGIN, y + 6, { align: "right" });
  return baseY + 28;
}

function tableHeader(doc: jsPDF, logo: string | null, from: string, to: string): () => void {
  return () => drawHeader(doc, logo, from, to);
}

export async function exportCommercialReportPDF(options: CommercialReportOptions): Promise<void> {
  const { analysis: a, conclusions, from, to, deadDays } = options;
  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4", compress: true });
  const logo = await loadLogo();
  const repeatedHeader = tableHeader(doc, logo, from, to);
  let y = addPage(doc, logo, from, to, true);

  y = sectionTitle(doc, "1. Indicadores clave", y);
  y = drawKpis(doc, a, y);
  y = sectionTitle(doc, "2. Introduccion de Ventas General", y);
  y = paragraph(doc, `El periodo acumula ${fmtMoney(a.totalSales)} en ${fmtNumber(a.invoiceCount)} facturas, con ticket promedio de ${fmtMoney(a.avgTicket)} y margen promedio estimado de ${a.avgMargin.toFixed(1)}%.`, y);
  drawTrend(doc, a, y + 4);

  y = addPage(doc, logo, from, to);
  y = sectionTitle(doc, "3. Rotacion de Producto", y);
  const high = a.products.filter((p) => p.rotation === "Alta").length;
  const medium = a.products.filter((p) => p.rotation === "Media").length;
  const low = a.products.filter((p) => p.rotation === "Baja").length;
  const avgSt = a.products.length ? a.products.reduce((sum, p) => sum + p.sellThrough, 0) / a.products.length : 0;
  y = paragraph(doc, `Rotacion alta: ${high} productos. Media: ${medium}. Baja: ${low}. Sell-through promedio estimado: ${avgSt.toFixed(1)}%.`, y);
  autoTable(doc, {
    head: [["Categoria", "Alta", "Media", "Baja", "Sell-through", "Dias inventario"]],
    body: a.rotationByCategory.map((row) => [row.category, row.Alta, row.Media, row.Baja, `${row.sellThrough.toFixed(1)}%`, row.daysInventory]),
    startY: y,
    margin: { left: MARGIN, right: MARGIN, top: TOP, bottom: BOTTOM },
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: NAVY, textColor: 255 },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    didDrawPage: repeatedHeader,
  });

  const paretoSections = [
    { title: "4. Pareto 80/20 - Productos", data: a.paretoProducts, noun: "productos" },
    { title: "4. Pareto 80/20 - Clientes", data: a.paretoCustomers, noun: "clientes" },
  ];
  for (const section of paretoSections) {
    y = addPage(doc, logo, from, to);
    y = sectionTitle(doc, section.title, y);
    y = paragraph(doc, `${section.data.topCount} ${section.noun} (${section.data.topPct.toFixed(1)}% del total) generan aproximadamente el 80% de la facturacion analizada.`, y);
    autoTable(doc, {
      head: [["#", section.noun === "productos" ? "Producto" : "Cliente", "Importe", "% acumulado"]],
      body: section.data.items.filter((item) => item.inTop).map((item, index) => [index + 1, item.name, fmtMoney(item.value), `${item.cumPct.toFixed(1)}%`]),
      startY: y,
      margin: { left: MARGIN, right: MARGIN, top: TOP, bottom: BOTTOM },
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: NAVY, textColor: 255 },
      alternateRowStyles: { fillColor: [248, 249, 252] },
      columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 290 }, 2: { halign: "right" }, 3: { halign: "right" } },
      didDrawPage: repeatedHeader,
    });
  }

  const dead = a.deadStock.filter((product) => product.daysSinceSale >= deadDays);
  const deadValue = dead.reduce((sum, product) => sum + product.stock * product.avgPrice, 0);
  y = addPage(doc, logo, from, to);
  y = sectionTitle(doc, `5. Productos con Nula Rotacion (${deadDays}+ dias)`, y);
  y = paragraph(doc, `${fmtNumber(dead.length)} productos sin venta en el umbral seleccionado. Valor monetario estancado estimado: ${fmtMoney(deadValue)}.`, y);
  autoTable(doc, {
    head: [["Producto", "Stock acumulado", "Valor estancado", "Dias sin venta"]],
    body: dead.map((product) => [product.name, fmtNumber(product.stock), fmtMoney(product.stock * product.avgPrice), fmtNumber(product.daysSinceSale)]),
    startY: y,
    margin: { left: MARGIN, right: MARGIN, top: TOP, bottom: BOTTOM },
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: NAVY, textColor: 255 },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    columnStyles: { 0: { cellWidth: 300 }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    didDrawPage: repeatedHeader,
  });

  y = (doc as PDFWithTable).lastAutoTable?.finalY ?? TOP;
  const pageH = doc.internal.pageSize.getHeight();
  if (y + 170 > pageH - BOTTOM) y = addPage(doc, logo, from, to);
  else y += 24;
  y = sectionTitle(doc, "6. Resumen Ejecutivo de Analisis Comercial", y);
  conclusions.forEach((conclusion, index) => {
    const marker = conclusion.level === "alert" ? "ALERTA" : conclusion.level === "warn" ? "ATENCION" : "HALLAZGO";
    y = paragraph(doc, `${index + 1}. ${marker}: ${conclusion.text}`, y, 9);
  });
  paragraph(doc, "Nota: el archivo de ventas no incluye inventario ni costos; stock, dias de inventario, sell-through y margen son valores estimados.", y + 4, 8);

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    const pageW = doc.internal.pageSize.getWidth();
    const currentH = doc.internal.pageSize.getHeight();
    doc.setFillColor(...RED);
    doc.rect(0, 0, 14, currentH, "F");
    doc.setDrawColor(225, 228, 235);
    doc.line(MARGIN, currentH - 34, pageW - MARGIN, currentH - 34);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Desarrollado por Miguel M. Navarro.", MARGIN, currentH - 18);
    doc.text(`Pagina ${page} de ${totalPages}`, pageW - MARGIN, currentH - 18, { align: "right" });
  }

  doc.save(`reporte-area-comercial-${from}_${to}.pdf`);
}

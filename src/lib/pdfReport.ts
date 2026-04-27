import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";
import { fmtMoney, fmtNumber, fmtPct, fmtMonth } from "@/lib/format";

export interface ReportPayload {
  periodLabel: string;
  invCount: number;
  revenue: number;
  subtotal: number;
  taxes: number;
  balance: number;
  avgTicket: number;
  customerCount: number;
  recurrencia: number;
  revDelta: number;
  ticketDelta: number;
  customersDelta: number;
  topCustomers: { fullName: string; ventas: number }[];
  categories: { name: string; value: number }[];
  trend: { period: string; ventas: number; facturas: number }[];
}

const RED: [number, number, number] = [220, 38, 38];
const NAVY: [number, number, number] = [30, 41, 99];
const GRAY: [number, number, number] = [100, 110, 130];
const LIGHT: [number, number, number] = [240, 242, 247];

function deltaText(d: number): string {
  if (!isFinite(d)) return "sin comparativa disponible";
  const dir = d >= 0 ? "incremento" : "decremento";
  return `${dir} de ${Math.abs(d).toFixed(1)}% vs período anterior`;
}

function buildAnalysis(p: ReportPayload): string[] {
  const paragraphs: string[] = [];

  paragraphs.push(
    `Durante el período analizado (${p.periodLabel}) la organización procesó ${fmtNumber(p.invCount)} facturas, ` +
    `generando una facturación total de ${fmtMoney(p.revenue, true)}. El ticket promedio se ubicó en ${fmtMoney(p.avgTicket)}, ` +
    `atendiendo a un total de ${fmtNumber(p.customerCount)} clientes activos con una recurrencia de ${fmtPct(p.recurrencia, 1)} facturas por cliente.`,
  );

  paragraphs.push(
    `En términos comparativos, los ingresos presentan un ${deltaText(p.revDelta)}, ` +
    `mientras que el ticket medio muestra un ${deltaText(p.ticketDelta)}. ` +
    `La base de clientes activos refleja un ${deltaText(p.customersDelta)}, ` +
    `lo que permite identificar tendencias claras en el comportamiento comercial.`,
  );

  if (p.balance > 0.5) {
    const pctBalance = p.revenue > 0 ? (p.balance / p.revenue) * 100 : 0;
    paragraphs.push(
      `El saldo pendiente de cobro asciende a ${fmtMoney(p.balance, true)}, equivalente al ${pctBalance.toFixed(1)}% ` +
      `de la facturación del período. Se recomienda priorizar las gestiones de cobranza sobre los clientes con mayor ` +
      `exposición para mejorar el flujo de efectivo.`,
    );
  } else {
    paragraphs.push(
      `La cartera se encuentra al corriente, sin saldos pendientes relevantes al cierre del período. ` +
      `Esta situación refleja una sana política de cobranza y disciplina financiera con los clientes.`,
    );
  }

  if (p.topCustomers.length > 0) {
    const top3 = p.topCustomers.slice(0, 3);
    const top3Total = top3.reduce((a, c) => a + c.ventas, 0);
    const concentration = p.revenue > 0 ? (top3Total / p.revenue) * 100 : 0;
    paragraphs.push(
      `Los tres clientes principales — ${top3.map((c) => c.fullName).join(", ")} — concentran el ${concentration.toFixed(1)}% ` +
      `de la facturación total. Esta concentración debe monitorearse: si supera el 50%, conviene diversificar la cartera ` +
      `para reducir el riesgo comercial.`,
    );
  }

  if (p.categories.length > 0) {
    const topCat = p.categories[0];
    const catPct = p.subtotal > 0 ? (topCat.value / p.subtotal) * 100 : 0;
    paragraphs.push(
      `Por mix de productos, la categoría líder es "${topCat.name}" con ${fmtMoney(topCat.value, true)} (${catPct.toFixed(1)}% del subtotal). ` +
      `El catálogo activo cuenta con ${p.categories.length} categorías representativas en el período.`,
    );
  }

  return paragraphs;
}

async function captureNode(id: string): Promise<string | null> {
  const el = document.getElementById(id);
  if (!el) return null;
  try {
    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: 2,
      logging: false,
      useCORS: true,
    });
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.error("PDF capture failed for", id, e);
    return null;
  }
}

export async function generateReportPDF(payload: ReportPayload): Promise<void> {
  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  // ===== Header bar =====
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setFillColor(...RED);
  doc.rect(0, 70, pageW, 4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Visor de Ventas", margin, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Reporte ejecutivo de desempeño comercial", margin, 50);

  doc.setFontSize(9);
  const today = new Date().toLocaleDateString("es-MX", {
    day: "2-digit", month: "long", year: "numeric",
  });
  doc.text(`Generado: ${today}`, pageW - margin, 32, { align: "right" });
  doc.text(`Período: ${payload.periodLabel}`, pageW - margin, 50, { align: "right" });

  y = 100;

  // ===== Section title =====
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Indicadores clave", margin, y);
  y += 16;

  // KPI grid (2x2)
  const kpis: { label: string; value: string; delta?: number }[] = [
    { label: "Ventas totales", value: fmtMoney(payload.revenue, true), delta: payload.revDelta },
    { label: "Ticket medio", value: fmtMoney(payload.avgTicket), delta: payload.ticketDelta },
    { label: "Clientes activos", value: fmtNumber(payload.customerCount), delta: payload.customersDelta },
    { label: "Saldo por cobrar", value: fmtMoney(payload.balance, true) },
  ];
  const colW = (pageW - margin * 2 - 12) / 2;
  const rowH = 56;
  kpis.forEach((k, i) => {
    const cx = margin + (i % 2) * (colW + 12);
    const cy = y + Math.floor(i / 2) * (rowH + 8);
    doc.setFillColor(...LIGHT);
    doc.roundedRect(cx, cy, colW, rowH, 6, 6, "F");
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(k.label.toUpperCase(), cx + 12, cy + 16);
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(k.value, cx + 12, cy + 36);
    if (k.delta !== undefined && isFinite(k.delta)) {
      const sign = k.delta >= 0 ? "▲" : "▼";
      const color: [number, number, number] = k.delta >= 0 ? [22, 163, 74] : [220, 38, 38];
      doc.setTextColor(...color);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`${sign} ${Math.abs(k.delta).toFixed(1)}%`, cx + colW - 12, cy + 36, { align: "right" });
    }
  });
  y += rowH * 2 + 8 + 20;

  // ===== Análisis =====
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Análisis ejecutivo", margin, y);
  y += 16;

  doc.setTextColor(40, 40, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const analysis = buildAnalysis(payload);
  for (const p of analysis) {
    const lines = doc.splitTextToSize(p, pageW - margin * 2);
    if (y + lines.length * 13 > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(lines, margin, y);
    y += lines.length * 13 + 8;
  }

  // ===== Capturar gráficas =====
  const chartIds = [
    { id: "pdf-chart-trend", title: "Tendencia mensual" },
    { id: "pdf-chart-categories", title: "Mix de categorías" },
    { id: "pdf-chart-top", title: "Top clientes" },
  ];

  for (const { id, title } of chartIds) {
    const dataUrl = await captureNode(id);
    if (!dataUrl) continue;
    const imgProps = doc.getImageProperties(dataUrl);
    const w = pageW - margin * 2;
    const h = (imgProps.height * w) / imgProps.width;
    if (y + h + 30 > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, margin, y);
    y += 12;
    doc.addImage(dataUrl, "PNG", margin, y, w, h);
    y += h + 18;
  }

  // ===== Tabla Top clientes =====
  if (payload.topCustomers.length > 0) {
    if (y + 120 > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Ranking — Top 10 clientes", margin, y);
    y += 14;

    doc.setFillColor(...NAVY);
    doc.rect(margin, y, pageW - margin * 2, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("#", margin + 8, y + 12);
    doc.text("Cliente", margin + 30, y + 12);
    doc.text("Facturación", pageW - margin - 8, y + 12, { align: "right" });
    y += 18;

    doc.setTextColor(40, 40, 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    payload.topCustomers.slice(0, 10).forEach((c, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(248, 249, 252);
        doc.rect(margin, y, pageW - margin * 2, 16, "F");
      }
      doc.text(String(i + 1), margin + 8, y + 11);
      const name = c.fullName.length > 60 ? c.fullName.slice(0, 58) + "…" : c.fullName;
      doc.text(name, margin + 30, y + 11);
      doc.text(fmtMoney(c.ventas), pageW - margin - 8, y + 11, { align: "right" });
      y += 16;
    });
  }

  // ===== Footer en todas las páginas =====
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LIGHT);
    doc.setLineWidth(0.5);
    doc.line(margin, pageH - 28, pageW - margin, pageH - 28);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Visor de Ventas · Reporte ejecutivo confidencial", margin, pageH - 14);
    doc.text(`Página ${i} de ${total}`, pageW - margin, pageH - 14, { align: "right" });
  }

  const filename = `reporte-ventas-${payload.periodLabel.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}

// Avoid unused import warning
void fmtMonth;

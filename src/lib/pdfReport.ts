import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";
import { fmtMoney, fmtNumber, fmtPct, fmtMonth } from "@/lib/format";
import logoUrl from "@/assets/logo-report.png";

// Cargar el logo como dataURL una sola vez (lazy)
let _logoDataUrl: string | null = null;
async function loadLogoDataUrl(): Promise<string | null> {
  if (_logoDataUrl) return _logoDataUrl;
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    _logoDataUrl = dataUrl;
    return dataUrl;
  } catch (e) {
    console.error("No se pudo cargar el logo del reporte", e);
    return null;
  }
}

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

  // Conclusión / lectura ejecutiva
  const positiveSignals = [
    isFinite(p.revDelta) && p.revDelta >= 0 ? "crecimiento de ingresos" : null,
    isFinite(p.ticketDelta) && p.ticketDelta >= 0 ? "expansión del ticket medio" : null,
    isFinite(p.customersDelta) && p.customersDelta >= 0 ? "ampliación de la base de clientes" : null,
  ].filter(Boolean) as string[];
  const negativeSignals = [
    isFinite(p.revDelta) && p.revDelta < 0 ? "contracción de ingresos" : null,
    isFinite(p.ticketDelta) && p.ticketDelta < 0 ? "disminución del ticket medio" : null,
    isFinite(p.customersDelta) && p.customersDelta < 0 ? "reducción en clientes activos" : null,
  ].filter(Boolean) as string[];

  let outlook = "El desempeño global del período se mantiene dentro de parámetros operativos esperados.";
  if (positiveSignals.length >= 2) {
    outlook = `Los indicadores reflejan una dinámica favorable, destacando ${positiveSignals.join(", ")}, lo que sugiere consolidar las estrategias comerciales actuales y capitalizar el momentum.`;
  } else if (negativeSignals.length >= 2) {
    outlook = `Los indicadores muestran señales de alerta —${negativeSignals.join(", ")}—, por lo que se sugiere revisar la mezcla comercial, políticas de precio y acciones de retención de clientes para revertir la tendencia.`;
  } else if (positiveSignals.length === 1 && negativeSignals.length === 1) {
    outlook = `El período presenta resultados mixtos: ${positiveSignals[0]} contrastado con ${negativeSignals[0]}. Se recomienda profundizar el análisis por segmento, categoría y agente para focalizar acciones correctivas.`;
  }

  paragraphs.push(
    `${outlook} Las gráficas y rankings que se presentan a continuación detallan la composición ` +
    `de la facturación por mes, categoría y cliente clave, ofreciendo a la dirección una visión integral ` +
    `para la toma de decisiones estratégicas.`,
  );

  return paragraphs;
}

// =====================
// Análisis por gráfica
// =====================
function analyzeTrend(p: ReportPayload): string {
  const t = p.trend;
  if (t.length === 0) return "No hay suficientes datos en el rango seleccionado para construir una tendencia mensual.";
  if (t.length === 1) {
    return `El rango analizado contiene un único período (${t[0].period}) con ${fmtMoney(t[0].ventas, true)} en ventas y ${fmtNumber(t[0].facturas)} facturas. ` +
      `Para identificar tendencias, recomendamos ampliar el rango de fechas a varios meses.`;
  }
  const max = t.reduce((a, b) => (b.ventas > a.ventas ? b : a));
  const min = t.reduce((a, b) => (b.ventas < a.ventas ? b : a));
  const first = t[0];
  const last = t[t.length - 1];
  const growth = first.ventas > 0 ? ((last.ventas - first.ventas) / first.ventas) * 100 : NaN;
  const dirText = isFinite(growth)
    ? growth >= 0
      ? `un crecimiento acumulado del ${growth.toFixed(1)}%`
      : `una contracción del ${Math.abs(growth).toFixed(1)}%`
    : "una variación no comparable";

  return `La evolución mensual abarca ${t.length} períodos. El mes con mayor facturación fue ${max.period} con ` +
    `${fmtMoney(max.ventas, true)}, mientras que el de menor desempeño fue ${min.period} con ${fmtMoney(min.ventas, true)}. ` +
    `Comparando el primer (${first.period}) y último período (${last.period}) del rango, se observa ${dirText}. ` +
    `Este comportamiento sugiere ${
      isFinite(growth) && growth >= 5
        ? "una dinámica comercial favorable que conviene reforzar"
        : isFinite(growth) && growth <= -5
        ? "la necesidad de revisar estrategias comerciales y de retención"
        : "estabilidad operativa en el período evaluado"
    }.`;
}

function analyzeCategories(p: ReportPayload): string {
  if (p.categories.length === 0) return "No se registró actividad por categoría en el rango seleccionado.";
  const total = p.categories.reduce((a, c) => a + c.value, 0);
  const top = p.categories[0];
  const topPct = total > 0 ? (top.value / total) * 100 : 0;
  const top3 = p.categories.slice(0, 3);
  const top3Pct = total > 0 ? (top3.reduce((a, c) => a + c.value, 0) / total) * 100 : 0;

  let concentrationNote = "";
  if (topPct >= 50) {
    concentrationNote = `La categoría líder concentra más de la mitad del mix, lo que indica una alta dependencia. Diversificar el portafolio reduciría el riesgo comercial.`;
  } else if (top3Pct >= 75) {
    concentrationNote = `Las tres principales categorías representan ${top3Pct.toFixed(1)}% del mix, mostrando una concentración moderada-alta típica de un portafolio especializado.`;
  } else {
    concentrationNote = `El mix se encuentra razonablemente diversificado entre ${p.categories.length} categorías activas, lo que aporta resiliencia comercial.`;
  }

  return `La categoría más relevante del período es "${top.name}" con ${fmtMoney(top.value, true)} ` +
    `(${topPct.toFixed(1)}% del subtotal). ${concentrationNote}`;
}

function analyzeTopCustomers(p: ReportPayload): string {
  if (p.topCustomers.length === 0) return "No hay clientes con actividad en el rango seleccionado.";
  const top1 = p.topCustomers[0];
  const total = p.revenue;
  const top1Pct = total > 0 ? (top1.ventas / total) * 100 : 0;
  const top3 = p.topCustomers.slice(0, 3);
  const top3Pct = total > 0 ? (top3.reduce((a, c) => a + c.ventas, 0) / total) * 100 : 0;
  const top10Pct = total > 0 ? (p.topCustomers.reduce((a, c) => a + c.ventas, 0) / total) * 100 : 0;

  let risk = "";
  if (top1Pct >= 30) {
    risk = `El cliente principal representa ${top1Pct.toFixed(1)}% de los ingresos, una concentración crítica que conviene mitigar mediante diversificación.`;
  } else if (top3Pct >= 50) {
    risk = `Los tres principales clientes acumulan ${top3Pct.toFixed(1)}% de los ingresos; conviene blindar la relación con cuentas estratégicas.`;
  } else {
    risk = `La cartera muestra una distribución sana, sin dependencia crítica de cuentas individuales.`;
  }

  return `El ranking lo encabeza ${top1.fullName} con ${fmtMoney(top1.ventas, true)} (${top1Pct.toFixed(1)}% del total). ` +
    `Los 10 clientes principales suman ${top10Pct.toFixed(1)}% de la facturación del período. ${risk}`;
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

function ensureSpace(doc: jsPDF, y: number, needed: number, margin: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  // Reservar 50pt para footer (línea + pie + crédito)
  if (y + needed > pageH - margin - 50) {
    doc.addPage();
    return margin;
  }
  return y;
}

function drawParagraph(doc: jsPDF, text: string, x: number, y: number, width: number, margin: number): number {
  doc.setTextColor(40, 40, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(text, width);
  y = ensureSpace(doc, y, lines.length * 13, margin);
  doc.text(lines, x, y);
  return y + lines.length * 13 + 6;
}

export async function generateReportPDF(payload: ReportPayload): Promise<void> {
  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  // Margen izquierdo amplio para respetar la franja roja del membrete
  const marginLeft = 60;
  const marginRight = 40;
  const margin = marginLeft; // alias usado en helpers existentes
  let y = 40;

  // ===== Membrete: franja roja vertical izquierda + cabecera con logo =====
  // Franja roja de borde izquierdo (toda la página, se redibuja en cada página al final)
  doc.setFillColor(...RED);
  doc.rect(0, 0, 18, pageH, "F");

  // Cabecera (fondo blanco, logo + título)
  const headerH = 80;
  const logoData = await loadLogoDataUrl();
  let textX = marginLeft;
  if (logoData) {
    try {
      const logoSize = 50;
      doc.addImage(logoData, "PNG", marginLeft, 30, logoSize, logoSize);
      textX = marginLeft + logoSize + 14;
    } catch (e) {
      console.error("No se pudo dibujar el logo en el PDF", e);
    }
  }

  doc.setTextColor(20, 20, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Visor Ventas", textX, 56);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text("Reporte ejecutivo de desempeño comercial", textX, 74);

  doc.setTextColor(40, 40, 50);
  doc.setFontSize(9);
  const today = new Date().toLocaleDateString("es-MX", {
    day: "2-digit", month: "long", year: "numeric",
  });
  doc.text(`Generado: ${today}`, pageW - marginRight, 56, { align: "right" });
  doc.text(`Período: ${payload.periodLabel}`, pageW - marginRight, 74, { align: "right" });

  y = 30 + headerH + 20;


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
      const sign = k.delta >= 0 ? "+" : "-";
      const color: [number, number, number] = k.delta >= 0 ? [22, 163, 74] : [220, 38, 38];
      doc.setTextColor(...color);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`${sign}${Math.abs(k.delta).toFixed(1)}% vs anterior`, cx + colW - 12, cy + 36, { align: "right" });
    }
  });
  y += rowH * 2 + 8 + 20;

  // ===== Análisis ejecutivo =====
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Análisis ejecutivo", margin, y);
  y += 16;

  const analysis = buildAnalysis(payload);
  for (const p of analysis) {
    y = drawParagraph(doc, p, margin, y, pageW - margin * 2, margin);
    y += 2;
  }

  // ===== Capturar gráficas con análisis individual =====
  const chartSections: { id: string; title: string; analysis: string }[] = [
    { id: "pdf-chart-trend", title: "Tendencia mensual", analysis: analyzeTrend(payload) },
    { id: "pdf-chart-categories", title: "Mix de categorías", analysis: analyzeCategories(payload) },
    { id: "pdf-chart-top", title: "Top clientes", analysis: analyzeTopCustomers(payload) },
  ];

  for (const { id, title, analysis: chartAnalysis } of chartSections) {
    const dataUrl = await captureNode(id);
    if (!dataUrl) continue;
    const imgProps = doc.getImageProperties(dataUrl);
    const w = pageW - margin * 2;
    const h = (imgProps.height * w) / imgProps.width;

    y = ensureSpace(doc, y, h + 60, margin);

    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, margin, y);
    y += 4;
    doc.setDrawColor(...RED);
    doc.setLineWidth(1.5);
    doc.line(margin, y, margin + 36, y);
    y += 10;

    doc.addImage(dataUrl, "PNG", margin, y, w, h);
    y += h + 10;

    // Párrafo explicativo dinámico bajo la gráfica
    doc.setFillColor(248, 249, 252);
    const linesAna = doc.splitTextToSize(chartAnalysis, pageW - margin * 2 - 16);
    const boxH = linesAna.length * 12 + 16;
    y = ensureSpace(doc, y, boxH + 12, margin);
    doc.roundedRect(margin, y, pageW - margin * 2, boxH, 6, 6, "F");
    doc.setTextColor(40, 40, 50);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.text(linesAna, margin + 8, y + 12);
    y += boxH + 16;
  }

  // ===== Tabla Top clientes =====
  if (payload.topCustomers.length > 0) {
    y = ensureSpace(doc, y, 140, margin);
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
      y = ensureSpace(doc, y, 16, margin);
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

  // ===== Membrete + Footer en todas las páginas =====
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);

    // Franja roja izquierda (membrete) en todas las páginas
    doc.setFillColor(...RED);
    doc.rect(0, 0, 18, pageH, "F");

    // Línea separadora del pie
    doc.setDrawColor(...LIGHT);
    doc.setLineWidth(0.5);
    doc.line(marginLeft, pageH - 40, pageW - marginRight, pageH - 40);

    // Crédito + paginación (estilo membrete)
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("Desarrollado por Miguel M. Navarro.", marginLeft, pageH - 24);
    doc.text(`Pagina ${i} de ${total}`, pageW - marginRight, pageH - 24, { align: "right" });
  }

  const safeLabel = payload.periodLabel.replace(/[^\w\-]+/g, "_");
  const filename = `reporte-ventas-${safeLabel}.pdf`;
  doc.save(filename);
}

// Avoid unused import warning
void fmtMonth;

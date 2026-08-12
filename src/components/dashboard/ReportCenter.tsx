import { useState } from "react";
import {
  FileDown, FileSpreadsheet, Loader2, CalendarRange, Package, Users, Wallet,
  BarChart3, Layers, FileText, UserMinus, LayoutDashboard, UserCheck,
} from "lucide-react";
import { fmtDate } from "@/lib/format";
import type { Invoice } from "@/lib/types";
import { exportTableExcel, exportTablePDF } from "@/lib/tableExport";
import {
  buildProductSalesReport, buildCustomerRankingReport, buildOutstandingReport,
  buildMonthlySummaryReport, buildCategoryReport, buildInvoiceDetailReport,
  buildAgentReport, buildInactiveCustomersReport,
} from "@/lib/reportBuilders";
import {
  buildConsumptionReport, exportConsumptionExcel, exportConsumptionPDF,
} from "@/lib/customerConsumptionReport";
import { cn } from "@/lib/utils";

type Fmt = "pdf" | "xlsx";

interface ReportDef {
  key: string;
  label: string;
  description: string;
  icon: typeof Package;
  formats: Fmt[];
}

const REPORTS: ReportDef[] = [
  { key: "ejecutivo", label: "Reporte Ejecutivo", description: "KPIs, gráficas y análisis automático del período.", icon: LayoutDashboard, formats: ["pdf"] },
  { key: "productos", label: "Ventas por Producto", description: "Productos ordenados de mayor a menor venta en el período.", icon: Package, formats: ["pdf", "xlsx"] },
  { key: "consumo", label: "Consumo por Cliente", description: "Clientes que consumieron, desglosado mes a mes.", icon: Users, formats: ["pdf", "xlsx"] },
  { key: "ranking", label: "Ranking de Clientes", description: "Clientes ordenados por facturación, ticket y saldo.", icon: UserCheck, formats: ["pdf", "xlsx"] },
  { key: "categorias", label: "Ventas por Categoría", description: "Participación de cada categoría de producto.", icon: Layers, formats: ["pdf", "xlsx"] },
  { key: "mensual", label: "Resumen Mensual", description: "Comparativo mes a mes de ventas, clientes y ticket.", icon: BarChart3, formats: ["pdf", "xlsx"] },
  { key: "saldos", label: "Saldos por Cobrar", description: "Facturas pendientes con antigüedad de saldo.", icon: Wallet, formats: ["pdf", "xlsx"] },
  { key: "facturas", label: "Detalle de Facturas", description: "Listado completo de facturas del período.", icon: FileText, formats: ["pdf", "xlsx"] },
  { key: "agentes", label: "Ventas por Agente", description: "Desempeño de cada agente de ventas.", icon: BarChart3, formats: ["pdf", "xlsx"] },
  { key: "inactivos", label: "Clientes Inactivos", description: "Clientes con historial que no compraron en el período.", icon: UserMinus, formats: ["pdf", "xlsx"] },
];

interface Props {
  invoices: Invoice[];
  dateRange: { from: string; to: string };
  periodLabel: string;
  onExecutivePDF: (from: string, to: string) => Promise<void>;
}

export function ReportCenter({ invoices, dateRange, periodLabel, onExecutivePDF }: Props) {
  const [type, setType] = useState<string>("productos");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [busy, setBusy] = useState<Fmt | null>(null);

  const def = REPORTS.find((r) => r.key === type)!;

  const run = async (fmt: Fmt) => {
    const f = from || dateRange.from;
    const t = to || dateRange.to;
    if (!f || !t) return;
    setBusy(fmt);
    try {
      if (type === "ejecutivo") {
        await onExecutivePDF(f, t);
        return;
      }
      if (type === "consumo") {
        const rep = buildConsumptionReport(invoices, f, t);
        if (fmt === "xlsx") exportConsumptionExcel(rep);
        else await exportConsumptionPDF(rep);
        return;
      }
      const builders: Record<string, (i: Invoice[], a: string, b: string) => ReturnType<typeof buildProductSalesReport>> = {
        productos: buildProductSalesReport,
        ranking: buildCustomerRankingReport,
        categorias: buildCategoryReport,
        mensual: buildMonthlySummaryReport,
        saldos: buildOutstandingReport,
        facturas: buildInvoiceDetailReport,
        agentes: buildAgentReport,
        inactivos: buildInactiveCustomersReport,
      };
      const report = builders[type](invoices, f, t);
      if (fmt === "xlsx") exportTableExcel(report);
      else await exportTablePDF(report);
    } finally {
      setBusy(null);
    }
  };

  const years = [2026, 2025, 2024, 2023, 2022];

  return (
    <section className="mt-10 rounded-2xl bg-gradient-to-br from-card to-muted/40 border border-border p-5 sm:p-8 shadow-[var(--shadow-sm)]">
      <div className="flex items-start gap-3 mb-5">
        <div className="h-10 w-10 rounded-lg bg-brand-red/10 text-brand-red flex items-center justify-center shrink-0">
          <FileDown className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-bold tracking-tight">Centro de Reportes</h3>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            Selecciona el tipo de reporte, el período y el formato de descarga. Si dejas las fechas en
            blanco se usará todo el rango disponible ({periodLabel} activo en pantalla).
          </p>
        </div>
      </div>

      {/* Tipo de reporte */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mb-5">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          const active = r.key === type;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setType(r.key)}
              className={cn(
                "text-left rounded-xl border p-3 transition-colors flex gap-3 items-start",
                active
                  ? "border-brand-red bg-brand-red/5"
                  : "border-border bg-background hover:border-brand-red/40",
              )}
            >
              <span className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                active ? "bg-brand-red text-brand-red-foreground" : "bg-muted text-muted-foreground",
              )}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight">{r.label}</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">{r.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Período + formato */}
      <div className="grid sm:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <CalendarRange className="h-3.5 w-3.5" /> Desde
          </label>
          <input
            type="date"
            value={from}
            min={dateRange.from}
            max={dateRange.to}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <CalendarRange className="h-3.5 w-3.5" /> Hasta
          </label>
          <input
            type="date"
            value={to}
            min={from || dateRange.from}
            max={dateRange.to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <button
          onClick={() => run("pdf")}
          disabled={busy !== null || !def.formats.includes("pdf")}
          className="h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-red text-brand-red-foreground px-5 text-sm font-semibold shadow-[var(--shadow-sm)] hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
        >
          {busy === "pdf" ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando...</> : <><FileDown className="h-4 w-4" /> PDF</>}
        </button>
        <button
          onClick={() => run("xlsx")}
          disabled={busy !== null || !def.formats.includes("xlsx")}
          className="h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white px-5 text-sm font-semibold shadow-[var(--shadow-sm)] hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
        >
          {busy === "xlsx" ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando...</> : <><FileSpreadsheet className="h-4 w-4" /> Excel</>}
        </button>
      </div>

      {!def.formats.includes("xlsx") && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          El {def.label} incluye gráficas, por lo que solo está disponible en PDF.
        </p>
      )}

      <div className="mt-5 pt-4 border-t border-border">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Atajos por año
        </span>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => { setFrom(`${y}-01-01`); setTo(`${y}-12-31`); }}
              className={cn(
                "px-4 py-2 rounded-lg border text-sm font-semibold transition-colors",
                from === `${y}-01-01` && to === `${y}-12-31`
                  ? "border-brand-red bg-brand-red/10 text-brand-red"
                  : "border-border bg-background hover:border-brand-red/60 hover:text-brand-red",
              )}
            >
              {y}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setFrom(""); setTo(""); }}
            className="ml-auto px-2 py-1 rounded-md border border-border bg-background hover:border-primary/40 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Limpiar
          </button>
        </div>
        <div className="mt-3 text-[11px] text-muted-foreground">
          Datos disponibles: {fmtDate(dateRange.from)} — {fmtDate(dateRange.to)}
        </div>
      </div>
    </section>
  );
}

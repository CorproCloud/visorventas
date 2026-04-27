import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import {
  DollarSign, Percent, ShoppingCart, Users, Database, Package, FileText,
  FileDown, Settings2, Loader2, CalendarRange,
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PeriodSelector } from "@/components/layout/PeriodSelector";
import { useDataStore, filterInvoices } from "@/lib/store";
import { fmtMoney, fmtNumber, fmtPct, fmtMonth, fmtDate, safeId } from "@/lib/format";
import { generateReportPDF } from "@/lib/pdfReport";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/lib/types";

// Paleta amplia, sin repeticiones (15 tonos)
const CATEGORY_PALETTE = [
  "#1E40AF", "#059669", "#DC2626", "#D97706", "#7C3AED",
  "#0891B2", "#DB2777", "#65A30D", "#EA580C", "#4338CA",
  "#0D9488", "#9333EA", "#CA8A04", "#BE123C", "#0369A1",
];

type TrendMetric = "ventas" | "facturas" | "ticket" | "clientes" | "saldo";
type TrendChartType = "area" | "bar" | "line";

const METRIC_OPTIONS: { key: TrendMetric; label: string; format: (v: number) => string }[] = [
  { key: "ventas", label: "Ventas totales", format: (v) => fmtMoney(v, true) },
  { key: "facturas", label: "Núm. facturas", format: (v) => fmtNumber(v) },
  { key: "ticket", label: "Ticket medio", format: (v) => fmtMoney(v) },
  { key: "clientes", label: "Clientes únicos", format: (v) => fmtNumber(v) },
  { key: "saldo", label: "Saldo por cobrar", format: (v) => fmtMoney(v, true) },
];

export function DashboardPage() {
  const ds = useDataStore((s) => s.datasets.find((d) => d.id === s.activeDatasetId) ?? null);
  const year = useDataStore((s) => s.selectedYear);
  const month = useDataStore((s) => s.selectedMonth);

  const [trendMetric, setTrendMetric] = useState<TrendMetric>("ventas");
  const [trendChart, setTrendChart] = useState<TrendChartType>("area");
  const [generating, setGenerating] = useState(false);
  const [reportFrom, setReportFrom] = useState<string>("");
  const [reportTo, setReportTo] = useState<string>("");

  const data = useMemo(() => {
    if (!ds) return null;
    const all = ds.invoices;
    const current = filterInvoices(all, year, month);

    const revenue = current.reduce((a, i) => a + i.total, 0);
    const subtotal = current.reduce((a, i) => a + i.subtotal, 0);
    const balance = current.reduce((a, i) => a + i.balance, 0);
    const invCount = current.length;
    const avgTicket = invCount > 0 ? revenue / invCount : 0;
    const customerSet = new Set(current.map((i) => i.customerName));
    const customerCount = customerSet.size;
    const recurrencia = customerCount > 0 ? invCount / customerCount : 0;

    const prevPeriod = month
      ? prevMonthOf(month, ds.months)
      : year
      ? prevYearOf(year, ds.years)
      : null;
    const prev = prevPeriod
      ? all.filter((i) => (month ? i.yearMonth === prevPeriod : i.year === prevPeriod))
      : [];
    const prevRev = prev.reduce((a, i) => a + i.total, 0);
    const prevTicket = prev.length > 0 ? prevRev / prev.length : 0;
    const prevCustomers = new Set(prev.map((i) => i.customerName)).size;

    const revDelta = prevRev > 0 ? ((revenue - prevRev) / prevRev) * 100 : NaN;
    const ticketDelta = prevTicket > 0 ? ((avgTicket - prevTicket) / prevTicket) * 100 : NaN;
    const customersDelta = prevCustomers > 0 ? ((customerCount - prevCustomers) / prevCustomers) * 100 : NaN;

    // Tendencia mensual con TODAS las métricas
    const trend = ds.months.map((m) => {
      const r = all.filter((i) => i.yearMonth === m);
      const ventas = r.reduce((a, i) => a + i.total, 0);
      const saldo = r.reduce((a, i) => a + i.balance, 0);
      const facturas = r.length;
      const ticket = facturas > 0 ? ventas / facturas : 0;
      const clientes = new Set(r.map((i) => i.customerName)).size;
      return {
        period: fmtMonth(m),
        ym: m,
        ventas: Math.round(ventas),
        facturas,
        ticket: Math.round(ticket),
        clientes,
        saldo: Math.round(saldo),
      };
    });

    // Top 10 clientes
    const custMap = new Map<string, { name: string; revenue: number; invoices: number }>();
    for (const i of current) {
      const k = i.customerName;
      const cur = custMap.get(k) ?? { name: k, revenue: 0, invoices: 0 };
      cur.revenue += i.total;
      cur.invoices += 1;
      custMap.set(k, cur);
    }
    const topCustomers = Array.from(custMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((c) => ({
        name: c.name.length > 24 ? c.name.slice(0, 22) + "…" : c.name,
        fullName: c.name,
        ventas: Math.round(c.revenue),
      }));

    // Categorías
    const catMap = new Map<string, number>();
    for (const i of current) {
      for (const ln of i.lines) {
        const c = ln.category ?? "Otros";
        catMap.set(c, (catMap.get(c) ?? 0) + ln.lineNet);
      }
    }
    const categories = Array.from(catMap, ([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);

    return {
      revenue, subtotal, balance, invCount, avgTicket, customerCount, recurrencia,
      revDelta, ticketDelta, customersDelta,
      trend, topCustomers, categories, taxes: revenue - subtotal,
    };
  }, [ds, year, month]);

  if (!ds) return <EmptyState />;

  const periodLabel = month ? fmtMonth(month) : year ?? "Todos los períodos";
  const metricCfg = METRIC_OPTIONS.find((m) => m.key === trendMetric)!;

  // Ancho dinámico para scroll horizontal: 60px por mes mín 100% del contenedor
  const trendMinWidth = Math.max(data!.trend.length * 60, 600);

  const handleGeneratePDF = async () => {
    if (!ds) return;
    setGenerating(true);
    try {
      // Determinar facturas según rango de fechas (si está definido) o filtros activos
      const usingRange = Boolean(reportFrom && reportTo);
      let invoicesForReport: Invoice[];
      let label: string;

      if (usingRange) {
        const from = reportFrom;
        const to = reportTo;
        invoicesForReport = ds.invoices.filter((i) => i.date >= from && i.date <= to);
        label = `${fmtDate(from)} — ${fmtDate(to)}`;
      } else {
        invoicesForReport = filterInvoices(ds.invoices, year, month);
        label = periodLabel;
      }

      const reportData = computeReportSnapshot(ds.invoices, invoicesForReport, year, month, usingRange, reportFrom);

      // Pequeña espera para asegurar render de gráficas
      await new Promise((r) => setTimeout(r, 100));
      await generateReportPDF({
        periodLabel: label,
        invCount: reportData.invCount,
        revenue: reportData.revenue,
        subtotal: reportData.subtotal,
        taxes: reportData.taxes,
        balance: reportData.balance,
        avgTicket: reportData.avgTicket,
        customerCount: reportData.customerCount,
        recurrencia: reportData.recurrencia,
        revDelta: reportData.revDelta,
        ticketDelta: reportData.ticketDelta,
        customersDelta: reportData.customersDelta,
        topCustomers: reportData.topCustomers,
        categories: reportData.categories.slice(0, 10),
        trend: reportData.trend,
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-[1500px] mx-auto">
      <header className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard de Ventas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {periodLabel} · {fmtNumber(data!.invCount)} facturas
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PeriodSelector />
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Ventas Totales"
          value={fmtMoney(data!.revenue, true)}
          hint={`Subtotal: ${fmtMoney(data!.subtotal, true)} · Imp: ${fmtMoney(data!.taxes, true)}`}
          delta={isFinite(data!.revDelta) ? data!.revDelta : undefined}
          icon={DollarSign}
          accent="navy"
        />
        <KpiCard
          label="Ticket Medio"
          value={fmtMoney(data!.avgTicket)}
          hint={`${fmtNumber(data!.invCount)} facturas`}
          delta={isFinite(data!.ticketDelta) ? data!.ticketDelta : undefined}
          icon={ShoppingCart}
          accent="emerald"
        />
        <KpiCard
          label="Clientes"
          value={fmtNumber(data!.customerCount)}
          hint={`Recurrencia ${fmtPct(data!.recurrencia, 1)} fact./cli.`}
          delta={isFinite(data!.customersDelta) ? data!.customersDelta : undefined}
          icon={Users}
          accent="slate"
        />
        <KpiCard
          label="Saldo por Cobrar"
          value={fmtMoney(data!.balance, true)}
          hint={data!.balance > 0 ? "Pendiente de pago" : "Cobrado"}
          icon={Percent}
          accent={data!.balance > 0 ? "red" : "emerald"}
        />
      </div>

      {/* TENDENCIA — full width con scroll horizontal y métrica configurable */}
      <div className="mt-6">
        <div id="pdf-chart-trend" className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                Tendencia mensual — {metricCfg.label}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data!.trend.length} períodos · desplaza horizontalmente para ver historial completo
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Selector de métrica */}
              <div className="inline-flex rounded-md border border-border bg-background p-0.5">
                {METRIC_OPTIONS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setTrendMetric(m.key)}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium rounded transition-colors",
                      trendMetric === m.key
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {/* Selector de tipo */}
              <div className="inline-flex rounded-md border border-border bg-background p-0.5">
                {(["area", "bar", "line"] as TrendChartType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTrendChart(t)}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium rounded capitalize transition-colors",
                      trendChart === t
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t === "bar" ? "Barras" : t === "line" ? "Lineas" : "Area"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto pb-2 -mx-1 px-1">
            <div style={{ minWidth: trendMinWidth, height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                {trendChart === "area" ? (
                  <AreaChart data={data!.trend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grad-trend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="period" stroke="var(--muted-foreground)" fontSize={11}
                      tickLine={false} axisLine={false} interval={0} angle={-25} textAnchor="end" height={50} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false}
                      tickFormatter={(v) => fmtNumber(v, true)} />
                    <Tooltip contentStyle={tooltipStyle}
                      formatter={((v: unknown) => metricCfg.format(Number(v))) as never}
                      cursor={{ fill: "var(--muted)" }} />
                    <Area type="monotone" dataKey={trendMetric} stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#grad-trend)" />
                  </AreaChart>
                ) : trendChart === "bar" ? (
                  <BarChart data={data!.trend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="period" stroke="var(--muted-foreground)" fontSize={11}
                      tickLine={false} axisLine={false} interval={0} angle={-25} textAnchor="end" height={50} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false}
                      tickFormatter={(v) => fmtNumber(v, true)} />
                    <Tooltip contentStyle={tooltipStyle}
                      formatter={((v: unknown) => metricCfg.format(Number(v))) as never}
                      cursor={{ fill: "var(--muted)" }} />
                    <Bar dataKey={trendMetric} fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart data={data!.trend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="period" stroke="var(--muted-foreground)" fontSize={11}
                      tickLine={false} axisLine={false} interval={0} angle={-25} textAnchor="end" height={50} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false}
                      tickFormatter={(v) => fmtNumber(v, true)} />
                    <Tooltip contentStyle={tooltipStyle}
                      formatter={((v: unknown) => metricCfg.format(Number(v))) as never} />
                    <Line type="monotone" dataKey={trendMetric} stroke="var(--chart-1)" strokeWidth={2.5}
                      dot={{ r: 3, fill: "var(--chart-1)" }} activeDot={{ r: 5 }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid lg:grid-cols-2 gap-4">
        <ChartCard id="pdf-chart-categories" title="Mix de categorías" subtitle={periodLabel}>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={data!.categories.slice(0, 12)}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={110}
                paddingAngle={2}
              >
                {data!.categories.slice(0, 12).map((_, i) => (
                  <Cell key={i} fill={CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={((v: unknown) => fmtMoney(Number(v), true)) as never} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard id="pdf-chart-top" title="Top 10 clientes" subtitle="Por facturación en el período">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data!.topCustomers} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false}
                tickFormatter={(v) => fmtNumber(v, true)} />
              <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={10} tickLine={false}
                axisLine={false} width={150} />
              <Tooltip contentStyle={tooltipStyle} formatter={((v: unknown) => fmtMoney(Number(v))) as never} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="ventas" fill="var(--chart-2)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {data!.topCustomers.length > 0 && (
        <section className="mt-6 rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold">Clientes destacados</h3>
              <p className="text-xs text-muted-foreground">Click para ver detalle</p>
            </div>
            <Link to="/" className="text-xs text-primary hover:underline">Ver todos</Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {data!.topCustomers.slice(0, 8).map((c) => (
              <Link
                key={c.fullName}
                to="/customers/$customerId"
                params={{ customerId: safeId(c.fullName) }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <Users className="h-3.5 w-3.5" />
                {c.fullName.length > 30 ? c.fullName.slice(0, 28) + "…" : c.fullName}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/explorer" className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity">
          <FileText className="h-4 w-4" /> Abrir Pivot
        </Link>
        <Link to="/catalog" className="inline-flex items-center gap-2 rounded-lg bg-card border border-border px-4 py-2 text-sm font-medium hover:border-primary/40 transition-colors">
          <Package className="h-4 w-4" /> Ver Catálogo
        </Link>
      </div>

      {/* ===== Sección de Reporte PDF (pie de página) ===== */}
      <section className="mt-10 rounded-2xl bg-gradient-to-br from-card to-muted/40 border border-border p-6 sm:p-8 shadow-[var(--shadow-sm)]">
        <div className="flex items-start gap-3 mb-5">
          <div className="h-10 w-10 rounded-lg bg-brand-red/10 text-brand-red flex items-center justify-center shrink-0">
            <FileDown className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight">Generar Reporte</h3>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
              Selecciona un rango de fechas para acotar el análisis. El reporte incluirá KPIs, gráficas
              y párrafos explicativos automáticos para cada visualización. Si dejas las fechas en blanco,
              se utilizará el período activo ({periodLabel}).
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <CalendarRange className="h-3.5 w-3.5" /> Fecha inicio
            </label>
            <input
              type="date"
              value={reportFrom}
              min={ds.dateRange.from}
              max={ds.dateRange.to}
              onChange={(e) => setReportFrom(e.target.value)}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <CalendarRange className="h-3.5 w-3.5" /> Fecha fin
            </label>
            <input
              type="date"
              value={reportTo}
              min={reportFrom || ds.dateRange.from}
              max={ds.dateRange.to}
              onChange={(e) => setReportTo(e.target.value)}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <button
            onClick={handleGeneratePDF}
            disabled={generating || (Boolean(reportFrom) !== Boolean(reportTo))}
            className="h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-red text-brand-red-foreground px-5 text-sm font-semibold shadow-[var(--shadow-sm)] hover:opacity-90 disabled:opacity-60 transition-opacity whitespace-nowrap"
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generando...</>
            ) : (
              <><FileDown className="h-4 w-4" /> Generar Reporte PDF</>
            )}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">Atajos:</span>
          {ds.years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => {
                const yearDates = ds.invoices.filter((i) => i.year === y).map((i) => i.date).sort();
                if (yearDates.length > 0) {
                  setReportFrom(yearDates[0]);
                  setReportTo(yearDates[yearDates.length - 1]);
                }
              }}
              className="px-2 py-1 rounded-md border border-border bg-background hover:border-primary/40 hover:text-foreground transition-colors"
            >
              Año {y}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setReportFrom(""); setReportTo(""); }}
            className="px-2 py-1 rounded-md border border-border bg-background hover:border-primary/40 hover:text-foreground transition-colors"
          >
            Limpiar
          </button>
          <span className="ml-auto text-[11px]">
            Datos disponibles: {fmtDate(ds.dateRange.from)} — {fmtDate(ds.dateRange.to)}
          </span>
        </div>
      </section>
    </div>
  );
}

// Construye el snapshot del reporte a partir de las facturas filtradas (por fechas o filtro activo)
function computeReportSnapshot(
  allInvoices: Invoice[],
  current: Invoice[],
  year: string | null,
  month: string | null,
  usingRange: boolean,
  _rangeFrom: string,
) {
  const revenue = current.reduce((a, i) => a + i.total, 0);
  const subtotal = current.reduce((a, i) => a + i.subtotal, 0);
  const balance = current.reduce((a, i) => a + i.balance, 0);
  const invCount = current.length;
  const avgTicket = invCount > 0 ? revenue / invCount : 0;
  const customerSet = new Set(current.map((i) => i.customerName));
  const customerCount = customerSet.size;
  const recurrencia = customerCount > 0 ? invCount / customerCount : 0;

  // Comparativa: período anterior de igual longitud (rango) o filtros (año/mes)
  let prev: Invoice[] = [];
  if (usingRange && current.length > 0) {
    const sorted = current.map((i) => i.date).sort();
    const fromDate = new Date(sorted[0] + "T00:00:00").getTime();
    const toDate = new Date(sorted[sorted.length - 1] + "T00:00:00").getTime();
    const span = toDate - fromDate;
    const prevTo = new Date(fromDate - 24 * 3600 * 1000).toISOString().slice(0, 10);
    const prevFrom = new Date(fromDate - 24 * 3600 * 1000 - span).toISOString().slice(0, 10);
    prev = allInvoices.filter((i) => i.date >= prevFrom && i.date <= prevTo);
  } else if (month) {
    const allMonths = Array.from(new Set(allInvoices.map((i) => i.yearMonth))).sort();
    const idx = allMonths.indexOf(month);
    const prevM = idx > 0 ? allMonths[idx - 1] : null;
    if (prevM) prev = allInvoices.filter((i) => i.yearMonth === prevM);
  } else if (year) {
    const allYears = Array.from(new Set(allInvoices.map((i) => i.year))).sort();
    const idx = allYears.indexOf(year);
    const prevY = idx > 0 ? allYears[idx - 1] : null;
    if (prevY) prev = allInvoices.filter((i) => i.year === prevY);
  }

  const prevRev = prev.reduce((a, i) => a + i.total, 0);
  const prevTicket = prev.length > 0 ? prevRev / prev.length : 0;
  const prevCustomers = new Set(prev.map((i) => i.customerName)).size;
  const revDelta = prevRev > 0 ? ((revenue - prevRev) / prevRev) * 100 : NaN;
  const ticketDelta = prevTicket > 0 ? ((avgTicket - prevTicket) / prevTicket) * 100 : NaN;
  const customersDelta = prevCustomers > 0 ? ((customerCount - prevCustomers) / prevCustomers) * 100 : NaN;

  // Tendencia mensual sobre el período seleccionado
  const monthsInRange = Array.from(new Set(current.map((i) => i.yearMonth))).sort();
  const trend = monthsInRange.map((m) => {
    const r = current.filter((i) => i.yearMonth === m);
    const ventas = r.reduce((a, i) => a + i.total, 0);
    const facturas = r.length;
    return { period: fmtMonth(m), ventas: Math.round(ventas), facturas };
  });

  // Top 10 clientes
  const custMap = new Map<string, number>();
  for (const i of current) custMap.set(i.customerName, (custMap.get(i.customerName) ?? 0) + i.total);
  const topCustomers = Array.from(custMap, ([fullName, ventas]) => ({ fullName, ventas: Math.round(ventas) }))
    .sort((a, b) => b.ventas - a.ventas)
    .slice(0, 10);

  // Categorías
  const catMap = new Map<string, number>();
  for (const i of current) {
    for (const ln of i.lines) {
      const c = ln.category ?? "Otros";
      catMap.set(c, (catMap.get(c) ?? 0) + ln.lineNet);
    }
  }
  const categories = Array.from(catMap, ([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);

  return {
    revenue, subtotal, balance, invCount, avgTicket, customerCount, recurrencia,
    revDelta, ticketDelta, customersDelta, taxes: revenue - subtotal,
    trend, topCustomers, categories,
  };
}


function prevMonthOf(m: string, all: string[]): string | null {
  const idx = all.indexOf(m);
  return idx > 0 ? all[idx - 1] : null;
}
function prevYearOf(y: string, all: string[]): string | null {
  const idx = all.indexOf(y);
  return idx > 0 ? all[idx - 1] : null;
}

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "var(--shadow-md)",
};

function ChartCard({ title, subtitle, children, className = "", id }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string; id?: string;
}) {
  return (
    <div id={id} className={`rounded-2xl bg-card border border-border p-5 ${className}`}>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-4 sm:px-8 py-20 max-w-2xl mx-auto text-center">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
        <Database className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold">Aún no hay facturas cargadas</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Sube tu consecutivo de facturas para comenzar el análisis.
      </p>
      <Link to="/data" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
        <Database className="h-4 w-4" /> Ir a Datos
      </Link>
    </div>
  );
}

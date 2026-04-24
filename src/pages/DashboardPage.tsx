import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { DollarSign, Percent, ShoppingCart, Repeat, Database, Package } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PeriodSelector } from "@/components/layout/PeriodSelector";
import { useDataStore } from "@/lib/store";
import { fmtMoney, fmtNumber, fmtPct } from "@/lib/format";

export function DashboardPage() {
  const ds = useDataStore((s) => s.datasets.find((d) => d.id === s.activeDatasetId) ?? null);
  const period = useDataStore((s) => s.selectedPeriod);

  const data = useMemo(() => {
    if (!ds) return null;
    const records = ds.records;
    const current = period ? records.filter((r) => r.period === period) : records;

    const sales = current.reduce((a, r) => a + r.netSales, 0);
    const cost = current.reduce((a, r) => a + r.netCost, 0);
    const units = current.reduce((a, r) => a + r.units, 0);
    const margin = sales > 0 ? ((sales - cost) / sales) * 100 : 0;
    const avgTicket = units > 0 ? sales / units : 0;
    const skus = new Set(current.map((r) => r.code)).size;

    // previous period (chronological)
    const idx = ds.periods.indexOf(period ?? "");
    const prevPeriod = idx > 0 ? ds.periods[idx - 1] : null;
    const prevRecs = prevPeriod ? records.filter((r) => r.period === prevPeriod) : [];
    const prevSales = prevRecs.reduce((a, r) => a + r.netSales, 0);
    const prevUnits = prevRecs.reduce((a, r) => a + r.units, 0);
    const prevSkus = new Set(prevRecs.map((r) => r.code)).size;
    const salesDelta = prevSales > 0 ? ((sales - prevSales) / prevSales) * 100 : NaN;
    const unitsDelta = prevUnits > 0 ? ((units - prevUnits) / prevUnits) * 100 : NaN;
    const skusDelta = prevSkus > 0 ? ((skus - prevSkus) / prevSkus) * 100 : NaN;

    // Trend across all periods
    const trend = ds.periods.map((p) => {
      const r = records.filter((x) => x.period === p);
      const s = r.reduce((a, b) => a + b.netSales, 0);
      const c = r.reduce((a, b) => a + b.netCost, 0);
      return {
        period: p,
        ventas: Math.round(s),
        margen: s > 0 ? +(((s - c) / s) * 100).toFixed(1) : 0,
      };
    });

    // Top 10 products in current period
    const top = [...current].sort((a, b) => b.netSales - a.netSales).slice(0, 10).map((r) => ({
      name: r.description.length > 26 ? r.description.slice(0, 24) + "…" : r.description,
      ventas: Math.round(r.netSales),
    }));

    // Category distribution
    const catMap = new Map<string, number>();
    for (const r of current) {
      catMap.set(r.category ?? "Otros", (catMap.get(r.category ?? "Otros") ?? 0) + r.netSales);
    }
    const categories = Array.from(catMap, ([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);

    return {
      sales, cost, units, margin, avgTicket, skus,
      salesDelta, unitsDelta, skusDelta,
      trend, top, categories,
    };
  }, [ds, period]);

  if (!ds) return <EmptyState />;

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-[1500px] mx-auto">
      <header className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard de Ventas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ds.name} · {data ? fmtNumber(ds.records.length) : 0} registros
          </p>
        </div>
        <PeriodSelector />
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Ventas Netas"
          value={fmtMoney(data!.sales, true)}
          hint={`${period ?? "Total"} · ${fmtNumber(data!.units, true)} unidades`}
          delta={isFinite(data!.salesDelta) ? data!.salesDelta : undefined}
          icon={DollarSign}
          accent="navy"
        />
        <KpiCard
          label="Margen Bruto"
          value={fmtPct(data!.margin)}
          hint={`Costo: ${fmtMoney(data!.cost, true)}`}
          icon={Percent}
          accent="emerald"
        />
        <KpiCard
          label="Ticket Medio"
          value={fmtMoney(data!.avgTicket)}
          hint="por unidad vendida"
          delta={isFinite(data!.unitsDelta) ? data!.unitsDelta : undefined}
          icon={ShoppingCart}
          accent="slate"
        />
        <KpiCard
          label="SKUs Activos"
          value={fmtNumber(data!.skus)}
          hint="recurrencia de catálogo"
          delta={isFinite(data!.skusDelta) ? data!.skusDelta : undefined}
          icon={Repeat}
          accent="red"
        />
      </div>

      {/* Charts */}
      <div className="mt-6 grid lg:grid-cols-3 gap-4">
        <ChartCard title="Tendencia anual" subtitle="Ventas netas por período" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data!.trend} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="period" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false}
                tickFormatter={(v) => fmtNumber(v, true)} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={((v: unknown) => fmtMoney(Number(v))) as never}
                cursor={{ fill: "var(--muted)" }}
              />
              <Area type="monotone" dataKey="ventas" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#g1)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribución por categoría" subtitle={period ? `Período ${period}` : "Total"}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data!.categories}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={2}
              >
                {data!.categories.map((_, i) => (
                  <Cell key={i} fill={`var(--chart-${(i % 5) + 1})`} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={((v: unknown) => fmtMoney(Number(v), true)) as never} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-4 grid lg:grid-cols-2 gap-4">
        <ChartCard title="Top 10 productos" subtitle="Por venta neta">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data!.top} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false}
                tickFormatter={(v) => fmtNumber(v, true)} />
              <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={10} tickLine={false}
                axisLine={false} width={140} />
              <Tooltip contentStyle={tooltipStyle} formatter={((v: unknown) => fmtMoney(Number(v))) as never} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="ventas" fill="var(--chart-2)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Margen vs Período" subtitle="% margen bruto promedio">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data!.trend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="period" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false}
                tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={tooltipStyle} formatter={((v: unknown) => `${v}%`) as never} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="margen" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/explorer" className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity">
          <Database className="h-4 w-4" /> Abrir Pivot
        </Link>
        <Link to="/catalog" className="inline-flex items-center gap-2 rounded-lg bg-card border border-border px-4 py-2 text-sm font-medium hover:border-primary/40 transition-colors">
          <Package className="h-4 w-4" /> Ver Catálogo
        </Link>
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "var(--shadow-md)",
};

function ChartCard({ title, subtitle, children, className = "" }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-2xl bg-card border border-border p-5 ${className}`}>
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
      <h2 className="text-xl font-semibold">Aún no hay datos cargados</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Sube tu primer archivo Excel/CSV para comenzar el análisis.
      </p>
      <Link to="/data" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
        <Database className="h-4 w-4" /> Ir a Datos
      </Link>
    </div>
  );
}

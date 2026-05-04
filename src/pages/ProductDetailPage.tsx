import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, LineChart, Line,
} from "recharts";
import {
  ArrowLeft, Package, Users, DollarSign, ShoppingCart, Calendar, TrendingUp,
} from "lucide-react";
import { useDataStore } from "@/lib/store";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { DateRangeFilter, type DateRange } from "@/components/layout/DateRangeFilter";
import { fmtMoney, fmtNumber, fmtDate, fmtMonth, safeId } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ProductDetailPageProps {
  productCode: string;
}

type ChartType = "area" | "bar" | "line";

export function ProductDetailPage({ productCode }: ProductDetailPageProps) {
  const ds = useDataStore((s) => s.datasets.find((d) => d.id === s.activeDatasetId) ?? null);
  const [chart, setChart] = useState<ChartType>("area");
  const [range, setRange] = useState<DateRange>({ from: null, to: null });

  const decoded = useMemo(() => {
    try { return decodeURIComponent(productCode); } catch { return productCode; }
  }, [productCode]);

  const data = useMemo(() => {
    if (!ds) return null;

    // Recolectar líneas de este producto a través de facturas
    interface Hit {
      invoiceId: string;
      folio: string;
      date: string;
      yearMonth: string;
      customerId: string;
      customerName: string;
      quantity: number;
      unitPrice: number;
      lineNet: number;
      description: string;
      unit: string;
      category: string;
    }
    const hits: Hit[] = [];
    for (const inv of ds.invoices) {
      for (const ln of inv.lines) {
        if (ln.code === decoded) {
          hits.push({
            invoiceId: inv.id,
            folio: inv.folio,
            date: inv.date,
            yearMonth: inv.yearMonth,
            customerId: inv.customerId,
            customerName: inv.customerName,
            quantity: ln.quantity,
            unitPrice: ln.unitPrice,
            lineNet: ln.lineNet,
            description: ln.description,
            unit: ln.unit,
            category: ln.category ?? "Otros",
          });
        }
      }
    }
    if (hits.length === 0) return { notFound: true } as const;

    const description = hits[0].description;
    const unit = hits[0].unit;
    const category = hits[0].category;

    // Rango global del producto (límites del filtro)
    const allDates = hits.map((h) => h.date).sort();
    const minDate = allDates[0];
    const maxDate = allDates[allDates.length - 1];

    // Aplicar filtro temporal
    const fHits = hits.filter((h) => {
      if (range.from && h.date < range.from) return false;
      if (range.to && h.date > range.to) return false;
      return true;
    });

    if (fHits.length === 0) {
      return {
        notFound: false as const,
        empty: true as const,
        code: decoded, description, unit, category,
        minDate, maxDate,
      };
    }

    const totalUnits = fHits.reduce((a, h) => a + h.quantity, 0);
    const totalNet = fHits.reduce((a, h) => a + h.lineNet, 0);
    const avgPrice = totalUnits > 0 ? totalNet / totalUnits : 0;
    const fDates = fHits.map((h) => h.date).sort();
    const firstDate = fDates[0];
    const lastDate = fDates[fDates.length - 1];

    // Tendencia mensual (solo meses dentro del rango filtrado del producto)
    const monthSet = new Set(fHits.map((h) => h.yearMonth));
    const filteredMonths = ds.months.filter((m) => monthSet.has(m));
    const monthlyMap = new Map<string, { ym: string; ventas: number; unidades: number; facturas: number }>();
    for (const m of filteredMonths) monthlyMap.set(m, { ym: m, ventas: 0, unidades: 0, facturas: 0 });
    for (const h of fHits) {
      const cur = monthlyMap.get(h.yearMonth);
      if (!cur) continue;
      cur.ventas += h.lineNet;
      cur.unidades += h.quantity;
      cur.facturas += 1;
    }
    const trend = Array.from(monthlyMap.values()).map((x) => ({
      period: fmtMonth(x.ym),
      ventas: Math.round(x.ventas),
      unidades: Math.round(x.unidades),
      facturas: x.facturas,
    }));

    // Clientes que compran este producto
    const custMap = new Map<string, {
      customerId: string;
      customerName: string;
      units: number;
      net: number;
      invoiceCount: number;
      lastDate: string;
    }>();
    for (const h of fHits) {
      const cur = custMap.get(h.customerName) ?? {
        customerId: h.customerId,
        customerName: h.customerName,
        units: 0,
        net: 0,
        invoiceCount: 0,
        lastDate: "",
      };
      cur.units += h.quantity;
      cur.net += h.lineNet;
      cur.invoiceCount += 1;
      if (h.date > cur.lastDate) cur.lastDate = h.date;
      custMap.set(h.customerName, cur);
    }
    const customers = Array.from(custMap.values()).sort((a, b) => b.net - a.net);

    return {
      notFound: false as const,
      empty: false as const,
      code: decoded,
      description,
      unit,
      category,
      totalUnits,
      totalNet,
      avgPrice,
      firstDate,
      lastDate,
      minDate,
      maxDate,
      invoiceCount: fHits.length,
      trend,
      customers,
    };
  }, [ds, decoded, range]);

  if (!ds) return <NotFound code={decoded} reason="No hay datasets cargados." />;
  if (!data || data.notFound) return <NotFound code={decoded} reason="No se encontraron ventas para este producto." />;

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-[1500px] mx-auto">
      <Link to="/catalog" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver al catálogo
      </Link>

      <header className="mb-6 flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Package className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{data.category}</div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">{data.description}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1.5">
            <span className="font-mono">{data.code}</span>
            <span>Unidad: {data.unit}</span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {fmtDate(data.firstDate)} → {fmtDate(data.lastDate)}
            </span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Ventas netas" value={fmtMoney(data.totalNet, true)}
          hint={`${fmtNumber(data.invoiceCount)} facturas`} icon={DollarSign} accent="navy" />
        <KpiCard label="Unidades vendidas" value={fmtNumber(data.totalUnits)}
          hint={`Unidad: ${data.unit}`} icon={ShoppingCart} accent="emerald" />
        <KpiCard label="Precio promedio" value={fmtMoney(data.avgPrice)}
          hint="Por unidad" icon={TrendingUp} accent="slate" />
        <KpiCard label="Clientes" value={fmtNumber(data.customers.length)}
          hint="que compran este producto" icon={Users} accent="navy" />
      </div>

      {/* Historial de ventas */}
      <div className="mt-6 rounded-2xl bg-card border border-border p-5">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold">Historial de ventas</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Evolución mensual de ventas netas para este producto
            </p>
          </div>
          <div className="inline-flex rounded-md border border-border bg-background p-0.5">
            {(["area", "bar", "line"] as ChartType[]).map((t) => (
              <button
                key={t}
                onClick={() => setChart(t)}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-medium rounded capitalize transition-colors whitespace-nowrap",
                  chart === t ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "bar" ? "Barras" : t === "line" ? "Lineas" : "Area"}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto pb-2 -mx-1 px-1">
          <div style={{ minWidth: Math.max(data.trend.length * 60, 600), height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              {chart === "area" ? (
                <AreaChart data={data.trend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="prod-grad" x1="0" y1="0" x2="0" y2="1">
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
                    formatter={((v: unknown) => fmtMoney(Number(v))) as never} cursor={{ fill: "var(--muted)" }} />
                  <Area type="monotone" dataKey="ventas" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#prod-grad)" />
                </AreaChart>
              ) : chart === "bar" ? (
                <BarChart data={data.trend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="period" stroke="var(--muted-foreground)" fontSize={11}
                    tickLine={false} axisLine={false} interval={0} angle={-25} textAnchor="end" height={50} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false}
                    tickFormatter={(v) => fmtNumber(v, true)} />
                  <Tooltip contentStyle={tooltipStyle}
                    formatter={((v: unknown) => fmtMoney(Number(v))) as never} cursor={{ fill: "var(--muted)" }} />
                  <Bar dataKey="ventas" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={data.trend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="period" stroke="var(--muted-foreground)" fontSize={11}
                    tickLine={false} axisLine={false} interval={0} angle={-25} textAnchor="end" height={50} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false}
                    tickFormatter={(v) => fmtNumber(v, true)} />
                  <Tooltip contentStyle={tooltipStyle}
                    formatter={((v: unknown) => fmtMoney(Number(v))) as never} />
                  <Line type="monotone" dataKey="ventas" stroke="var(--chart-1)" strokeWidth={2.5}
                    dot={{ r: 3, fill: "var(--chart-1)" }} activeDot={{ r: 5 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Clientes que compran este producto */}
      <section className="mt-6 rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold">Clientes que compran este producto ({data.customers.length})</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Ordenados por facturación. Click para ver detalle del cliente.</p>
        </div>
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted z-10">
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 text-left">#</th>
                <th className="px-4 py-2.5 text-left">Cliente</th>
                <th className="px-4 py-2.5 text-right">Unidades</th>
                <th className="px-4 py-2.5 text-right">Facturas</th>
                <th className="px-4 py-2.5 text-right">Última compra</th>
                <th className="px-4 py-2.5 text-right">Total neto</th>
              </tr>
            </thead>
            <tbody>
              {data.customers.map((c, idx) => (
                <tr key={c.customerName} className="border-t border-border hover:bg-muted/40">
                  <td className="px-4 py-2 text-muted-foreground tabular-nums">{idx + 1}</td>
                  <td className="px-4 py-2">
                    <Link
                      to="/customers/$customerId"
                      params={{ customerId: safeId(c.customerName) }}
                      className="text-foreground hover:text-primary font-medium"
                    >
                      {c.customerName}
                    </Link>
                    <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{c.customerId}</div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtNumber(c.units)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.invoiceCount}</td>
                  <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">{fmtDate(c.lastDate)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtMoney(c.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
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

function NotFound({ code, reason }: { code: string; reason: string }) {
  return (
    <div className="px-4 sm:px-8 py-20 max-w-2xl mx-auto text-center">
      <h2 className="text-xl font-semibold">Producto no encontrado</h2>
      <p className="text-sm text-muted-foreground mt-1">{reason}</p>
      <p className="text-xs text-muted-foreground mt-1">Código: <span className="font-mono">{code}</span></p>
      <Link to="/catalog" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
        <ArrowLeft className="h-4 w-4" /> Volver al catálogo
      </Link>
    </div>
  );
}

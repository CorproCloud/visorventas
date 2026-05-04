import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import {
  ArrowLeft, DollarSign, ShoppingCart, FileText, Wallet, Calendar, Package, Mail,
} from "lucide-react";
import { useDataStore } from "@/lib/store";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { DateRangeFilter, type DateRange } from "@/components/layout/DateRangeFilter";
import { fmtMoney, fmtNumber, fmtDate, fmtMonth, safeId } from "@/lib/format";

interface CustomerDetailPageProps {
  customerId: string; // url-safe (encoded name)
}

export function CustomerDetailPage({ customerId }: CustomerDetailPageProps) {
  const ds = useDataStore((s) => s.datasets.find((d) => d.id === s.activeDatasetId) ?? null);
  const [range, setRange] = useState<DateRange>({ from: null, to: null });


  const decoded = useMemo(() => {
    try { return decodeURIComponent(customerId); } catch { return customerId; }
  }, [customerId]);

  const data = useMemo(() => {
    if (!ds) return null;
    const allInvs = ds.invoices.filter(
      (i) => safeId(i.customerName) === customerId || i.customerName === decoded,
    );
    if (allInvs.length === 0) return { invoices: [], notFound: true } as const;

    // Rango global de fechas del cliente (para los límites del filtro)
    const allDates = allInvs.map((i) => i.date).sort();
    const minDate = allDates[0];
    const maxDate = allDates[allDates.length - 1];

    // Aplicar filtro de rango temporal
    const invs = allInvs.filter((i) => {
      if (range.from && i.date < range.from) return false;
      if (range.to && i.date > range.to) return false;
      return true;
    });

    if (invs.length === 0) {
      return {
        invoices: [],
        notFound: false as const,
        empty: true as const,
        minDate, maxDate,
        customerName: allInvs[0].customerName,
        internalId: allInvs[0].customerId,
        agent: allInvs[0].agentId,
      };
    }

    const totalRev = invs.reduce((a, i) => a + i.total, 0);
    const subtotal = invs.reduce((a, i) => a + i.subtotal, 0);
    const balance = invs.reduce((a, i) => a + i.balance, 0);
    const totalUnits = invs.reduce((a, i) => a + i.lines.reduce((x, l) => x + l.quantity, 0), 0);
    const avgTicket = invs.length > 0 ? totalRev / invs.length : 0;
    const dates = invs.map((i) => i.date).sort();
    const firstDate = dates[0];
    const lastDate = dates.at(-1)!;
    const monthSet = new Set(invs.map((i) => i.yearMonth));

    // Tendencia mensual de este cliente (solo meses dentro del rango filtrado)
    const filteredMonths = ds.months.filter((m) => monthSet.has(m));
    const monthlyMap = new Map<string, { ym: string; ventas: number; facturas: number }>();
    for (const m of filteredMonths) monthlyMap.set(m, { ym: m, ventas: 0, facturas: 0 });
    for (const i of invs) {
      const cur = monthlyMap.get(i.yearMonth);
      if (!cur) continue;
      cur.ventas += i.total;
      cur.facturas += 1;
    }
    const trend = Array.from(monthlyMap.values()).map((x) => ({
      period: fmtMonth(x.ym),
      ventas: Math.round(x.ventas),
      facturas: x.facturas,
    }));

    // Top productos del cliente
    const prodMap = new Map<string, { code: string; description: string; units: number; net: number }>();
    for (const i of invs) {
      for (const ln of i.lines) {
        const cur = prodMap.get(ln.code) ?? { code: ln.code, description: ln.description, units: 0, net: 0 };
        cur.units += ln.quantity;
        cur.net += ln.lineNet;
        prodMap.set(ln.code, cur);
      }
    }
    const topProducts = Array.from(prodMap.values())
      .sort((a, b) => b.net - a.net)
      .slice(0, 10);

    return {
      invoices: invs,
      notFound: false as const,
      empty: false as const,
      totalRev, subtotal, balance, totalUnits, avgTicket,
      firstDate, lastDate, activeMonths: monthSet.size,
      minDate, maxDate,
      trend, topProducts,
      customerName: invs[0].customerName,
      internalId: invs[0].customerId,
      agent: invs[0].agentId,
    };
  }, [ds, customerId, decoded, range]);

  if (!ds) {
    return <NotFound name={decoded} reason="No hay datasets cargados." />;
  }
  if (!data || data.notFound) {
    return <NotFound name={decoded} reason="No se encontraron facturas para este cliente." />;
  }

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-[1500px] mx-auto">
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a clientes
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{data.customerName}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1.5">
          <span className="font-mono">Cliente {data.internalId}</span>
          {data.agent && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> Agente {data.agent}</span>}
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {fmtDate(data.firstDate)} → {fmtDate(data.lastDate)}
          </span>
          <span>{data.activeMonths} meses activos</span>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Facturado total" value={fmtMoney(data.totalRev, true)}
          hint={`Subtotal ${fmtMoney(data.subtotal, true)}`} icon={DollarSign} accent="navy" />
        <KpiCard label="Facturas" value={fmtNumber(data.invoices.length)}
          hint={`${fmtNumber(data.totalUnits)} unidades`} icon={FileText} accent="emerald" />
        <KpiCard label="Ticket medio" value={fmtMoney(data.avgTicket)}
          hint="por factura" icon={ShoppingCart} accent="slate" />
        <KpiCard label="Saldo pendiente" value={fmtMoney(data.balance, true)}
          hint={data.balance > 0 ? "Por cobrar" : "Cobrado"} icon={Wallet}
          accent={data.balance > 0 ? "red" : "emerald"} />
      </div>

      <div className="mt-6 grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl bg-card border border-border p-5">
          <h3 className="text-sm font-semibold mb-3">Tendencia de compra</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.trend} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cust-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="period" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false}
                tickFormatter={(v) => fmtNumber(v, true)} />
              <Tooltip contentStyle={tooltipStyle}
                formatter={((v: unknown) => fmtMoney(Number(v))) as never}
                cursor={{ fill: "var(--muted)" }} />
              <Area type="monotone" dataKey="ventas" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#cust-grad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-card border border-border p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Productos top</h3>
          <ul className="space-y-2.5">
            {data.topProducts.slice(0, 8).map((p, idx) => {
              const max = data.topProducts[0]?.net || 1;
              const pct = (p.net / max) * 100;
              return (
                <li key={p.code}>
                  <Link
                    to="/products/$productCode"
                    params={{ productCode: encodeURIComponent(p.code) }}
                    className="block group"
                  >
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium leading-snug group-hover:text-primary transition-colors">
                          <span className="text-muted-foreground mr-1.5">#{idx + 1}</span>
                          {p.description}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{p.code} · {fmtNumber(p.units)} u.</div>
                      </div>
                      <div className="text-xs font-semibold tabular-nums shrink-0">{fmtMoney(p.net, true)}</div>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--chart-2)]" style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <section className="mt-6 rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold">Historial de facturas ({data.invoices.length})</h3>
        </div>
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted z-10">
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 text-left">Fecha</th>
                <th className="px-4 py-2.5 text-left">Folio</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-right">Líneas</th>
                <th className="px-4 py-2.5 text-right">Subtotal</th>
                <th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {[...data.invoices].sort((a, b) => b.date.localeCompare(a.date)).map((inv) => (
                <tr key={inv.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-4 py-2 whitespace-nowrap">{fmtDate(inv.date)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{inv.folio}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                      inv.status?.toLowerCase().includes("pagada") ? "bg-emerald/15 text-emerald" :
                      inv.balance > 0 ? "bg-brand-red/10 text-brand-red" : "bg-muted text-muted-foreground"
                    }`}>{inv.status || "—"}</span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{inv.lines.length}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtMoney(inv.subtotal)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtMoney(inv.total)}</td>
                  <td className={`px-4 py-2 text-right tabular-nums ${inv.balance > 0 ? "text-brand-red font-medium" : ""}`}>
                    {fmtMoney(inv.balance)}
                  </td>
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

function NotFound({ name, reason }: { name: string; reason: string }) {
  return (
    <div className="px-4 sm:px-8 py-20 max-w-2xl mx-auto text-center">
      <h2 className="text-xl font-semibold">Cliente no encontrado</h2>
      <p className="text-sm text-muted-foreground mt-1">{reason}</p>
      <p className="text-xs text-muted-foreground mt-1">Buscaba: <span className="font-mono">{name}</span></p>
      <Link to="/" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
    </div>
  );
}

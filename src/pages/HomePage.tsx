import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowRight, Database, LayoutDashboard, Package, Search, Sparkles,
  TrendingUp, Users, FileText, Wallet,
} from "lucide-react";
import { useDataStore } from "@/lib/store";
import { UploadDropzone } from "@/components/data/UploadDropzone";
import { fmtMoney, fmtNumber, fmtDate, safeId } from "@/lib/format";
import type { CustomerSummary } from "@/lib/types";

export function HomePage() {
  const datasets = useDataStore((s) => s.datasets);
  const activeId = useDataStore((s) => s.activeDatasetId);
  const setActive = useDataStore((s) => s.setActive);
  const active = datasets.find((d) => d.id === activeId);

  const [query, setQuery] = useState("");

  // Resúmenes por cliente
  const customers = useMemo<CustomerSummary[]>(() => {
    if (!active) return [];
    const map = new Map<string, CustomerSummary & { _catSales: Map<string, number> }>();
    for (const inv of active.invoices) {
      const key = inv.customerName || inv.customerId;
      let c = map.get(key);
      if (!c) {
        c = {
          id: inv.customerId,
          name: inv.customerName,
          invoiceCount: 0,
          totalSales: 0,
          totalRevenue: 0,
          totalUnits: 0,
          avgTicket: 0,
          lastInvoiceDate: inv.date,
          firstInvoiceDate: inv.date,
          outstandingBalance: 0,
          uniqueSkus: 0,
          topCategory: "—",
          _catSales: new Map(),
        };
        map.set(key, c);
      }
      c.invoiceCount += 1;
      c.totalSales += inv.subtotal;
      c.totalRevenue += inv.total;
      c.outstandingBalance += inv.balance;
      if (inv.date > c.lastInvoiceDate) c.lastInvoiceDate = inv.date;
      if (inv.date < c.firstInvoiceDate) c.firstInvoiceDate = inv.date;
      const skuSet = new Set<string>();
      for (const ln of inv.lines) {
        c.totalUnits += ln.quantity;
        skuSet.add(ln.code);
        const cat = ln.category ?? "Otros";
        c._catSales.set(cat, (c._catSales.get(cat) ?? 0) + ln.lineNet);
      }
      c.uniqueSkus = Math.max(c.uniqueSkus, skuSet.size);
    }
    return Array.from(map.values()).map((c) => {
      const top = Array.from(c._catSales.entries()).sort((a, b) => b[1] - a[1])[0];
      return {
        ...c,
        avgTicket: c.invoiceCount > 0 ? c.totalRevenue / c.invoiceCount : 0,
        topCategory: top?.[0] ?? "—",
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [active]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    );
  }, [customers, query]);

  const totals = useMemo(() => {
    if (!active) return null;
    const totalRev = active.invoices.reduce((a, i) => a + i.total, 0);
    const balance = active.invoices.reduce((a, i) => a + i.balance, 0);
    return { totalRev, balance, customerCount: customers.length };
  }, [active, customers]);

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-10 max-w-[1500px] mx-auto">
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-3xl px-6 sm:px-12 py-10 sm:py-14 text-white"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-brand-red/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-10 h-72 w-72 rounded-full bg-emerald/20 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/20 backdrop-blur px-3 py-1 text-xs">
            <Sparkles className="h-3.5 w-3.5 text-emerald" />
            Customer Sales Intelligence
          </div>
          <h1 className="mt-4 text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
            Conoce a tus clientes,
            <br />
            <span className="text-emerald">vende más inteligente.</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-white/75 max-w-2xl">
            Carga tu consecutivo de facturas y obtén ranking de clientes, ticket medio,
            recurrencia, productos preferidos y saldos pendientes — al instante.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-white text-foreground px-5 py-2.5 text-sm font-semibold hover:bg-white/90 transition-colors">
              <LayoutDashboard className="h-4 w-4" /> Ir al Dashboard
            </Link>
            <Link to="/data" className="inline-flex items-center gap-2 rounded-xl bg-white/10 ring-1 ring-white/20 text-white px-5 py-2.5 text-sm font-semibold hover:bg-white/15 transition-colors">
              <Database className="h-4 w-4" /> Gestionar datos
            </Link>
          </div>
        </div>
      </section>

      {/* Empty state */}
      {datasets.length === 0 && (
        <section className="mt-8 grid lg:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-card border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Carga tu consecutivo de facturas</h2>
                <p className="text-xs text-muted-foreground">.xls, .xlsx o .csv</p>
              </div>
            </div>
            <UploadDropzone />
          </div>
          <div className="rounded-2xl bg-card border border-border p-6">
            <h2 className="text-base font-semibold mb-4">Qué obtienes</h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {[
                { icon: Users, label: "Ranking de clientes con ticket medio y recurrencia" },
                { icon: TrendingUp, label: "Tendencias mensuales, YoY y estacionalidad" },
                { icon: Package, label: "Catálogo con métricas de rotación por SKU" },
                { icon: FileText, label: "Pivot de facturas con filtros y exportación" },
              ].map((f) => (
                <li key={f.label} className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-md bg-emerald/10 text-emerald flex items-center justify-center shrink-0">
                    <f.icon className="h-3.5 w-3.5" />
                  </div>
                  <span>{f.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Resumen + selector de clientes */}
      {active && totals && (
        <>
          <section className="mt-10 grid sm:grid-cols-3 gap-4">
            <SummaryStat icon={Users} label="Clientes activos" value={fmtNumber(totals.customerCount)} accent="navy" />
            <SummaryStat icon={FileText} label="Facturación total" value={fmtMoney(totals.totalRev, true)} accent="emerald" />
            <SummaryStat icon={Wallet} label="Saldo por cobrar" value={fmtMoney(totals.balance, true)} accent={totals.balance > 0 ? "red" : "slate"} />
          </section>

          <section className="mt-8">
            <div className="flex items-end justify-between flex-wrap gap-4 mb-5">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Selecciona un cliente</h2>
                <p className="text-sm text-muted-foreground">
                  Dataset: <span className="font-medium text-foreground">{active.name}</span> · {fmtNumber(active.invoiceCount)} facturas · {fmtDate(active.dateRange.from)} → {fmtDate(active.dateRange.to)}
                </p>
              </div>
              <div className="relative flex-1 min-w-[240px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar cliente por nombre o clave..."
                  className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.slice(0, 60).map((c, idx) => (
                <Link
                  key={`${c.id}-${c.name}`}
                  to="/customers/$customerId"
                  params={{ customerId: safeId(c.name) }}
                  className="group relative overflow-hidden rounded-2xl bg-card border border-border p-5 hover:border-primary/40 hover:shadow-[var(--shadow-md)] transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h3 className="text-sm font-semibold leading-snug line-clamp-2 min-h-[2.6em]">{c.name}</h3>
                  <p className="text-[11px] font-mono text-muted-foreground mt-0.5">Cliente {c.id}</p>

                  <div className="mt-4 space-y-1.5">
                    <Row label="Facturado" value={fmtMoney(c.totalRevenue, true)} bold />
                    <Row label="Facturas" value={`${fmtNumber(c.invoiceCount)}`} />
                    <Row label="Ticket medio" value={fmtMoney(c.avgTicket)} />
                    <Row label="Top categoría" value={c.topCategory} />
                  </div>

                  <div
                    className="absolute bottom-0 left-0 h-1 w-full opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: "var(--gradient-emerald)" }}
                  />
                </Link>
              ))}
            </div>

            {filtered.length > 60 && (
              <p className="mt-4 text-xs text-muted-foreground text-center">
                Mostrando 60 de {fmtNumber(filtered.length)} clientes. Refina la búsqueda para ver más.
              </p>
            )}
          </section>

          {datasets.length > 1 && (
            <div className="mt-10">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Otros datasets
              </h3>
              <div className="flex flex-wrap gap-2">
                {datasets.filter((d) => d.id !== activeId).map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setActive(d.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-card border border-border hover:border-primary/40 transition-colors"
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "text-foreground font-semibold" : "text-foreground font-medium"}`}>{value}</span>
    </div>
  );
}

function SummaryStat({ icon: Icon, label, value, accent }: {
  icon: typeof Users; label: string; value: string; accent: "navy" | "emerald" | "slate" | "red";
}) {
  const cls: Record<string, string> = {
    navy: "bg-primary/10 text-primary",
    emerald: "bg-emerald/10 text-emerald",
    slate: "bg-muted text-muted-foreground",
    red: "bg-brand-red/10 text-brand-red",
  };
  return (
    <div className="rounded-2xl bg-card border border-border p-5 flex items-center gap-4">
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${cls[accent]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold tabular-nums truncate">{value}</div>
      </div>
    </div>
  );
}

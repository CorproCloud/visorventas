import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowUpDown, Database, FileText, Search, Users, Wallet, AlertCircle,
  ChevronRight, Upload,
} from "lucide-react";
import { useDataStore } from "@/lib/store";
import { UploadDropzone } from "@/components/data/UploadDropzone";
import { fmtMoney, fmtNumber, fmtDate, safeId } from "@/lib/format";
import type { CustomerSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

type SortKey = "name" | "totalRevenue" | "invoiceCount" | "avgTicket" | "outstandingBalance" | "lastInvoiceDate";
type SortDir = "asc" | "desc";

export function HomePage() {
  const datasets = useDataStore((s) => s.datasets);
  const activeId = useDataStore((s) => s.activeDatasetId);
  const setActive = useDataStore((s) => s.setActive);
  const active = datasets.find((d) => d.id === activeId);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("totalRevenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [onlyDebt, setOnlyDebt] = useState(false);

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
    });
  }, [active]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = customers;
    if (q) {
      rows = rows.filter((c) =>
        c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
      );
    }
    if (onlyDebt) {
      rows = rows.filter((c) => c.outstandingBalance > 0.5);
    }
    rows = [...rows].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return rows;
  }, [customers, query, sortKey, sortDir, onlyDebt]);

  const totals = useMemo(() => {
    if (!active) return null;
    const totalRev = active.invoices.reduce((a, i) => a + i.total, 0);
    const balance = active.invoices.reduce((a, i) => a + i.balance, 0);
    const overdue = customers.filter((c) => c.outstandingBalance > 0.5).length;
    return { totalRev, balance, customerCount: customers.length, overdue };
  }, [active, customers]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc"); }
  };

  // Empty state — no datasets
  if (datasets.length === 0) {
    return (
      <div className="px-4 sm:px-8 py-8 max-w-5xl mx-auto">
        <div className="rounded-lg bg-card border border-border p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-md bg-brand-red/10 text-brand-red flex items-center justify-center">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Carga el consecutivo de facturas</h2>
              <p className="text-xs text-muted-foreground">Formato .xls, .xlsx o .csv exportado del ERP.</p>
            </div>
          </div>
          <div className="mt-4">
            <UploadDropzone />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-5">
      {/* Toolbar / KPIs compactas */}
      {active && totals && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <Stat icon={Users} label="Clientes" value={fmtNumber(totals.customerCount)} accent="navy" />
          <Stat icon={FileText} label="Facturado" value={fmtMoney(totals.totalRev, true)} accent="emerald" />
          <Stat icon={Wallet} label="Saldo por cobrar" value={fmtMoney(totals.balance, true)} accent={totals.balance > 0 ? "red" : "slate"} />
          <Stat icon={AlertCircle} label="Con adeudo" value={fmtNumber(totals.overdue)} accent="red" />
        </section>
      )}

      {/* Toolbar */}
      <section className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cliente por nombre o clave..."
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-foreground select-none cursor-pointer">
            <input
              type="checkbox"
              checked={onlyDebt}
              onChange={(e) => setOnlyDebt(e.target.checked)}
              className="h-4 w-4 accent-[var(--brand-red)]"
            />
            Solo con saldo
          </label>
          {active && (
            <div className="text-xs text-muted-foreground ml-auto">
              {fmtNumber(active.invoiceCount)} facturas
              {" · "}{fmtDate(active.dateRange.from)} → {fmtDate(active.dateRange.to)}
            </div>
          )}
        </div>

        {/* Tabla densa — todos los clientes */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left w-10">#</th>
                <Th sortKey="name" current={sortKey} dir={sortDir} onClick={toggleSort} align="left">Cliente</Th>
                <Th sortKey="invoiceCount" current={sortKey} dir={sortDir} onClick={toggleSort} align="right">Facturas</Th>
                <Th sortKey="totalRevenue" current={sortKey} dir={sortDir} onClick={toggleSort} align="right">Facturado</Th>
                <Th sortKey="avgTicket" current={sortKey} dir={sortDir} onClick={toggleSort} align="right">Ticket medio</Th>
                <Th sortKey="outstandingBalance" current={sortKey} dir={sortDir} onClick={toggleSort} align="right">Saldo</Th>
                <Th sortKey="lastInvoiceDate" current={sortKey} dir={sortDir} onClick={toggleSort} align="left">Última compra</Th>
                <th className="px-4 py-2.5 text-left">Top categoría</th>
                <th className="px-2 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => (
                <tr key={`${c.id}-${c.name}`} className="border-t border-border hover:bg-muted/40 transition-colors group">
                  <td className="px-4 py-2 text-xs font-mono text-muted-foreground tabular-nums">{idx + 1}</td>
                  <td className="px-4 py-2">
                    <Link
                      to="/customers/$customerId"
                      params={{ customerId: safeId(c.name) }}
                      className="block min-w-0"
                    >
                      <div className="font-medium text-foreground leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                        {c.name}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground">{c.id}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtNumber(c.invoiceCount)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtMoney(c.totalRevenue)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{fmtMoney(c.avgTicket)}</td>
                  <td className={cn(
                    "px-4 py-2 text-right tabular-nums font-medium",
                    c.outstandingBalance > 0.5 ? "text-brand-red" : "text-muted-foreground",
                  )}>
                    {fmtMoney(c.outstandingBalance)}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{fmtDate(c.lastInvoiceDate)}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground line-clamp-1 max-w-[180px]">{c.topCategory}</td>
                  <td className="px-2 py-2">
                    <Link
                      to="/customers/$customerId"
                      params={{ customerId: safeId(c.name) }}
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground group-hover:text-primary"
                      aria-label="Ver detalle"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Sin resultados con los filtros actuales.
                </td></tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-muted/40 text-xs">
                <tr className="border-t border-border">
                  <td className="px-4 py-2.5" />
                  <td className="px-4 py-2.5 font-semibold text-foreground">{fmtNumber(filtered.length)} clientes</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                    {fmtNumber(filtered.reduce((a, c) => a + c.invoiceCount, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                    {fmtMoney(filtered.reduce((a, c) => a + c.totalRevenue, 0), true)}
                  </td>
                  <td />
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-brand-red">
                    {fmtMoney(filtered.reduce((a, c) => a + c.outstandingBalance, 0), true)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* Datasets switcher */}
      {datasets.length > 1 && (
        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
            <Database className="h-3 w-3" /> Datasets
          </span>
          {datasets.map((d, i) => (
            <button
              key={d.id}
              onClick={() => setActive(d.id)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
                d.id === activeId
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:border-primary/40",
              )}
            >
              Dataset {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Th({
  children, sortKey, current, dir, onClick, align,
}: {
  children: React.ReactNode;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  align: "left" | "right";
}) {
  const active = sortKey === current;
  return (
    <th className={cn("px-4 py-2.5 select-none", align === "right" ? "text-right" : "text-left")}>
      <button
        onClick={() => onClick(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors",
          active && "text-foreground",
        )}
      >
        {children}
        <ArrowUpDown className={cn("h-3 w-3", active ? "opacity-100" : "opacity-30")} />
        {active && <span className="text-[9px]">{dir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}

function Stat({ icon: Icon, label, value, accent }: {
  icon: typeof Users; label: string; value: string;
  accent: "navy" | "emerald" | "slate" | "red";
}) {
  const cls: Record<string, string> = {
    navy: "bg-primary/10 text-primary",
    emerald: "bg-emerald/10 text-emerald",
    slate: "bg-muted text-muted-foreground",
    red: "bg-brand-red/10 text-brand-red",
  };
  return (
    <div className="rounded-lg bg-card border border-border px-4 py-3 flex items-center gap-3">
      <div className={cn("h-9 w-9 rounded-md flex items-center justify-center shrink-0", cls[accent])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-base font-bold tabular-nums truncate">{value}</div>
      </div>
    </div>
  );
}

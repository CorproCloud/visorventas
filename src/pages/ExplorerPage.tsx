import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import * as XLSX from "xlsx";
import { ArrowDown, ArrowUp, ArrowUpDown, Database, Download, Search } from "lucide-react";
import { useDataStore, filterInvoices } from "@/lib/store";
import { PeriodSelector } from "@/components/layout/PeriodSelector";
import { fmtMoney, fmtNumber, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface FlatRow {
  date: string;
  folio: string;
  customer: string;
  customerId: string;
  status: string;
  agent: string;
  subtotal: number;
  iva: number;
  total: number;
  balance: number;
  lines: number;
}

type SortKey = keyof FlatRow;

const COLUMNS: { key: SortKey; label: string; align?: "right"; format?: (v: unknown) => string }[] = [
  { key: "date", label: "Fecha", format: (v) => fmtDate(String(v)) },
  { key: "folio", label: "Folio" },
  { key: "customer", label: "Cliente" },
  { key: "status", label: "Status" },
  { key: "agent", label: "Agente" },
  { key: "lines", label: "Líneas", align: "right", format: (v) => fmtNumber(Number(v)) },
  { key: "subtotal", label: "Subtotal", align: "right", format: (v) => fmtMoney(Number(v)) },
  { key: "iva", label: "IVA", align: "right", format: (v) => fmtMoney(Number(v)) },
  { key: "total", label: "Total", align: "right", format: (v) => fmtMoney(Number(v)) },
  { key: "balance", label: "Saldo", align: "right", format: (v) => fmtMoney(Number(v)) },
];

export function ExplorerPage() {
  const ds = useDataStore((s) => s.datasets.find((d) => d.id === s.activeDatasetId) ?? null);
  const year = useDataStore((s) => s.selectedYear);
  const month = useDataStore((s) => s.selectedMonth);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const rows = useMemo<FlatRow[]>(() => {
    if (!ds) return [];
    const filtered = filterInvoices(ds.invoices, year, month);
    let r: FlatRow[] = filtered.map((inv) => ({
      date: inv.date,
      folio: inv.folio,
      customer: inv.customerName,
      customerId: inv.customerId,
      status: inv.status || "—",
      agent: inv.agentId || "—",
      subtotal: inv.subtotal,
      iva: inv.iva,
      total: inv.total,
      balance: inv.balance,
      lines: inv.lines.length,
    }));
    if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter((x) =>
        x.customer.toLowerCase().includes(q) ||
        x.folio.toLowerCase().includes(q) ||
        x.customerId.toLowerCase().includes(q),
      );
    }
    r.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return r;
  }, [ds, year, month, query, sortKey, sortDir, statusFilter]);

  const statuses = useMemo(() => {
    if (!ds) return [];
    return Array.from(new Set(ds.invoices.map((i) => i.status || "—"))).sort();
  }, [ds]);

  const totals = useMemo(() => ({
    subtotal: rows.reduce((a, r) => a + r.subtotal, 0),
    iva: rows.reduce((a, r) => a + r.iva, 0),
    total: rows.reduce((a, r) => a + r.total, 0),
    balance: rows.reduce((a, r) => a + r.balance, 0),
  }), [rows]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const exportXlsx = () => {
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Facturas");
    XLSX.writeFile(wb, `pulse-bi-facturas-${Date.now()}.xlsx`);
  };

  const exportCsv = () => {
    const headers = COLUMNS.map((c) => c.label).join(",");
    const lines = rows.map((r) => COLUMNS.map((c) => JSON.stringify(r[c.key] ?? "")).join(","));
    const blob = new Blob([headers + "\n" + lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pulse-bi-facturas-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!ds) {
    return (
      <div className="px-4 sm:px-8 py-20 max-w-2xl mx-auto text-center">
        <h2 className="text-xl font-semibold">No hay datos</h2>
        <p className="text-sm text-muted-foreground mt-1">Carga datos para usar el explorador.</p>
        <Link to="/data" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
          <Database className="h-4 w-4" /> Ir a Datos
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-[1500px] mx-auto">
      <header className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Explorador de Facturas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {fmtNumber(rows.length)} facturas · Total {fmtMoney(totals.total, true)} · Saldo {fmtMoney(totals.balance, true)}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg bg-card border border-border px-3 py-2 text-sm font-medium hover:border-primary/40 transition-colors">
            <Download className="h-4 w-4" /> CSV
          </button>
          <button onClick={exportXlsx} className="inline-flex items-center gap-2 rounded-lg bg-emerald text-emerald-foreground px-3 py-2 text-sm font-medium hover:opacity-90 transition-opacity">
            <Download className="h-4 w-4" /> Excel
          </button>
        </div>
      </header>

      <div className="rounded-xl bg-card border border-border p-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por cliente, folio..."
            className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <PeriodSelector />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
        >
          <option value="all">Todos los status</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted z-10">
              <tr>
                {COLUMNS.map((c) => (
                  <th key={String(c.key)}
                    onClick={() => toggleSort(c.key)}
                    className={cn(
                      "px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none whitespace-nowrap",
                      c.align === "right" ? "text-right" : "text-left",
                    )}>
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {sortKey === c.key
                        ? sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 500).map((r, i) => (
                <tr key={`${r.folio}-${i}`} className="border-t border-border hover:bg-muted/40 transition-colors">
                  {COLUMNS.map((c) => {
                    const v = r[c.key];
                    return (
                      <td key={String(c.key)} className={cn(
                        "px-3 py-2 whitespace-nowrap tabular-nums",
                        c.align === "right" ? "text-right" : "text-left",
                        c.key === "balance" && Number(v) > 0 ? "text-brand-red font-medium" : "",
                      )}>
                        {c.format ? c.format(v) : String(v ?? "—")}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {rows.length > 500 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-3 py-3 text-center text-xs text-muted-foreground bg-muted/30">
                    Mostrando 500 de {fmtNumber(rows.length)}. Refina la búsqueda o exporta para ver todo.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="sticky bottom-0 bg-muted">
              <tr className="border-t-2 border-border font-semibold text-xs">
                <td colSpan={6} className="px-3 py-2.5 text-right text-muted-foreground uppercase tracking-wider">Totales</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.subtotal)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.iva)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.total)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-brand-red">{fmtMoney(totals.balance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

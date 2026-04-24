import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import * as XLSX from "xlsx";
import { ArrowDown, ArrowUp, ArrowUpDown, Database, Download, Filter, Search } from "lucide-react";
import { useDataStore } from "@/lib/store";
import { PeriodSelector } from "@/components/layout/PeriodSelector";
import { fmtMoney, fmtNumber, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SalesRecord } from "@/lib/types";

type SortKey = keyof SalesRecord;
type GroupKey = "none" | "category" | "unit" | "period";

const COLUMNS: { key: SortKey; label: string; align?: "right"; format?: (v: any) => string }[] = [
  { key: "code", label: "Clave" },
  { key: "description", label: "Descripción" },
  { key: "category", label: "Categoría" },
  { key: "unit", label: "Unidad" },
  { key: "period", label: "Período" },
  { key: "units", label: "Unidades", align: "right", format: (v) => fmtNumber(v) },
  { key: "avgPrice", label: "Precio Prom.", align: "right", format: (v) => fmtMoney(v) },
  { key: "netSales", label: "Venta Neta", align: "right", format: (v) => fmtMoney(v) },
  { key: "netCost", label: "Costo Neto", align: "right", format: (v) => fmtMoney(v) },
  { key: "marginPct", label: "Margen %", align: "right", format: (v) => fmtPct(v) },
];

export function ExplorerPage() {
  const ds = useDataStore((s) => s.datasets.find((d) => d.id === s.activeDatasetId) ?? null);
  const period = useDataStore((s) => s.selectedPeriod);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("netSales");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [groupBy, setGroupBy] = useState<GroupKey>("none");
  const [allPeriods, setAllPeriods] = useState(false);

  const rows = useMemo(() => {
    if (!ds) return [];
    let r = ds.records.slice();
    if (!allPeriods && period) r = r.filter((x) => x.period === period);
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter(
        (x) =>
          x.code.toLowerCase().includes(q) ||
          x.description.toLowerCase().includes(q) ||
          (x.category ?? "").toLowerCase().includes(q),
      );
    }
    r.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return r;
  }, [ds, period, allPeriods, query, sortKey, sortDir]);

  const groups = useMemo(() => {
    if (groupBy === "none") return null;
    const map = new Map<string, SalesRecord[]>();
    for (const r of rows) {
      const key = String(r[groupBy as keyof SalesRecord] ?? "—");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      items,
      totalSales: items.reduce((a, b) => a + b.netSales, 0),
      totalUnits: items.reduce((a, b) => a + b.units, 0),
    })).sort((a, b) => b.totalSales - a.totalSales);
  }, [rows, groupBy]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const exportXlsx = () => {
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Datos");
    XLSX.writeFile(wb, `pulse-bi-${period ?? "all"}-${Date.now()}.xlsx`);
  };

  const exportCsv = () => {
    const headers = COLUMNS.map((c) => c.label).join(",");
    const lines = rows.map((r) => COLUMNS.map((c) => JSON.stringify(r[c.key] ?? "")).join(","));
    const blob = new Blob([headers + "\n" + lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pulse-bi-${period ?? "all"}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!ds) {
    return (
      <div className="px-4 sm:px-8 py-20 max-w-2xl mx-auto text-center">
        <h2 className="text-xl font-semibold">No hay datasets</h2>
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
          <h1 className="text-2xl font-bold tracking-tight">Explorador de Datos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pivot table · {fmtNumber(rows.length)} filas
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg bg-card border border-border px-3 py-2 text-sm font-medium hover:border-primary/40 transition-colors">
            <Download className="h-4 w-4" /> CSV
          </button>
          <button onClick={exportXlsx}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald text-emerald-foreground px-3 py-2 text-sm font-medium hover:opacity-90 transition-opacity">
            <Download className="h-4 w-4" /> Excel
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="rounded-xl bg-card border border-border p-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por clave, descripción, categoría..."
            className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <PeriodSelector />
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground px-3 py-2 rounded-lg border border-border bg-background cursor-pointer">
          <input type="checkbox" checked={allPeriods} onChange={(e) => setAllPeriods(e.target.checked)} className="accent-primary" />
          Todos los períodos
        </label>
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupKey)}
            className="bg-transparent text-sm focus:outline-none"
          >
            <option value="none">Sin agrupar</option>
            <option value="category">Por categoría</option>
            <option value="unit">Por unidad</option>
            <option value="period">Por período</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted z-10">
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key}
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
              {groups
                ? groups.map((g) => (
                    <GroupRows key={g.key} group={g} />
                  ))
                : rows.slice(0, 500).map((r) => <DataRow key={r.id} r={r} />)}
              {!groups && rows.length > 500 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-3 py-3 text-center text-xs text-muted-foreground bg-muted/30">
                    Mostrando 500 de {fmtNumber(rows.length)} filas. Refina la búsqueda para ver más.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DataRow({ r }: { r: SalesRecord }) {
  return (
    <tr className="border-t border-border hover:bg-muted/40 transition-colors">
      {COLUMNS.map((c) => {
        const v = r[c.key];
        return (
          <td key={c.key} className={cn("px-3 py-2 whitespace-nowrap tabular-nums",
            c.align === "right" ? "text-right" : "text-left")}>
            {c.format ? c.format(v) : String(v ?? "—")}
          </td>
        );
      })}
    </tr>
  );
}

function GroupRows({ group }: { group: { key: string; items: SalesRecord[]; totalSales: number; totalUnits: number } }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <tr className="bg-muted/60 border-t border-border">
        <td colSpan={COLUMNS.length} className="px-3 py-2">
          <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <span className={cn("transition-transform", open ? "rotate-90" : "")}>▶</span>
            <span>{group.key}</span>
            <span className="text-muted-foreground font-normal">
              · {group.items.length} ítems · {fmtMoney(group.totalSales, true)} · {fmtNumber(group.totalUnits, true)} unid.
            </span>
          </button>
        </td>
      </tr>
      {open && group.items.slice(0, 200).map((r) => <DataRow key={r.id} r={r} />)}
    </>
  );
}

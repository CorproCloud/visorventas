import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Package, Search, TrendingUp, Database } from "lucide-react";
import { useDataStore } from "@/lib/store";
import { PeriodSelector } from "@/components/layout/PeriodSelector";
import { fmtMoney, fmtNumber, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

export function CatalogPage() {
  const ds = useDataStore((s) => s.datasets.find((d) => d.id === s.activeDatasetId) ?? null);
  const period = useDataStore((s) => s.selectedPeriod);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    if (!ds) return [];
    // Aggregate per code (across selected period or all)
    const recs = period ? ds.records.filter((r) => r.period === period) : ds.records;
    const map = new Map<string, {
      code: string; description: string; category: string; unit: string;
      units: number; netSales: number; netCost: number; appearances: number;
    }>();
    for (const r of recs) {
      const k = r.code;
      const cur = map.get(k);
      if (cur) {
        cur.units += r.units;
        cur.netSales += r.netSales;
        cur.netCost += r.netCost;
        cur.appearances += 1;
      } else {
        map.set(k, {
          code: r.code,
          description: r.description,
          category: r.category ?? "Otros",
          unit: r.unit,
          units: r.units,
          netSales: r.netSales,
          netCost: r.netCost,
          appearances: 1,
        });
      }
    }
    return Array.from(map.values())
      .map((x) => ({
        ...x,
        margin: x.netSales > 0 ? ((x.netSales - x.netCost) / x.netSales) * 100 : 0,
        rotation: x.appearances, // # of period entries — proxy for rotation
      }))
      .sort((a, b) => b.netSales - a.netSales);
  }, [ds, period]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.category));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    let arr = items;
    if (category !== "all") arr = arr.filter((i) => i.category === category);
    const q = query.trim().toLowerCase();
    if (q) {
      arr = arr.filter(
        (i) => i.code.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
      );
    }
    return arr;
  }, [items, category, query]);

  // Reset window on filter change
  useEffect(() => setVisible(PAGE_SIZE), [query, category, period]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setVisible((v) => Math.min(v + PAGE_SIZE, filtered.length));
    });
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  if (!ds) {
    return (
      <div className="px-4 sm:px-8 py-20 max-w-2xl mx-auto text-center">
        <h2 className="text-xl font-semibold">No hay catálogo disponible</h2>
        <p className="text-sm text-muted-foreground mt-1">Carga un dataset para ver tu catálogo.</p>
        <Link to="/data" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
          <Database className="h-4 w-4" /> Ir a Datos
        </Link>
      </div>
    );
  }

  const totalSales = filtered.reduce((a, b) => a + b.netSales, 0);

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-[1500px] mx-auto">
      <header className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogo de Productos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {fmtNumber(filtered.length)} SKUs · {fmtMoney(totalSales, true)} en ventas
          </p>
        </div>
        <PeriodSelector />
      </header>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <CategoryChip active={category === "all"} onClick={() => setCategory("all")}>
            Todas
          </CategoryChip>
          {categories.map((c) => (
            <CategoryChip key={c} active={category === c} onClick={() => setCategory(c)}>
              {c}
            </CategoryChip>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.slice(0, visible).map((i, idx) => (
          <article key={i.code}
            className="group relative rounded-2xl bg-card border border-border p-5 hover:border-primary/40 hover:shadow-[var(--shadow-md)] transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Package className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-mono px-2 py-1 rounded-md bg-muted text-muted-foreground">
                #{idx + 1}
              </span>
            </div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{i.category}</div>
            <h3 className="mt-1 text-sm font-semibold leading-snug line-clamp-2 min-h-[2.6em]">{i.description}</h3>
            <div className="mt-1 text-[11px] text-muted-foreground font-mono">{i.code} · {i.unit}</div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <Metric label="Venta" value={fmtMoney(i.netSales, true)} />
              <Metric label="Unidades" value={fmtNumber(i.units, true)} />
              <Metric label="Margen" value={fmtPct(i.margin)} accent={i.margin >= 25 ? "good" : i.margin >= 15 ? "ok" : "warn"} />
              <Metric label="Rotación" value={`${i.rotation}× per.`} />
            </div>

            <div className="mt-4 h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full"
                style={{
                  width: `${Math.min(100, (i.netSales / (filtered[0]?.netSales || 1)) * 100)}%`,
                  background: "var(--gradient-emerald)",
                }}
              />
            </div>
          </article>
        ))}
      </div>

      {visible < filtered.length && (
        <div ref={sentinelRef} className="py-10 text-center text-xs text-muted-foreground">
          <TrendingUp className="inline h-4 w-4 mr-2 animate-pulse" />
          Cargando más productos...
        </div>
      )}

      {filtered.length === 0 && (
        <div className="py-20 text-center text-sm text-muted-foreground">
          No hay productos que coincidan con los filtros.
        </div>
      )}
    </div>
  );
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: "good" | "ok" | "warn" }) {
  return (
    <div className="rounded-lg bg-muted/40 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-sm font-semibold tabular-nums",
          accent === "good" && "text-emerald",
          accent === "warn" && "text-brand-red",
          accent === "ok" && "text-warning",
        )}
      >
        {value}
      </div>
    </div>
  );
}

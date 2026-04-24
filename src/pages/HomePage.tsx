import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Calendar, Database, LayoutDashboard, Package, Search, Sparkles, TrendingUp } from "lucide-react";
import { useDataStore } from "@/lib/store";
import { UploadDropzone } from "@/components/data/UploadDropzone";
import { fmtMoney, fmtNumber } from "@/lib/format";

export function HomePage() {
  const datasets = useDataStore((s) => s.datasets);
  const activeId = useDataStore((s) => s.activeDatasetId);
  const setActive = useDataStore((s) => s.setActive);
  const setPeriod = useDataStore((s) => s.setPeriod);
  const active = datasets.find((d) => d.id === activeId);

  const [query, setQuery] = useState("");

  const periodCards = useMemo(() => {
    if (!active) return [];
    return active.periods.map((p) => {
      const recs = active.records.filter((r) => r.period === p);
      const sales = recs.reduce((a, r) => a + r.netSales, 0);
      const units = recs.reduce((a, r) => a + r.units, 0);
      const skus = new Set(recs.map((r) => r.code)).size;
      return { period: p, sales, units, skus };
    });
  }, [active]);

  const filtered = periodCards.filter((c) => c.period.includes(query.trim()));

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-10 max-w-[1400px] mx-auto">
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
            Sales Intelligence Platform
          </div>
          <h1 className="mt-4 text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
            Convierte tu historial de ventas
            <br />
            en <span className="text-emerald">decisiones accionables</span>.
          </h1>
          <p className="mt-4 text-sm sm:text-base text-white/75 max-w-2xl">
            Carga tus reportes Excel/CSV y obtén KPIs, tendencias, pivot tables y catálogos
            interactivos al instante. Datos procesados localmente — sin fricción.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-white text-foreground px-5 py-2.5 text-sm font-semibold hover:bg-white/90 transition-colors"
            >
              <LayoutDashboard className="h-4 w-4" />
              Ir al Dashboard
            </Link>
            <Link
              to="/data"
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 ring-1 ring-white/20 text-white px-5 py-2.5 text-sm font-semibold hover:bg-white/15 transition-colors"
            >
              <Database className="h-4 w-4" />
              Gestionar datos
            </Link>
          </div>
        </div>
      </section>

      {/* No data state */}
      {datasets.length === 0 && (
        <section className="mt-8 grid lg:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-card border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Carga tu primera fuente</h2>
                <p className="text-xs text-muted-foreground">Excel o CSV — esquema flexible</p>
              </div>
            </div>
            <UploadDropzone />
          </div>
          <div className="rounded-2xl bg-card border border-border p-6">
            <h2 className="text-base font-semibold mb-4">Qué obtienes</h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {[
                { icon: TrendingUp, label: "KPIs en tiempo real: Ventas, Margen, Ticket Medio, Recurrencia" },
                { icon: LayoutDashboard, label: "Gráficos de tendencias y distribución por categoría" },
                { icon: Package, label: "Catálogo de productos con métricas de rotación" },
                { icon: Database, label: "Pivot table con filtros, orden y exportación" },
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

      {/* Period selector hero */}
      {active && (
        <section className="mt-10">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-5">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Selecciona un período</h2>
              <p className="text-sm text-muted-foreground">
                Dataset activo: <span className="font-medium text-foreground">{active.name}</span> ·{" "}
                {fmtNumber(active.records.length)} registros
              </p>
            </div>
            <div className="relative flex-1 min-w-[240px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar período..."
                className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((c) => (
              <Link
                key={c.period}
                to="/dashboard"
                onClick={() => setPeriod(c.period)}
                className="group relative overflow-hidden rounded-2xl bg-card border border-border p-5 hover:border-primary/40 hover:shadow-[var(--shadow-md)] transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    Período
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="text-3xl font-bold tracking-tight">{c.period}</div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Ventas netas</span>
                    <span className="font-semibold text-foreground tabular-nums">{fmtMoney(c.sales, true)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Unidades</span>
                    <span className="font-semibold text-foreground tabular-nums">{fmtNumber(c.units, true)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">SKUs activos</span>
                    <span className="font-semibold text-foreground tabular-nums">{c.skus}</span>
                  </div>
                </div>
                <div
                  className="absolute bottom-0 left-0 h-1 w-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "var(--gradient-emerald)" }}
                />
              </Link>
            ))}
          </div>

          {/* Other datasets */}
          {datasets.length > 1 && (
            <div className="mt-10">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Otros datasets
              </h3>
              <div className="flex flex-wrap gap-2">
                {datasets
                  .filter((d) => d.id !== activeId)
                  .map((d) => (
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
        </section>
      )}
    </div>
  );
}

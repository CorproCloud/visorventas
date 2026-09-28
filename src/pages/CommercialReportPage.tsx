import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  DollarSign, Boxes, Crown, Star, ArrowLeft, FileDown, Loader2, AlertTriangle, CheckCircle2, AlertCircle,
  RefreshCcw, PieChart as PieIcon, PackageX, ClipboardList, TrendingUp,
} from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";
import { useDataStore } from "@/lib/store";
import { analyzeCommercial, buildConclusions } from "@/lib/commercialAnalysis";
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import logoUrl from "@/assets/logo-report.png";

const card = "rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-sm)]";

export function CommercialReportPage() {
  const ds = useDataStore((s) => s.datasets.find((d) => d.id === s.activeDatasetId) ?? null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [grain, setGrain] = useState<"mes" | "semana">("mes");
  const [paretoTab, setParetoTab] = useState<"productos" | "clientes">("productos");
  const [deadDays, setDeadDays] = useState<30 | 60 | 90>(30);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const f = from || ds?.dateRange.from || "";
  const t = to || ds?.dateRange.to || "";
  const a = useMemo(() => (ds && f && t ? analyzeCommercial(ds.invoices, f, t) : null), [ds, f, t]);
  const conclusions = useMemo(() => (a ? buildConclusions(a) : []), [a]);

  if (!ds || !a) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        No hay datos activos. Carga un archivo en <Link to="/data" className="text-brand-red underline">Datos</Link>.
      </div>
    );
  }

  const trend = grain === "mes" ? a.trendMonthly : a.trendWeekly;
  const pareto = paretoTab === "productos" ? a.paretoProducts : a.paretoCustomers;
  const paretoChart = pareto.items.slice(0, 25).map((i) => ({ ...i, short: i.name.length > 18 ? i.name.slice(0, 18) + "…" : i.name, value: Math.round(i.value) }));
  const dead = a.deadStock.filter((p) => p.daysSinceSale >= deadDays);
  const deadValue = dead.reduce((s, p) => s + p.stock * p.avgPrice, 0);
  const avgSellThrough = a.products.length ? a.products.reduce((s, p) => s + p.sellThrough, 0) / a.products.length : 0;
  const avgDaysInv = a.products.length ? Math.round(a.products.reduce((s, p) => s + Math.min(p.daysInventory, 365), 0) / a.products.length) : 0;

  const exportPDF = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
      const mx = 36, top = 92, bottom = 40;
      const maxW = pw - mx * 2, maxH = ph - top - bottom;
      let logo: string | null = null;
      try {
        const blob = await (await fetch(logoUrl)).blob();
        logo = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob); });
      } catch { /* sin logo */ }
      let page = 0;
      const newPage = () => {
        if (page > 0) doc.addPage();
        page++;
        doc.setFillColor(220, 38, 38); doc.rect(0, 0, 12, ph, "F");
        if (logo) doc.addImage(logo, "PNG", mx, 24, 42, 42);
        doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(20, 20, 30);
        doc.text("Reporte Área Comercial General", mx + 54, 44);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100, 110, 130);
        doc.text(`Período: ${fmtDate(f)} — ${fmtDate(t)}`, mx + 54, 60);
        doc.text(`Generado: ${new Date().toLocaleDateString("es-MX")}`, pw - mx, 44, { align: "right" });
        doc.setDrawColor(230, 232, 238); doc.line(mx, 76, pw - mx, 76);
        doc.setFontSize(8);
        doc.text("Desarrollado por Miguel M. Navarro.", mx, ph - 18);
        doc.text(`Página ${page}`, pw - mx, ph - 18, { align: "right" });
        return top;
      };
      let y = newPage();
      const blocks = Array.from(ref.current.querySelectorAll<HTMLElement>("[data-pdf-block]"));
      // Quitar límites de scroll para capturar tablas completas
      const scrollers = Array.from(ref.current.querySelectorAll<HTMLElement>(".overflow-y-auto"));
      scrollers.forEach((el) => { el.style.maxHeight = "none"; el.style.overflow = "visible"; });
      const extras = Array.from(ref.current.querySelectorAll<HTMLElement>("[data-pdf-extra]"));
      extras.forEach((el) => { el.style.display = "none"; });
      try {
        for (const el of blocks) {
          const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", windowWidth: 1200, width: el.scrollWidth });
          let w = maxW, h = (canvas.height / canvas.width) * w;
          if (h > maxH) {
            // Bloque muy alto: partir en rebanadas de página completa
            const pxPerPt = canvas.width / w;
            let sy = 0;
            if (y > top) y = newPage();
            while (sy < canvas.height) {
              const sh = Math.min(maxH * pxPerPt, canvas.height - sy);
              const c = document.createElement("canvas");
              c.width = canvas.width; c.height = sh;
              c.getContext("2d")!.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
              doc.addImage(c.toDataURL("image/jpeg", 0.92), "JPEG", mx, y, w, sh / pxPerPt);
              sy += sh;
              if (sy < canvas.height) y = newPage(); else y += sh / pxPerPt + 12;
            }
            continue;
          }
          if (y + h > ph - bottom) y = newPage();
          doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", mx, y, w, h);
          y += h + 12;
        }
      } finally {
        scrollers.forEach((el) => { el.style.maxHeight = ""; el.style.overflow = ""; });
        extras.forEach((el) => { el.style.display = ""; });
      }
      doc.save(`reporte-area-comercial-${f}_${t}.pdf`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al Dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Reporte Área Comercial General</h1>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <input type="date" value={from} min={ds.dateRange.from} max={ds.dateRange.to} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
          <input type="date" value={to} min={from || ds.dateRange.from} max={ds.dateRange.to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
          <button onClick={exportPDF} disabled={busy} className="h-10 inline-flex items-center gap-2 rounded-lg bg-brand-red text-brand-red-foreground px-4 text-sm font-semibold disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} PDF
          </button>
        </div>
      </div>

      <div ref={ref} className="space-y-5 bg-background">
        <p className="text-sm text-muted-foreground">Período: {fmtDate(f)} — {fmtDate(t)} · Excluye "Administración y control"</p>

        {/* 1. KPIs */}
        <div data-pdf-block className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={DollarSign} label="Ventas Totales" value={fmtMoney(a.totalSales, true)} sub={isFinite(a.prevDelta) ? `${a.prevDelta >= 0 ? "+" : ""}${a.prevDelta.toFixed(1)}% vs período anterior` : `${fmtNumber(a.invoiceCount)} facturas`} />
          <Kpi icon={Boxes} label="Unidades Vendidas" value={fmtNumber(a.totalUnits)} sub={`${fmtNumber(a.products.filter((p) => p.units > 0).length)} productos con venta`} />
          <Kpi icon={Crown} label="Cliente Top" value={a.topCustomer?.name ?? "—"} sub={a.topCustomer ? fmtMoney(a.topCustomer.value, true) : ""} small />
          <Kpi icon={Star} label="Producto Estrella" value={a.topProduct?.name ?? "—"} sub={a.topProduct ? fmtMoney(a.topProduct.value, true) : ""} small />
        </div>

        {/* 2. Ventas general */}
        <section data-pdf-block className={card}>
          <Header icon={TrendingUp} title="Introducción de Ventas General">
            <Tabs value={grain} onChange={setGrain} options={[["mes", "Mensual"], ["semana", "Semanal"]]} />
          </Header>
          <div className="grid lg:grid-cols-[1fr_260px] gap-5">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="l" tick={{ fontSize: 11 }} tickFormatter={(v) => fmtMoney(v, true)} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any, n: any) => (n === "Ventas" ? fmtMoney(v) : fmtNumber(v))} />
                  <Legend />
                  <Bar yAxisId="l" dataKey="ventas" name="Ventas" fill="var(--brand-red)" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="r" dataKey="unidades" name="Unidades" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              <Metric label="Monto total" value={fmtMoney(a.totalSales)} />
              <Metric label="Margen de ganancia promedio (est.)" value={`${a.avgMargin.toFixed(1)}%`} />
              <Metric label="Ticket promedio" value={fmtMoney(a.avgTicket)} />
              <Metric label="Facturas" value={fmtNumber(a.invoiceCount)} />
            </div>
          </div>
        </section>

        {/* 3. Rotación */}
        <section data-pdf-block className={card}>
          <Header icon={RefreshCcw} title="Rotación de Producto" />
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            {(["Alta", "Media", "Baja"] as const).map((r) => (
              <div key={r} className={cn("rounded-xl border p-3", r === "Alta" ? "border-emerald-500/40 bg-emerald-500/5" : r === "Media" ? "border-amber-500/40 bg-amber-500/5" : "border-brand-red/40 bg-brand-red/5")}>
                <div className="text-[11px] uppercase font-semibold text-muted-foreground">Rotación {r}</div>
                <div className="text-2xl font-bold">{a.products.filter((p) => p.rotation === r).length}</div>
                <div className="text-[11px] text-muted-foreground">productos</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-6 text-sm mb-3">
            <span>Sell-through promedio: <b>{avgSellThrough.toFixed(1)}%</b></span>
            <span>Días promedio de inventario: <b>{avgDaysInv}</b></span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground border-b border-border">
                <tr><th className="text-left py-2">Categoría</th><th className="text-right">Alta</th><th className="text-right">Media</th><th className="text-right">Baja</th><th className="text-right">Sell-through</th><th className="text-right">Días inv.</th></tr>
              </thead>
              <tbody>
                {a.rotationByCategory.map((c) => (
                  <tr key={c.category} className="border-b border-border/60">
                    <td className="py-2 font-medium">{c.category}</td>
                    <td className="text-right">{c.Alta}</td><td className="text-right">{c.Media}</td><td className="text-right">{c.Baja}</td>
                    <td className="text-right">{c.sellThrough.toFixed(1)}%</td><td className="text-right">{c.daysInventory}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Pareto */}
        <section data-pdf-block className={card}>
          <Header icon={PieIcon} title="Análisis 80/20 (Pareto)">
            <Tabs value={paretoTab} onChange={setParetoTab} options={[["productos", "Productos"], ["clientes", "Clientes"]]} />
          </Header>
          <p className="text-sm mb-3">
            <b>{pareto.topCount}</b> {paretoTab} (<b>{pareto.topPct.toFixed(1)}%</b> del total de {pareto.items.length}) generan el <b>80%</b> de {paretoTab === "productos" ? "los ingresos" : "la facturación"}.
          </p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={paretoChart} margin={{ bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="short" angle={-40} textAnchor="end" interval={0} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="l" tickFormatter={(v) => fmtMoney(v, true)} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any, n: any) => (n === "% acumulado" ? `${v.toFixed(1)}%` : fmtMoney(v))} labelFormatter={(_, p) => p?.[0]?.payload?.name ?? ""} />
                <Bar yAxisId="l" dataKey="value" name="Importe" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                <Line yAxisId="r" dataKey="cumPct" name="% acumulado" stroke="var(--brand-red)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto mt-3 max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground border-b border-border sticky top-0 bg-card">
                <tr><th className="text-left py-2">#</th><th className="text-left">{paretoTab === "productos" ? "Producto" : "Cliente"}</th><th className="text-right">Importe</th><th className="text-right">% acum.</th></tr>
              </thead>
              <tbody>
                {pareto.items.filter((i) => i.inTop).map((i, idx) => (
                  <tr key={i.name} data-pdf-extra={idx >= 25 ? "" : undefined} className="border-b border-border/60">
                    <td className="py-1.5">{idx + 1}</td><td>{i.name}</td><td className="text-right">{fmtMoney(i.value)}</td><td className="text-right">{i.cumPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 5. Stock muerto */}
        <section data-pdf-block className={card}>
          <Header icon={PackageX} title="Productos con Nula Rotación (Stock Muerto)">
            <Tabs value={String(deadDays)} onChange={(v) => setDeadDays(Number(v) as 30 | 60 | 90)} options={[["30", "30 días"], ["60", "60 días"], ["90", "90 días"]]} />
          </Header>
          <p className="text-sm mb-3"><b>{dead.length}</b> productos sin venta en {deadDays}+ días · Valor estancado: <b>{fmtMoney(deadValue)}</b></p>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground border-b border-border sticky top-0 bg-card">
                <tr><th className="text-left py-2">Producto</th><th className="text-right">Stock acumulado</th><th className="text-right">Valor estancado</th><th className="text-right">Días sin venta</th></tr>
              </thead>
              <tbody>
                {dead.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">Sin productos en este rango.</td></tr>}
                {dead.map((p, idx) => (
                  <tr key={p.key} data-pdf-extra={idx >= 25 ? "" : undefined} className="border-b border-border/60">
                    <td className="py-1.5">{p.name}</td>
                    <td className="text-right">{fmtNumber(p.stock)}</td>
                    <td className="text-right">{fmtMoney(p.stock * p.avgPrice)}</td>
                    <td className={cn("text-right font-semibold", p.daysSinceSale >= 90 ? "text-brand-red" : "")}>{p.daysSinceSale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 6. Resumen ejecutivo */}
        <section data-pdf-block className={card}>
          <Header icon={ClipboardList} title="Resumen Ejecutivo de Análisis Comercial" />
          <ul className="space-y-2">
            {conclusions.map((c, i) => {
              const Icon = c.level === "ok" ? CheckCircle2 : c.level === "warn" ? AlertCircle : AlertTriangle;
              return (
                <li key={i} className="flex gap-2 text-sm">
                  <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", c.level === "ok" ? "text-emerald-600" : c.level === "warn" ? "text-amber-600" : "text-brand-red")} />
                  <span>{c.text}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-muted-foreground mt-4">
            Nota: el archivo de ventas no incluye inventario ni costos; stock, días de inventario, sell-through y margen son valores estimados/simulados.
          </p>
        </section>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, small }: { icon: typeof DollarSign; label: string; value: string; sub?: string; small?: boolean }) {
  return (
    <div className={card}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4 text-brand-red" /> {label}
      </div>
      <div className={cn("font-bold mt-2 leading-tight", small ? "text-sm" : "text-2xl")}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function Header({ icon: Icon, title, children }: { icon: typeof DollarSign; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
      <h2 className="font-bold flex items-center gap-2"><Icon className="h-4 w-4 text-brand-red" /> {title}</h2>
      {children}
    </div>
  );
}

function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40">
      {options.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} className={cn("px-3 py-1 text-xs font-semibold rounded-md", value === k ? "bg-brand-red text-brand-red-foreground" : "text-muted-foreground")}>{l}</button>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-[11px] uppercase font-semibold text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

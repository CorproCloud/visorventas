import type { Invoice } from "./types";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export const isExcludedProduct = (desc: string, code = "") =>
  norm(`${desc} ${code}`).includes("administracion y control");

// Hash determinista para datos simulados (inventario / costo)
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

export interface ProductStat {
  key: string;
  code: string;
  name: string;
  category: string;
  units: number;
  revenue: number;
  lastSale: string;
  daysSinceSale: number;
  avgPrice: number;
  stock: number;        // simulado
  sellThrough: number;  // %
  daysInventory: number;
  rotation: "Alta" | "Media" | "Baja";
}

export interface ParetoItem { name: string; value: number; cumPct: number; inTop: boolean }

export interface CommercialAnalysis {
  totalSales: number;
  totalUnits: number;
  invoiceCount: number;
  avgTicket: number;
  avgMargin: number; // % estimado
  topCustomer: { name: string; value: number } | null;
  topProduct: { name: string; value: number } | null;
  trendMonthly: { period: string; ventas: number; unidades: number }[];
  trendWeekly: { period: string; ventas: number; unidades: number }[];
  products: ProductStat[];
  rotationByCategory: { category: string; Alta: number; Media: number; Baja: number; sellThrough: number; daysInventory: number }[];
  paretoProducts: { items: ParetoItem[]; topCount: number; topPct: number };
  paretoCustomers: { items: ParetoItem[]; topCount: number; topPct: number };
  deadStock: ProductStat[];
  refDate: string;
  prevDelta: number;
}

function pareto(map: Map<string, number>) {
  const arr = Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const total = arr.reduce((a, r) => a + r.value, 0) || 1;
  let cum = 0;
  let topCount = 0;
  const items: ParetoItem[] = arr.map((r) => {
    const before = cum;
    cum += r.value;
    const inTop = before / total < 0.8;
    if (inTop) topCount++;
    return { name: r.name, value: r.value, cumPct: (cum / total) * 100, inTop };
  });
  return { items, topCount, topPct: arr.length ? (topCount / arr.length) * 100 : 0 };
}

const monthLbl = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][+m - 1]} ${y.slice(2)}`;
};

function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const w = Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-S${String(w).padStart(2, "0")}`;
}

export function analyzeCommercial(all: Invoice[], from: string, to: string): CommercialAnalysis {
  const inv = all.filter((i) => i.date >= from && i.date <= to);
  const refDate = to;
  const ref = new Date(refDate + "T00:00:00").getTime();

  let totalSales = 0, totalUnits = 0;
  const custMap = new Map<string, number>();
  const prodRevenue = new Map<string, number>();
  const monthMap = new Map<string, { ventas: number; unidades: number }>();
  const weekMap = new Map<string, { ventas: number; unidades: number }>();
  const pMap = new Map<string, { code: string; name: string; category: string; units: number; revenue: number; lastSale: string }>();
  const invIds = new Set<string>();

  for (const i of inv) {
    let invNet = 0, invUnits = 0;
    for (const ln of i.lines) {
      if (isExcludedProduct(ln.description, ln.code)) continue;
      invNet += ln.lineNet;
      invUnits += ln.quantity;
      const key = ln.code || ln.description;
      const p = pMap.get(key) ?? { code: ln.code, name: ln.description, category: ln.category ?? "Otros", units: 0, revenue: 0, lastSale: "" };
      p.units += ln.quantity;
      p.revenue += ln.lineNet;
      if (i.date > p.lastSale) p.lastSale = i.date;
      pMap.set(key, p);
      prodRevenue.set(ln.description, (prodRevenue.get(ln.description) ?? 0) + ln.lineNet);
    }
    if (invNet === 0 && invUnits === 0) continue;
    invIds.add(i.id);
    totalSales += invNet;
    totalUnits += invUnits;
    custMap.set(i.customerName, (custMap.get(i.customerName) ?? 0) + invNet);
    const m = monthMap.get(i.yearMonth) ?? { ventas: 0, unidades: 0 };
    m.ventas += invNet; m.unidades += invUnits; monthMap.set(i.yearMonth, m);
    const wk = isoWeek(new Date(i.date + "T00:00:00"));
    const w = weekMap.get(wk) ?? { ventas: 0, unidades: 0 };
    w.ventas += invNet; w.unidades += invUnits; weekMap.set(wk, w);
  }

  // Productos con historial completo (para detectar stock muerto también fuera del rango)
  for (const i of all) {
    if (i.date > to) continue;
    for (const ln of i.lines) {
      if (isExcludedProduct(ln.description, ln.code)) continue;
      const key = ln.code || ln.description;
      const p = pMap.get(key) ?? { code: ln.code, name: ln.description, category: ln.category ?? "Otros", units: 0, revenue: 0, lastSale: "" };
      if (i.date > p.lastSale) p.lastSale = i.date;
      if (!pMap.has(key)) p.units = 0;
      pMap.set(key, p);
    }
  }

  const periodDays = Math.max(1, Math.round((ref - new Date(from + "T00:00:00").getTime()) / 86400000) + 1);
  const products: ProductStat[] = Array.from(pMap, ([key, p]) => {
    const h = hash(key);
    const avgPrice = p.units > 0 ? p.revenue / p.units : 0;
    // Inventario simulado: entre 0.2x y 1.5x de lo vendido (mín. 5 uds.)
    const stock = Math.max(5, Math.round((p.units || 10) * (0.2 + h * 1.3)));
    const sellThrough = p.units + stock > 0 ? (p.units / (p.units + stock)) * 100 : 0;
    const dailyUnits = p.units / periodDays;
    const daysInventory = dailyUnits > 0 ? Math.round(stock / dailyUnits) : 999;
    const daysSinceSale = p.lastSale ? Math.round((ref - new Date(p.lastSale + "T00:00:00").getTime()) / 86400000) : 999;
    const rotation: ProductStat["rotation"] = sellThrough >= 60 ? "Alta" : sellThrough >= 35 ? "Media" : "Baja";
    return { key, code: p.code, name: p.name, category: p.category, units: p.units, revenue: p.revenue, lastSale: p.lastSale, daysSinceSale, avgPrice, stock, sellThrough, daysInventory, rotation };
  }).sort((a, b) => b.revenue - a.revenue);

  const catMap = new Map<string, { Alta: number; Media: number; Baja: number; st: number; di: number; n: number }>();
  for (const p of products) {
    const c = catMap.get(p.category) ?? { Alta: 0, Media: 0, Baja: 0, st: 0, di: 0, n: 0 };
    c[p.rotation]++; c.st += p.sellThrough; c.di += Math.min(p.daysInventory, 365); c.n++;
    catMap.set(p.category, c);
  }
  const rotationByCategory = Array.from(catMap, ([category, c]) => ({
    category, Alta: c.Alta, Media: c.Media, Baja: c.Baja,
    sellThrough: c.n ? c.st / c.n : 0, daysInventory: c.n ? Math.round(c.di / c.n) : 0,
  })).sort((a, b) => b.Alta + b.Media + b.Baja - (a.Alta + a.Media + a.Baja));

  const deadStock = products.filter((p) => p.daysSinceSale >= 30).sort((a, b) => b.daysSinceSale - a.daysSinceSale);

  // Margen estimado (sin costos en el ERP): 22%–38% por producto, ponderado por venta
  const marginW = products.reduce((a, p) => a + p.revenue * (0.22 + hash(p.key + "m") * 0.16), 0);
  const avgMargin = totalSales > 0 ? (marginW / totalSales) * 100 : 0;

  // Comparativa con período anterior de igual longitud
  const prevTo = new Date(new Date(from + "T00:00:00").getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - (periodDays - 1) * 86400000);
  const pf = prevFrom.toISOString().slice(0, 10), pt = prevTo.toISOString().slice(0, 10);
  const prevSales = all.filter((i) => i.date >= pf && i.date <= pt)
    .reduce((a, i) => a + i.lines.filter((l) => !isExcludedProduct(l.description, l.code)).reduce((x, l) => x + l.lineNet, 0), 0);

  const topC = Array.from(custMap).sort((a, b) => b[1] - a[1])[0];
  const topP = Array.from(prodRevenue).sort((a, b) => b[1] - a[1])[0];

  return {
    totalSales, totalUnits, invoiceCount: invIds.size,
    avgTicket: invIds.size ? totalSales / invIds.size : 0,
    avgMargin,
    topCustomer: topC ? { name: topC[0], value: topC[1] } : null,
    topProduct: topP ? { name: topP[0], value: topP[1] } : null,
    trendMonthly: Array.from(monthMap).sort().map(([k, v]) => ({ period: monthLbl(k), ventas: Math.round(v.ventas), unidades: Math.round(v.unidades) })),
    trendWeekly: Array.from(weekMap).sort().map(([k, v]) => ({ period: k, ventas: Math.round(v.ventas), unidades: Math.round(v.unidades) })),
    products, rotationByCategory,
    paretoProducts: pareto(prodRevenue),
    paretoCustomers: pareto(custMap),
    deadStock, refDate,
    prevDelta: prevSales > 0 ? ((totalSales - prevSales) / prevSales) * 100 : NaN,
  };
}

export function buildConclusions(a: CommercialAnalysis): { text: string; level: "ok" | "warn" | "alert" }[] {
  const out: { text: string; level: "ok" | "warn" | "alert" }[] = [];
  const fmt = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
  if (isFinite(a.prevDelta)) {
    out.push({
      text: `Las ventas ${a.prevDelta >= 0 ? "crecieron" : "cayeron"} ${Math.abs(a.prevDelta).toFixed(1)}% frente al período anterior de igual duración (${fmt(a.totalSales)} en total).`,
      level: a.prevDelta >= 0 ? "ok" : a.prevDelta < -10 ? "alert" : "warn",
    });
  } else {
    out.push({ text: `Ventas totales del período: ${fmt(a.totalSales)} en ${a.invoiceCount} facturas.`, level: "ok" });
  }
  out.push({
    text: `Concentración de ingresos: ${a.paretoProducts.topCount} productos (${a.paretoProducts.topPct.toFixed(0)}% del catálogo vendido) generan el 80% de las ventas.`,
    level: a.paretoProducts.topPct < 15 ? "warn" : "ok",
  });
  const cShare = a.topCustomer && a.totalSales ? (a.topCustomer.value / a.totalSales) * 100 : 0;
  out.push({
    text: `${a.paretoCustomers.topCount} clientes concentran el 80% de la facturación; el cliente top representa ${cShare.toFixed(1)}%.`,
    level: cShare > 25 ? "alert" : cShare > 15 ? "warn" : "ok",
  });
  const low = a.products.filter((p) => p.rotation === "Baja").length;
  if (a.products.length) {
    out.push({
      text: `${low} de ${a.products.length} productos (${((low / a.products.length) * 100).toFixed(0)}%) presentan rotación baja.`,
      level: low / a.products.length > 0.4 ? "alert" : low / a.products.length > 0.2 ? "warn" : "ok",
    });
  }
  const dead90 = a.deadStock.filter((p) => p.daysSinceSale >= 90);
  const deadValue = dead90.reduce((s, p) => s + p.stock * p.avgPrice, 0);
  if (dead90.length) {
    out.push({ text: `Alerta de inventario: ${dead90.length} productos sin venta en más de 90 días, con valor estancado estimado de ${fmt(deadValue)}.`, level: "alert" });
  }
  out.push({ text: `Margen promedio estimado de ${a.avgMargin.toFixed(1)}% y ticket promedio de ${fmt(a.avgTicket)}.`, level: "ok" });
  return out;
}

import type { Invoice } from "./types";
import { fmtDate, fmtMoney, fmtMonth, fmtNumber } from "./format";
import type { TableReport } from "./tableExport";

const inRange = (invoices: Invoice[], from: string, to: string) =>
  invoices.filter((i) => i.date >= from && i.date <= to);

const periodOf = (from: string, to: string) => `${fmtDate(from)} — ${fmtDate(to)}`;

// ===== Ventas por producto (más vendidos arriba) =====
export function buildProductSalesReport(invoices: Invoice[], from: string, to: string): TableReport {
  const list = inRange(invoices, from, to);
  const map = new Map<string, {
    code: string; description: string; unit: string; category: string;
    quantity: number; amount: number; invoices: Set<string>; customers: Set<string>;
  }>();

  for (const inv of list) {
    for (const ln of inv.lines) {
      const key = ln.code || ln.description;
      let r = map.get(key);
      if (!r) {
        r = {
          code: ln.code, description: ln.description, unit: ln.unit,
          category: ln.category ?? "Otros",
          quantity: 0, amount: 0, invoices: new Set(), customers: new Set(),
        };
        map.set(key, r);
      }
      r.quantity += ln.quantity;
      r.amount += ln.lineNet;
      r.invoices.add(inv.id);
      r.customers.add(inv.customerName);
    }
  }

  const all = Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  const totalAmount = all.reduce((a, r) => a + r.amount, 0);
  const totalQty = all.reduce((a, r) => a + r.quantity, 0);

  const rows = all.map((r, idx) => ({
    rank: idx + 1,
    code: r.code,
    description: r.description,
    unit: r.unit,
    category: r.category,
    quantity: r.quantity,
    amount: r.amount,
    share: totalAmount > 0 ? (r.amount / totalAmount) * 100 : 0,
    avgPrice: r.quantity > 0 ? r.amount / r.quantity : 0,
    invoices: r.invoices.size,
    customers: r.customers.size,
  }));

  return {
    title: "Ventas por Producto",
    fileBase: "ventas-por-producto",
    periodLabel: periodOf(from, to),
    orientation: "l",
    columns: [
      { header: "#", key: "rank", type: "number", width: 28, wch: 6 },
      { header: "Clave", key: "code", width: 60, wch: 16 },
      { header: "Descripción", key: "description", width: 190, wch: 46 },
      { header: "Categoría", key: "category", width: 62, wch: 16 },
      { header: "Unidad", key: "unit", width: 44, wch: 10 },
      { header: "Cantidad", key: "quantity", type: "number", wch: 14 },
      { header: "Importe", key: "amount", type: "money", wch: 18 },
      { header: "% del total", key: "share", type: "pct", wch: 12 },
      { header: "Precio prom.", key: "avgPrice", type: "money", wch: 16 },
      { header: "Facturas", key: "invoices", type: "number", wch: 12 },
      { header: "Clientes", key: "customers", type: "number", wch: 12 },
    ],
    rows,
    totals: { description: "TOTAL", quantity: totalQty, amount: totalAmount, share: 100 },
    summary: [
      { label: "Productos", value: fmtNumber(all.length) },
      { label: "Importe", value: fmtMoney(totalAmount, true) },
      { label: "Unidades", value: fmtNumber(totalQty) },
    ],
    notes: [
      "Productos ordenados de mayor a menor importe vendido en el período; los de menor rotación aparecen al final del listado.",
    ],
  };
}

// ===== Ranking de clientes =====
export function buildCustomerRankingReport(invoices: Invoice[], from: string, to: string): TableReport {
  const list = inRange(invoices, from, to);
  const map = new Map<string, {
    id: string; name: string; total: number; subtotal: number; balance: number;
    count: number; last: string; skus: Set<string>;
  }>();

  for (const inv of list) {
    const key = inv.customerId || inv.customerName;
    let r = map.get(key);
    if (!r) r = { id: inv.customerId, name: inv.customerName, total: 0, subtotal: 0, balance: 0, count: 0, last: "", skus: new Set() };
    r.total += inv.total;
    r.subtotal += inv.subtotal;
    r.balance += inv.balance;
    r.count += 1;
    if (inv.date > r.last) r.last = inv.date;
    for (const ln of inv.lines) r.skus.add(ln.code || ln.description);
    map.set(key, r);
  }

  const all = Array.from(map.values()).sort((a, b) => b.total - a.total);
  const grand = all.reduce((a, r) => a + r.total, 0);

  return {
    title: "Ranking de Clientes",
    fileBase: "ranking-clientes",
    periodLabel: periodOf(from, to),
    orientation: "l",
    columns: [
      { header: "#", key: "rank", type: "number", width: 28, wch: 6 },
      { header: "N° Cliente", key: "id", width: 66, wch: 16 },
      { header: "Nombre", key: "name", width: 220, wch: 48 },
      { header: "Facturas", key: "count", type: "number", wch: 12 },
      { header: "Subtotal", key: "subtotal", type: "money", wch: 18 },
      { header: "Total", key: "total", type: "money", wch: 18 },
      { header: "% del total", key: "share", type: "pct", wch: 12 },
      { header: "Ticket prom.", key: "avg", type: "money", wch: 16 },
      { header: "Saldo", key: "balance", type: "money", wch: 16 },
      { header: "SKUs", key: "skus", type: "number", wch: 10 },
      { header: "Última compra", key: "last", wch: 16 },
    ],
    rows: all.map((r, i) => ({
      rank: i + 1,
      id: r.id,
      name: r.name,
      count: r.count,
      subtotal: r.subtotal,
      total: r.total,
      share: grand > 0 ? (r.total / grand) * 100 : 0,
      avg: r.count > 0 ? r.total / r.count : 0,
      balance: r.balance,
      skus: r.skus.size,
      last: fmtDate(r.last),
    })),
    totals: {
      name: "TOTAL",
      count: all.reduce((a, r) => a + r.count, 0),
      subtotal: all.reduce((a, r) => a + r.subtotal, 0),
      total: grand,
      share: 100,
      balance: all.reduce((a, r) => a + r.balance, 0),
    },
    summary: [
      { label: "Clientes", value: fmtNumber(all.length) },
      { label: "Total", value: fmtMoney(grand, true) },
    ],
  };
}

// ===== Saldos por cobrar =====
export function buildOutstandingReport(invoices: Invoice[], from: string, to: string): TableReport {
  const list = inRange(invoices, from, to).filter((i) => Math.abs(i.balance) > 0.5);
  const sorted = [...list].sort((a, b) => b.balance - a.balance);
  const today = new Date();

  const rows = sorted.map((i) => {
    const days = Math.max(0, Math.round((today.getTime() - new Date(i.date + "T00:00:00").getTime()) / 86400000));
    return {
      folio: i.folio,
      date: fmtDate(i.date),
      id: i.customerId,
      name: i.customerName,
      status: i.status,
      total: i.total,
      balance: i.balance,
      days,
      bucket: days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+",
    };
  });

  return {
    title: "Saldos por Cobrar",
    fileBase: "saldos-por-cobrar",
    periodLabel: periodOf(from, to),
    orientation: "l",
    columns: [
      { header: "Folio", key: "folio", width: 66, wch: 16 },
      { header: "Fecha", key: "date", width: 62, wch: 14 },
      { header: "N° Cliente", key: "id", width: 62, wch: 14 },
      { header: "Cliente", key: "name", width: 200, wch: 46 },
      { header: "Estatus", key: "status", width: 60, wch: 14 },
      { header: "Total", key: "total", type: "money", wch: 18 },
      { header: "Saldo", key: "balance", type: "money", wch: 18 },
      { header: "Días", key: "days", type: "number", wch: 10 },
      { header: "Antigüedad", key: "bucket", width: 60, wch: 12 },
    ],
    rows,
    totals: {
      name: "TOTAL",
      total: rows.reduce((a, r) => a + r.total, 0),
      balance: rows.reduce((a, r) => a + r.balance, 0),
    },
    summary: [
      { label: "Facturas con saldo", value: fmtNumber(rows.length) },
      { label: "Saldo", value: fmtMoney(rows.reduce((a, r) => a + r.balance, 0), true) },
    ],
    notes: ["Facturas con saldo pendiente ordenadas de mayor a menor, con antigüedad calculada a la fecha de generación."],
  };
}

// ===== Resumen mensual =====
export function buildMonthlySummaryReport(invoices: Invoice[], from: string, to: string): TableReport {
  const list = inRange(invoices, from, to);
  const months = Array.from(new Set(list.map((i) => i.yearMonth))).sort();

  const rows = months.map((m) => {
    const r = list.filter((i) => i.yearMonth === m);
    const total = r.reduce((a, i) => a + i.total, 0);
    const units = r.reduce((a, i) => a + i.lines.reduce((x, l) => x + l.quantity, 0), 0);
    return {
      month: fmtMonth(m),
      invoices: r.length,
      customers: new Set(r.map((i) => i.customerName)).size,
      subtotal: r.reduce((a, i) => a + i.subtotal, 0),
      taxes: total - r.reduce((a, i) => a + i.subtotal, 0),
      total,
      avg: r.length > 0 ? total / r.length : 0,
      units,
      balance: r.reduce((a, i) => a + i.balance, 0),
    };
  });

  return {
    title: "Resumen Mensual de Ventas",
    fileBase: "resumen-mensual",
    periodLabel: periodOf(from, to),
    orientation: "l",
    columns: [
      { header: "Mes", key: "month", width: 80, wch: 16 },
      { header: "Facturas", key: "invoices", type: "number", wch: 12 },
      { header: "Clientes", key: "customers", type: "number", wch: 12 },
      { header: "Unidades", key: "units", type: "number", wch: 14 },
      { header: "Subtotal", key: "subtotal", type: "money", wch: 18 },
      { header: "Impuestos", key: "taxes", type: "money", wch: 18 },
      { header: "Total", key: "total", type: "money", wch: 18 },
      { header: "Ticket prom.", key: "avg", type: "money", wch: 16 },
      { header: "Saldo", key: "balance", type: "money", wch: 16 },
    ],
    rows,
    totals: {
      month: "TOTAL",
      invoices: rows.reduce((a, r) => a + r.invoices, 0),
      units: rows.reduce((a, r) => a + r.units, 0),
      subtotal: rows.reduce((a, r) => a + r.subtotal, 0),
      taxes: rows.reduce((a, r) => a + r.taxes, 0),
      total: rows.reduce((a, r) => a + r.total, 0),
      balance: rows.reduce((a, r) => a + r.balance, 0),
    },
    summary: [
      { label: "Meses", value: fmtNumber(rows.length) },
      { label: "Total", value: fmtMoney(rows.reduce((a, r) => a + r.total, 0), true) },
    ],
  };
}

// ===== Ventas por categoría =====
export function buildCategoryReport(invoices: Invoice[], from: string, to: string): TableReport {
  const list = inRange(invoices, from, to);
  const map = new Map<string, { amount: number; quantity: number; skus: Set<string>; customers: Set<string> }>();

  for (const inv of list) {
    for (const ln of inv.lines) {
      const c = ln.category ?? "Otros";
      let r = map.get(c);
      if (!r) r = { amount: 0, quantity: 0, skus: new Set(), customers: new Set() };
      r.amount += ln.lineNet;
      r.quantity += ln.quantity;
      r.skus.add(ln.code || ln.description);
      r.customers.add(inv.customerName);
      map.set(c, r);
    }
  }

  const all = Array.from(map, ([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount);
  const total = all.reduce((a, r) => a + r.amount, 0);

  return {
    title: "Ventas por Categoría",
    fileBase: "ventas-por-categoria",
    periodLabel: periodOf(from, to),
    orientation: "p",
    columns: [
      { header: "Categoría", key: "name", width: 130, wch: 24 },
      { header: "Unidades", key: "quantity", type: "number", wch: 14 },
      { header: "Importe", key: "amount", type: "money", wch: 18 },
      { header: "% del total", key: "share", type: "pct", wch: 12 },
      { header: "SKUs", key: "skus", type: "number", wch: 10 },
      { header: "Clientes", key: "customers", type: "number", wch: 12 },
    ],
    rows: all.map((r) => ({
      name: r.name,
      quantity: r.quantity,
      amount: r.amount,
      share: total > 0 ? (r.amount / total) * 100 : 0,
      skus: r.skus.size,
      customers: r.customers.size,
    })),
    totals: {
      name: "TOTAL",
      quantity: all.reduce((a, r) => a + r.quantity, 0),
      amount: total,
      share: 100,
    },
    summary: [
      { label: "Categorías", value: fmtNumber(all.length) },
      { label: "Importe", value: fmtMoney(total, true) },
    ],
  };
}

// ===== Detalle de facturas =====
export function buildInvoiceDetailReport(invoices: Invoice[], from: string, to: string): TableReport {
  const list = inRange(invoices, from, to).sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    title: "Detalle de Facturas",
    fileBase: "detalle-facturas",
    periodLabel: periodOf(from, to),
    orientation: "l",
    columns: [
      { header: "Folio", key: "folio", width: 60, wch: 16 },
      { header: "Fecha", key: "date", width: 60, wch: 14 },
      { header: "N° Cliente", key: "id", width: 58, wch: 14 },
      { header: "Cliente", key: "name", width: 190, wch: 46 },
      { header: "Agente", key: "agent", width: 46, wch: 12 },
      { header: "Estatus", key: "status", width: 54, wch: 14 },
      { header: "Líneas", key: "lines", type: "number", wch: 10 },
      { header: "Subtotal", key: "subtotal", type: "money", wch: 16 },
      { header: "IVA", key: "iva", type: "money", wch: 14 },
      { header: "Total", key: "total", type: "money", wch: 16 },
      { header: "Saldo", key: "balance", type: "money", wch: 14 },
    ],
    rows: list.map((i) => ({
      folio: i.folio,
      date: fmtDate(i.date),
      id: i.customerId,
      name: i.customerName,
      agent: i.agentId,
      status: i.status,
      lines: i.lines.length,
      subtotal: i.subtotal,
      iva: i.iva,
      total: i.total,
      balance: i.balance,
    })),
    totals: {
      name: "TOTAL",
      subtotal: list.reduce((a, i) => a + i.subtotal, 0),
      iva: list.reduce((a, i) => a + i.iva, 0),
      total: list.reduce((a, i) => a + i.total, 0),
      balance: list.reduce((a, i) => a + i.balance, 0),
    },
    summary: [
      { label: "Facturas", value: fmtNumber(list.length) },
      { label: "Total", value: fmtMoney(list.reduce((a, i) => a + i.total, 0), true) },
    ],
  };
}

// ===== Ventas por agente =====
export function buildAgentReport(invoices: Invoice[], from: string, to: string): TableReport {
  const list = inRange(invoices, from, to);
  const map = new Map<string, { total: number; count: number; customers: Set<string>; balance: number }>();
  for (const i of list) {
    const k = i.agentId || "Sin agente";
    let r = map.get(k);
    if (!r) r = { total: 0, count: 0, customers: new Set(), balance: 0 };
    r.total += i.total;
    r.balance += i.balance;
    r.count += 1;
    r.customers.add(i.customerName);
    map.set(k, r);
  }
  const all = Array.from(map, ([agent, v]) => ({ agent, ...v })).sort((a, b) => b.total - a.total);
  const grand = all.reduce((a, r) => a + r.total, 0);

  return {
    title: "Ventas por Agente",
    fileBase: "ventas-por-agente",
    periodLabel: periodOf(from, to),
    orientation: "p",
    columns: [
      { header: "Agente", key: "agent", width: 90, wch: 18 },
      { header: "Facturas", key: "count", type: "number", wch: 12 },
      { header: "Clientes", key: "customers", type: "number", wch: 12 },
      { header: "Total", key: "total", type: "money", wch: 18 },
      { header: "% del total", key: "share", type: "pct", wch: 12 },
      { header: "Ticket prom.", key: "avg", type: "money", wch: 16 },
      { header: "Saldo", key: "balance", type: "money", wch: 16 },
    ],
    rows: all.map((r) => ({
      agent: r.agent,
      count: r.count,
      customers: r.customers.size,
      total: r.total,
      share: grand > 0 ? (r.total / grand) * 100 : 0,
      avg: r.count > 0 ? r.total / r.count : 0,
      balance: r.balance,
    })),
    totals: {
      agent: "TOTAL",
      count: all.reduce((a, r) => a + r.count, 0),
      total: grand,
      share: 100,
      balance: all.reduce((a, r) => a + r.balance, 0),
    },
    summary: [
      { label: "Agentes", value: fmtNumber(all.length) },
      { label: "Total", value: fmtMoney(grand, true) },
    ],
  };
}

// ===== Clientes inactivos (sin compras en el período) =====
export function buildInactiveCustomersReport(invoices: Invoice[], from: string, to: string): TableReport {
  const active = new Set(inRange(invoices, from, to).map((i) => i.customerId || i.customerName));
  const map = new Map<string, { id: string; name: string; last: string; total: number; count: number; balance: number }>();
  for (const i of invoices) {
    const k = i.customerId || i.customerName;
    if (active.has(k)) continue;
    let r = map.get(k);
    if (!r) r = { id: i.customerId, name: i.customerName, last: "", total: 0, count: 0, balance: 0 };
    r.total += i.total;
    r.balance += i.balance;
    r.count += 1;
    if (i.date > r.last) r.last = i.date;
    map.set(k, r);
  }
  const all = Array.from(map.values()).sort((a, b) => (a.last < b.last ? 1 : -1));

  return {
    title: "Clientes Inactivos",
    fileBase: "clientes-inactivos",
    periodLabel: periodOf(from, to),
    orientation: "p",
    columns: [
      { header: "N° Cliente", key: "id", width: 70, wch: 16 },
      { header: "Nombre", key: "name", width: 210, wch: 48 },
      { header: "Última compra", key: "last", width: 80, wch: 16 },
      { header: "Facturas hist.", key: "count", type: "number", wch: 14 },
      { header: "Total histórico", key: "total", type: "money", wch: 18 },
      { header: "Saldo", key: "balance", type: "money", wch: 16 },
    ],
    rows: all.map((r) => ({
      id: r.id,
      name: r.name,
      last: fmtDate(r.last),
      count: r.count,
      total: r.total,
      balance: r.balance,
    })),
    totals: {
      name: "TOTAL",
      count: all.reduce((a, r) => a + r.count, 0),
      total: all.reduce((a, r) => a + r.total, 0),
      balance: all.reduce((a, r) => a + r.balance, 0),
    },
    summary: [{ label: "Clientes inactivos", value: fmtNumber(all.length) }],
    notes: ["Clientes con historial de compra que NO facturaron dentro del período seleccionado."],
  };
}

export const fmtMoney = (n: number, compact = false) => {
  if (!isFinite(n)) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(n);
};

export const fmtNumber = (n: number, compact = false) => {
  if (!isFinite(n)) return "—";
  return new Intl.NumberFormat("es-MX", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(n);
};

export const fmtPct = (n: number, digits = 1) => {
  if (!isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
};

export const fmtDate = (iso: string) => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso + "T00:00:00"));
};

export const fmtMonth = (ym: string) => {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return new Intl.DateTimeFormat("es-MX", { month: "short", year: "numeric" }).format(d);
};

export const inferCategory = (description: string): string => {
  const d = description.toLowerCase();
  const cats = [
    "Whisky", "Tequila", "Vodka", "Ron", "Ginebra", "Mezcal",
    "Brandy", "Cognac", "Champagne", "Cerveza", "Vino", "Licor",
  ];
  for (const c of cats) if (d.includes(c.toLowerCase())) return c;
  return "Otros";
};

// Slug seguro para customer ID en URLs
export const safeId = (s: string) => encodeURIComponent(s.trim() || "sc");

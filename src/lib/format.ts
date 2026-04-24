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

export const inferCategory = (description: string): string => {
  const d = description.toLowerCase();
  const cats = [
    "Whisky", "Tequila", "Vodka", "Ron", "Ginebra", "Licor",
    "Cerveza", "Vino", "Mezcal", "Brandy", "Cognac", "Champagne",
  ];
  for (const c of cats) if (d.includes(c.toLowerCase())) return c;
  return "Otros";
};

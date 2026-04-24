import { useDataStore } from "@/lib/store";
import { ChevronDown } from "lucide-react";
import { fmtMonth } from "@/lib/format";

export function PeriodSelector({ className = "" }: { className?: string }) {
  const ds = useDataStore((s) => s.datasets.find((d) => d.id === s.activeDatasetId) ?? null);
  const year = useDataStore((s) => s.selectedYear);
  const month = useDataStore((s) => s.selectedMonth);
  const setYear = useDataStore((s) => s.setYear);
  const setMonth = useDataStore((s) => s.setMonth);

  if (!ds) return null;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {ds.years.length > 1 && (
        <div className="relative">
          <select
            value={year ?? ""}
            onChange={(e) => setYear(e.target.value || null)}
            className="appearance-none bg-card border border-border rounded-lg pl-3 pr-9 py-2 text-sm font-medium hover:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 cursor-pointer"
          >
            <option value="">Todos los años</option>
            {ds.years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="relative">
        <select
          value={month ?? ""}
          onChange={(e) => setMonth(e.target.value || null)}
          className="appearance-none bg-card border border-border rounded-lg pl-3 pr-9 py-2 text-sm font-medium hover:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 cursor-pointer"
        >
          <option value="">Todos los meses</option>
          {ds.months
            .filter((m) => !year || m.startsWith(year))
            .map((m) => (
              <option key={m} value={m}>{fmtMonth(m)}</option>
            ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

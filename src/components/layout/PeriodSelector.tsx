import { useDataStore } from "@/lib/store";
import { ChevronDown } from "lucide-react";

export function PeriodSelector({ className = "" }: { className?: string }) {
  const ds = useDataStore((s) => s.datasets.find((d) => d.id === s.activeDatasetId) ?? null);
  const period = useDataStore((s) => s.selectedPeriod);
  const setPeriod = useDataStore((s) => s.setPeriod);

  if (!ds || ds.periods.length === 0) return null;

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <select
        value={period ?? ""}
        onChange={(e) => setPeriod(e.target.value || null)}
        className="appearance-none bg-card border border-border rounded-lg pl-4 pr-10 py-2 text-sm font-medium text-foreground hover:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 cursor-pointer"
      >
        {ds.periods.map((p) => (
          <option key={p} value={p}>
            Período {p}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-muted-foreground" />
    </div>
  );
}

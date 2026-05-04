import { CalendarRange, X } from "lucide-react";

export interface DateRange {
  from: string | null; // YYYY-MM-DD
  to: string | null;
}

interface DateRangeFilterProps {
  range: DateRange;
  onChange: (r: DateRange) => void;
  min?: string;
  max?: string;
  className?: string;
}

export function DateRangeFilter({ range, onChange, min, max, className = "" }: DateRangeFilterProps) {
  const hasFilter = !!(range.from || range.to);
  return (
    <div className={`inline-flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 ${className}`}>
      <CalendarRange className="h-4 w-4 text-muted-foreground shrink-0" />
      <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        Desde
        <input
          type="date"
          value={range.from ?? ""}
          min={min}
          max={range.to ?? max}
          onChange={(e) => onChange({ ...range, from: e.target.value || null })}
          className="bg-transparent border-0 p-0 text-xs text-foreground focus:outline-none focus:ring-0"
        />
      </label>
      <span className="text-muted-foreground/60 text-xs">→</span>
      <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        Hasta
        <input
          type="date"
          value={range.to ?? ""}
          min={range.from ?? min}
          max={max}
          onChange={(e) => onChange({ ...range, to: e.target.value || null })}
          className="bg-transparent border-0 p-0 text-xs text-foreground focus:outline-none focus:ring-0"
        />
      </label>
      {hasFilter && (
        <button
          type="button"
          onClick={() => onChange({ from: null, to: null })}
          className="ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label="Limpiar filtro de fechas"
        >
          <X className="h-3 w-3" /> Limpiar
        </button>
      )}
    </div>
  );
}

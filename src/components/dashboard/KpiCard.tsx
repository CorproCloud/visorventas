import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  delta?: number; // percentage change vs prev
  icon: LucideIcon;
  accent?: "navy" | "emerald" | "red" | "slate";
}

const accents = {
  navy: "bg-[var(--navy)] text-white",
  emerald: "bg-emerald text-emerald-foreground",
  red: "bg-brand-red text-brand-red-foreground",
  slate: "bg-slate-soft text-foreground",
};

export function KpiCard({ label, value, hint, delta, icon: Icon, accent = "navy" }: KpiCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="group relative rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">{value}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", accents[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {typeof delta === "number" && isFinite(delta) && (
        <div
          className={cn(
            "mt-3 inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md",
            positive ? "bg-emerald/10 text-emerald" : "bg-brand-red/10 text-brand-red",
          )}
        >
          {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {positive ? "+" : ""}
          {delta.toFixed(1)}% vs anterior
        </div>
      )}
    </div>
  );
}

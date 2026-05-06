"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarRange, X } from "lucide-react";
import type { DateRange as DayPickerRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
  placeholder?: string;
}

const toDate = (s?: string | null) => (s ? parseISO(s) : undefined);
const toIso = (d?: Date) => (d ? format(d, "yyyy-MM-dd") : null);

export function DateRangeFilter({
  range,
  onChange,
  min,
  max,
  className = "",
  placeholder = "Selecciona un rango",
}: DateRangeFilterProps) {
  const hasFilter = !!(range.from || range.to);

  const selected: DayPickerRange | undefined =
    range.from || range.to
      ? { from: toDate(range.from), to: toDate(range.to) }
      : undefined;

  const label = hasFilter
    ? `${range.from ? format(parseISO(range.from), "d MMM yyyy", { locale: es }) : "…"} → ${
        range.to ? format(parseISO(range.to), "d MMM yyyy", { locale: es }) : "…"
      }`
    : placeholder;

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-9 justify-start text-left font-normal gap-2 min-w-[220px] sm:min-w-[280px]",
              !hasFilter && "text-muted-foreground",
            )}
          >
            <CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-xs sm:text-sm">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={selected}
            onSelect={(r) =>
              onChange({
                from: toIso(r?.from),
                to: toIso(r?.to ?? r?.from),
              })
            }
            numberOfMonths={typeof window !== "undefined" && window.innerWidth >= 640 ? 2 : 1}
            defaultMonth={toDate(range.from) ?? toDate(min)}
            disabled={{
              before: toDate(min) ?? new Date(1970, 0, 1),
              after: toDate(max) ?? new Date(2100, 0, 1),
            }}
            initialFocus
            locale={es}
            className={cn("p-3 pointer-events-auto")}
          />
          <div className="flex items-center justify-between border-t border-border p-2">
            <span className="px-2 text-[11px] text-muted-foreground">
              {hasFilter ? "Rango seleccionado" : "Sin filtro"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange({ from: null, to: null })}
              className="h-8 text-xs gap-1"
            >
              <X className="h-3 w-3" /> Limpiar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

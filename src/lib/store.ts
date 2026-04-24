import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Dataset, Invoice } from "./types";

interface DataState {
  datasets: Dataset[];
  activeDatasetId: string | null;
  selectedYear: string | null;       // filtro yyyy o null = todos
  selectedMonth: string | null;      // filtro yyyy-mm o null = todos
  addDataset: (name: string, invoices: Invoice[]) => string;
  removeDataset: (id: string) => void;
  setActive: (id: string | null) => void;
  setYear: (y: string | null) => void;
  setMonth: (m: string | null) => void;
  clearAll: () => void;
}

function buildDataset(name: string, invoices: Invoice[]): Dataset {
  const months = Array.from(new Set(invoices.map((i) => i.yearMonth))).sort();
  const years = Array.from(new Set(invoices.map((i) => i.year))).sort();
  const dates = invoices.map((i) => i.date).sort();
  const lineCount = invoices.reduce((a, i) => a + i.lines.length, 0);
  return {
    id: `ds-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    uploadedAt: Date.now(),
    invoices,
    invoiceCount: invoices.length,
    lineCount,
    months,
    years,
    dateRange: { from: dates[0] ?? "", to: dates.at(-1) ?? "" },
  };
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      datasets: [],
      activeDatasetId: null,
      selectedYear: null,
      selectedMonth: null,

      addDataset: (name, invoices) => {
        const ds = buildDataset(name, invoices);
        set({
          datasets: [...get().datasets, ds],
          activeDatasetId: ds.id,
          selectedYear: null,
          selectedMonth: null,
        });
        return ds.id;
      },

      removeDataset: (id) => {
        const remaining = get().datasets.filter((d) => d.id !== id);
        const wasActive = get().activeDatasetId === id;
        set({
          datasets: remaining,
          activeDatasetId: wasActive ? remaining[0]?.id ?? null : get().activeDatasetId,
          selectedYear: wasActive ? null : get().selectedYear,
          selectedMonth: wasActive ? null : get().selectedMonth,
        });
      },

      setActive: (id) => set({ activeDatasetId: id, selectedYear: null, selectedMonth: null }),
      setYear: (y) => set({ selectedYear: y, selectedMonth: null }),
      setMonth: (m) => set({ selectedMonth: m }),
      clearAll: () => set({ datasets: [], activeDatasetId: null, selectedYear: null, selectedMonth: null }),
    }),
    {
      name: "pulse-bi-store-v2",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        }
        return window.localStorage;
      }),
    },
  ),
);

// Helpers
export const getActive = (): Dataset | null => {
  const { datasets, activeDatasetId } = useDataStore.getState();
  return datasets.find((d) => d.id === activeDatasetId) ?? null;
};

// Filtrado de facturas por filtros activos
export function filterInvoices(
  invoices: Invoice[],
  year: string | null,
  month: string | null,
): Invoice[] {
  let r = invoices;
  if (month) r = r.filter((i) => i.yearMonth === month);
  else if (year) r = r.filter((i) => i.year === year);
  return r;
}

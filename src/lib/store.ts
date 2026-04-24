import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Dataset, SalesRecord } from "./types";

interface DataState {
  datasets: Dataset[];
  activeDatasetId: string | null;
  selectedPeriod: string | null; // active period filter
  addDataset: (name: string, records: SalesRecord[], periods: string[]) => string;
  removeDataset: (id: string) => void;
  setActive: (id: string | null) => void;
  setPeriod: (period: string | null) => void;
  clearAll: () => void;
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      datasets: [],
      activeDatasetId: null,
      selectedPeriod: null,

      addDataset: (name, records, periods) => {
        const id = `ds-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const ds: Dataset = {
          id,
          name,
          uploadedAt: Date.now(),
          rowCount: records.length,
          periods,
          records,
        };
        set({
          datasets: [...get().datasets, ds],
          activeDatasetId: id,
          selectedPeriod: periods[periods.length - 1] ?? null,
        });
        return id;
      },

      removeDataset: (id) => {
        const remaining = get().datasets.filter((d) => d.id !== id);
        const wasActive = get().activeDatasetId === id;
        set({
          datasets: remaining,
          activeDatasetId: wasActive ? remaining[0]?.id ?? null : get().activeDatasetId,
          selectedPeriod: wasActive ? remaining[0]?.periods.at(-1) ?? null : get().selectedPeriod,
        });
      },

      setActive: (id) => {
        const ds = get().datasets.find((d) => d.id === id);
        set({ activeDatasetId: id, selectedPeriod: ds?.periods.at(-1) ?? null });
      },

      setPeriod: (period) => set({ selectedPeriod: period }),

      clearAll: () => set({ datasets: [], activeDatasetId: null, selectedPeriod: null }),
    }),
    {
      name: "sales-bi-store",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        }
        return window.localStorage;
      }),
    },
  ),
);

// Selector helpers
export const useActiveDataset = (): Dataset | null => {
  const { datasets, activeDatasetId } = useDataStore();
  return datasets.find((d) => d.id === activeDatasetId) ?? null;
};

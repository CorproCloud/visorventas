import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Dataset, Invoice } from "./types";
import {
  listCloudFiles,
  uploadCloudFile,
  setCloudFileActive,
  deleteCloudFile,
  loadInvoicesFor,
  clearInvoiceCache,
  type CloudFile,
} from "./cloudFiles";

const MERGED_ID = "merged-active";

function buildMerged(name: string, invoices: Invoice[]): Dataset {
  const months = Array.from(new Set(invoices.map((i) => i.yearMonth))).sort();
  const years = Array.from(new Set(invoices.map((i) => i.year))).sort();
  const dates = invoices.map((i) => i.date).sort();
  const lineCount = invoices.reduce((a, i) => a + i.lines.length, 0);
  return {
    id: MERGED_ID,
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

interface DataState {
  // Cloud file metadata (lightweight)
  cloudFiles: CloudFile[];
  loading: boolean;
  syncing: boolean;
  // In-memory merged dataset built from active cloud files
  datasets: Dataset[];
  activeDatasetId: string | null;
  // Filters (persisted)
  selectedYear: string | null;
  selectedMonth: string | null;

  // Actions
  refreshCloudFiles: () => Promise<void>;
  rebuildActive: () => Promise<void>;
  uploadFile: (file: File, onProgress?: (msg: string) => void) => Promise<void>;
  toggleActive: (id: string, value: boolean) => Promise<void>;
  removeFile: (id: string) => Promise<void>;
  setYear: (y: string | null) => void;
  setMonth: (m: string | null) => void;
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      cloudFiles: [],
      loading: false,
      syncing: false,
      datasets: [],
      activeDatasetId: null,
      selectedYear: null,
      selectedMonth: null,

      refreshCloudFiles: async () => {
        set({ loading: true });
        try {
          const files = await listCloudFiles();
          set({ cloudFiles: files });
          await get().rebuildActive();
        } finally {
          set({ loading: false });
        }
      },

      rebuildActive: async () => {
        const active = get().cloudFiles.filter((f) => f.is_active);
        if (active.length === 0) {
          set({ datasets: [], activeDatasetId: null });
          return;
        }
        set({ syncing: true });
        try {
          const all: Invoice[] = [];
          for (const f of active) {
            const inv = await loadInvoicesFor(f);
            all.push(...inv);
          }
          const name = active.length === 1 ? active[0].name : `${active.length} archivos combinados`;
          const merged = buildMerged(name, all);
          set({ datasets: [merged], activeDatasetId: MERGED_ID });
        } finally {
          set({ syncing: false });
        }
      },

      uploadFile: async (file, onProgress) => {
        await uploadCloudFile(file, onProgress);
        await get().refreshCloudFiles();
      },

      toggleActive: async (id, value) => {
        await setCloudFileActive(id, value);
        set({
          cloudFiles: get().cloudFiles.map((f) => (f.id === id ? { ...f, is_active: value } : f)),
        });
        await get().rebuildActive();
      },

      removeFile: async (id) => {
        const file = get().cloudFiles.find((f) => f.id === id);
        if (!file) return;
        await deleteCloudFile(file);
        clearInvoiceCache(id);
        set({ cloudFiles: get().cloudFiles.filter((f) => f.id !== id) });
        await get().rebuildActive();
      },

      setYear: (y) => set({ selectedYear: y, selectedMonth: null }),
      setMonth: (m) => set({ selectedMonth: m }),
    }),
    {
      name: "visor-ventas-prefs-v3",
      // Only persist filter prefs — never invoices/files (avoids quota errors)
      partialize: (s) => ({
        selectedYear: s.selectedYear,
        selectedMonth: s.selectedMonth,
      }),
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        }
        return window.localStorage;
      }),
    },
  ),
);

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

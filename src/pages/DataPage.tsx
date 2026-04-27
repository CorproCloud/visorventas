import { Database, FileSpreadsheet, Trash2, CheckCircle2, Calendar } from "lucide-react";
import { UploadDropzone } from "@/components/data/UploadDropzone";
import { useDataStore } from "@/lib/store";
import { fmtNumber, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function DataPage() {
  const datasets = useDataStore((s) => s.datasets);
  const activeId = useDataStore((s) => s.activeDatasetId);
  const setActive = useDataStore((s) => s.setActive);
  const remove = useDataStore((s) => s.removeDataset);
  const clearAll = useDataStore((s) => s.clearAll);

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-[1200px] mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Gestión de Datos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Carga, activa o elimina tus consecutivos de facturas. Procesamiento 100% en el navegador.
        </p>
      </header>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="rounded-2xl bg-card border border-border p-6">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Cargar nuevo dataset
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Soporta el reporte ERP "Consecutivo de Facturas Desglosado de Ventas" (.xls / .xlsx / .csv).
          </p>
          <UploadDropzone />
          <div className="mt-4 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">El parser detecta automáticamente:</p>
            <p>· Encabezados de factura (fecha, folio, cliente, totales).</p>
            <p>· Líneas de detalle (clave, descripción, cantidad, precio).</p>
            <p>· Status, agente y moneda por factura.</p>
          </div>
        </section>

        <section className="rounded-2xl bg-card border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              Mis datasets ({datasets.length})
            </h2>
            {datasets.length > 0 && (
              <button
                onClick={() => { if (confirm("¿Eliminar TODOS los datasets?")) clearAll(); }}
                className="text-xs text-brand-red hover:underline"
              >
                Eliminar todos
              </button>
            )}
          </div>

          {datasets.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground border-2 border-dashed border-border rounded-xl">
              Aún no hay datasets cargados.
            </div>
          ) : (
            <ul className="space-y-2">
              {datasets.map((d) => {
                const isActive = d.id === activeId;
                return (
                  <li key={d.id} className={cn(
                    "rounded-xl border p-3 flex items-center gap-3 transition-colors",
                    isActive ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/30",
                  )}>
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}>
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{d.name}</span>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald/15 text-emerald font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Activo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                        <span>{fmtNumber(d.invoiceCount)} facturas · {fmtNumber(d.lineCount)} líneas</span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {fmtDate(d.dateRange.from)} → {fmtDate(d.dateRange.to)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {!isActive && (
                        <button onClick={() => setActive(d.id)} className="text-xs px-3 py-1.5 rounded-md bg-card border border-border hover:border-primary/40 transition-colors">
                          Activar
                        </button>
                      )}
                      <button
                        onClick={() => { if (confirm(`¿Eliminar "${d.name}"?`)) remove(d.id); }}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-brand-red hover:bg-brand-red/10 transition-colors"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <footer className="mt-10 pt-6 border-t border-border text-center">
        <p className="text-[11px] text-muted-foreground/80 italic">
          Generado con <span className="font-medium text-foreground/80">Visor de Ventas</span>. Desarrollado por Miguel M. Navarro.
        </p>
      </footer>
    </div>
  );
}

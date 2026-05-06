import { Database, FileSpreadsheet, Trash2, CloudUpload, Loader2, Calendar } from "lucide-react";
import { UploadDropzone } from "@/components/data/UploadDropzone";
import { Switch } from "@/components/ui/switch";
import { useDataStore } from "@/lib/store";
import { fmtNumber, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function DataPage() {
  const cloudFiles = useDataStore((s) => s.cloudFiles);
  const loading = useDataStore((s) => s.loading);
  const syncing = useDataStore((s) => s.syncing);
  const toggleActive = useDataStore((s) => s.toggleActive);
  const removeFile = useDataStore((s) => s.removeFile);

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-[1200px] mx-auto">
      <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CloudUpload className="h-6 w-6 text-primary" />
            Gestión de Datos en la Nube
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Sube tus archivos al almacenamiento en la nube y activa cuáles se visualizan en la aplicación.
          </p>
        </div>
        {syncing && (
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground rounded-md bg-card border border-border px-3 py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sincronizando datos…
          </div>
        )}
      </header>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="rounded-2xl bg-card border border-border p-6">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Cargar nuevo archivo
          </h2>
          <p className="text-xs text-muted-foreground mb-4 whitespace-pre-line">
            Soporta el reporte ERP "Consecutivo de Facturas Desglosado de Ventas" (.xls / .xlsx / .csv). Los archivos se guardan de forma persistente en la nube.
          </p>
          <UploadDropzone />
          <div className="mt-4 text-xs text-muted-foreground whitespace-pre-line">
            {"\n\n\u00A0\n\n\u00A0"}
          </div>
        </section>

        <section className="rounded-2xl bg-card border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              Mis archivos en la nube ({cloudFiles.length})
            </h2>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {cloudFiles.length === 0 && !loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground border-2 border-dashed border-border rounded-xl">
              Aún no hay archivos subidos a la nube.
            </div>
          ) : (
            <ul className="space-y-2">
              {cloudFiles.map((f) => (
                <li
                  key={f.id}
                  className={cn(
                    "rounded-xl border p-3 flex items-center gap-3 transition-colors",
                    f.is_active
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:border-primary/30",
                  )}
                >
                  <div
                    className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                      f.is_active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{f.name}</div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                      <span>
                        {fmtNumber(f.invoice_count)} facturas · {fmtNumber(f.line_count)} líneas
                      </span>
                      <span>{fmtBytes(f.file_size)}</span>
                      {f.date_from && f.date_to && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {fmtDate(f.date_from)} → {fmtDate(f.date_to)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <Switch
                        checked={f.is_active}
                        onCheckedChange={(v) => toggleActive(f.id, v)}
                        aria-label="Activar archivo"
                      />
                      <span className="text-[11px] text-muted-foreground hidden sm:inline">
                        {f.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </label>
                    <button
                      onClick={() => {
                        if (confirm(`¿Eliminar "${f.name}" de la nube? Esta acción no se puede deshacer.`)) {
                          removeFile(f.id);
                        }
                      }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-brand-red hover:bg-brand-red/10 transition-colors"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <footer className="mt-10 pt-6 border-t border-border text-center">
        <p className="text-[11px] text-muted-foreground/80 italic">
          Desarrollado por Miguel M. Navarro.
        </p>
      </footer>
    </div>
  );
}

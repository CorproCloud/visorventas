import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useDataStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function UploadDropzone({ compact = false, onComplete }: { compact?: boolean; onComplete?: () => void }) {
  const uploadFile = useDataStore((s) => s.uploadFile);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string>("");
  const [status, setStatus] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (arr.length === 0) return;
      setBusy(true);
      setStatus(null);
      try {
        for (const file of arr) {
          await uploadFile(file, (m) => setProgressMsg(m));
        }
        setStatus({ type: "ok", msg: `${arr.length} archivo(s) subido(s) correctamente.` });
        onComplete?.();
      } catch (e) {
        setStatus({ type: "err", msg: e instanceof Error ? e.message : "Error desconocido" });
      } finally {
        setBusy(false);
        setProgressMsg("");
      }
    },
    [uploadFile, onComplete],
  );

  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "relative flex flex-col items-center justify-center cursor-pointer rounded-2xl border-2 border-dashed transition-all",
          compact ? "py-8 px-6" : "py-14 px-8",
          dragOver ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40 hover:bg-muted/30",
        )}
      >
        <input
          type="file"
          multiple
          accept=".xlsx,.xls,.csv"
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          disabled={busy}
        />
        <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center mb-3", busy ? "bg-primary/10" : "bg-muted")}>
          {busy ? <Loader2 className="h-6 w-6 text-primary animate-spin" /> : <Upload className="h-6 w-6 text-primary" />}
        </div>
        <div className="text-sm font-semibold text-foreground">
          {busy ? (progressMsg || "Procesando...") : "Arrastra o haz clic para subir"}
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Excel (.xlsx, .xls) o CSV — Se guarda en la nube
        </div>
      </label>

      {status && (
        <div className={cn(
          "mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg",
          status.type === "ok" ? "bg-emerald/10 text-emerald" : "bg-brand-red/10 text-brand-red",
        )}>
          {status.type === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{status.msg}</span>
        </div>
      )}
    </div>
  );
}

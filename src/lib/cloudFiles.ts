import { supabase } from "@/integrations/supabase/client";
import { parseFile } from "@/lib/parser";
import type { Invoice } from "@/lib/types";

export interface CloudFile {
  id: string;
  name: string;
  file_path: string;
  file_size: number;
  invoice_count: number;
  line_count: number;
  date_from: string | null;
  date_to: string | null;
  is_active: boolean;
  created_at: string;
}

const BUCKET = "datasets";

function jsonPathFor(filePath: string) {
  return `${filePath}.parsed.json`;
}

export async function listCloudFiles(): Promise<CloudFile[]> {
  const { data, error } = await supabase
    .from("datasets")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CloudFile[];
}

export async function uploadCloudFile(file: File, onProgress?: (msg: string) => void): Promise<CloudFile> {
  onProgress?.("Procesando facturas...");
  const invoices = await parseFile(file);
  if (invoices.length === 0) throw new Error("No se detectaron facturas válidas en el archivo.");

  const lineCount = invoices.reduce((a, i) => a + i.lines.length, 0);
  const dates = invoices.map((i) => i.date).sort();
  const dateFrom = dates[0] ?? null;
  const dateTo = dates[dates.length - 1] ?? null;

  const stamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${stamp}-${safeName}`;

  onProgress?.("Subiendo archivo a la nube...");
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (upErr) throw upErr;

  // Cache parsed JSON
  onProgress?.("Guardando datos procesados...");
  const json = JSON.stringify(invoices);
  const blob = new Blob([json], { type: "application/json" });
  await supabase.storage.from(BUCKET).upload(jsonPathFor(filePath), blob, {
    cacheControl: "3600",
    upsert: true,
    contentType: "application/json",
  });

  const { data: row, error: insErr } = await supabase
    .from("datasets")
    .insert({
      name: file.name.replace(/\.[^.]+$/, ""),
      file_path: filePath,
      file_size: file.size,
      invoice_count: invoices.length,
      line_count: lineCount,
      date_from: dateFrom,
      date_to: dateTo,
      is_active: true,
    })
    .select()
    .single();
  if (insErr) throw insErr;
  return row as CloudFile;
}

export async function setCloudFileActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("datasets").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function deleteCloudFile(file: CloudFile): Promise<void> {
  await supabase.storage.from(BUCKET).remove([file.file_path, jsonPathFor(file.file_path)]);
  const { error } = await supabase.from("datasets").delete().eq("id", file.id);
  if (error) throw error;
}

export async function downloadCloudFile(file: CloudFile): Promise<void> {
  const { data, error } = await supabase.storage.from(BUCKET).download(file.file_path);
  if (error || !data) throw error ?? new Error("No se pudo descargar el archivo");

  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.file_path.includes("-") ? file.file_path.split("-").slice(1).join("-") : file.file_path;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// In-memory cache of parsed invoices per file id
const invoiceCache = new Map<string, Invoice[]>();

export async function loadInvoicesFor(file: CloudFile): Promise<Invoice[]> {
  const cached = invoiceCache.get(file.id);
  if (cached) return cached;

  // Try parsed JSON first
  const jsonPath = jsonPathFor(file.file_path);
  const { data: jsonBlob } = await supabase.storage.from(BUCKET).download(jsonPath);
  if (jsonBlob) {
    try {
      const text = await jsonBlob.text();
      const invoices = JSON.parse(text) as Invoice[];
      invoiceCache.set(file.id, invoices);
      return invoices;
    } catch {
      // fall through to re-parse
    }
  }

  // Fallback: download original file and parse
  const { data: rawBlob, error } = await supabase.storage.from(BUCKET).download(file.file_path);
  if (error || !rawBlob) throw error ?? new Error("No se pudo descargar el archivo");
  const f = new File([rawBlob], file.file_path);
  const invoices = await parseFile(f);

  // Cache JSON for next time
  try {
    const blob = new Blob([JSON.stringify(invoices)], { type: "application/json" });
    await supabase.storage.from(BUCKET).upload(jsonPath, blob, { upsert: true, contentType: "application/json" });
  } catch {
    /* ignore */
  }

  invoiceCache.set(file.id, invoices);
  return invoices;
}

export function clearInvoiceCache(id?: string) {
  if (id) invoiceCache.delete(id);
  else invoiceCache.clear();
}

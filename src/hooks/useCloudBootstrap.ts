import { useEffect } from "react";
import { useDataStore } from "@/lib/store";

let started = false;
export function useCloudBootstrap() {
  const refresh = useDataStore((s) => s.refreshCloudFiles);
  useEffect(() => {
    if (started) return;
    started = true;
    refresh().catch((e) => console.error("Cloud bootstrap failed", e));
  }, [refresh]);
}

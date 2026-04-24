import { useEffect, useState } from "react";
import { apiFetch } from "@/services/apiFetch";

export type SearchCapability = "isbn" | "title" | "author" | "series" | "text" | "cover";

export interface PluginMeta {
  id: string;
  name: string;
  description?: string;
  capabilities: SearchCapability[];
}

interface PluginsResponse {
  plugins: PluginMeta[];
  defaultOrder: string[];
}

let cache: PluginsResponse | null = null;
let inflight: Promise<PluginsResponse> | null = null;

async function fetchPlugins(): Promise<PluginsResponse> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await apiFetch("/api/plugins");
    if (!res.ok) return { plugins: [], defaultOrder: [] };
    const data = (await res.json()) as PluginsResponse;
    cache = data;
    return data;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export function usePluginsMeta(): PluginsResponse {
  const [state, setState] = useState<PluginsResponse>(cache ?? { plugins: [], defaultOrder: [] });
  useEffect(() => {
    let cancelled = false;
    fetchPlugins().then((data) => {
      if (!cancelled) setState(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

export function invalidatePluginsMeta(): void {
  cache = null;
}

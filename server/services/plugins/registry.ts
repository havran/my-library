import type { BookSourcePlugin, PluginConfig, SearchCapability } from "./types.js";
import { getCapabilities } from "./types.js";

export function pluginsFor(
  all: BookSourcePlugin[],
  cfg: PluginConfig,
  cap: SearchCapability,
): BookSourcePlugin[] {
  const byId = new Map(all.map((p) => [p.id, p]));
  const disabled = new Set(cfg.disabled);
  const seen = new Set<string>();
  const out: BookSourcePlugin[] = [];
  for (const id of cfg.order) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (disabled.has(id)) continue;
    const p = byId.get(id);
    if (!p) continue;
    if (!getCapabilities(p).includes(cap)) continue;
    out.push(p);
  }
  // Tail — any plugin not in order yet (newly added builtins)
  for (const p of all) {
    if (seen.has(p.id)) continue;
    if (disabled.has(p.id)) continue;
    if (!getCapabilities(p).includes(cap)) continue;
    out.push(p);
  }
  return out;
}

export function priorityIndex(cfg: PluginConfig): Map<string, number> {
  return new Map(cfg.order.map((id, i) => [id, i] as const));
}

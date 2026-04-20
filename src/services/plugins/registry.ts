import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BookSourcePlugin, SearchCapability } from "./types";
import { getCapabilities } from "./types";

const plugins = new Map<string, BookSourcePlugin>();

export function registerPlugin(p: BookSourcePlugin): void {
  plugins.set(p.id, p);
  ensureInOrder(p.id);
}

export function allPlugins(): BookSourcePlugin[] {
  return Array.from(plugins.values());
}

export function getPlugin(id: string): BookSourcePlugin | undefined {
  return plugins.get(id);
}

interface PluginConfigState {
  order: string[];
  disabled: string[];
  setOrder(order: string[]): void;
  toggle(id: string, enabled: boolean): void;
  movePlugin(id: string, delta: number): void;
  reset(): void;
}

export const usePluginConfig = create<PluginConfigState>()(
  persist(
    (set, get) => ({
      order: [],
      disabled: [],
      setOrder: (order) => set({ order }),
      toggle: (id, enabled) => {
        const disabled = new Set(get().disabled);
        if (enabled) disabled.delete(id);
        else disabled.add(id);
        set({ disabled: Array.from(disabled) });
      },
      movePlugin: (id, delta) => {
        const order = [...get().order];
        const i = order.indexOf(id);
        if (i === -1) return;
        const j = Math.max(0, Math.min(order.length - 1, i + delta));
        if (i === j) return;
        order.splice(i, 1);
        order.splice(j, 0, id);
        set({ order });
      },
      reset: () => set({ order: Array.from(plugins.keys()), disabled: [] }),
    }),
    { name: "my-library-plugin-config" },
  ),
);

function ensureInOrder(id: string): void {
  const { order } = usePluginConfig.getState();
  if (!order.includes(id)) {
    usePluginConfig.setState({ order: [...order, id] });
  }
}

/** Enabled plugins supporting `cap`, in user-priority order. */
export function pluginsFor(cap: SearchCapability): BookSourcePlugin[] {
  const { order, disabled } = usePluginConfig.getState();
  const disabledSet = new Set(disabled);
  const seen = new Set<string>();
  const out: BookSourcePlugin[] = [];
  for (const id of order) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (disabledSet.has(id)) continue;
    const p = plugins.get(id);
    if (!p) continue;
    if (!getCapabilities(p).includes(cap)) continue;
    out.push(p);
  }
  // Tail: any registered plugins not in the persisted order yet
  for (const p of plugins.values()) {
    if (seen.has(p.id)) continue;
    if (disabledSet.has(p.id)) continue;
    if (!getCapabilities(p).includes(cap)) continue;
    out.push(p);
  }
  return out;
}

/** Priority index (lower = earlier). Unknown IDs sort to the end. */
export function priorityIndex(): Map<string, number> {
  const { order } = usePluginConfig.getState();
  return new Map(order.map((id, i) => [id, i] as const));
}

import { create } from "zustand";
import type { BookSourcePlugin, SearchCapability } from "./types";
import { getCapabilities } from "./types";
import { saveSetting } from "@/services/userSettings";

const plugins = new Map<string, BookSourcePlugin>();
const SETTING_KEY = "plugins";

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
  hydrated: boolean;
  setOrder(order: string[]): void;
  toggle(id: string, enabled: boolean): void;
  movePlugin(id: string, delta: number): void;
  reset(): void;
  hydrate(config: { order?: string[]; disabled?: string[] } | null): void;
}

export const usePluginConfig = create<PluginConfigState>()((set, get) => ({
  order: [],
  disabled: [],
  hydrated: false,
  setOrder: (order) => {
    set({ order });
    persist(get());
  },
  toggle: (id, enabled) => {
    const disabled = new Set(get().disabled);
    if (enabled) disabled.delete(id);
    else disabled.add(id);
    set({ disabled: Array.from(disabled) });
    persist(get());
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
    persist(get());
  },
  reset: () => {
    set({ order: Array.from(plugins.keys()), disabled: [] });
    persist(get());
  },
  // Called once after auth load completes. Until then, writes are buffered
  // into local state but not synced — otherwise we'd clobber the server copy
  // with defaults during the brief window before hydrate lands.
  hydrate: (config) => {
    const order = config?.order ?? Array.from(plugins.keys());
    const disabled = config?.disabled ?? [];
    set({ order, disabled, hydrated: true });
  },
}));

function persist(state: PluginConfigState): void {
  if (!state.hydrated) return;
  saveSetting(SETTING_KEY, { order: state.order, disabled: state.disabled });
}

function ensureInOrder(id: string): void {
  const { order } = usePluginConfig.getState();
  if (!order.includes(id)) {
    usePluginConfig.setState({ order: [...order, id] });
  }
}

/** Reset to in-memory defaults (no server write). Used on logout. */
export function resetPluginConfigLocal(): void {
  usePluginConfig.setState({
    order: Array.from(plugins.keys()),
    disabled: [],
    hydrated: false,
  });
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

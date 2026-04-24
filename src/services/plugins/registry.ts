import { create } from "zustand";
import { saveSetting } from "@/services/userSettings";

const SETTING_KEY = "plugins";

interface PluginConfigState {
  order: string[];
  disabled: string[];
  hydrated: boolean;
  setOrder(order: string[]): void;
  toggle(id: string, enabled: boolean): void;
  movePlugin(id: string, delta: number): void;
  reset(defaults: string[]): void;
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
  reset: (defaults) => {
    set({ order: defaults, disabled: [] });
    persist(get());
  },
  hydrate: (config) => {
    const order = config?.order ?? [];
    const disabled = config?.disabled ?? [];
    set({ order, disabled, hydrated: true });
  },
}));

function persist(state: PluginConfigState): void {
  if (!state.hydrated) return;
  saveSetting(SETTING_KEY, { order: state.order, disabled: state.disabled });
}

/** Reset to blank in-memory state (no server write). Used on logout. */
export function resetPluginConfigLocal(): void {
  usePluginConfig.setState({ order: [], disabled: [], hydrated: false });
}

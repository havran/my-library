import { create } from "zustand";
import type { AuthUser } from "@/services/auth";
import * as auth from "@/services/auth";
import { loadAllSettings } from "@/services/userSettings";
import { usePluginConfig, resetPluginConfigLocal } from "@/services/plugins/registry";
import { invalidatePluginsMeta } from "@/services/plugins/meta";

interface AuthState {
  user: AuthUser | null;
  // `null` = unknown (haven't called /me yet), so gates wait instead of bouncing to /login.
  isLoading: boolean;

  loadMe: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

async function hydrateUserSettings(): Promise<void> {
  const all = await loadAllSettings();
  const plugins = all.plugins as { order?: string[]; disabled?: string[] } | undefined;
  usePluginConfig.getState().hydrate(plugins ?? null);
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  loadMe: async () => {
    set({ isLoading: true });
    const user = await auth.fetchMe();
    set({ user, isLoading: false });
    if (user) await hydrateUserSettings();
  },

  login: async (username, password) => {
    const user = await auth.login(username, password);
    set({ user });
    await hydrateUserSettings();
  },

  logout: async () => {
    await auth.logout();
    set({ user: null });
    resetPluginConfigLocal();
    invalidatePluginsMeta();
  },

  changePassword: async (currentPassword, newPassword) => {
    await auth.changePassword(currentPassword, newPassword);
  },
}));

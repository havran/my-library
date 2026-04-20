import { create } from "zustand";
import type { AuthUser } from "@/services/auth";
import * as auth from "@/services/auth";

interface AuthState {
  user: AuthUser | null;
  // `null` = unknown (haven't called /me yet), so gates wait instead of bouncing to /login.
  isLoading: boolean;

  loadMe: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  loadMe: async () => {
    set({ isLoading: true });
    const user = await auth.fetchMe();
    set({ user, isLoading: false });
  },

  login: async (username, password) => {
    const user = await auth.login(username, password);
    set({ user });
  },

  logout: async () => {
    await auth.logout();
    set({ user: null });
  },

  changePassword: async (currentPassword, newPassword) => {
    await auth.changePassword(currentPassword, newPassword);
  },
}));

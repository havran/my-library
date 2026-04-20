import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/auth", () => ({
  fetchMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
}));

import { useAuthStore } from "./useAuthStore";
import * as auth from "@/services/auth";

beforeEach(() => {
  useAuthStore.setState({ user: null, isLoading: false });
  vi.clearAllMocks();
});

describe("loadMe", () => {
  it("populates user when /me returns one", async () => {
    vi.mocked(auth.fetchMe).mockResolvedValueOnce({ username: "alice", role: "admin" });

    await useAuthStore.getState().loadMe();

    expect(useAuthStore.getState().user).toEqual({ username: "alice", role: "admin" });
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it("leaves user null when /me returns null (unauthenticated)", async () => {
    vi.mocked(auth.fetchMe).mockResolvedValueOnce(null);

    await useAuthStore.getState().loadMe();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it("sets isLoading true during load, then false after", async () => {
    let resolve: (v: null) => void;
    const pending = new Promise<null>((r) => {
      resolve = r;
    });
    vi.mocked(auth.fetchMe).mockReturnValueOnce(pending);

    const p = useAuthStore.getState().loadMe();
    expect(useAuthStore.getState().isLoading).toBe(true);

    resolve!(null);
    await p;
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});

describe("login", () => {
  it("stores the returned user", async () => {
    vi.mocked(auth.login).mockResolvedValueOnce({ username: "bob", role: "admin" });

    await useAuthStore.getState().login("bob", "hunter2");

    expect(auth.login).toHaveBeenCalledWith("bob", "hunter2");
    expect(useAuthStore.getState().user).toEqual({ username: "bob", role: "admin" });
  });

  it("does not swallow errors from the auth service", async () => {
    vi.mocked(auth.login).mockRejectedValueOnce(new Error("Invalid username or password"));

    await expect(useAuthStore.getState().login("bob", "wrong")).rejects.toThrow(
      "Invalid username or password",
    );
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe("logout", () => {
  it("clears user state", async () => {
    useAuthStore.setState({ user: { username: "bob", role: "admin" } });
    vi.mocked(auth.logout).mockResolvedValueOnce(undefined);

    await useAuthStore.getState().logout();

    expect(auth.logout).toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe("changePassword", () => {
  it("delegates to the auth service without touching user state", async () => {
    useAuthStore.setState({ user: { username: "bob", role: "admin" } });
    vi.mocked(auth.changePassword).mockResolvedValueOnce(undefined);

    await useAuthStore.getState().changePassword("old", "new!");

    expect(auth.changePassword).toHaveBeenCalledWith("old", "new!");
    expect(useAuthStore.getState().user).toEqual({ username: "bob", role: "admin" });
  });

  it("propagates errors (e.g. wrong current password)", async () => {
    vi.mocked(auth.changePassword).mockRejectedValueOnce(
      new Error("Current password is incorrect"),
    );

    await expect(useAuthStore.getState().changePassword("wrong", "new!")).rejects.toThrow(
      "Current password is incorrect",
    );
  });
});

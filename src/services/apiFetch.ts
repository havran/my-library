import { useAuthStore } from "@/store/useAuthStore";

// Shared fetch wrapper for our own API: if the server returns 401 on a call that
// was authenticated, our session must have expired or been revoked — wipe local
// auth state so RequireAuth bounces the user to /login on next render. Response
// is returned unchanged so callers keep their existing error handling.
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    const { user } = useAuthStore.getState();
    if (user) useAuthStore.setState({ user: null });
  }
  return res;
}

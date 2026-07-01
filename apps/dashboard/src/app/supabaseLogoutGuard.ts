const SUPABASE_MANUAL_LOGOUT_KEY = "8xd.dashboard.supabase.manualLogout";

export function markSupabaseManualLogout(): void {
  try {
    getSessionStorage()?.setItem(SUPABASE_MANUAL_LOGOUT_KEY, "1");
  } catch {
    // Ignore storage failures; logout still clears the server-side session.
  }
}

export function clearSupabaseManualLogout(): void {
  try {
    getSessionStorage()?.removeItem(SUPABASE_MANUAL_LOGOUT_KEY);
  } catch {
    // Ignore storage failures; users can still authenticate normally.
  }
}

export function wasSupabaseManualLogout(): boolean {
  try {
    return getSessionStorage()?.getItem(SUPABASE_MANUAL_LOGOUT_KEY) === "1";
  } catch {
    return false;
  }
}

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

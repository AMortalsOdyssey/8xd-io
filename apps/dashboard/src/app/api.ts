import { buildSnapshot, seedData, type DashboardSnapshot, type TimeRange } from "../shared/snapshot";
import type { AuthProviderStatus, ScopeRef } from "../shared/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const localPreview = import.meta.env.DEV && import.meta.env.VITE_USE_WORKER_API !== "1";

export const apiModeLabel = localPreview ? "开发预览" : "Worker API";

export interface AuthConfig {
  credentialUsername: string;
  turnstileEnabled: boolean;
  turnstileSiteKey: string;
  supabaseEnabled: boolean;
  supabaseUrl: string;
  supabasePublishableKey: string;
  authProviders: AuthProviderStatus[];
}

export async function getAuthConfig(): Promise<AuthConfig> {
  if (localPreview) {
    return {
      credentialUsername: "dashboard.8xd.io/admin",
      turnstileEnabled: false,
      turnstileSiteKey: "",
      supabaseEnabled: false,
      supabaseUrl: "",
      supabasePublishableKey: "",
      authProviders: [],
    };
  }
  const response = await fetch("/api/auth/config", { credentials: "include" });
  if (!response.ok) {
    return {
      credentialUsername: "dashboard.8xd.io/admin",
      turnstileEnabled: false,
      turnstileSiteKey: "",
      supabaseEnabled: false,
      supabaseUrl: "",
      supabasePublishableKey: "",
      authProviders: [],
    };
  }
  return (await response.json()) as AuthConfig;
}

export async function getSession(): Promise<boolean> {
  if (localPreview) return true;
  const response = await fetch("/api/session", { credentials: "include" });
  if (!response.ok) return false;
  const body = (await response.json()) as { authenticated?: boolean };
  return Boolean(body.authenticated);
}

export async function login(password: string, turnstileToken?: string): Promise<void> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, turnstileToken }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || "登录失败");
  }
}

export async function exchangeSupabaseSession(accessToken: string): Promise<void> {
  const response = await fetch("/api/auth/supabase/exchange", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || "Supabase 登录失败");
  }
}

export async function supabaseClient(config: AuthConfig): Promise<SupabaseClient | null> {
  if (!config.supabaseEnabled || !config.supabaseUrl || !config.supabasePublishableKey) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export async function exchangeExistingSupabaseSession(config: AuthConfig): Promise<boolean> {
  const client = await supabaseClient(config);
  if (!client) return false;
  const { data } = await client.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return false;
  await exchangeSupabaseSession(accessToken);
  return true;
}

export async function signInWithSupabaseGoogle(config: AuthConfig): Promise<void> {
  const client = await supabaseClient(config);
  if (!client) throw new Error("Supabase 尚未配置");
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  });
  if (error) throw error;
}

export async function sendSupabaseMagicLink(config: AuthConfig, email: string): Promise<void> {
  const client = await supabaseClient(config);
  if (!client) throw new Error("Supabase 尚未配置");
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
    },
  });
  if (error) throw error;
}

export async function signOutSupabase(config: AuthConfig): Promise<void> {
  const client = await supabaseClient(config);
  if (!client) return;
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw error;
}

export async function logout(): Promise<void> {
  if (localPreview) return;
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}

export async function fetchDashboard(range: TimeRange, scope: ScopeRef): Promise<DashboardSnapshot> {
  if (localPreview) {
    return buildSnapshot({ ...seedData, sourceLabel: "开发预览" }, range, scope);
  }

  const search = new URLSearchParams({
    range,
    scopeType: scope.type,
    scopeId: scope.id,
  });
  const response = await fetch(`/api/dashboard/summary?${search.toString()}`, {
    credentials: "include",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || "无法读取 Dashboard 数据");
  }
  return (await response.json()) as DashboardSnapshot;
}

export async function syncCloudflare(): Promise<string> {
  if (localPreview) return "开发预览模式：同步按钮已模拟完成";
  const response = await fetch("/api/sync/cloudflare", {
    method: "POST",
    credentials: "include",
  });
  const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
  if (!response.ok) throw new Error(body.error || "同步失败");
  return body.message || "同步任务已启动";
}

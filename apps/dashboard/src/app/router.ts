import type { TimeRange } from "../shared/snapshot";
import type { ScopeRef } from "../shared/types";

export type NavKey =
  | "overview"
  | "lawyer"
  | "jovlo"
  | "journey"
  | "cloudflare"
  | "domains"
  | "workers"
  | "storage"
  | "database"
  | "connectors"
  | "alerts"
  | "settings";

export interface RouteState {
  nav: NavKey;
  range: TimeRange;
  scope: ScopeRef;
}

const NAV_PATHS: Record<NavKey, string> = {
  overview: "/overview",
  lawyer: "/sites/lawyer",
  jovlo: "/sites/jovlo",
  journey: "/sites/journey-wave",
  domains: "/domains",
  cloudflare: "/cloudflare",
  workers: "/cloudflare/workers",
  storage: "/cloudflare/storage",
  database: "/cloudflare/database",
  connectors: "/connectors",
  alerts: "/alerts",
  settings: "/settings",
};

const PATH_NAVS = new Map<string, NavKey>(
  (Object.entries(NAV_PATHS) as [NavKey, string][]).map(([nav, path]) => [path, nav]),
);

const DEFAULT_RANGE: TimeRange = "30d";
const GLOBAL_SCOPE: ScopeRef = { type: "global", id: "global" };

export function parseScope(value: string): ScopeRef {
  const [type, ...rest] = value.split(":");
  const id = rest.join(":");
  if ((type === "project" || type === "domain" || type === "hostname" || type === "resource") && id) {
    return { type, id };
  }
  return GLOBAL_SCOPE;
}

export function scopeValue(scope: ScopeRef): string {
  return `${scope.type}:${scope.id}`;
}

function parseRange(value: string | null): TimeRange {
  return value === "24h" || value === "7d" || value === "30d" ? value : DEFAULT_RANGE;
}

function parseNavFromPath(pathname: string): NavKey | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return null;
  return PATH_NAVS.get(path) ?? null;
}

/** 兼容旧链接：/?view=lawyer&scopeType=domain&scopeId=fangliying.com */
function parseLegacyRoute(params: URLSearchParams): Partial<RouteState> {
  const legacy: Partial<RouteState> = {};
  const view = params.get("view");
  if (view && view in NAV_PATHS) legacy.nav = view as NavKey;
  const scopeType = params.get("scopeType");
  if (scopeType) legacy.scope = parseScope(`${scopeType}:${params.get("scopeId") || "global"}`);
  return legacy;
}

export function parseRoute(location: Pick<Location, "pathname" | "search">): RouteState {
  const params = new URLSearchParams(location.search);
  const legacy = parseLegacyRoute(params);
  const nav = parseNavFromPath(location.pathname) ?? legacy.nav ?? "overview";
  const scopeParam = params.get("scope");
  const scope = scopeParam ? parseScope(scopeParam) : legacy.scope ?? GLOBAL_SCOPE;
  return { nav, range: parseRange(params.get("range")), scope };
}

export function buildUrl(route: RouteState): string {
  const params = new URLSearchParams();
  if (route.range !== DEFAULT_RANGE) params.set("range", route.range);
  if (route.scope.type !== "global") params.set("scope", scopeValue(route.scope));
  const query = params.toString();
  return `${NAV_PATHS[route.nav]}${query ? `?${query}` : ""}`;
}

export function routesEqual(left: RouteState, right: RouteState): boolean {
  return (
    left.nav === right.nav &&
    left.range === right.range &&
    left.scope.type === right.scope.type &&
    left.scope.id === right.scope.id
  );
}

/** 页面强制绑定的 scope：站点专属页始终锁定自己的站点 */
export function pinnedScopeForNav(nav: NavKey): ScopeRef | null {
  if (nav === "lawyer") return { type: "domain", id: "fangliying.com" };
  if (nav === "jovlo") return { type: "hostname", id: "jovlo.8xd.io" };
  if (nav === "journey") return { type: "hostname", id: "journey-wave.8xd.io" };
  return null;
}

export function normalizeRoute(route: RouteState): RouteState {
  const pinned = pinnedScopeForNav(route.nav);
  if (pinned && (route.scope.type !== pinned.type || route.scope.id !== pinned.id)) {
    return { ...route, scope: pinned };
  }
  return route;
}

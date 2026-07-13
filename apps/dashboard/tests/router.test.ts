import { describe, expect, it } from "vitest";
import {
  buildUrl,
  normalizeRoute,
  parseRoute,
  parseScope,
  routesEqual,
  scopeValue,
  type RouteState,
} from "../src/app/router";

describe("dashboard router", () => {
  it("maps every nav key to a unique path and back", () => {
    const navs: RouteState["nav"][] = [
      "overview",
      "lawyer",
      "jovlo",
      "cloudflare",
      "domains",
      "workers",
      "storage",
      "database",
      "connectors",
      "alerts",
      "settings",
    ];
    const paths = new Set<string>();
    for (const nav of navs) {
      const url = buildUrl({ nav, range: "30d", scope: { type: "global", id: "global" } });
      expect(paths.has(url)).toBe(false);
      paths.add(url);
      const [pathname, search = ""] = url.split("?");
      expect(parseRoute({ pathname, search }).nav).toBe(nav);
    }
  });

  it("keeps range and scope in the query string and restores them after refresh", () => {
    const route: RouteState = {
      nav: "domains",
      range: "7d",
      scope: { type: "hostname", id: "jovlo.8xd.io" },
    };
    const url = buildUrl(route);
    expect(url).toBe("/domains?range=7d&scope=hostname%3Ajovlo.8xd.io");
    const [pathname, search] = url.split("?");
    expect(parseRoute({ pathname, search: `?${search}` })).toEqual(route);
  });

  it("omits default range and global scope from the url", () => {
    expect(buildUrl({ nav: "overview", range: "30d", scope: { type: "global", id: "global" } })).toBe("/overview");
  });

  it("treats the root path as overview", () => {
    expect(parseRoute({ pathname: "/", search: "" }).nav).toBe("overview");
  });

  it("falls back to overview for unknown paths", () => {
    const route = parseRoute({ pathname: "/does-not-exist", search: "?range=24h" });
    expect(route.nav).toBe("overview");
    expect(route.range).toBe("24h");
  });

  it("supports legacy query links", () => {
    const route = parseRoute({
      pathname: "/",
      search: "?view=lawyer&range=7d&scopeType=domain&scopeId=fangliying.com",
    });
    expect(route).toEqual({
      nav: "lawyer",
      range: "7d",
      scope: { type: "domain", id: "fangliying.com" },
    });
  });

  it("pins site pages to their own scope", () => {
    const normalized = normalizeRoute({
      nav: "jovlo",
      range: "30d",
      scope: { type: "domain", id: "fangliying.com" },
    });
    expect(normalized.scope).toEqual({ type: "hostname", id: "jovlo.8xd.io" });

    const lawyer = normalizeRoute({
      nav: "lawyer",
      range: "30d",
      scope: { type: "global", id: "global" },
    });
    expect(lawyer.scope).toEqual({ type: "domain", id: "fangliying.com" });
  });

  it("round-trips scope values including ids that contain colons", () => {
    const scope = parseScope("resource:worker:share-pages");
    expect(scope).toEqual({ type: "resource", id: "worker:share-pages" });
    expect(parseScope(scopeValue(scope))).toEqual(scope);
  });

  it("rejects malformed scope values", () => {
    expect(parseScope("hostname:")).toEqual({ type: "global", id: "global" });
    expect(parseScope("bogus:value")).toEqual({ type: "global", id: "global" });
  });

  it("compares routes structurally", () => {
    const base: RouteState = { nav: "overview", range: "30d", scope: { type: "global", id: "global" } };
    expect(routesEqual(base, { ...base })).toBe(true);
    expect(routesEqual(base, { ...base, range: "7d" })).toBe(false);
    expect(routesEqual(base, { ...base, scope: { type: "domain", id: "8xd.io" } })).toBe(false);
  });
});

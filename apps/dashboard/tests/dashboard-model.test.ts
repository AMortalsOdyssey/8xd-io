import { describe, expect, it } from "vitest";
import {
  buildScopeTree,
  connectorCards,
  filterRowsForScope,
  summarizeRows,
  zeroTrafficLabel,
} from "../src/shared/dashboard-model";
import { buildSnapshot, seedData } from "../src/shared/snapshot";
import type { Connector, MetricRow, ResourceRecord } from "../src/shared/types";

const resources: ResourceRecord[] = [
  {
    id: "zone-8xd",
    platform: "Cloudflare",
    type: "zone",
    name: "8xd.io",
    status: "active",
    projectKey: "share-pages",
    domain: "8xd.io",
    hostnames: ["8xd.io", "share-pages.8xd.io", "dashboard.8xd.io"],
    shared: false,
  },
  {
    id: "worker-share",
    platform: "Cloudflare",
    type: "worker",
    name: "share-pages-8xd-io",
    status: "active",
    projectKey: "share-pages",
    domain: "8xd.io",
    hostnames: ["share-pages.8xd.io"],
    shared: false,
  },
  {
    id: "worker-jovlo-ai",
    platform: "Cloudflare",
    type: "worker",
    name: "jovlo-ai",
    status: "active",
    projectKey: "jovlo",
    domain: "8xd.io",
    hostnames: ["jovlo.8xd.io"],
    shared: false,
  },
  {
    id: "r2-share",
    platform: "Cloudflare",
    type: "r2",
    name: "share-pages-content",
    status: "active",
    projectKey: "shared",
    domain: "8xd.io",
    hostnames: ["share-pages.8xd.io", "dashboard.8xd.io"],
    shared: true,
  },
  {
    id: "zone-lawyer",
    platform: "Cloudflare",
    type: "zone",
    name: "fangliying.com",
    status: "active",
    projectKey: "lawyer-homepage",
    domain: "fangliying.com",
    hostnames: ["fangliying.com", "www.fangliying.com"],
    shared: false,
  },
];

const rows: MetricRow[] = [
  {
    key: "requests",
    label: "请求数",
    value: 100,
    unit: "次",
    range: "30d",
    date: "2026-06-12",
    scopeType: "hostname",
    scopeId: "share-pages.8xd.io",
    source: "real",
  },
  {
    key: "requests",
    label: "请求数",
    value: 20,
    unit: "次",
    range: "30d",
    date: "2026-06-12",
    scopeType: "hostname",
    scopeId: "www.fangliying.com",
    source: "real",
  },
  {
    key: "r2Storage",
    label: "R2 存储",
    value: 34.2,
    unit: "MiB",
    range: "30d",
    date: "2026-06-12",
    scopeType: "resource",
    scopeId: "r2-share",
    source: "real",
  },
];

describe("dashboard scope model", () => {
  it("builds global, project, domain, hostname and resource scopes without losing shared resources", () => {
    const tree = buildScopeTree(resources);

    expect(tree.global.id).toBe("global");
    expect(tree.projects.map((scope) => scope.id)).toEqual([
      "jovlo",
      "lawyer-homepage",
      "share-pages",
      "shared",
    ]);
    expect(tree.domains.map((scope) => scope.id)).toEqual([
      "8xd.io",
      "fangliying.com",
    ]);
    expect(tree.hostnames.map((scope) => scope.id)).toContain("dashboard.8xd.io");
    expect(tree.hostnames.map((scope) => scope.id)).toContain("jovlo.8xd.io");
    expect(tree.resources.find((scope) => scope.id === "r2-share")?.badge).toBe(
      "共享资源",
    );
  });

  it("filters metric rows by global, project, domain, hostname and resource scope", () => {
    expect(filterRowsForScope(rows, resources, { type: "global", id: "global" })).toHaveLength(3);
    expect(filterRowsForScope(rows, resources, { type: "domain", id: "8xd.io" }).map((row) => row.scopeId)).toEqual([
      "share-pages.8xd.io",
      "r2-share",
    ]);
    expect(filterRowsForScope(rows, resources, { type: "hostname", id: "share-pages.8xd.io" }).map((row) => row.key)).toEqual([
      "requests",
      "r2Storage",
    ]);
    expect(filterRowsForScope(rows, resources, { type: "project", id: "lawyer-homepage" }).map((row) => row.scopeId)).toEqual([
      "www.fangliying.com",
    ]);
    expect(filterRowsForScope(rows, resources, { type: "resource", id: "r2-share" }).map((row) => row.key)).toEqual([
      "r2Storage",
    ]);
  });

  it("summarizes Chinese KPI labels and keeps unavailable metrics at zero", () => {
    const summary = summarizeRows(rows, resources, { type: "domain", id: "8xd.io" });

    expect(summary.title).toBe("8xd.io 域名总览");
    expect(summary.cards).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "总请求数", value: "100" }),
      expect.objectContaining({ label: "R2 存储", value: "34.2 MiB" }),
    ]));
    expect(summary.cards.find((card) => card.label === "告警数")?.value).toBe("0");
    expect(summary.emptyState).toBeUndefined();
  });

  it("uses a Chinese empty state for hostname scopes with no traffic", () => {
    const summary = summarizeRows(rows, resources, {
      type: "hostname",
      id: "dashboard.8xd.io",
    });

    expect(summary.title).toBe("dashboard.8xd.io 子域名总览");
    expect(summary.emptyState).toBe("暂无流量");
    expect(zeroTrafficLabel("dashboard.8xd.io")).toBe("dashboard.8xd.io 暂无流量");
  });
});

describe("connector cards", () => {
  it("does not present future platforms as connected", () => {
    const connectors: Connector[] = [
      { platform: "Cloudflare", status: "connected", real: true },
      { platform: "Supabase", status: "planned", real: false },
      { platform: "Firebase", status: "disconnected", real: false },
      { platform: "Google Cloud", status: "planned", real: false },
    ];

    expect(connectorCards(connectors)).toEqual([
      { platform: "Cloudflare", label: "已连接", tone: "success", sourceLabel: "真实数据" },
      { platform: "Supabase", label: "规划中", tone: "planned", sourceLabel: "未接入" },
      { platform: "Firebase", label: "未连接", tone: "muted", sourceLabel: "未接入" },
      { platform: "Google Cloud", label: "规划中", tone: "planned", sourceLabel: "未接入" },
    ]);
  });
});

describe("dashboard snapshot", () => {
  it("filters trends and domains by active scope", () => {
    const globalSnapshot = buildSnapshot(seedData, "30d", { type: "global", id: "global" });
    const hostnameSnapshot = buildSnapshot(seedData, "30d", {
      type: "hostname",
      id: "share-pages.8xd.io",
    });
    const resourceSnapshot = buildSnapshot(seedData, "30d", {
      type: "resource",
      id: "worker-share-pages",
    });

    const globalRequests = globalSnapshot.trends.reduce((sum, point) => sum + point.requests, 0);
    const hostnameRequests = hostnameSnapshot.trends.reduce((sum, point) => sum + point.requests, 0);

    expect(hostnameRequests).toBeGreaterThan(0);
    expect(hostnameRequests).toBeLessThan(globalRequests);
    expect(resourceSnapshot.domains.map((domain) => domain.domain)).toEqual(["8xd.io"]);
  });
});

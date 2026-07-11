import type {
  Connector,
  ConnectorCard,
  DashboardSummary,
  KpiCard,
  MetricRow,
  ResourceRecord,
  ScopeOption,
  ScopeRef,
  ScopeTree,
} from "./types";

const PROJECT_LABELS: Record<string, string> = {
  jovlo: "Jovlo.ai",
  "share-pages": "Share Pages",
  "lawyer-homepage": "律师主页",
  shared: "共享资源",
  uncategorized: "未归类项目",
};

const RESOURCE_TYPE_LABELS: Record<ResourceRecord["type"], string> = {
  zone: "根域名",
  hostname: "子域名",
  pages: "Pages",
  worker: "Worker",
  r2: "R2",
  kv: "KV",
  d1: "D1",
  queue: "Queues",
  vectorize: "Vectorize",
  connector: "连接器",
};

export function buildScopeTree(resources: ResourceRecord[]): ScopeTree {
  const projectIds = new Set<string>();
  const domains = new Set<string>();
  const hostnames = new Map<string, string | undefined>();

  for (const resource of resources) {
    projectIds.add(resource.projectKey || "uncategorized");
    if (resource.domain) domains.add(resource.domain);
    for (const hostname of resource.hostnames) {
      hostnames.set(hostname, resource.domain);
    }
  }

  return {
    global: {
      type: "global",
      id: "global",
      label: "全部资源",
      kindLabel: "全局",
    },
    projects: [...projectIds].sort().map((id) => ({
      type: "project",
      id,
      label: PROJECT_LABELS[id] ?? id,
      kindLabel: "项目",
    })),
    domains: [...domains].sort().map((id) => ({
      type: "domain",
      id,
      label: id,
      kindLabel: "根域名",
    })),
    hostnames: [...hostnames.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, parentId]) => ({
      type: "hostname",
      id,
      label: id,
      kindLabel: "子域名",
      parentId,
    })),
    resources: resources
      .map((resource) => ({
        type: "resource" as const,
        id: resource.id,
        label: resource.name,
        kindLabel: RESOURCE_TYPE_LABELS[resource.type],
        parentId: resource.domain,
        badge: resource.shared ? "共享资源" : undefined,
      }))
      .sort((a, b) => `${a.kindLabel}:${a.label}`.localeCompare(`${b.kindLabel}:${b.label}`)),
  };
}

export function filterRowsForScope(
  rows: MetricRow[],
  resources: ResourceRecord[],
  scope: ScopeRef,
): MetricRow[] {
  if (scope.type === "global") return rows;

  return rows.filter((row) => metricBelongsToScope(row, resources, scope));
}

export function summarizeRows(
  rows: MetricRow[],
  resources: ResourceRecord[],
  scope: ScopeRef,
): DashboardSummary {
  const scopedRows = filterRowsForScope(rows, resources, scope);
  const totals = scopedRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.key] = (acc[row.key] ?? 0) + row.value;
    return acc;
  }, {});

  const requestTotal = Math.round(totals.requests ?? 0);
  const r2Storage = totals.r2Storage ?? 0;
  const workerRequests = Math.round(totals.workerRequests ?? 0);
  const kvOperations = Math.round(totals.kvOperations ?? 0);
  const visits = Math.round(totals.visits ?? 0);

  const cards: KpiCard[] = [
    {
      label: "总请求数",
      value: formatInteger(requestTotal),
      helper: "当前范围内的 HTTP 请求",
      tone: "blue",
    },
    {
      label: "R2 存储",
      value: `${trimDecimal(r2Storage)} MiB`,
      helper: "对象存储用量",
      tone: "blue",
    },
    {
      label: "访问量",
      value: formatInteger(visits),
      helper: "Web Analytics 访问",
      tone: "green",
    },
    {
      label: "Worker 请求",
      value: formatInteger(workerRequests),
      helper: "Workers 调用次数",
      tone: "orange",
    },
    {
      label: "KV 操作",
      value: formatInteger(kvOperations),
      helper: "读写与列表操作",
      tone: "gray",
    },
    {
      label: "告警数",
      value: formatInteger(totals.alerts ?? 0),
      helper: "当前未处理告警",
      tone: "red",
    },
  ];

  return {
    title: scopeTitle(scope),
    cards,
    emptyState: scope.type === "hostname" && requestTotal === 0 && visits === 0 ? "暂无流量" : undefined,
  };
}

export function connectorCards(connectors: Connector[]): ConnectorCard[] {
  return connectors.map((connector) => {
    if (connector.status === "connected" && connector.real) {
      return {
        platform: connector.platform,
        label: "已连接",
        tone: "success",
        sourceLabel: "真实数据",
      };
    }

    if (connector.status === "failed") {
      return {
        platform: connector.platform,
        label: "同步失败",
        tone: "danger",
        sourceLabel: "未接入",
      };
    }

    if (connector.status === "planned") {
      return {
        platform: connector.platform,
        label: "规划中",
        tone: "planned",
        sourceLabel: "未接入",
      };
    }

    return {
      platform: connector.platform,
      label: "未连接",
      tone: "muted",
      sourceLabel: "未接入",
    };
  });
}

export function zeroTrafficLabel(hostname: string): string {
  return `${hostname} 暂无流量`;
}

function metricBelongsToScope(row: MetricRow, resources: ResourceRecord[], scope: ScopeRef): boolean {
  if (scope.type === "resource") {
    return row.scopeType === "resource" && row.scopeId === scope.id;
  }

  if (scope.type === "hostname") {
    if (row.scopeType === "hostname") return row.scopeId === scope.id;
    if (row.scopeType === "resource") {
      return resources.some(
        (resource) => resource.id === row.scopeId && resource.hostnames.includes(scope.id),
      );
    }
    return false;
  }

  if (row.scopeType === scope.type && row.scopeId === scope.id) return true;

  const directResource = resources.find((resource) => resource.id === row.scopeId);
  if (directResource && resourceBelongsToScope(directResource, scope)) return true;

  if (row.scopeType === "hostname") {
    return resources.some(
      (resource) =>
        resource.hostnames.includes(row.scopeId) && resourceBelongsToScope(resource, scope),
    );
  }

  return false;
}

function resourceBelongsToScope(resource: ResourceRecord, scope: ScopeRef): boolean {
  switch (scope.type) {
    case "global":
      return true;
    case "project":
      return resource.projectKey === scope.id;
    case "domain":
      return resource.domain === scope.id;
    case "hostname":
      return resource.hostnames.includes(scope.id);
    case "resource":
      return resource.id === scope.id;
  }
}

function scopeTitle(scope: ScopeRef): string {
  switch (scope.type) {
    case "global":
      return "全部资源总览";
    case "project":
      return `${PROJECT_LABELS[scope.id] ?? scope.id} 项目总览`;
    case "domain":
      return `${scope.id} 域名总览`;
    case "hostname":
      return `${scope.id} 子域名总览`;
    case "resource":
      return `${scope.id} 资源总览`;
  }
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function trimDecimal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

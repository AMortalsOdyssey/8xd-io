import {
  buildScopeTree,
  connectorCards,
  filterRowsForScope,
  summarizeRows,
} from "./dashboard-model";
import type {
  Connector,
  AuthProviderStatus,
  DashboardSummary,
  MetricRow,
  MetricSource,
  ResourceRecord,
  ScopeRef,
  ScopeTree,
  TrafficBreakdown,
  TrafficInsight,
} from "./types";

export type TimeRange = "24h" | "7d" | "30d";

export interface TrendPoint {
  date: string;
  requests: number;
  visits: number;
  errors: number;
  scopeType?: ScopeRef["type"];
  scopeId?: string;
}

export interface DomainOverview {
  domain: string;
  status: string;
  requests: number;
  visits: number;
  bytesMiB: number;
  threats: number;
  topDay: string;
  hostnames: string[];
}

export interface AlertRecord {
  id: string;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  scopeType: ScopeRef["type"];
  scopeId: string;
  status: "open" | "resolved";
}

export interface DashboardSnapshot {
  generatedAt: string;
  sourceLabel: "真实数据" | "缓存快照" | "开发预览";
  scopes: ScopeTree;
  activeScope: ScopeRef;
  range: TimeRange;
  summary: DashboardSummary;
  resources: ResourceRecord[];
  metrics: MetricRow[];
  connectors: ReturnType<typeof connectorCards>;
  connectorRecords: Connector[];
  trends: TrendPoint[];
  domains: DomainOverview[];
  alerts: AlertRecord[];
  trafficBreakdowns: TrafficBreakdown[];
  trafficInsights: TrafficInsight[];
  authProviders: AuthProviderStatus[];
}

export interface RawDashboardData {
  generatedAt: string;
  sourceLabel: DashboardSnapshot["sourceLabel"];
  resources: ResourceRecord[];
  metrics: MetricRow[];
  connectors: Connector[];
  trends: TrendPoint[];
  domains: DomainOverview[];
  alerts: AlertRecord[];
  trafficBreakdowns: TrafficBreakdown[];
  authProviders: AuthProviderStatus[];
}

export const seedData: RawDashboardData = {
  generatedAt: "2026-06-14T10:30:00+08:00",
  sourceLabel: "缓存快照",
  resources: [
    {
      id: "zone-8xd-io",
      platform: "Cloudflare",
      type: "zone",
      name: "8xd.io",
      status: "active",
      projectKey: "share-pages",
      domain: "8xd.io",
      hostnames: ["8xd.io", "share-pages.8xd.io", "dashboard.8xd.io"],
      shared: false,
      lastSyncedAt: "2026-06-14T10:30:00+08:00",
    },
    {
      id: "zone-fangliying",
      platform: "Cloudflare",
      type: "zone",
      name: "fangliying.com",
      status: "active",
      projectKey: "lawyer-homepage",
      domain: "fangliying.com",
      hostnames: ["fangliying.com", "www.fangliying.com"],
      shared: false,
      lastSyncedAt: "2026-06-14T10:30:00+08:00",
    },
    {
      id: "zone-say2pen",
      platform: "Cloudflare",
      type: "zone",
      name: "say2pen.com",
      status: "active",
      projectKey: "uncategorized",
      domain: "say2pen.com",
      hostnames: ["say2pen.com"],
      shared: false,
      lastSyncedAt: "2026-06-14T10:30:00+08:00",
    },
    {
      id: "pages-fly-lawyer-homepage",
      platform: "Cloudflare",
      type: "pages",
      name: "fly-lawyer-homepage",
      status: "active",
      projectKey: "lawyer-homepage",
      domain: "fangliying.com",
      hostnames: ["fangliying.com", "www.fangliying.com"],
      shared: false,
    },
    {
      id: "pages-8xd-io",
      platform: "Cloudflare",
      type: "pages",
      name: "8xd-io",
      status: "active",
      projectKey: "share-pages",
      domain: "8xd.io",
      hostnames: ["8xd.io"],
      shared: false,
    },
    {
      id: "worker-share-pages",
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
      id: "r2-share-pages-content",
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
      id: "kv-share-pages-config",
      platform: "Cloudflare",
      type: "kv",
      name: "SHARE_PAGES_CONFIG",
      status: "active",
      projectKey: "share-pages",
      domain: "8xd.io",
      hostnames: ["share-pages.8xd.io"],
      shared: false,
    },
    {
      id: "d1-empty",
      platform: "Cloudflare",
      type: "d1",
      name: "D1",
      status: "empty",
      projectKey: "uncategorized",
      hostnames: [],
      shared: false,
      metadata: { emptyLabel: "暂无资源" },
    },
    {
      id: "queues-empty",
      platform: "Cloudflare",
      type: "queue",
      name: "Queues",
      status: "empty",
      projectKey: "uncategorized",
      hostnames: [],
      shared: false,
      metadata: { emptyLabel: "暂无资源" },
    },
    {
      id: "vectorize-empty",
      platform: "Cloudflare",
      type: "vectorize",
      name: "Vectorize",
      status: "empty",
      projectKey: "uncategorized",
      hostnames: [],
      shared: false,
      metadata: { emptyLabel: "暂无资源" },
    },
  ],
  metrics: [
    metric("requests", "请求数", 24299, "次", "domain", "8xd.io"),
    metric("requests", "请求数", 6312, "次", "domain", "fangliying.com"),
    metric("requests", "请求数", 588, "次", "domain", "say2pen.com"),
    metric("visits", "访问量", 420, "次", "domain", "8xd.io"),
    metric("visits", "访问量", 60, "次", "domain", "fangliying.com"),
    metric("requests", "请求数", 2986, "次", "resource", "worker-share-pages"),
    metric("workerRequests", "Worker 请求", 2986, "次", "resource", "worker-share-pages"),
    metric("workerCpuMs", "CPU 时间", 4765, "ms", "resource", "worker-share-pages"),
    metric("workerWallMs", "总耗时", 9883, "ms", "resource", "worker-share-pages"),
    metric("r2Storage", "R2 存储", 34.2, "MiB", "resource", "r2-share-pages-content"),
    metric("r2Objects", "R2 对象数", 115, "个", "resource", "r2-share-pages-content"),
    metric("r2Operations", "R2 操作", 810, "次", "resource", "r2-share-pages-content"),
    metric("r2ClassAOperations", "R2 Class A 操作", 810, "次", "resource", "r2-share-pages-content"),
    metric("kvKeys", "KV 键数量", 6, "个", "resource", "kv-share-pages-config"),
    metric("kvStorageKiB", "KV 存储", 9.3, "KiB", "resource", "kv-share-pages-config"),
    metric("kvOperations", "KV 操作", 6830, "次", "resource", "kv-share-pages-config"),
    metric("requests", "请求数", 360, "次", "hostname", "share-pages.8xd.io"),
    metric("visits", "访问量", 360, "次", "hostname", "share-pages.8xd.io"),
    metric("requests", "请求数", 60, "次", "hostname", "8xd.io"),
    metric("visits", "访问量", 60, "次", "hostname", "8xd.io"),
    metric("requests", "请求数", 50, "次", "hostname", "fangliying.com"),
    metric("visits", "访问量", 50, "次", "hostname", "fangliying.com"),
    metric("requests", "请求数", 10, "次", "hostname", "www.fangliying.com"),
    metric("visits", "访问量", 10, "次", "hostname", "www.fangliying.com"),
    metric("threats", "威胁数", 542, "次", "domain", "8xd.io"),
    metric("threats", "威胁数", 52, "次", "domain", "fangliying.com"),
  ],
  connectors: [
    { platform: "Cloudflare", status: "connected", real: true, lastSyncedAt: "2026-06-14T10:30:00+08:00" },
    { platform: "Supabase", status: "planned", real: false, message: "待授权后接入 Postgres / Auth / Storage" },
    { platform: "Firebase", status: "disconnected", real: false, message: "未连接，保留移动端与 Firestore 扩展位" },
    { platform: "Google Cloud", status: "planned", real: false, message: "待接入 Billing / Cloud Run / Logging" },
  ],
  trends: [
    { date: "06-07", requests: 3865, visits: 42, errors: 0 },
    { date: "06-08", requests: 439, visits: 26, errors: 0 },
    { date: "06-09", requests: 9639, visits: 210, errors: 1 },
    { date: "06-10", requests: 1268, visits: 122, errors: 0 },
    { date: "06-11", requests: 2686, visits: 63, errors: 0 },
    { date: "06-12", requests: 281, visits: 35, errors: 0 },
    { date: "06-13", requests: 925, visits: 68, errors: 0 },
    { date: "06-14", requests: 149, visits: 9, errors: 0 },
  ],
  domains: [
    {
      domain: "8xd.io",
      status: "active",
      requests: 24299,
      visits: 420,
      bytesMiB: 167.8,
      threats: 542,
      topDay: "2026-06-03",
      hostnames: ["8xd.io", "share-pages.8xd.io", "dashboard.8xd.io"],
    },
    {
      domain: "fangliying.com",
      status: "active",
      requests: 6312,
      visits: 60,
      bytesMiB: 99,
      threats: 52,
      topDay: "2026-06-07",
      hostnames: ["fangliying.com", "www.fangliying.com"],
    },
    {
      domain: "say2pen.com",
      status: "active",
      requests: 588,
      visits: 0,
      bytesMiB: 0.3,
      threats: 0,
      topDay: "2026-05-16",
      hostnames: ["say2pen.com"],
    },
  ],
  alerts: [],
  trafficBreakdowns: [
    traffic("country-cn", "domain", "fangliying.com", "country", "中国大陆", 2460, "requests", "estimated", "Cloudflare Zone 请求按常见访问地区归因，等待 Logpush 或更多 GraphQL 维度校准"),
    traffic("country-us", "domain", "fangliying.com", "country", "美国", 980, "requests", "estimated", "包含搜索爬虫、AI Agent、CDN 健康检查和真实访客"),
    traffic("country-sg", "domain", "fangliying.com", "country", "新加坡", 410, "requests", "estimated", "常见 CDN、搜索和代理出口"),
    traffic("country-hk", "domain", "fangliying.com", "country", "中国香港", 330, "requests", "estimated", "可能包含搜索、社交预览和境外代理"),
    traffic("country-other", "domain", "fangliying.com", "country", "其它地区", 2132, "requests", "estimated", "剩余地区合并展示"),
    traffic("path-home", "domain", "fangliying.com", "path", "/", 2380, "requests", "estimated", "首页及其静态资源会一起计入根域名请求"),
    traffic("path-news", "domain", "fangliying.com", "path", "/news", 1260, "requests", "estimated", "新闻列表、文章页和对应图片资源"),
    traffic("path-practice", "domain", "fangliying.com", "path", "/practice", 820, "requests", "estimated", "业务领域页面"),
    traffic("path-assets", "domain", "fangliying.com", "path", "/_astro / assets", 1180, "requests", "estimated", "JS、CSS、图片等静态资源请求"),
    traffic("path-other", "domain", "fangliying.com", "path", "其它页面", 672, "requests", "estimated", "关于、案例、联系等页面"),
    traffic("ref-direct", "domain", "fangliying.com", "referrer", "直接访问 / 无 Referer", 2740, "requests", "estimated", "浏览器直接打开、隐私浏览器、App 内打开和部分机器人会缺少 Referer"),
    traffic("ref-search", "domain", "fangliying.com", "referrer", "搜索引擎", 1560, "requests", "estimated", "Google、Bing、百度、搜狗等搜索或爬虫相关请求"),
    traffic("ref-social", "domain", "fangliying.com", "referrer", "微信 / 社交预览", 640, "requests", "estimated", "分享卡片抓取和 App 内浏览"),
    traffic("ref-agent", "domain", "fangliying.com", "referrer", "Agent / 工具请求", 830, "requests", "estimated", "AI Agent、监控、预览器、SEO 工具和脚本请求"),
    traffic("ref-other", "domain", "fangliying.com", "referrer", "其它来源", 542, "requests", "estimated", "剩余来源合并"),
    traffic("agent-browser", "domain", "fangliying.com", "agent", "浏览器页面访问", 4378, "requests", "estimated", "Cloudflare Web Analytics 的 pageViews 更接近真实浏览"),
    traffic("agent-static", "domain", "fangliying.com", "agent", "静态资源加载", 1180, "requests", "estimated", "一次页面访问通常会触发多个资源请求"),
    traffic("agent-bot", "domain", "fangliying.com", "agent", "搜索/AI/监控 Agent", 754, "requests", "estimated", "未开启 Bot Management 时按 UA/路径/Referer 近似归因"),
    traffic("source-geo-crawler", "domain", "fangliying.com", "source", "GEO / AI Crawler", 510, "requests", "estimated", "AI 训练或索引 crawler 的近似请求量，等待 Cloudflare User-Agent / AI Crawl Control 校准"),
    traffic("source-geo-search", "domain", "fangliying.com", "source", "GEO / AI Search", 190, "requests", "estimated", "AI 搜索产品抓取与检索类请求的估算值"),
    traffic("source-geo-assistant", "domain", "fangliying.com", "source", "GEO / AI Assistant", 126, "requests", "estimated", "用户在 AI 助手中触发网页读取时可能产生的请求"),
    traffic("source-seo-bot", "domain", "fangliying.com", "source", "SEO / Search Bot", 570, "requests", "estimated", "Google、Bing、百度等传统搜索引擎 crawler 请求"),
    traffic("source-seo-referral", "domain", "fangliying.com", "source", "SEO / Search Referral", 760, "requests", "estimated", "搜索结果点击带来的浏览器访问"),
    traffic("source-human", "domain", "fangliying.com", "source", "Human / Browser", 3602, "requests", "estimated", "浏览器访问与静态资源加载合并估算"),
    traffic("ai-openai-gptbot", "domain", "fangliying.com", "aiAgent", "OpenAI / GPTBot", 160, "requests", "estimated", "高置信：匹配 OpenAI 公开 User-Agent；当前为估算，等待真实 UA 采集"),
    traffic("ai-openai-chatgpt", "domain", "fangliying.com", "aiAgent", "OpenAI / ChatGPT User", 76, "requests", "estimated", "高置信：用户触发的 ChatGPT 网页读取会使用该类 UA；当前为估算"),
    traffic("ai-claude", "domain", "fangliying.com", "aiAgent", "Anthropic / ClaudeBot", 70, "requests", "estimated", "高置信：匹配 Anthropic 公开 User-Agent；当前为估算"),
    traffic("ai-perplexity", "domain", "fangliying.com", "aiAgent", "Perplexity / PerplexityBot", 50, "requests", "estimated", "高置信：匹配 Perplexity 公开 User-Agent；当前为估算"),
    traffic("ai-bytespider", "domain", "fangliying.com", "aiAgent", "ByteDance / Bytespider", 158, "requests", "estimated", "中置信：可归为字节系抓取，不等同于确认豆包模型推理请求"),
  ],
  authProviders: defaultAuthProviders(false),
};

export function buildSnapshot(
  raw: RawDashboardData,
  range: TimeRange,
  activeScope: ScopeRef,
): DashboardSnapshot {
  const scopedMetrics = filterRowsForScope(raw.metrics, raw.resources, activeScope);
  const trends = filterTrends(raw.trends, range, activeScope, raw.metrics, raw.resources);
  const summary = summarizeRows(raw.metrics, raw.resources, activeScope);
  applyRangeToSummary(summary, trends, range, activeScope, raw.trends, raw.resources);

  return {
    generatedAt: raw.generatedAt,
    sourceLabel: raw.sourceLabel,
    scopes: buildScopeTree(raw.resources),
    activeScope,
    range,
    summary,
    resources: raw.resources.filter((resource) => resourceInScope(resource, activeScope)),
    metrics: scopedMetrics,
    connectors: connectorCards(raw.connectors),
    connectorRecords: raw.connectors,
    trends,
    domains: filterDomains(raw.domains, activeScope, raw.resources),
    alerts: raw.alerts.filter(
      (alert) => activeScope.type === "global" || alert.scopeId === activeScope.id,
    ),
    trafficBreakdowns: filterTrafficBreakdowns(raw.trafficBreakdowns, raw.resources, activeScope),
    trafficInsights: buildTrafficInsights(raw, activeScope),
    authProviders: raw.authProviders,
  };
}

/**
 * 指标快照固定是近 30 天口径。选择更短时间范围时，请求/访问 KPI 改用
 * 每日趋势真实数据聚合（仅在该 scope 存在真实趋势行时）并标记为 range 口径；
 * 无法重算的卡片保持 snapshot 口径，UI 上固定标注"近 30 天"。
 */
function applyRangeToSummary(
  summary: DashboardSummary,
  trends: TrendPoint[],
  range: TimeRange,
  scope: ScopeRef,
  allTrends: TrendPoint[],
  resources: ResourceRecord[],
): void {
  const hasRealTrends =
    scope.type === "global" ||
    allTrends.some((trend) => trendBelongsToScope(trend, resources, scope));
  if (!hasRealTrends) return;

  const requests = Math.round(trends.reduce((sum, trend) => sum + (trend.requests || 0), 0));
  const visits = Math.round(trends.reduce((sum, trend) => sum + (trend.visits || 0), 0));
  for (const card of summary.cards) {
    if (card.key === "requests") {
      card.window = "range";
      if (range !== "30d") card.value = formatCardInteger(requests);
    }
    if (card.key === "visits") {
      card.window = "range";
      if (range !== "30d") card.value = formatCardInteger(visits);
    }
  }
}

function formatCardInteger(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function metric(
  key: string,
  label: string,
  value: number,
  unit: string,
  scopeType: ScopeRef["type"],
  scopeId: string,
  source: MetricSource = "cached",
): MetricRow {
  return {
    key,
    label,
    value,
    unit,
    range: "30d",
    date: "2026-06-14",
    scopeType,
    scopeId,
    source,
  };
}

function traffic(
  id: string,
  scopeType: ScopeRef["type"],
  scopeId: string,
  kind: TrafficBreakdown["kind"],
  label: string,
  value: number,
  unit: TrafficBreakdown["unit"],
  source: MetricSource,
  helper?: string,
): TrafficBreakdown {
  return {
    id,
    scopeType,
    scopeId,
    kind,
    label,
    value,
    unit,
    source,
    helper,
    date: "2026-06-14",
  };
}

function resourceInScope(resource: ResourceRecord, scope: ScopeRef): boolean {
  if (scope.type === "global") return true;
  if (scope.type === "project") return resource.projectKey === scope.id;
  if (scope.type === "domain") return resource.domain === scope.id;
  if (scope.type === "hostname") return resource.hostnames.includes(scope.id);
  return resource.id === scope.id;
}

function filterDomains(
  domains: DomainOverview[],
  scope: ScopeRef,
  resources: ResourceRecord[],
): DomainOverview[] {
  if (scope.type === "global") {
    return domains;
  }

  if (scope.type === "project") {
    const scopedResources = resources.filter((resource) => resourceInScope(resource, scope));
    const scopedDomains = new Set(scopedResources.map((resource) => resource.domain).filter(Boolean));
    const scopedHostnames = new Set(scopedResources.flatMap((resource) => resource.hostnames));

    return domains
      .filter(
        (domain) =>
          scopedDomains.has(domain.domain) ||
          domain.hostnames.some((hostname) => scopedHostnames.has(hostname)),
      )
      .map((domain) => ({
        ...domain,
        hostnames: domain.hostnames.filter(
          (hostname) => scopedHostnames.size === 0 || scopedHostnames.has(hostname),
        ),
      }));
  }

  if (scope.type === "resource") {
    const resource = resources.find((item) => item.id === scope.id);
    if (!resource) return [];

    return domains
      .filter(
        (domain) =>
          (resource.domain && domain.domain === resource.domain) ||
          domain.hostnames.some((hostname) => resource.hostnames.includes(hostname)),
      )
      .map((domain) => ({
        ...domain,
        hostnames: resource.hostnames.length
          ? domain.hostnames.filter((hostname) => resource.hostnames.includes(hostname))
          : domain.hostnames,
      }));
  }

  if (scope.type === "domain") {
    return domains.filter((domain) => domain.domain === scope.id);
  }

  return domains
    .filter((domain) => domain.hostnames.includes(scope.id))
    .map((domain) => ({
      ...domain,
      hostnames: domain.hostnames.filter((hostname) => hostname === scope.id),
    }));
}

function filterTrafficBreakdowns(
  breakdowns: TrafficBreakdown[],
  resources: ResourceRecord[],
  scope: ScopeRef,
): TrafficBreakdown[] {
  if (scope.type === "global") return breakdowns;
  return breakdowns.filter((row) => trafficBelongsToScope(row, resources, scope));
}

function trafficBelongsToScope(
  row: TrafficBreakdown,
  resources: ResourceRecord[],
  scope: ScopeRef,
): boolean {
  if (row.scopeType === scope.type && row.scopeId === scope.id) return true;
  if (scope.type === "domain" && row.scopeType === "hostname") {
    return resources.some(
      (resource) => resource.domain === scope.id && resource.hostnames.includes(row.scopeId),
    );
  }
  if (scope.type === "project") {
    const directResource = resources.find((resource) => resource.domain === row.scopeId || resource.hostnames.includes(row.scopeId));
    return directResource ? resourceInScope(directResource, scope) : false;
  }
  if (scope.type === "hostname" && row.scopeType === "domain") {
    return resources.some(
      (resource) => resource.domain === row.scopeId && resource.hostnames.includes(scope.id),
    );
  }
  return false;
}

function buildTrafficInsights(raw: RawDashboardData, scope: ScopeRef): TrafficInsight[] {
  const scopeDomain = resolveScopeDomain(scope, raw.resources) || "fangliying.com";
  const domain = raw.domains.find((item) => item.domain === scopeDomain);
  const breakdowns = filterTrafficBreakdowns(raw.trafficBreakdowns, raw.resources, {
    type: "domain",
    id: scopeDomain,
  });
  const instrumentedViews = sumBreakdown(breakdowns, "event", "views") || sumBreakdown(breakdowns, "event", "events");
  const agentRequests = breakdowns
    .filter((row) => row.kind === "agent" && /Agent|bot|爬虫|监控|AI/i.test(row.label))
    .reduce((sum, row) => sum + row.value, 0);
  const geoRequests = breakdowns
    .filter((row) => row.kind === "source" && row.label.startsWith("GEO /"))
    .reduce((sum, row) => sum + row.value, 0);
  const staticRequests = breakdowns
    .filter((row) => row.kind === "path" && /assets|_astro|静态/i.test(row.label))
    .reduce((sum, row) => sum + row.value, 0);
  const topReferrer = topBreakdown(breakdowns, "referrer");
  const topAiAgent = topBreakdown(breakdowns, "aiAgent");
  const requests = domain?.requests ?? metricTotal(raw.metrics, "requests", "domain", scopeDomain);
  const visits = domain?.visits ?? metricTotal(raw.metrics, "visits", "domain", scopeDomain);

  if (scope.type !== "domain" && scope.type !== "hostname" && scope.type !== "project") {
    return [
      {
        id: "scope-tip",
        title: "看律师主页归因",
        value: "切换到 fangliying.com",
        detail: "总览会聚合所有域名；律师主页页签会默认聚焦 fangliying.com，避免把 8xd.io、say2pen.com 的流量混在一起。",
        tone: "info",
      },
      {
        id: "auth-tip",
        title: "登录方案建议",
        value: "Supabase 免费层优先",
        detail: "Firebase Auth 的基础登录可免费使用，但启用 GCP/Blaze 后会有按量计费风险；Dashboard 已保留 Supabase 邮箱免密和 Google OAuth 接入位。",
        tone: "success",
      },
    ];
  }

  return [
    {
      id: "requests-meaning",
      title: "这 6300 多次从哪来",
      value: `${formatInsightNumber(requests)} HTTP 请求`,
      detail: "Cloudflare 统计根域名下所有 HTTP 请求，不等同于真人访客；一次打开页面会额外产生 CSS、JS、图片、favicon、OG 图和预览抓取请求。",
      tone: "info",
    },
    {
      id: "pageviews-meaning",
      title: "更接近访问量的是",
      value: `${formatInsightNumber(visits)} Web Analytics 访问`,
      detail: instrumentedViews > 0
        ? `站内埋点已收到 ${formatInsightNumber(instrumentedViews)} 次浏览事件，后续会和 Cloudflare 请求数并排对照。`
        : "当前先以 Cloudflare Web Analytics 的 pageViews 看真实浏览；新埋点上线后会补充浏览器端 pageview。",
      tone: "success",
    },
    {
      id: "agent-share",
      title: "疑似非真人请求",
      value: agentRequests > 0 || geoRequests > 0 ? `${formatInsightNumber(Math.max(agentRequests, geoRequests))} 次` : "待继续采集",
      detail: "搜索爬虫、AI Agent、监控和社交卡片预览都会访问页面；未开启 Cloudflare Bot Management 时，Dashboard 用 UA、Referer、路径和来源字段做近似归因。",
      tone: agentRequests > 0 || geoRequests > 0 ? "warning" : "muted",
    },
    {
      id: "geo-ai-share",
      title: "AI / GEO 来源",
      value: geoRequests > 0 ? `${formatInsightNumber(geoRequests)} 次` : "等待 UA",
      detail: topAiAgent
        ? `当前最高识别为 ${topAiAgent.label}。${topAiAgent.helper || "真实度取决于 User-Agent、Referer 和 Cloudflare 分类字段。"}`
        : "可识别 ChatGPT、Claude、Perplexity、Bytespider 等常见 AI/Agent UA；不会执行 JS 的 crawler 主要靠边缘请求维度。",
      tone: geoRequests > 0 ? "success" : "muted",
    },
    {
      id: "static-share",
      title: "静态资源请求",
      value: staticRequests > 0 ? `${formatInsightNumber(staticRequests)} 次` : "并入页面路径",
      detail: "请求总量里包含页面依赖资源，所以刚上线也可能出现请求数明显高于访问量的情况。",
      tone: "muted",
    },
    {
      id: "top-source",
      title: "当前最大来源",
      value: topReferrer?.label ?? "直接访问 / 无 Referer",
      detail: topReferrer?.helper ?? "直接访问、App 内打开、隐私浏览器和部分机器人经常不会带 Referer。",
      tone: "info",
    },
  ];
}

function resolveScopeDomain(scope: ScopeRef, resources: ResourceRecord[]): string | undefined {
  if (scope.type === "domain") return scope.id;
  if (scope.type === "hostname") {
    return resources.find((resource) => resource.hostnames.includes(scope.id))?.domain;
  }
  if (scope.type === "project") {
    return resources.find((resource) => resource.projectKey === scope.id && resource.domain)?.domain;
  }
  if (scope.type === "resource") {
    return resources.find((resource) => resource.id === scope.id)?.domain;
  }
  return undefined;
}

function sumBreakdown(
  breakdowns: TrafficBreakdown[],
  kind: TrafficBreakdown["kind"],
  unit: TrafficBreakdown["unit"],
): number {
  return breakdowns
    .filter((row) => row.kind === kind && row.unit === unit)
    .reduce((sum, row) => sum + row.value, 0);
}

function topBreakdown(
  breakdowns: TrafficBreakdown[],
  kind: TrafficBreakdown["kind"],
): TrafficBreakdown | undefined {
  return breakdowns
    .filter((row) => row.kind === kind)
    .sort((a, b) => b.value - a.value)[0];
}

function metricTotal(
  metrics: MetricRow[],
  key: string,
  scopeType: ScopeRef["type"],
  scopeId: string,
): number {
  return metrics
    .filter((metric) => metric.key === key && metric.scopeType === scopeType && metric.scopeId === scopeId)
    .reduce((sum, metric) => sum + metric.value, 0);
}

function formatInsightNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(Math.round(value));
}

export function defaultAuthProviders(supabaseConfigured: boolean): AuthProviderStatus[] {
  return [
    {
      provider: "password",
      label: "当前密码登录",
      status: "active",
      costLabel: "免费",
      detail: "生产环境继续保留管理员密码、HttpOnly Session Cookie 和 Cloudflare Turnstile，不影响现有登录。",
    },
    {
      provider: "supabase",
      label: "Supabase 邮箱免密 / Google",
      status: supabaseConfigured ? "available" : "not_configured",
      costLabel: "Free 计划可用",
      detail: "Supabase Free 包含 50,000 MAU、Magic Link/OTP、Social OAuth。配置 URL、publishable key 和允许邮箱后即可启用。",
    },
    {
      provider: "firebase",
      label: "Firebase Auth",
      status: "blocked",
      costLabel: "Spark 免费，Blaze 有按量计费风险",
      detail: "Firebase 支持 Google 登录；但一旦项目需要启用 GCP/Blaze 服务，就进入按量计费边界，因此本 Dashboard 先不接。",
    },
  ];
}

function filterTrends(
  trends: TrendPoint[],
  range: TimeRange,
  scope: ScopeRef,
  metrics: MetricRow[],
  resources: ResourceRecord[],
): TrendPoint[] {
  const globalTrends = sliceTrends(aggregateTrends(trends), range);
  if (scope.type === "global") return globalTrends;

  const scopedTrends = aggregateTrends(
    trends.filter((trend) => trendBelongsToScope(trend, resources, scope)),
  );
  if (scopedTrends.length > 0) return sliceTrends(scopedTrends, range);

  const scopedMetrics = filterRowsForScope(metrics, resources, scope);
  return synthesizeScopedTrends(scopedMetrics, globalTrends);
}

function aggregateTrends(trends: TrendPoint[]): TrendPoint[] {
  const byDate = new Map<string, TrendPoint>();
  for (const trend of trends) {
    const current = byDate.get(trend.date) ?? {
      date: trend.date,
      requests: 0,
      visits: 0,
      errors: 0,
    };
    current.requests += trend.requests || 0;
    current.visits += trend.visits || 0;
    current.errors += trend.errors || 0;
    byDate.set(trend.date, current);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function sliceTrends(trends: TrendPoint[], range: TimeRange): TrendPoint[] {
  if (range === "24h") return trends.slice(-2);
  if (range === "7d") return trends.slice(-7);
  return trends;
}

function synthesizeScopedTrends(metrics: MetricRow[], baseTrends: TrendPoint[]): TrendPoint[] {
  if (baseTrends.length === 0) {
    return [];
  }

  const totals = metrics.reduce(
    (acc, metric) => {
      if (metric.key === "requests") acc.requests += metric.value;
      if (metric.key === "workerRequests" && acc.requests === 0) acc.requests += metric.value;
      if (metric.key === "visits") acc.visits += metric.value;
      if (metric.key === "errors") acc.errors += metric.value;
      return acc;
    },
    { requests: 0, visits: 0, errors: 0 },
  );
  const baseTotals = baseTrends.reduce(
    (acc, trend) => {
      acc.requests += trend.requests;
      acc.visits += trend.visits;
      acc.errors += trend.errors;
      return acc;
    },
    { requests: 0, visits: 0, errors: 0 },
  );

  return baseTrends.map((trend) => ({
    date: trend.date,
    requests: distributeTrendValue(totals.requests, trend.requests, baseTotals.requests, baseTrends.length),
    visits: distributeTrendValue(totals.visits, trend.visits, baseTotals.visits, baseTrends.length),
    errors: distributeTrendValue(totals.errors, trend.errors, baseTotals.errors, baseTrends.length),
  }));
}

function distributeTrendValue(total: number, baseValue: number, baseTotal: number, bucketCount: number): number {
  if (total === 0) return 0;
  if (baseTotal <= 0) return Math.round(total / bucketCount);
  return Math.round(total * (baseValue / baseTotal));
}

function trendBelongsToScope(trend: TrendPoint, resources: ResourceRecord[], scope: ScopeRef): boolean {
  if (!trend.scopeType || !trend.scopeId) return false;

  if (scope.type === "resource") {
    return trend.scopeType === "resource" && trend.scopeId === scope.id;
  }

  if (scope.type === "hostname") {
    if (trend.scopeType === "hostname") return trend.scopeId === scope.id;
    if (trend.scopeType === "resource") {
      return resources.some(
        (resource) => resource.id === trend.scopeId && resource.hostnames.includes(scope.id),
      );
    }
    return false;
  }

  if (trend.scopeType === scope.type && trend.scopeId === scope.id) return true;

  if (trend.scopeType === "resource") {
    const resource = resources.find((item) => item.id === trend.scopeId);
    return resource ? resourceInScope(resource, scope) : false;
  }

  if (trend.scopeType === "hostname") {
    return resources.some(
      (resource) =>
        resource.hostnames.includes(trend.scopeId || "") && resourceInScope(resource, scope),
    );
  }

  return false;
}

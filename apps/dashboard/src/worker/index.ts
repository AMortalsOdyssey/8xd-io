import {
  buildSnapshot,
  defaultAuthProviders,
  seedData,
  type RawDashboardData,
  type TimeRange,
} from "../shared/snapshot";
import {
  classifyTrafficIdentity,
  confidenceLabel,
  trafficBucketLabel,
  type TrafficIdentity,
} from "../shared/ai-attribution";
import type { Connector, MetricRow, MetricSource, ResourceRecord, ScopeRef, TrafficBreakdown } from "../shared/types";

const SESSION_COOKIE = "dashboard_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  DASHBOARD_ADMIN_PASSWORD?: string;
  DASHBOARD_AUTH_SECRET?: string;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
  TURNSTILE_ENABLED?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET?: string;
  ANALYTICS_ALLOWED_ORIGINS?: string;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  DASHBOARD_ALLOWED_EMAILS?: string;
  HEALTHCHECK_TARGETS?: string;
}

interface WorkerDomainBinding {
  hostname: string;
  service: string;
  zone_name: string;
}

interface HealthcheckTarget {
  id: string;
  name: string;
  url: string;
  projectKey: string;
  domain: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env, ctx);
  },
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runMonitoring(env));
  },
};

async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname.startsWith("/api/")) {
    return handleApi(request, env, ctx);
  }

  if (request.method === "OPTIONS") return new Response(null, { status: 204 });

  return env.ASSETS.fetch(request);
}

async function handleApi(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/api/collect/pageview") {
    return handlePageviewCollection(request, env);
  }

  if (url.pathname === "/api/auth/config" && request.method === "GET") {
    const supabaseConfigured = hasSupabaseConfig(env);
    return json({
      credentialUsername: "dashboard.8xd.io/admin",
      turnstileEnabled: isTurnstileEnabled(env),
      turnstileSiteKey: getTurnstileSiteKey(env),
      supabaseEnabled: supabaseConfigured,
      supabaseUrl: supabaseConfigured ? env.SUPABASE_URL : "",
      supabasePublishableKey: supabaseConfigured ? env.SUPABASE_PUBLISHABLE_KEY : "",
      authProviders: defaultAuthProviders(supabaseConfigured),
    });
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const body = await safeJson<{ password?: string; turnstileToken?: string }>(request);
    if (!env.DASHBOARD_ADMIN_PASSWORD || !env.DASHBOARD_AUTH_SECRET) {
      return json({ ok: false, error: "Dashboard 尚未配置管理员密码" }, 503);
    }

    const turnstile = await verifyTurnstile(request, env, body.turnstileToken);
    if (!turnstile.ok) {
      return json({ ok: false, error: turnstile.error }, 403);
    }

    if (body.password !== env.DASHBOARD_ADMIN_PASSWORD) {
      return json({ ok: false, error: "密码错误" }, 401);
    }

    const cookie = await createSessionCookie(env, url.protocol === "https:");
    return json({ ok: true }, 200, { "Set-Cookie": cookie });
  }

  if (url.pathname === "/api/auth/supabase/exchange" && request.method === "POST") {
    const body = await safeJson<{ accessToken?: string }>(request);
    if (!body.accessToken) return json({ ok: false, error: "缺少 Supabase access token" }, 400);
    const exchanged = await exchangeSupabaseSession(body.accessToken, env, url.protocol === "https:");
    if (!exchanged.ok) return json({ ok: false, error: exchanged.error }, exchanged.status);
    return json({ ok: true }, 200, { "Set-Cookie": exchanged.cookie });
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    return json({ ok: true }, 200, {
      "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${url.protocol === "https:" ? "; Secure" : ""}`,
    });
  }

  if (url.pathname === "/api/session") {
    return json({ authenticated: await isAuthenticated(request, env) });
  }

  if (!(await isAuthenticated(request, env))) {
    return json({ ok: false, error: "请先登录" }, 401);
  }

  if (url.pathname === "/api/sync/cloudflare" && request.method === "POST") {
    ctx.waitUntil(runMonitoring(env));
    return json({ ok: true, message: "资源同步与健康检查已启动" });
  }

  const range = normalizeRange(url.searchParams.get("range"));
  const scope = normalizeScope(url.searchParams.get("scopeType"), url.searchParams.get("scopeId"));
  const raw = await loadRawData(env);

  if (url.pathname === "/api/scopes") {
    return json(buildSnapshot(raw, range, scope).scopes);
  }

  if (url.pathname === "/api/dashboard/summary") {
    return json(buildSnapshot(raw, range, scope));
  }

  if (url.pathname === "/api/domains") {
    return json(buildSnapshot(raw, range, scope).domains);
  }

  const hostnameMatch = url.pathname.match(/^\/api\/domains\/([^/]+)\/hostnames$/);
  if (hostnameMatch) {
    const domain = decodeURIComponent(hostnameMatch[1]);
    const domains = buildSnapshot(raw, range, { type: "domain", id: domain }).domains;
    return json(domains.find((item) => item.domain === domain)?.hostnames ?? []);
  }

  if (url.pathname === "/api/cloudflare/resources") {
    return json(buildSnapshot(raw, range, scope).resources);
  }

  if (url.pathname === "/api/cloudflare/metrics") {
    return json(buildSnapshot(raw, range, scope).metrics);
  }

  if (url.pathname === "/api/connectors") {
    return json(buildSnapshot(raw, range, scope).connectors);
  }

  return json({ ok: false, error: "接口不存在" }, 404);
}

async function handlePageviewCollection(request: Request, env: Env): Promise<Response> {
  const cors = analyticsCors(request, env);
  if (!cors.allowed) {
    return json({ ok: false, error: "origin not allowed" }, 403, cors.headers);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors.headers });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "method not allowed" }, 405, cors.headers);
  }

  const body = await safeJson<{
    domain?: string;
    path?: string;
    referrer?: string;
    eventName?: string;
    sessionId?: string;
  }>(request);
  const originHost = request.headers.get("Origin") ? new URL(request.headers.get("Origin") || "").hostname : "";
  const domain = canonicalAnalyticsDomain(sanitizeDomain(body.domain || originHost));

  if (!isAllowedAnalyticsDomain(domain)) {
    return json({ ok: false, error: "domain not allowed" }, 400, cors.headers);
  }

  if (!env.DB) {
    return json({ ok: true, stored: false }, 200, cors.headers);
  }

  const now = new Date().toISOString();
  const userAgent = sanitizeString(request.headers.get("User-Agent") || "", 260);
  const remoteIp = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "";
  const ipHash = remoteIp ? await sign(`ip:${remoteIp}`, env.DASHBOARD_AUTH_SECRET || "dashboard-analytics") : "";
  const path = sanitizePath(body.path || "/");
  const referrer = sanitizeString(body.referrer || "", 360);
  const eventName = sanitizeString(body.eventName || "pageview", 80) || "pageview";
  const sessionId = sanitizeString(body.sessionId || "", 120);
  const country = sanitizeString(request.headers.get("CF-IPCountry") || "", 24);

  try {
    await env.DB.prepare(
      "INSERT INTO page_events (id, domain, path, referrer, country, ip_hash, user_agent, device, event_name, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      crypto.randomUUID(),
      domain,
      path,
      referrer,
      country,
      ipHash,
      userAgent,
      deviceFromUserAgent(userAgent),
      eventName,
      sessionId,
      now,
    ).run();
  } catch (error) {
    console.warn("page event write failed", error);
    return json({ ok: true, stored: false }, 200, cors.headers);
  }

  return json({ ok: true, stored: true }, 200, cors.headers);
}

async function exchangeSupabaseSession(
  accessToken: string,
  env: Env,
  secure: boolean,
): Promise<{ ok: true; cookie: string } | { ok: false; status: number; error: string }> {
  if (!hasSupabaseConfig(env)) {
    return { ok: false, status: 503, error: "Supabase 尚未配置" };
  }

  const allowedEmails = parseAllowedEmails(env.DASHBOARD_ALLOWED_EMAILS);
  if (allowedEmails.size === 0) {
    return { ok: false, status: 503, error: "尚未配置 DASHBOARD_ALLOWED_EMAILS" };
  }

  const response = await fetch(`${String(env.SUPABASE_URL).replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY || "",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    return { ok: false, status: 401, error: "Supabase 登录态无效" };
  }

  const user = (await response.json()) as { email?: string };
  const email = String(user.email || "").toLowerCase();
  if (!email || !allowedEmails.has(email)) {
    return { ok: false, status: 403, error: "此邮箱未授权访问 Dashboard" };
  }

  return {
    ok: true,
    cookie: await createSessionCookie(env, secure),
  };
}

async function loadRawData(env: Env): Promise<RawDashboardData> {
  if (!env.DB) return seedData;

  try {
    const resources = await env.DB.prepare("SELECT * FROM resources ORDER BY type, name").all<Record<string, unknown>>();
    const metrics = await env.DB.prepare("SELECT * FROM metric_snapshots ORDER BY date").all<Record<string, unknown>>();
    const trends = await env.DB.prepare("SELECT * FROM trend_snapshots ORDER BY date").all<Record<string, unknown>>();
    const connectors = await env.DB.prepare("SELECT * FROM connectors ORDER BY platform").all<Record<string, unknown>>();
    const domains = await env.DB.prepare("SELECT * FROM domains ORDER BY domain").all<Record<string, unknown>>();
    const alerts = await env.DB.prepare("SELECT * FROM alerts WHERE status = 'open' ORDER BY created_at DESC").all<Record<string, unknown>>();
    const healthChecks = await queryOptional<Record<string, unknown>>(
      env.DB,
      "SELECT * FROM health_checks ORDER BY name",
    );
    const trafficRows = await queryOptional<Record<string, unknown>>(
      env.DB,
      "SELECT * FROM traffic_breakdowns ORDER BY kind, value DESC",
    );
    const pageEventBreakdowns = await loadPageEventBreakdowns(env.DB);

    if (!resources.results.length) {
      return {
        ...seedData,
        authProviders: defaultAuthProviders(hasSupabaseConfig(env)),
      };
    }

    const storedBreakdowns = trafficRows.map(mapTrafficBreakdown);

    return {
      generatedAt: new Date().toISOString(),
      sourceLabel: "真实数据",
      resources: [...resources.results.map(mapResource), ...healthChecks.map(mapHealthcheckResource)],
      metrics: [...metrics.results.map(mapMetric), ...healthChecks.flatMap(mapHealthcheckMetrics)],
      connectors: connectors.results.map(mapConnector),
      trends: trends.results.length ? trends.results.map(mapTrend) : buildTrends(metrics.results.map(mapMetric)),
      domains: domains.results.map((row) => ({
        domain: String(row.domain),
        status: String(row.status || "active"),
        requests: Number(row.requests || 0),
        visits: Number(row.visits || 0),
        bytesMiB: Number(row.bytes_mib || 0),
        threats: Number(row.threats || 0),
        topDay: String(row.top_day || ""),
        hostnames: parseJson<string[]>(row.hostnames_json, []),
      })),
      alerts: alerts.results.map((row) => ({
        id: String(row.id),
        title: String(row.title),
        description: String(row.description || ""),
        severity: String(row.severity || "info") as "info" | "warning" | "critical",
        scopeType: String(row.scope_type || "global") as ScopeRef["type"],
        scopeId: String(row.scope_id || "global"),
        status: String(row.status || "open") as "open" | "resolved",
      })),
      trafficBreakdowns: mergeBreakdowns(storedBreakdowns.length ? storedBreakdowns : seedData.trafficBreakdowns, pageEventBreakdowns),
      authProviders: defaultAuthProviders(hasSupabaseConfig(env)),
    };
  } catch (error) {
    console.warn("D1 read failed; using seed snapshot", error);
    return {
      ...seedData,
      sourceLabel: "缓存快照",
      authProviders: defaultAuthProviders(hasSupabaseConfig(env)),
    };
  }
}

async function runMonitoring(env: Env): Promise<void> {
  await Promise.all([syncCloudflare(env), runHealthChecks(env)]);
}

async function syncCloudflare(env: Env): Promise<void> {
  const startedAt = new Date().toISOString();

  if (!env.DB) return;

  try {
    if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
      throw new Error("缺少 CF_ACCOUNT_ID 或 CF_API_TOKEN");
    }

    const collected = await collectCloudflare(env);
    await writeRawData(env.DB, collected);
    await env.DB.prepare(
      "INSERT INTO sync_runs (id, connector, status, started_at, finished_at, message) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(crypto.randomUUID(), "Cloudflare", "success", startedAt, new Date().toISOString(), "同步完成").run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await env.DB.prepare(
      "INSERT INTO sync_runs (id, connector, status, started_at, finished_at, message) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(crypto.randomUUID(), "Cloudflare", "failed", startedAt, new Date().toISOString(), message).run();
    await env.DB.prepare(
      "INSERT INTO alerts (id, title, description, severity, scope_type, scope_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      crypto.randomUUID(),
      "Cloudflare 同步失败",
      message,
      "warning",
      "global",
      "global",
      "open",
      new Date().toISOString(),
    ).run();
  }
}

async function runHealthChecks(env: Env): Promise<void> {
  if (!env.DB) return;

  for (const target of parseHealthcheckTargets(env.HEALTHCHECK_TARGETS)) {
    const startedAt = Date.now();
    let status: "up" | "down" = "down";
    let httpStatus = 0;
    let errorMessage = "";

    try {
      const response = await fetch(target.url, {
        headers: { "User-Agent": "8xd-dashboard-health/1.0" },
        signal: AbortSignal.timeout(8_000),
      });
      httpStatus = response.status;
      const body = (await response.json().catch(() => null)) as HealthResponseBody;
      status = isHealthyResponse(response.ok, body) ? "up" : "down";
      if (status === "down") errorMessage = `HTTP ${response.status}`;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    const checkedAt = new Date().toISOString();
    const responseMs = Date.now() - startedAt;
    await env.DB.prepare(
      "INSERT INTO health_checks (id, name, url, project_key, domain, status, http_status, response_ms, error, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, url = excluded.url, project_key = excluded.project_key, domain = excluded.domain, status = excluded.status, http_status = excluded.http_status, response_ms = excluded.response_ms, error = excluded.error, checked_at = excluded.checked_at",
    ).bind(
      target.id,
      target.name,
      target.url,
      target.projectKey,
      target.domain,
      status,
      httpStatus,
      responseMs,
      errorMessage,
      checkedAt,
    ).run();
    await env.DB.prepare(
      "INSERT INTO health_check_runs (id, target_id, status, http_status, response_ms, error, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(crypto.randomUUID(), target.id, status, httpStatus, responseMs, errorMessage, checkedAt).run();

    const alertId = `health-check-${target.id}`;
    if (status === "down") {
      await env.DB.prepare(
        "INSERT INTO alerts (id, title, description, severity, scope_type, scope_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?) ON CONFLICT(id) DO UPDATE SET description = excluded.description, severity = excluded.severity, status = 'open', created_at = excluded.created_at",
      ).bind(
        alertId,
        `${target.name} 健康检查失败`,
        `${target.url} · ${errorMessage || `HTTP ${httpStatus}`} · ${responseMs}ms`,
        "critical",
        "hostname",
        new URL(target.url).hostname,
        checkedAt,
      ).run();
    } else {
      await env.DB.prepare("UPDATE alerts SET status = 'resolved' WHERE id = ?").bind(alertId).run();
    }
  }

  await env.DB.prepare("DELETE FROM health_check_runs WHERE checked_at < datetime('now', '-30 days')").run();
}

type HealthResponseBody = { ok?: boolean; data?: { ok?: boolean } } | null;

export function isHealthyResponse(responseOk: boolean, body: HealthResponseBody): boolean {
  return responseOk && (body?.ok === true || body?.data?.ok === true);
}

async function collectCloudflare(env: Env): Promise<RawDashboardData> {
  const [zones, pages, workers, workerDomains, d1, r2, kv, queues, vectorize] = await Promise.all([
    cfRest<{ id: string; name: string; status: string; plan?: { name?: string } }[]>(env, "/zones", { per_page: "100" }),
    cfRest<Record<string, unknown>[]>(env, `/accounts/${env.CF_ACCOUNT_ID}/pages/projects`),
    cfRest<Record<string, unknown>[]>(env, `/accounts/${env.CF_ACCOUNT_ID}/workers/scripts`),
    cfRest<WorkerDomainBinding[]>(env, `/accounts/${env.CF_ACCOUNT_ID}/workers/domains`),
    cfRest<Record<string, unknown>[]>(env, `/accounts/${env.CF_ACCOUNT_ID}/d1/database`),
    cfRest<{ buckets?: { name: string; creation_date?: string }[] }>(env, `/accounts/${env.CF_ACCOUNT_ID}/r2/buckets`),
    cfRest<Record<string, unknown>[]>(env, `/accounts/${env.CF_ACCOUNT_ID}/storage/kv/namespaces`, { per_page: "100" }),
    cfRest<Record<string, unknown>[]>(env, `/accounts/${env.CF_ACCOUNT_ID}/queues`, { per_page: "100" }),
    cfRest<Record<string, unknown>[]>(env, `/accounts/${env.CF_ACCOUNT_ID}/vectorize/v2/indexes`),
  ]);

  const resources = normalizeResources({ zones, pages, workers, workerDomains, d1, r2, kv, queues, vectorize });
  const domainMetrics = await collectDomainMetrics(env, zones, resources);
  const accountMetrics = await collectAccountMetrics(env);

  return {
    generatedAt: new Date().toISOString(),
    sourceLabel: "真实数据",
    resources,
    metrics: [...domainMetrics.metrics, ...accountMetrics],
    connectors: [
      { platform: "Cloudflare", status: "connected", real: true, lastSyncedAt: new Date().toISOString() },
      {
        platform: "Supabase",
        status: hasSupabaseConfig(env) ? "connected" : "planned",
        real: hasSupabaseConfig(env),
        message: hasSupabaseConfig(env) ? "已配置邮箱免密 / Google OAuth 入口" : "Free 计划可用，待配置 URL、publishable key 和允许邮箱",
      },
      { platform: "Firebase", status: "disconnected", real: false, message: "Spark 可免费用 Auth；Dashboard 暂不接入，避免 GCP/Blaze 按量计费风险" },
      { platform: "Google Cloud", status: "planned", real: false },
    ],
    trends: domainMetrics.trends,
    domains: domainMetrics.domains,
    alerts: [],
    trafficBreakdowns: mergeBreakdowns(domainMetrics.trafficBreakdowns, []),
    authProviders: defaultAuthProviders(hasSupabaseConfig(env)),
  };
}

async function cfRest<T>(env: Env, path: string, query?: Record<string, string>): Promise<T> {
  const url = new URL(`https://api.cloudflare.com/client/v4${path}`);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
  });
  const jsonBody = (await response.json()) as { success: boolean; result: T; errors?: { message: string }[] };
  if (!response.ok || !jsonBody.success) {
    throw new Error(jsonBody.errors?.map((error) => error.message).join("; ") || `Cloudflare API ${response.status}`);
  }
  return jsonBody.result;
}

async function cfGraphql<T>(env: Env, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (!response.ok || body.errors?.length) {
    throw new Error(body.errors?.map((error) => error.message).join("; ") || `Cloudflare GraphQL ${response.status}`);
  }
  return body.data as T;
}

async function collectDomainMetrics(
  env: Env,
  zones: { id: string; name: string; status: string }[],
  resources: ResourceRecord[],
): Promise<Pick<RawDashboardData, "metrics" | "trends" | "domains" | "trafficBreakdowns">> {
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const end = new Date().toISOString().slice(0, 10);
  const metrics: MetricRow[] = [];
  const domains: RawDashboardData["domains"] = [];
  const trafficBreakdowns: TrafficBreakdown[] = [];
  const trendsByDate = new Map<string, { requests: number; visits: number; errors: number }>();
  const trendPoints: RawDashboardData["trends"] = [];

  const query = `query ZoneHttp($zoneTag: string!, $start: Date!, $end: Date!) {
    viewer { zones(filter: { zoneTag: $zoneTag }) {
      httpRequests1dGroups(limit: 100, filter: { date_geq: $start, date_leq: $end }, orderBy: [date_ASC]) {
        dimensions { date }
        sum { requests bytes threats pageViews responseStatusMap { edgeResponseStatus requests } }
      }
    }}
  }`;

  for (const zone of zones) {
    const data = await cfGraphql<{
      viewer: { zones: { httpRequests1dGroups: { dimensions: { date: string }; sum: { requests: number; bytes: number; threats: number; pageViews: number; responseStatusMap: { edgeResponseStatus: number; requests: number }[] } }[] }[] };
    }>(env, query, { zoneTag: zone.id, start, end });

    const rows = data.viewer.zones[0]?.httpRequests1dGroups ?? [];
    const total = rows.reduce(
      (acc, row) => {
        acc.requests += row.sum.requests || 0;
        acc.bytes += row.sum.bytes || 0;
        acc.threats += row.sum.threats || 0;
        acc.pageViews += row.sum.pageViews || 0;
        const dayErrors = (row.sum.responseStatusMap || [])
          .filter((status) => status.edgeResponseStatus >= 500)
          .reduce((sum, status) => sum + (status.requests || 0), 0);
        const trend = trendsByDate.get(row.dimensions.date.slice(5)) ?? { requests: 0, visits: 0, errors: 0 };
        trend.requests += row.sum.requests || 0;
        trend.visits += row.sum.pageViews || 0;
        trend.errors += dayErrors;
        trendsByDate.set(row.dimensions.date.slice(5), trend);
        trendPoints.push({
          date: row.dimensions.date.slice(5),
          requests: row.sum.requests || 0,
          visits: row.sum.pageViews || 0,
          errors: dayErrors,
          scopeType: "domain",
          scopeId: zone.name,
        });
        return acc;
      },
      { requests: 0, bytes: 0, threats: 0, pageViews: 0 },
    );

    metrics.push(metric("requests", "请求数", total.requests, "次", "domain", zone.name));
    metrics.push(metric("visits", "访问量", total.pageViews, "次", "domain", zone.name));
    metrics.push(metric("threats", "威胁数", total.threats, "次", "domain", zone.name));
    const hostnames = hostnamesForDomain(zone.name, resources);
    // 免费计划的 host 维度明细只支持 ≤24h 窗口：用近 24h 的真实 host 分布
    // 把 30 天根域名总量按比例外推到各子域名，比无脑均分可信得多。
    const hostDistribution = await collectHostDistribution(env, zone);
    const distributionTotal = [...hostDistribution.values()].reduce((sum, count) => sum + count, 0);
    for (const hostname of hostnames) {
      const share = distributionTotal > 0
        ? (hostDistribution.get(hostname) ?? 0) / distributionTotal
        : 1 / Math.max(hostnames.length, 1);
      metrics.push(metric("requests", "请求数", Math.round(total.requests * share), "次", "hostname", hostname, "estimated"));
      metrics.push(metric("visits", "访问量", Math.round(total.pageViews * share), "次", "hostname", hostname, "estimated"));
    }
    domains.push({
      domain: zone.name,
      status: zone.status,
      requests: total.requests,
      visits: total.pageViews,
      bytesMiB: Math.round((total.bytes / 1024 / 1024) * 10) / 10,
      threats: total.threats,
      topDay: rows.slice().sort((a, b) => b.sum.requests - a.sum.requests)[0]?.dimensions.date ?? "",
      hostnames,
    });
    trafficBreakdowns.push(...(await collectZoneTrafficBreakdowns(env, zone, total.requests, total.pageViews, hostnames)));
  }

  return {
    metrics,
    domains,
    trends: [
      ...[...trendsByDate.entries()].map(([date, values]) => ({
        date,
        ...values,
        scopeType: "global" as const,
        scopeId: "global",
      })),
      ...trendPoints,
    ],
    trafficBreakdowns,
  };
}

async function collectAccountMetrics(env: Env): Promise<MetricRow[]> {
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const end = new Date().toISOString().slice(0, 10);
  const query = `query AccountUsage($accountTag: string!, $start: Date!, $end: Date!) {
    viewer { accounts(filter: { accountTag: $accountTag }) {
      workersInvocationsAdaptive(limit: 10000, filter: { date_geq: $start, date_leq: $end }) {
        sum { requests errors duration cpuTimeUs }
        dimensions { scriptName }
      }
      r2StorageAdaptiveGroups(limit: 10000, filter: { date_geq: $start, date_leq: $end }) { dimensions { bucketName } max { objectCount payloadSize } }
      r2OperationsAdaptiveGroups(limit: 10000, filter: { date_geq: $start, date_leq: $end }) { dimensions { bucketName } sum { requests } }
      kvStorageAdaptiveGroups(limit: 10000, filter: { date_geq: $start, date_leq: $end }) { dimensions { namespaceId } max { keyCount byteCount } }
      kvOperationsAdaptiveGroups(limit: 10000, filter: { date_geq: $start, date_leq: $end }) { dimensions { namespaceId } sum { requests } }
    }}
  }`;
  const data = await cfGraphql<{
    viewer: { accounts: {
      workersInvocationsAdaptive: { sum: { requests: number; errors: number; duration: number; cpuTimeUs: number }; dimensions: { scriptName: string } }[];
      r2StorageAdaptiveGroups: { dimensions: { bucketName: string }; max: { objectCount: number; payloadSize: number } }[];
      r2OperationsAdaptiveGroups: { dimensions: { bucketName: string }; sum: { requests: number } }[];
      kvStorageAdaptiveGroups: { dimensions: { namespaceId: string }; max: { keyCount: number; byteCount: number } }[];
      kvOperationsAdaptiveGroups: { dimensions: { namespaceId: string }; sum: { requests: number } }[];
    }[] };
  }>(env, query, { accountTag: env.CF_ACCOUNT_ID, start, end });

  const account = data.viewer.accounts[0];
  const metrics: MetricRow[] = [];

  // Workers：请求 / 错误 / CPU 时间 / 总耗时，全部来自 workersInvocationsAdaptive 真实数据
  const byScript = new Map<string, { requests: number; errors: number; duration: number; cpuTimeUs: number }>();
  for (const row of account.workersInvocationsAdaptive) {
    const name = row.dimensions.scriptName || "unknown";
    const acc = byScript.get(name) ?? { requests: 0, errors: 0, duration: 0, cpuTimeUs: 0 };
    acc.requests += row.sum.requests || 0;
    acc.errors += row.sum.errors || 0;
    acc.duration += row.sum.duration || 0;
    acc.cpuTimeUs += row.sum.cpuTimeUs || 0;
    byScript.set(name, acc);
  }
  for (const [scriptName, sums] of byScript) {
    const resourceId = workerResourceId(scriptName);
    metrics.push(metric("workerRequests", "Worker 请求", sums.requests, "次", "resource", resourceId));
    metrics.push(metric("requests", "请求数", sums.requests, "次", "resource", resourceId));
    metrics.push(metric("workerErrors", "Worker 错误", sums.errors, "次", "resource", resourceId));
    metrics.push(metric("workerCpuMs", "CPU 时间", Math.round(sums.cpuTimeUs / 1000), "ms", "resource", resourceId));
    metrics.push(metric("workerWallMs", "总耗时", Math.round(sums.duration * 1000), "ms", "resource", resourceId));
  }

  // R2：按桶存储 / 对象数 / 操作数
  for (const row of account.r2StorageAdaptiveGroups) {
    const resourceId = r2ResourceId(row.dimensions.bucketName);
    metrics.push(metric("r2Storage", "R2 存储", Math.round(((row.max.payloadSize || 0) / 1024 / 1024) * 10) / 10, "MiB", "resource", resourceId));
    metrics.push(metric("r2Objects", "R2 对象数", row.max.objectCount || 0, "个", "resource", resourceId));
  }
  const r2OpsByBucket = new Map<string, number>();
  for (const row of account.r2OperationsAdaptiveGroups) {
    const bucket = row.dimensions.bucketName || "unknown";
    r2OpsByBucket.set(bucket, (r2OpsByBucket.get(bucket) ?? 0) + (row.sum.requests || 0));
  }
  for (const [bucket, operations] of r2OpsByBucket) {
    metrics.push(metric("r2Operations", "R2 操作", operations, "次", "resource", r2ResourceId(bucket)));
  }

  // KV：按 namespace 键数 / 容量 / 操作数
  for (const row of account.kvStorageAdaptiveGroups) {
    const resourceId = kvResourceId(row.dimensions.namespaceId);
    metrics.push(metric("kvKeys", "KV 键数量", row.max.keyCount || 0, "个", "resource", resourceId));
    metrics.push(metric("kvStorageKiB", "KV 存储", Math.round(((row.max.byteCount || 0) / 1024) * 10) / 10, "KiB", "resource", resourceId));
  }
  for (const row of account.kvOperationsAdaptiveGroups) {
    metrics.push(metric("kvOperations", "KV 操作", row.sum.requests || 0, "次", "resource", kvResourceId(row.dimensions.namespaceId)));
  }

  return metrics;
}

async function collectZoneTrafficBreakdowns(
  env: Env,
  zone: { id: string; name: string },
  totalRequests: number,
  totalVisits: number,
  hostnames: string[],
): Promise<TrafficBreakdown[]> {
  // 免费计划限制：httpRequestsAdaptiveGroups 明细查询窗口 ≤24h，
  // clientRequestReferer 维度无权限（Referer 归因改由浏览器埋点承担）。
  const [countries, hosts, paths, devices, userAgents] = await Promise.all([
    collectGraphqlBreakdown(env, zone, "country", "clientCountryName", "未知地区", "requests", 10),
    collectGraphqlBreakdown(env, zone, "host", "clientRequestHTTPHost", zone.name, "requests", 12),
    collectGraphqlBreakdown(env, zone, "path", "clientRequestPath", "/", "requests", 12),
    collectGraphqlBreakdown(env, zone, "agent", "clientDeviceType", "未知设备", "requests", 8),
    collectGraphqlBreakdown(env, zone, "aiAgent", "userAgent", "未知 User-Agent", "requests", 40),
  ]);
  const identityRows = buildIdentityBreakdowns(zone.name, userAgents, [], "Cloudflare 近 24 小时 User-Agent 采样");

  const rows = [
    ...countries,
    ...normalizeHostRows(hosts, zone.name),
    ...paths,
    ...devices.map((row) => ({ ...row, label: deviceLabel(row.label) })),
    ...identityRows,
  ];

  if (rows.length > 0) {
    rows.push(
      breakdown(
        `event-${zone.name}-cloudflare-pageviews`,
        "domain",
        zone.name,
        "event",
        "Cloudflare Web Analytics pageViews",
        totalVisits,
        "views",
        "real",
        "Cloudflare Web Analytics 访问量，比根域名 HTTP 请求更接近真实页面浏览。",
      ),
    );
    return rows;
  }

  return estimateZoneBreakdowns(zone.name, totalRequests, totalVisits, hostnames);
}

async function collectGraphqlBreakdown(
  env: Env,
  zone: { id: string; name: string },
  kind: TrafficBreakdown["kind"],
  dimensionField: string,
  fallbackLabel: string,
  unit: TrafficBreakdown["unit"],
  limit = 8,
): Promise<TrafficBreakdown[]> {
  // 免费计划的明细维度最多支持 1 天窗口；取近 23 小时保守规避时钟偏差。
  const since = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
  const until = new Date().toISOString();
  const query = `query ZoneBreakdown($zoneTag: string!, $since: Time!, $until: Time!) {
    viewer { zones(filter: { zoneTag: $zoneTag }) {
      httpRequestsAdaptiveGroups(limit: ${limit}, filter: { datetime_geq: $since, datetime_leq: $until }, orderBy: [count_DESC]) {
        count
        dimensions { ${dimensionField} }
      }
    }}
  }`;

  try {
    const data = await cfGraphql<{
      viewer: { zones: { httpRequestsAdaptiveGroups: { count: number; dimensions: Record<string, unknown> }[] }[] };
    }>(env, query, { zoneTag: zone.id, since, until });
    const rows = data.viewer.zones[0]?.httpRequestsAdaptiveGroups ?? [];
    return rows
      .map((row, index) =>
        breakdown(
          `${kind}-${zone.name}-${index}-${slug(String(row.dimensions[dimensionField] || fallbackLabel))}`,
          "domain",
          zone.name,
          kind,
          String(row.dimensions[dimensionField] || fallbackLabel),
          row.count || 0,
          unit,
          "real",
          "来自 Cloudflare GraphQL 近 24 小时请求采样（免费计划明细窗口上限 1 天）。",
        ),
      )
      .filter((row) => row.value > 0);
  } catch (error) {
    console.warn(`Cloudflare breakdown skipped for ${zone.name}:${dimensionField}`, error);
    return [];
  }
}

/** 近 24h 各 hostname 的真实请求分布，用于把 30 天根域名总量按比例外推到子域名 */
async function collectHostDistribution(env: Env, zone: { id: string; name: string }): Promise<Map<string, number>> {
  const rows = await collectGraphqlBreakdown(env, zone, "host", "clientRequestHTTPHost", zone.name, "requests", 20);
  const distribution = new Map<string, number>();
  for (const row of rows) {
    const hostname = normalizeHostLabel(row.label);
    if (hostname !== zone.name && !hostname.endsWith(`.${zone.name}`)) continue;
    distribution.set(hostname, (distribution.get(hostname) ?? 0) + row.value);
  }
  return distribution;
}

/** 去掉端口后缀并合并（jovlo.8xd.io:8080 → jovlo.8xd.io），过滤伪造/外部 Host */
function normalizeHostRows(rows: TrafficBreakdown[], zoneName: string): TrafficBreakdown[] {
  const merged = new Map<string, TrafficBreakdown>();
  for (const row of rows) {
    const label = normalizeHostLabel(row.label);
    if (label !== zoneName && !label.endsWith(`.${zoneName}`)) continue;
    const existing = merged.get(label);
    if (existing) {
      existing.value += row.value;
    } else {
      merged.set(label, { ...row, label });
    }
  }
  return [...merged.values()];
}

function normalizeHostLabel(value: string): string {
  return value.toLowerCase().replace(/:\d+$/, "");
}

function estimateZoneBreakdowns(
  domain: string,
  totalRequests: number,
  totalVisits: number,
  hostnames: string[],
): TrafficBreakdown[] {
  const rows: TrafficBreakdown[] = [];
  const add = (
    id: string,
    kind: TrafficBreakdown["kind"],
    label: string,
    ratio: number,
    helper: string,
  ) => {
    rows.push(
      breakdown(id, "domain", domain, kind, label, Math.round(totalRequests * ratio), "requests", "estimated", helper),
    );
  };

  add(`country-${domain}-cn`, "country", "中国大陆", 0.39, "按 Cloudflare 总请求与常见访问地区估算，后续可由 Logpush 校准。");
  add(`country-${domain}-us`, "country", "美国", 0.16, "常见搜索、AI Agent、监控与代理出口。");
  add(`country-${domain}-sg`, "country", "新加坡", 0.08, "常见 CDN、代理和搜索出口。");
  add(`country-${domain}-other`, "country", "其它地区", 0.37, "剩余地区合并展示。");
  add(`path-${domain}-home`, "path", "/", 0.36, "首页、首屏资源和预览抓取。");
  add(`path-${domain}-assets`, "path", "/_astro / assets", 0.19, "JS、CSS、图片等静态资源请求。");
  add(`path-${domain}-news`, "path", "/news", 0.2, "新闻列表、文章页和对应资源。");
  add(`path-${domain}-practice`, "path", "/practice", 0.13, "业务领域页面。");
  add(`path-${domain}-other`, "path", "其它页面", 0.12, "关于、案例、联系等页面。");
  add(`ref-${domain}-direct`, "referrer", "直接访问 / 无 Referer", 0.43, "直接打开、App 内打开、隐私浏览器和部分机器人会缺少 Referer。");
  add(`ref-${domain}-search`, "referrer", "搜索引擎", 0.25, "Google、Bing、百度、搜狗等搜索或爬虫相关请求。");
  add(`ref-${domain}-social`, "referrer", "微信 / 社交预览", 0.1, "分享卡片抓取和 App 内浏览。");
  add(`ref-${domain}-agent`, "referrer", "Agent / 工具请求", 0.13, "AI Agent、监控、预览器、SEO 工具和脚本请求。");
  add(`ref-${domain}-other`, "referrer", "其它来源", 0.09, "剩余来源合并。");
  // 注意：这里不再生成 aiAgent / source 维度的估算行。AI 厂商归因只基于真实
  // User-Agent / Referer 采样，拿不到明细时对应面板显示"等待采集"，不编造比例。
  rows.push(
    breakdown(
      `agent-${domain}-browser`,
      "domain",
      domain,
      "agent",
      "浏览器页面访问",
      totalVisits,
      "requests",
      "estimated",
      "Cloudflare pageViews 更接近真实浏览，但仍可能包含部分预览器。",
    ),
    breakdown(
      `agent-${domain}-static`,
      "domain",
      domain,
      "agent",
      "静态资源加载",
      Math.max(totalRequests - totalVisits, 0),
      "requests",
      "estimated",
      "一次页面访问会触发多个资源请求。",
    ),
    breakdown(
      `event-${domain}-cloudflare-pageviews`,
      "domain",
      domain,
      "event",
      "Cloudflare Web Analytics pageViews",
      totalVisits,
      "views",
      "real",
      "Cloudflare 统计的页面访问量。",
    ),
  );

  for (const hostname of hostnames) {
    rows.push(
      breakdown(
        `host-${domain}-${slug(hostname)}`,
        "domain",
        domain,
        "host",
        hostname,
        Math.round(totalRequests / Math.max(hostnames.length, 1)),
        "requests",
        "estimated",
        "Cloudflare 当前根域名汇总可用，hostname 拆分等待更细维度数据。",
      ),
    );
  }

  return rows;
}

function breakdown(
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
    label: sanitizeString(label, 180) || "未知",
    value,
    unit,
    source,
    helper,
    date: new Date().toISOString().slice(0, 10),
  };
}

export function normalizeResources(input: {
  zones: { id: string; name: string; status: string }[];
  pages: Record<string, unknown>[];
  workers: Record<string, unknown>[];
  workerDomains: WorkerDomainBinding[];
  d1: Record<string, unknown>[];
  r2: { buckets?: { name: string }[] };
  kv: Record<string, unknown>[];
  queues: Record<string, unknown>[];
  vectorize: Record<string, unknown>[];
}): ResourceRecord[] {
  const resources: ResourceRecord[] = [];
  for (const zone of input.zones) {
    resources.push({
      id: `zone-${zone.id}`,
      platform: "Cloudflare",
      type: "zone",
      name: zone.name,
      status: zone.status === "active" ? "active" : "inactive",
      projectKey: inferProject(zone.name),
      domain: zone.name,
      hostnames: [zone.name],
      shared: false,
    });
  }
  for (const project of input.pages) {
    const name = String(project.name);
    const domains = Array.isArray(project.domains) ? project.domains.map(String) : [];
    resources.push({
      id: `pages-${name}`,
      platform: "Cloudflare",
      type: "pages",
      name,
      status: "active",
      projectKey: inferProject(domains[0] || name),
      domain: domains.find((item) => !item.endsWith(".pages.dev")),
      hostnames: domains,
      shared: false,
    });
  }
  for (const script of input.workers) {
    const name = String(script.id);
    const domains = input.workerDomains.filter((item) => item.service === name);
    const hostnames = domains.map((item) => item.hostname).sort();
    const domain = domains[0]?.zone_name || (name.includes("share-pages") ? "8xd.io" : undefined);
    resources.push({
      id: workerResourceId(name),
      platform: "Cloudflare",
      type: "worker",
      name,
      status: "active",
      projectKey: inferProject(hostnames[0] || name),
      domain,
      hostnames: hostnames.length ? hostnames : name.includes("share-pages") ? ["share-pages.8xd.io"] : [],
      shared: false,
    });
  }
  for (const bucket of input.r2.buckets ?? []) {
    resources.push({
      id: r2ResourceId(bucket.name),
      platform: "Cloudflare",
      type: "r2",
      name: bucket.name,
      status: "active",
      projectKey: bucket.name.includes("share-pages") ? "shared" : "uncategorized",
      domain: bucket.name.includes("share-pages") ? "8xd.io" : undefined,
      hostnames: bucket.name.includes("share-pages") ? ["share-pages.8xd.io", "dashboard.8xd.io"] : [],
      shared: true,
    });
  }
  for (const namespace of input.kv) {
    resources.push({
      id: kvResourceId(String(namespace.id)),
      platform: "Cloudflare",
      type: "kv",
      name: String(namespace.title || namespace.id),
      status: "active",
      projectKey: String(namespace.title || "").includes("SHARE_PAGES") ? "share-pages" : "uncategorized",
      domain: String(namespace.title || "").includes("SHARE_PAGES") ? "8xd.io" : undefined,
      hostnames: String(namespace.title || "").includes("SHARE_PAGES") ? ["share-pages.8xd.io"] : [],
      shared: false,
    });
  }
  addCloudflareRows(resources, input.d1, "d1", "D1");
  addCloudflareRows(resources, input.queues, "queue", "Queues");
  addCloudflareRows(resources, input.vectorize, "vectorize", "Vectorize");
  return resources;
}

function addCloudflareRows(
  resources: ResourceRecord[],
  rows: Record<string, unknown>[],
  type: ResourceRecord["type"],
  emptyName: string,
): void {
  if (rows.length > 0) {
    for (const row of rows) {
      const name = resourceField(row, ["name", "database_name", "queue_name", "title"], emptyName);
      const externalId = resourceField(row, ["uuid", "id", "queue_id", "name"], name);
      resources.push({
        id: `${type}-${externalId}`,
        platform: "Cloudflare",
        type,
        name,
        status: "active",
        projectKey: "uncategorized",
        hostnames: [],
        shared: false,
        metadata: row,
      });
    }
    return;
  }

  resources.push({
    id: `${type}-empty`,
    platform: "Cloudflare",
    type,
    name: emptyName,
    status: "empty",
    projectKey: "uncategorized",
    hostnames: [],
    shared: false,
    metadata: { emptyLabel: "暂无资源" },
  });
}

function resourceField(row: Record<string, unknown>, keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

function hostnamesForDomain(domain: string, resources: ResourceRecord[]): string[] {
  const hostnames = new Set<string>([domain]);
  for (const resource of resources) {
    if (resource.domain === domain || resource.hostnames.some((hostname) => hostname === domain || hostname.endsWith(`.${domain}`))) {
      for (const hostname of resource.hostnames) {
        if (hostname === domain || hostname.endsWith(`.${domain}`)) hostnames.add(hostname);
      }
    }
  }
  return [...hostnames].sort();
}

async function writeRawData(db: D1Database, data: RawDashboardData): Promise<void> {
  const statements: D1PreparedStatement[] = [
    db.prepare("DELETE FROM resources"),
    db.prepare("DELETE FROM metric_snapshots"),
    db.prepare("DELETE FROM trend_snapshots"),
    db.prepare("DELETE FROM connectors"),
    db.prepare("DELETE FROM domains"),
    db.prepare("DELETE FROM traffic_breakdowns"),
  ];

  for (const resource of data.resources) {
    statements.push(db.prepare(
      "INSERT INTO resources (id, platform, type, name, status, project_key, domain, hostnames_json, shared, metadata_json, last_synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(resource.id, resource.platform, resource.type, resource.name, resource.status, resource.projectKey, resource.domain ?? null, JSON.stringify(resource.hostnames), resource.shared ? 1 : 0, JSON.stringify(resource.metadata ?? {}), resource.lastSyncedAt ?? data.generatedAt));
  }
  for (const row of data.metrics) {
    statements.push(db.prepare(
      "INSERT INTO metric_snapshots (id, metric_key, label, value, unit, range, date, scope_type, scope_id, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(crypto.randomUUID(), row.key, row.label, row.value, row.unit, row.range, row.date, row.scopeType, row.scopeId, row.source));
  }
  for (const row of data.trends) {
    statements.push(db.prepare(
      "INSERT INTO trend_snapshots (id, date, requests, visits, errors, scope_type, scope_id, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      crypto.randomUUID(),
      row.date,
      row.requests,
      row.visits,
      row.errors,
      row.scopeType ?? "global",
      row.scopeId ?? "global",
      "real",
    ));
  }
  for (const connector of data.connectors) {
    statements.push(db.prepare(
      "INSERT INTO connectors (platform, status, real, last_synced_at, message) VALUES (?, ?, ?, ?, ?)",
    ).bind(connector.platform, connector.status, connector.real ? 1 : 0, connector.lastSyncedAt ?? null, connector.message ?? null));
  }
  for (const domain of data.domains) {
    statements.push(db.prepare(
      "INSERT INTO domains (domain, status, requests, visits, bytes_mib, threats, top_day, hostnames_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(domain.domain, domain.status, domain.requests, domain.visits, domain.bytesMiB, domain.threats, domain.topDay, JSON.stringify(domain.hostnames)));
  }
  for (const row of data.trafficBreakdowns) {
    statements.push(db.prepare(
      "INSERT INTO traffic_breakdowns (id, scope_type, scope_id, kind, label, value, unit, source, helper, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(row.id, row.scopeType, row.scopeId, row.kind, row.label, row.value, row.unit, row.source, row.helper ?? null, row.date ?? data.generatedAt.slice(0, 10)));
  }
  await db.batch(statements);
}

function metric(
  key: string,
  label: string,
  value: number,
  unit: string,
  scopeType: ScopeRef["type"],
  scopeId: string,
  source: MetricSource = "real",
): MetricRow {
  return {
    key,
    label,
    value,
    unit,
    range: "30d",
    date: new Date().toISOString().slice(0, 10),
    scopeType,
    scopeId,
    source,
  };
}

function mapResource(row: Record<string, unknown>): ResourceRecord {
  return {
    id: String(row.id),
    platform: "Cloudflare",
    type: String(row.type) as ResourceRecord["type"],
    name: String(row.name),
    status: String(row.status || "active") as ResourceRecord["status"],
    projectKey: String(row.project_key || "uncategorized"),
    domain: row.domain ? String(row.domain) : undefined,
    hostnames: parseJson<string[]>(row.hostnames_json, []),
    shared: Boolean(row.shared),
    metadata: parseJson<Record<string, unknown>>(row.metadata_json, {}),
    lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : undefined,
  };
}

function mapHealthcheckResource(row: Record<string, unknown>): ResourceRecord {
  const url = String(row.url);
  return {
    id: healthcheckResourceId(String(row.id)),
    platform: "Cloudflare",
    type: "connector",
    name: `${String(row.name)} 健康检查`,
    status: String(row.status) === "up" ? "active" : "error",
    projectKey: String(row.project_key || "uncategorized"),
    domain: String(row.domain || "") || undefined,
    hostnames: [new URL(url).hostname],
    shared: false,
    metadata: {
      url,
      status: String(row.status),
      httpStatus: Number(row.http_status || 0),
      responseMs: Number(row.response_ms || 0),
      error: String(row.error || ""),
    },
    lastSyncedAt: String(row.checked_at),
  };
}

function mapHealthcheckMetrics(row: Record<string, unknown>): MetricRow[] {
  const resourceId = healthcheckResourceId(String(row.id));
  const date = String(row.checked_at || new Date().toISOString()).slice(0, 10);
  return [
    {
      key: "availability",
      label: "可用率",
      value: String(row.status) === "up" ? 100 : 0,
      unit: "%",
      range: "24h",
      date,
      scopeType: "resource",
      scopeId: resourceId,
      source: "instrumented",
    },
    {
      key: "responseMs",
      label: "响应时间",
      value: Number(row.response_ms || 0),
      unit: "ms",
      range: "24h",
      date,
      scopeType: "resource",
      scopeId: resourceId,
      source: "instrumented",
    },
  ];
}

function mapMetric(row: Record<string, unknown>): MetricRow {
  return {
    key: String(row.metric_key),
    label: String(row.label),
    value: Number(row.value || 0),
    unit: String(row.unit || ""),
    range: String(row.range || "30d") as "24h" | "7d" | "30d",
    date: String(row.date),
    scopeType: String(row.scope_type) as ScopeRef["type"],
    scopeId: String(row.scope_id),
    source: String(row.source || "real") as "real" | "cached" | "unavailable",
  };
}

function mapTrafficBreakdown(row: Record<string, unknown>): TrafficBreakdown {
  return {
    id: String(row.id),
    scopeType: String(row.scope_type || "global") as ScopeRef["type"],
    scopeId: String(row.scope_id || "global"),
    kind: String(row.kind || "source") as TrafficBreakdown["kind"],
    label: String(row.label || "未知"),
    value: Number(row.value || 0),
    unit: String(row.unit || "requests") as TrafficBreakdown["unit"],
    source: String(row.source || "real") as MetricSource,
    helper: row.helper ? String(row.helper) : undefined,
    date: row.date ? String(row.date) : undefined,
  };
}

function mapTrend(row: Record<string, unknown>) {
  return {
    date: String(row.date),
    requests: Number(row.requests || 0),
    visits: Number(row.visits || 0),
    errors: Number(row.errors || 0),
    scopeType: String(row.scope_type || "global") as ScopeRef["type"],
    scopeId: String(row.scope_id || "global"),
  };
}

function mapConnector(row: Record<string, unknown>): Connector {
  return {
    platform: String(row.platform) as Connector["platform"],
    status: String(row.status || "disconnected") as Connector["status"],
    real: Boolean(row.real),
    lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : undefined,
    message: row.message ? String(row.message) : undefined,
  };
}

function buildTrends(metrics: MetricRow[]) {
  const byDate = new Map<string, { requests: number; visits: number; errors: number }>();
  for (const row of metrics) {
    const key = row.date.slice(5);
    const item = byDate.get(key) ?? { requests: 0, visits: 0, errors: 0 };
    if (row.key === "requests") item.requests += row.value;
    if (row.key === "visits") item.visits += row.value;
    if (row.key === "errors") item.errors += row.value;
    byDate.set(key, item);
  }
  return [...byDate.entries()].map(([date, values]) => ({ date, ...values }));
}

async function queryOptional<T>(db: D1Database, sql: string): Promise<T[]> {
  try {
    const rows = await db.prepare(sql).all<T>();
    return rows.results;
  } catch (error) {
    console.warn("optional D1 query skipped", error);
    return [];
  }
}

async function loadPageEventBreakdowns(db: D1Database): Promise<TrafficBreakdown[]> {
  const [countries, paths, referrers, devices, events, userAgents] = await Promise.all([
    queryOptional<Record<string, unknown>>(
      db,
      "SELECT CASE WHEN domain = 'www.fangliying.com' THEN 'fangliying.com' ELSE domain END AS scope_id, COALESCE(NULLIF(country, ''), '未知地区') AS label, COUNT(*) AS value FROM page_events WHERE created_at >= datetime('now', '-30 days') GROUP BY scope_id, label ORDER BY value DESC LIMIT 20",
    ),
    queryOptional<Record<string, unknown>>(
      db,
      "SELECT CASE WHEN domain = 'www.fangliying.com' THEN 'fangliying.com' ELSE domain END AS scope_id, COALESCE(NULLIF(path, ''), '/') AS label, COUNT(*) AS value FROM page_events WHERE created_at >= datetime('now', '-30 days') GROUP BY scope_id, label ORDER BY value DESC LIMIT 20",
    ),
    queryOptional<Record<string, unknown>>(
      db,
      "SELECT CASE WHEN domain = 'www.fangliying.com' THEN 'fangliying.com' ELSE domain END AS scope_id, COALESCE(NULLIF(referrer, ''), '直接访问 / 无 Referer') AS label, COUNT(*) AS value FROM page_events WHERE created_at >= datetime('now', '-30 days') GROUP BY scope_id, label ORDER BY value DESC LIMIT 20",
    ),
    queryOptional<Record<string, unknown>>(
      db,
      "SELECT CASE WHEN domain = 'www.fangliying.com' THEN 'fangliying.com' ELSE domain END AS scope_id, COALESCE(NULLIF(device, ''), '未知设备') AS label, COUNT(*) AS value FROM page_events WHERE created_at >= datetime('now', '-30 days') GROUP BY scope_id, label ORDER BY value DESC LIMIT 20",
    ),
    queryOptional<Record<string, unknown>>(
      db,
      "SELECT CASE WHEN domain = 'www.fangliying.com' THEN 'fangliying.com' ELSE domain END AS scope_id, COALESCE(NULLIF(event_name, ''), 'pageview') AS label, COUNT(*) AS value FROM page_events WHERE created_at >= datetime('now', '-30 days') GROUP BY scope_id, label ORDER BY value DESC LIMIT 20",
    ),
    queryOptional<Record<string, unknown>>(
      db,
      "SELECT CASE WHEN domain = 'www.fangliying.com' THEN 'fangliying.com' ELSE domain END AS scope_id, COALESCE(NULLIF(user_agent, ''), '未知 User-Agent') AS label, COUNT(*) AS value FROM page_events WHERE created_at >= datetime('now', '-30 days') GROUP BY scope_id, label ORDER BY value DESC LIMIT 20",
    ),
  ]);
  const identityRows = buildIdentityBreakdowns(
    "fangliying.com",
    mapEventRows(userAgents, "aiAgent", "events", false),
    mapEventRows(referrers, "referrer", "events", false),
    "律师主页 pageview beacon",
  );

  return [
    ...mapEventRows(countries, "country", "events"),
    ...mapEventRows(paths, "path", "events"),
    ...mapEventRows(referrers, "referrer", "events"),
    ...mapEventRows(devices, "agent", "events"),
    ...mapEventRows(events, "event", "views"),
    ...identityRows,
  ];
}

export function mapEventRows(
  rows: Record<string, unknown>[],
  kind: TrafficBreakdown["kind"],
  unit: TrafficBreakdown["unit"],
  simplify = true,
): TrafficBreakdown[] {
  return rows.map((row, index) => {
    const scopeId = String(row.scope_id || "fangliying.com");
    const rawLabel = String(row.label || "未知");
    const label = simplify && kind === "referrer" ? simplifyReferrer(rawLabel) : rawLabel;
    const scopeType = scopeId.split(".").length > 2 ? "hostname" : "domain";
    return breakdown(
      `event-${kind}-${scopeId}-${index}-${slug(label)}`,
      scopeType,
      scopeId,
      kind,
      label,
      Number(row.value || 0),
      unit,
      "instrumented",
      "来自浏览器端站内埋点，不包含被拦截的脚本、关闭 JS 的访问或纯资源请求。",
    );
  });
}

function buildIdentityBreakdowns(
  fallbackScopeId: string,
  userAgentRows: TrafficBreakdown[],
  referrerRows: TrafficBreakdown[],
  sourceDetail: string,
): TrafficBreakdown[] {
  const byIdentity = new Map<string, TrafficBreakdown>();
  const bySource = new Map<string, TrafficBreakdown>();

  for (const row of userAgentRows) {
    const identity = classifyTrafficIdentity({ userAgent: row.label });
    addIdentitySource(bySource, row, identity, sourceDetail);
    // aiAgent 面板只收 AI 身份；脚本/监控/搜索爬虫留在 source 构成里。
    if (identity.isAi) {
      addIdentitySource(byIdentity, row, identity, sourceDetail, "aiAgent");
    }
  }

  for (const row of referrerRows) {
    const identity = classifyTrafficIdentity({ referrer: row.label });
    if (identity.category === "unknown") continue;
    addIdentitySource(bySource, row, identity, sourceDetail);
    if (identity.isAi) {
      addIdentitySource(byIdentity, row, identity, sourceDetail, "aiAgent");
    }
  }

  if (byIdentity.size === 0 && bySource.size === 0 && fallbackScopeId) return [];
  return [...byIdentity.values(), ...bySource.values()];
}

function addIdentitySource(
  target: Map<string, TrafficBreakdown>,
  row: TrafficBreakdown,
  identity: TrafficIdentity,
  sourceDetail: string,
  kind: "aiAgent" | "source" = "source",
): void {
  const scopeId = row.scopeId || "fangliying.com";
  const label = kind === "aiAgent" ? identity.label : trafficBucketLabel(identity);
  const key = `${kind}:${scopeId}:${label}:${row.source}`;
  const helper = `${identity.detail} ${confidenceLabel(identity)}；数据源：${sourceDetail}。`;
  const existing = target.get(key);
  if (existing) {
    existing.value += row.value;
    return;
  }
  target.set(
    key,
    breakdown(
      `${kind}-${scopeId}-${row.source}-${slug(label)}`,
      "domain",
      scopeId,
      kind,
      label,
      row.value,
      row.unit,
      row.source,
      helper,
    ),
  );
}

function mergeBreakdowns(primary: TrafficBreakdown[], instrumented: TrafficBreakdown[]): TrafficBreakdown[] {
  if (instrumented.length === 0) return primary;
  return [
    ...primary,
    ...instrumented,
  ];
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function inferProject(value: string): string {
  if (value.includes("journey-wave")) return "journey-wave";
  if (value.includes("jovlo")) return "jovlo";
  if (value.includes("fangliying")) return "lawyer-homepage";
  if (value.includes("8xd") || value.includes("share-pages")) return "share-pages";
  return "uncategorized";
}

function workerResourceId(name: string): string {
  return name.includes("share-pages") ? "worker-share-pages" : `worker-${name}`;
}

function r2ResourceId(bucketName: string): string {
  const name = bucketName || "unknown";
  return name === "share-pages-content" ? "r2-share-pages-content" : `r2-${name}`;
}

function kvResourceId(namespaceId: string): string {
  // GraphQL 返回的 namespaceId 带连字符，REST 返回的不带，统一后再映射。
  const normalized = String(namespaceId || "").replace(/-/g, "");
  return normalized === "a38b5d84f6294c608b469f92d5cb6d61" ? "kv-share-pages-config" : `kv-${normalized}`;
}

function healthcheckResourceId(id: string): string {
  return `healthcheck-${id}`;
}

export function parseHealthcheckTargets(value: string | undefined): HealthcheckTarget[] {
  try {
    const parsed = JSON.parse(value || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const target = item as Record<string, unknown>;
      const id = String(target.id || "").trim();
      const name = String(target.name || "").trim();
      const url = String(target.url || "").trim();
      const projectKey = String(target.projectKey || "").trim();
      const domain = String(target.domain || "").trim();
      if (!/^[a-z0-9-]{1,80}$/.test(id) || !name || !projectKey || !domain) return [];
      if (!url.startsWith("https://")) return [];
      return [{ id, name, url, projectKey, domain }];
    });
  } catch {
    return [];
  }
}

function analyticsCors(request: Request, env: Env): { allowed: boolean; headers: HeadersInit } {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = new Set(
    (env.ANALYTICS_ALLOWED_ORIGINS || "https://fangliying.com,https://www.fangliying.com,http://127.0.0.1:4321,http://localhost:4321")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const allowed = !origin || allowedOrigins.has(origin);
  return {
    allowed,
    headers: {
      "Access-Control-Allow-Origin": allowed ? origin || "*" : "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    },
  };
}

function hasSupabaseConfig(env: Env): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY);
}

function parseAllowedEmails(value: string | undefined): Set<string> {
  return new Set(
    String(value || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function canonicalAnalyticsDomain(domain: string): string {
  if (domain === "www.fangliying.com") return "fangliying.com";
  return domain;
}

function isAllowedAnalyticsDomain(domain: string): boolean {
  return domain === "fangliying.com";
}

function sanitizeDomain(value: string): string {
  return sanitizeString(value, 120)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .replace(/:\d+$/, "");
}

function sanitizePath(value: string): string {
  const path = sanitizeString(value, 320);
  if (!path || !path.startsWith("/")) return "/";
  return path.split("?")[0] || "/";
}

function sanitizeString(value: string, maxLength: number): string {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
}

function simplifyReferrer(value: string): string {
  const trimmed = sanitizeString(value, 220);
  if (!trimmed) return "直接访问 / 无 Referer";
  if (trimmed === "直接访问 / 无 Referer" || trimmed === "无 Referer") return "直接访问 / 无 Referer";
  try {
    const hostname = new URL(trimmed).hostname.replace(/^www\./, "");
    if (/google|bing|baidu|sogou|so\.com|duckduckgo/i.test(hostname)) return "搜索引擎";
    if (/weixin|wechat|mp\.weixin|qq\.com|xiaohongshu|zhihu|douyin|tiktok/i.test(hostname)) return "微信 / 社交预览";
    return hostname || trimmed;
  } catch {
    if (/google|bing|baidu|sogou|search/i.test(trimmed)) return "搜索引擎";
    if (/weixin|wechat|social|share/i.test(trimmed)) return "微信 / 社交预览";
    return trimmed;
  }
}

function deviceLabel(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes("mobile")) return "移动端浏览器";
  if (normalized.includes("desktop")) return "桌面浏览器";
  if (normalized.includes("tablet")) return "平板浏览器";
  if (normalized.includes("bot") || normalized.includes("crawler") || normalized.includes("spider")) return "搜索/AI/监控 Agent";
  return value || "未知设备";
}

function deviceFromUserAgent(userAgent: string): string {
  const identity = classifyTrafficIdentity({ userAgent });
  if (identity.category !== "browser" && identity.category !== "unknown") {
    return identity.label;
  }
  if (/bot|crawler|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot/i.test(userAgent)) {
    return "搜索/AI/监控 Agent";
  }
  if (/mobile|iphone|android/i.test(userAgent)) return "移动端浏览器";
  if (/ipad|tablet/i.test(userAgent)) return "平板浏览器";
  if (userAgent) return "桌面浏览器";
  return "未知设备";
}

function slug(value: string): string {
  return sanitizeString(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

async function safeJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

function getTurnstileSiteKey(env: Env): string {
  return String(env.TURNSTILE_SITE_KEY || "");
}

function isTurnstileEnabled(env: Env): boolean {
  return (
    String(env.TURNSTILE_ENABLED || "").toLowerCase() === "true" &&
    Boolean(env.TURNSTILE_SITE_KEY) &&
    Boolean(env.TURNSTILE_SECRET)
  );
}

async function verifyTurnstile(
  request: Request,
  env: Env,
  token: string | undefined,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isTurnstileEnabled(env)) return { ok: true };

  if (!token) return { ok: false, error: "请先完成 Cloudflare 人类验证" };
  if (token.length > 2048) return { ok: false, error: "Cloudflare 验证无效，请刷新后重试" };

  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET || "");
  form.append("response", token);

  const remoteIp = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "";
  if (remoteIp) form.append("remoteip", remoteIp);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    const result = (await response.json()) as { success?: boolean; "error-codes"?: string[] };
    if (result.success) return { ok: true };
    console.warn("turnstile validation failed", result["error-codes"]);
    return { ok: false, error: "Cloudflare 人类验证失败，请刷新后重试" };
  } catch (error) {
    console.error("turnstile validation error", error);
    return { ok: false, error: "Cloudflare 人类验证失败，请稍后重试" };
  }
}

async function isAuthenticated(request: Request, env: Env): Promise<boolean> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || !env.DASHBOARD_AUTH_SECRET) return false;
  const [issuedAt, signature] = token.split(".");
  if (!issuedAt || !signature) return false;
  const age = Math.floor(Date.now() / 1000) - Number(issuedAt);
  if (!Number.isFinite(age) || age < 0 || age > SESSION_TTL_SECONDS) return false;
  return timingSafeEqual(signature, await sign(issuedAt, env.DASHBOARD_AUTH_SECRET));
}

async function createSessionCookie(env: Env, secure: boolean): Promise<string> {
  const issuedAt = String(Math.floor(Date.now() / 1000));
  const signature = await sign(issuedAt, env.DASHBOARD_AUTH_SECRET || "");
  return `${SESSION_COOKIE}=${issuedAt}.${signature}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure ? "; Secure" : ""}`;
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readCookie(request: Request, name: string): string | undefined {
  const cookie = request.headers.get("Cookie") || "";
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function normalizeRange(value: string | null): TimeRange {
  return value === "24h" || value === "7d" || value === "30d" ? value : "30d";
}

function normalizeScope(type: string | null, id: string | null): ScopeRef {
  if (type === "project" || type === "domain" || type === "hostname" || type === "resource") {
    return { type, id: id || "global" };
  }
  return { type: "global", id: "global" };
}

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

import {
  AlertTriangle,
  Activity,
  BarChart3,
  Bell,
  Box,
  CheckCircle2,
  ChevronRight,
  Cloud,
  CloudLightning,
  Database,
  Globe2,
  HardDrive,
  Home,
  Layers3,
  Link2,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  Scale,
  Server,
  Settings,
  Shield,
  Sparkles,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  apiModeLabel,
  exchangeExistingSupabaseSession,
  fetchDashboard,
  getAuthConfig,
  getSession,
  login,
  logout,
  sendSupabaseMagicLink,
  signOutSupabase,
  signInWithSupabaseGoogle,
  syncCloudflare,
  type AuthConfig,
} from "./api";
import {
  buildUrl,
  normalizeRoute,
  parseRoute,
  parseScope,
  routesEqual,
  scopeValue,
  type NavKey,
  type RouteState,
} from "./router";
import {
  clearSupabaseManualLogout,
  markSupabaseManualLogout,
  wasSupabaseManualLogout,
} from "./supabaseLogoutGuard";
import type { DashboardSnapshot, TimeRange, TrendPoint } from "../shared/snapshot";
import type { ConnectorCard, ResourceRecord, ScopeOption, ScopeRef, TrafficBreakdown } from "../shared/types";

interface NavItem {
  key: NavKey;
  label: string;
  hint?: string;
  icon: LucideIcon;
}

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: "概览",
    items: [
      { key: "overview", label: "总览", icon: Home },
      { key: "domains", label: "域名管理", icon: Globe2 },
    ],
  },
  {
    title: "站点监控",
    items: [
      { key: "lawyer", label: "律师主页", hint: "fangliying.com", icon: Scale },
      { key: "jovlo", label: "Jovlo.ai", hint: "jovlo.8xd.io", icon: Sparkles },
    ],
  },
  {
    title: "Cloudflare 资源",
    items: [
      { key: "cloudflare", label: "核心指标", icon: Cloud },
      { key: "workers", label: "Workers & Pages", icon: Server },
      { key: "storage", label: "存储", icon: HardDrive },
      { key: "database", label: "数据库与队列", icon: Database },
    ],
  },
  {
    title: "系统",
    items: [
      { key: "connectors", label: "连接器", icon: Link2 },
      { key: "alerts", label: "告警与日志", icon: Bell },
      { key: "settings", label: "设置", icon: Settings },
    ],
  },
];

const navTitles: Record<NavKey, string> = {
  overview: "总览",
  lawyer: "律师主页",
  jovlo: "Jovlo.ai",
  cloudflare: "Cloudflare 核心指标",
  domains: "域名管理",
  workers: "Workers & Pages",
  storage: "存储",
  database: "数据库与队列",
  connectors: "连接器",
  alerts: "告警与日志",
  settings: "设置",
};

const rangeLabels: Record<TimeRange, string> = {
  "24h": "近 24 小时",
  "7d": "近 7 天",
  "30d": "近 30 天",
};

const resourceTypeLabels: Record<ResourceRecord["type"], string> = {
  zone: "根域名",
  hostname: "子域名",
  pages: "Pages",
  worker: "Worker",
  r2: "R2 Bucket",
  kv: "KV Namespace",
  d1: "D1",
  queue: "Queues",
  vectorize: "Vectorize",
  connector: "健康检查",
};

const statusLabels: Record<ResourceRecord["status"], string> = {
  active: "正常",
  inactive: "停用",
  empty: "暂无资源",
  error: "异常",
  planned: "规划中",
};

const defaultAuthConfig: AuthConfig = {
  credentialUsername: "dashboard.8xd.io/admin",
  turnstileEnabled: false,
  turnstileSiteKey: "",
  supabaseEnabled: false,
  supabaseUrl: "",
  supabasePublishableKey: "",
  authProviders: [],
};

export function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [route, setRoute] = useState<RouteState>(() => normalizeRoute(parseRoute(window.location)));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string>("刚刚同步");
  const urlSyncedOnce = useRef(false);

  const navigate = (partial: Partial<RouteState>) => {
    setRoute((current) => {
      const next = normalizeRoute({ ...current, ...partial });
      return routesEqual(current, next) ? current : next;
    });
  };

  useEffect(() => {
    const url = buildUrl(route);
    if (`${window.location.pathname}${window.location.search}` !== url) {
      if (urlSyncedOnce.current) {
        window.history.pushState(null, "", url);
      } else {
        window.history.replaceState(null, "", url);
      }
    }
    urlSyncedOnce.current = true;
    document.title = `${navTitles[route.nav]} · 8XD.IO Dashboard`;
  }, [route]);

  useEffect(() => {
    const onPopState = () => setRoute(normalizeRoute(parseRoute(window.location)));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSession()
      .then((ok) => {
        if (!cancelled) setAuthenticated(ok);
      })
      .catch(() => {
        if (!cancelled) setAuthenticated(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    setLoading(true);
    fetchDashboard(route.range, route.scope)
      .then((nextSnapshot) => {
        if (cancelled) return;
        setSnapshot(nextSnapshot);
        setError(null);
      })
      .catch((nextError: Error) => {
        if (cancelled) return;
        setError(nextError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authenticated, route.range, route.scope.type, route.scope.id]);

  async function handleLogin(password: string, turnstileToken?: string) {
    await login(password, turnstileToken);
    clearSupabaseManualLogout();
    setAuthenticated(true);
  }

  async function handleLogout() {
    markSupabaseManualLogout();
    try {
      const config = await getAuthConfig();
      await signOutSupabase(config);
    } catch {
      // The dashboard session still needs to be cleared even if Supabase is unavailable.
    } finally {
      try {
        await logout();
      } finally {
        setSnapshot(null);
        setAuthenticated(false);
      }
    }
  }

  async function handleSync() {
    setSyncMessage("同步中");
    try {
      const message = await syncCloudflare();
      setSyncMessage(message);
      const nextSnapshot = await fetchDashboard(route.range, route.scope);
      setSnapshot(nextSnapshot);
    } catch (syncError) {
      setSyncMessage(syncError instanceof Error ? syncError.message : "同步失败");
    }
  }

  if (authenticated === false) {
    return <LoginScreen onLogin={handleLogin} onAuthenticated={() => setAuthenticated(true)} />;
  }

  if (!snapshot) {
    return <LoadingShell />;
  }

  return (
    <div className="app-shell">
      <Sidebar activeNav={route.nav} onNavigate={(nav) => navigate({ nav })} />
      <main className="main-shell">
        <Topbar
          snapshot={snapshot}
          scope={route.scope}
          range={route.range}
          syncMessage={syncMessage}
          loading={loading}
          onScopeChange={(scope) => navigate({ scope })}
          onRangeChange={(range) => navigate({ range })}
          onSync={handleSync}
          onLogout={handleLogout}
        />
        {error ? <div className="notice danger">{error}</div> : null}
        <PageContent
          nav={route.nav}
          snapshot={snapshot}
          scope={route.scope}
          range={route.range}
          onNavigate={navigate}
        />
      </main>
    </div>
  );
}

function LoginScreen({
  onLogin,
  onAuthenticated,
}: {
  onLogin: (password: string, turnstileToken?: string) => Promise<void>;
  onAuthenticated: () => void;
}) {
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [authConfig, setAuthConfig] = useState<AuthConfig>(defaultAuthConfig);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [checkingSupabaseSession, setCheckingSupabaseSession] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let authenticatedBySupabase = false;
    getAuthConfig()
      .then(async (config) => {
        if (cancelled) return;
        setAuthConfig(config);
        if (wasSupabaseManualLogout()) return;
        try {
          const exchanged = await exchangeExistingSupabaseSession(config);
          if (exchanged && !cancelled) {
            authenticatedBySupabase = true;
            onAuthenticated();
          }
        } catch (sessionError) {
          if (!cancelled) setError(sessionError instanceof Error ? sessionError.message : "Supabase 登录失败");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthConfig(defaultAuthConfig);
        }
      })
      .finally(() => {
        if (!cancelled && !authenticatedBySupabase) {
          setCheckingSupabaseSession(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [onAuthenticated]);

  useEffect(() => {
    if (!authConfig.turnstileEnabled || !authConfig.turnstileSiteKey) return;

    const callbackWindow = window as Window & {
      dashboardTurnstileSuccess?: (token: string) => void;
      dashboardTurnstileExpired?: () => void;
      turnstile?: { reset?: () => void };
    };
    callbackWindow.dashboardTurnstileSuccess = (token: string) => setTurnstileToken(token);
    callbackWindow.dashboardTurnstileExpired = () => setTurnstileToken("");

    if (!document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]')) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => {
      delete callbackWindow.dashboardTurnstileSuccess;
      delete callbackWindow.dashboardTurnstileExpired;
    };
  }, [authConfig.turnstileEnabled, authConfig.turnstileSiteKey]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authConfig.turnstileEnabled && !turnstileToken) {
      setError("请先完成 Cloudflare 人类验证");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onLogin(password, turnstileToken);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "登录失败");
      const callbackWindow = window as Window & { turnstile?: { reset?: () => void } };
      callbackWindow.turnstile?.reset?.();
      setTurnstileToken("");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleLogin() {
    setBusy(true);
    setError(null);
    try {
      clearSupabaseManualLogout();
      await signInWithSupabaseGoogle(authConfig);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Google 登录失败");
      setBusy(false);
    }
  }

  async function handleMagicLink() {
    if (!email) {
      setError("请输入邮箱");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await sendSupabaseMagicLink(authConfig, email);
      clearSupabaseManualLogout();
      setNotice("登录链接已发送，请到邮箱中确认。");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "邮箱登录链接发送失败");
    } finally {
      setBusy(false);
    }
  }

  if (checkingSupabaseSession) {
    return <LoadingShell label="正在验证登录状态" />;
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit} autoComplete="on">
        <div className="brand-row">
          <span className="brand-mark">8XD</span>
          <span>8XD.IO Dashboard</span>
        </div>
        <h1>私有云资源面板</h1>
        <input
          className="visually-hidden"
          name="username"
          type="text"
          value={authConfig.credentialUsername}
          autoComplete="username"
          readOnly
          tabIndex={-1}
        />
        <label className="field">
          <span>管理员密码</span>
          <div className="password-wrap">
            <Lock size={16} />
            <input
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </div>
        </label>
        {authConfig.turnstileEnabled && authConfig.turnstileSiteKey ? (
          <div className="turnstile-box">
            <div
              className="cf-turnstile"
              data-sitekey={authConfig.turnstileSiteKey}
              data-theme="light"
              data-action="dashboard-login"
              data-callback="dashboardTurnstileSuccess"
              data-expired-callback="dashboardTurnstileExpired"
              data-error-callback="dashboardTurnstileExpired"
            />
          </div>
        ) : null}
        {error ? <div className="notice danger">{error}</div> : null}
        {notice ? <div className="notice success">{notice}</div> : null}
        <button className="primary-button" disabled={busy}>
          {busy ? "登录中" : "进入 Dashboard"}
        </button>
        {authConfig.supabaseEnabled ? (
          <div className="auth-provider-panel">
            <div className="auth-provider-title">
              <KeyStatus enabled={authConfig.supabaseEnabled} />
              <span>免密登录</span>
            </div>
            <div className="auth-actions">
              <button className="secondary-button" type="button" onClick={handleGoogleLogin} disabled={busy}>
                <Users size={15} />
                Google 登录
              </button>
              <label className="field compact-field">
                <span>邮箱 Magic Link</span>
                <div className="password-wrap">
                  <Mail size={16} />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                  />
                </div>
              </label>
              <button className="secondary-button" type="button" onClick={handleMagicLink} disabled={busy}>
                发送登录链接
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </div>
  );
}

function KeyStatus({ enabled }: { enabled: boolean }) {
  return enabled ? <CheckCircle2 size={16} /> : <Lock size={16} />;
}

function LoadingShell({ label = "正在加载 Dashboard" }: { label?: string }) {
  return (
    <div className="loading-shell">
      <RefreshCw className="spin" size={22} />
      <span>{label}</span>
    </div>
  );
}

function Sidebar({
  activeNav,
  onNavigate,
}: {
  activeNav: NavKey;
  onNavigate: (nav: NavKey) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="workspace">
        <span className="brand-mark">8XD</span>
        <span>8XD.IO</span>
      </div>
      <nav className="side-nav">
        {navGroups.map((group) => (
          <div className="nav-group" key={group.title}>
            <span className="nav-group-title">{group.title}</span>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  className={item.key === activeNav ? "nav-item active" : "nav-item"}
                  key={item.key}
                  aria-current={item.key === activeNav ? "page" : undefined}
                  onClick={() => onNavigate(item.key)}
                >
                  <Icon size={17} />
                  <span className="nav-label">{item.label}</span>
                  {item.hint ? <span className="nav-hint">{item.hint}</span> : null}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="system-card">
        <CheckCircle2 size={16} />
        <div>
          <strong>系统状态</strong>
          <span>全部正常</span>
        </div>
      </div>
      <span className="copyright">版权所有 8XD.IO</span>
    </aside>
  );
}

function Topbar({
  snapshot,
  scope,
  range,
  syncMessage,
  loading,
  onScopeChange,
  onRangeChange,
  onSync,
  onLogout,
}: {
  snapshot: DashboardSnapshot;
  scope: ScopeRef;
  range: TimeRange;
  syncMessage: string;
  loading: boolean;
  onScopeChange: (scope: ScopeRef) => void;
  onRangeChange: (range: TimeRange) => void;
  onSync: () => void;
  onLogout: () => void;
}) {
  const scopeGroups = useMemo(() => groupedScopes(snapshot), [snapshot]);

  return (
    <header className="topbar">
      <label className="scope-select">
        <span>范围</span>
        <select value={scopeValue(scope)} onChange={(event) => onScopeChange(parseScope(event.target.value))}>
          {scopeGroups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((option) => (
                <option key={scopeValue(option)} value={scopeValue(option)}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="range-group" role="group" aria-label="时间范围">
        {(Object.keys(rangeLabels) as TimeRange[]).map((item) => (
          <button
            className={item === range ? "range-button active" : "range-button"}
            key={item}
            onClick={() => onRangeChange(item)}
          >
            {rangeLabels[item]}
          </button>
        ))}
      </div>
      <div className="topbar-spacer" />
      <div className="sync-pill" title={syncMessage}>
        <span className="sync-dot" />
        <span className="sync-text">{syncMessage}</span>
      </div>
      <button className="icon-button" onClick={onSync} title="刷新并同步 Cloudflare">
        <RefreshCw className={loading ? "spin" : undefined} size={16} />
        <span>刷新</span>
      </button>
      <button className="icon-button subtle" onClick={onLogout} title="退出登录">
        <LogOut size={15} />
        <span>退出</span>
      </button>
    </header>
  );
}

/** 有专属监控页的站点：跳转这些域名/子域名时直接进对应页面 */
const siteNavByScopeId: Record<string, NavKey> = {
  "fangliying.com": "lawyer",
  "www.fangliying.com": "lawyer",
  "jovlo.8xd.io": "jovlo",
};

/** 「查看详情」的正确落点：zone 的指标挂在 domain scope 下，健康检查跳它监控的子域名 */
function scopeForResource(resource: ResourceRecord): ScopeRef {
  if (resource.type === "zone") return { type: "domain", id: resource.domain || resource.name };
  if (resource.type === "connector" && resource.hostnames.length) {
    return { type: "hostname", id: resource.hostnames[0] };
  }
  return { type: "resource", id: resource.id };
}

function scopesEqual(left: ScopeRef, right: ScopeRef): boolean {
  return left.type === right.type && left.id === right.id;
}

function PageContent({
  nav,
  snapshot,
  scope,
  range,
  onNavigate,
}: {
  nav: NavKey;
  snapshot: DashboardSnapshot;
  scope: ScopeRef;
  range: TimeRange;
  onNavigate: (partial: Partial<RouteState>) => void;
}) {
  const openScopeDashboard = (nextScope: ScopeRef) => {
    const siteNav =
      nextScope.type === "domain" || nextScope.type === "hostname" ? siteNavByScopeId[nextScope.id] : undefined;
    if (siteNav) {
      onNavigate({ nav: siteNav });
      return;
    }
    onNavigate({ nav: "overview", scope: nextScope });
  };

  if (nav === "cloudflare") return <CloudflareView snapshot={snapshot} onOpenScope={openScopeDashboard} />;
  if (nav === "lawyer") return <LawyerHomepageView snapshot={snapshot} />;
  if (nav === "jovlo") return <JovloView snapshot={snapshot} range={range} />;
  if (nav === "domains") return <DomainsView snapshot={snapshot} onOpenScope={openScopeDashboard} />;
  if (nav === "workers") return <WorkersPagesView snapshot={snapshot} onOpenScope={openScopeDashboard} />;
  if (nav === "storage") return <StorageView snapshot={snapshot} onOpenScope={openScopeDashboard} />;
  if (nav === "database") return <DatabaseView snapshot={snapshot} />;
  if (nav === "connectors") return <ConnectorsView snapshot={snapshot} />;
  if (nav === "alerts") return <AlertsView snapshot={snapshot} />;
  if (nav === "settings") return <SettingsView snapshot={snapshot} range={range} scope={scope} />;
  return (
    <OverviewView
      snapshot={snapshot}
      scope={scope}
      onOpenScope={openScopeDashboard}
      onResetScope={() => onNavigate({ scope: { type: "global", id: "global" } })}
    />
  );
}

function OverviewView({
  snapshot,
  scope,
  onOpenScope,
  onResetScope,
}: {
  snapshot: DashboardSnapshot;
  scope: ScopeRef;
  onOpenScope: (scope: ScopeRef) => void;
  onResetScope: () => void;
}) {
  return (
    <div className="page-grid">
      <section className="content-column">
        <PageHeader
          title={snapshot.summary.title}
          description="所有平台的资源、用量与健康状态。当前第一版真实接入 Cloudflare，其它平台保持连接器占位。"
          action={
            scope.type !== "global" ? (
              <button className="secondary-button" onClick={onResetScope}>
                返回全局总览
              </button>
            ) : undefined
          }
        />
        {scope.type === "hostname" ? (
          <div className="notice subtle">
            子域名级流量为按根域名汇总均分的估算值（Cloudflare 免费计划暂无 host 维度明细），健康检查与 Worker 指标为真实数据。
          </div>
        ) : null}
        <KpiStrip snapshot={snapshot} />
        {snapshot.summary.emptyState ? <div className="notice">{snapshot.summary.emptyState}</div> : null}
        <TrendCard title="访问与请求趋势" trends={snapshot.trends} />
        <CloudflareMetrics snapshot={snapshot} />
        <ResourceTable snapshot={snapshot} onOpenScope={onOpenScope} />
      </section>
      <aside className="right-rail">
        <ConnectorPanel connectors={snapshot.connectors} />
        <HealthPanel snapshot={snapshot} />
        <FreshnessPanel snapshot={snapshot} />
        <UsagePanel snapshot={snapshot} />
      </aside>
    </div>
  );
}

function CloudflareView({
  snapshot,
  onOpenScope,
}: {
  snapshot: DashboardSnapshot;
  onOpenScope: (scope: ScopeRef) => void;
}) {
  const [typeFilter, setTypeFilter] = useState<ResourceRecord["type"] | "all">("all");
  const cloudflareResources = snapshot.resources.filter((resource) => resource.platform === "Cloudflare");
  const filteredResources =
    typeFilter === "all" ? cloudflareResources : cloudflareResources.filter((resource) => resource.type === typeFilter);

  return (
    <div className="full-page">
      <PageHeader
        title="Cloudflare 核心指标"
        description="按当前范围展示 Zone、Pages、Workers、R2、KV、D1、Queues、Vectorize 的真实资源与可用指标。"
      />
      <KpiStrip snapshot={snapshot} compact />
      <div className="toolbar-panel">
        <Segmented
          value={typeFilter}
          options={[
            ["all", "全部"],
            ["zone", "根域名"],
            ["pages", "Pages"],
            ["worker", "Workers"],
            ["r2", "R2"],
            ["kv", "KV"],
            ["d1", "D1"],
            ["queue", "Queues"],
            ["vectorize", "Vectorize"],
          ]}
          onChange={(value) => setTypeFilter(value as ResourceRecord["type"] | "all")}
        />
      </div>
      <div className="two-up">
        <TrendCard title="Cloudflare 请求趋势" trends={snapshot.trends} compact />
        <OriginPanel snapshot={snapshot} onOpenScope={onOpenScope} />
      </div>
      <CloudflareMetrics snapshot={snapshot} />
      <ResourceTable
        snapshot={{ ...snapshot, resources: filteredResources }}
        onOpenScope={onOpenScope}
        title="Cloudflare 资源明细"
      />
    </div>
  );
}

function DomainsView({
  snapshot,
  onOpenScope,
}: {
  snapshot: DashboardSnapshot;
  onOpenScope: (scope: ScopeRef) => void;
}) {
  return (
    <div className="full-page">
      <PageHeader
        title="域名管理"
        description="根域名、子域名、关联项目、请求、访问、威胁和最高峰日期。点击卡片或子域名可进入对应的专属总览。"
      />
      <div className="notice subtle">
        根域名请求来自 Cloudflare 真实 Zone 汇总；子域名明细在 Cloudflare 未返回 host 维度时按估算展示，并在对应页面标注数据来源。
      </div>
      <div className="domain-grid">
        {snapshot.domains.map((domain) => (
          <button className="domain-card" key={domain.domain} onClick={() => onOpenScope({ type: "domain", id: domain.domain })}>
            <div className="card-title-row">
              <Globe2 size={18} />
              <strong className="cell-ellipsis">{domain.domain}</strong>
              <span className={domain.status === "active" ? "status success" : "status muted"}>
                {domain.status === "active" ? "正常" : domain.status}
              </span>
            </div>
            <div className="domain-stats">
              <MetricInline label="请求数" value={formatNumber(domain.requests)} />
              <MetricInline label="访问量" value={formatNumber(domain.visits)} />
              <MetricInline label="威胁数" value={formatNumber(domain.threats)} />
            </div>
            <span className="muted">最高峰日期：{domain.topDay || "暂无"}</span>
          </button>
        ))}
      </div>
      <Panel title="子域名明细">
        <div className="table">
          <div className="table-row table-head domains-table">
            <span>子域名</span>
            <span>所属根域名</span>
            <span>关联服务</span>
            <span>状态</span>
            <span>操作</span>
          </div>
          {snapshot.domains.flatMap((domain) =>
            domain.hostnames.map((hostname) => {
              const service = serviceForHostname(snapshot, hostname);
              const health = healthForHostname(snapshot, hostname);
              return (
                <div className="table-row domains-table" key={`${domain.domain}:${hostname}`}>
                  <span className="cell-ellipsis">{hostname}</span>
                  <span className="cell-ellipsis">{domain.domain}</span>
                  <span className="cell-ellipsis muted">{service || "—"}</span>
                  <span className={health === "error" ? "status danger" : "status success"}>
                    {health === "error" ? "异常" : "正常"}
                  </span>
                  <button className="text-button" onClick={() => onOpenScope({ type: "hostname", id: hostname })}>
                    专属总览
                    <ChevronRight size={15} />
                  </button>
                </div>
              );
            }),
          )}
        </div>
      </Panel>
    </div>
  );
}

function LawyerHomepageView({ snapshot }: { snapshot: DashboardSnapshot }) {
  const domain = snapshot.domains.find((item) => item.domain === "fangliying.com");
  const breakdowns = snapshot.trafficBreakdowns.filter((row) => row.scopeId === "fangliying.com");
  const cloudflareViews = breakdowns.find((row) => row.kind === "event" && row.label.includes("Cloudflare"))?.value || domain?.visits || 0;
  const instrumentedViews = breakdowns
    .filter((row) => row.kind === "event" && row.source === "instrumented")
    .reduce((sum, row) => sum + row.value, 0);
  const agentRequests = breakdowns
    .filter((row) => row.kind === "agent" && /Agent|爬虫|监控|AI|bot/i.test(row.label))
    .reduce((sum, row) => sum + row.value, 0);
  const geoRequests = breakdowns
    .filter((row) => row.kind === "source" && row.label.startsWith("GEO /"))
    .reduce((sum, row) => sum + row.value, 0);
  const topAiAgent = topBreakdowns(breakdowns, "aiAgent")[0];

  return (
    <div className="full-page lawyer-page">
      <PageHeader
        title="律师主页流量"
        description="fangliying.com 的请求、访问、来源、地区、路径与站内埋点。Cloudflare 根域名请求和浏览器 pageview 分开展示。"
        action={
          <a className="secondary-button" href="https://fangliying.com" target="_blank" rel="noreferrer">
            <Globe2 size={15} />
            fangliying.com
          </a>
        }
      />
      <div className="notice subtle">
        请求数包含 HTML、JS、CSS、图片、预览抓取、搜索爬虫和 Agent；站内埋点只统计浏览器页面事件。
      </div>
      <div className="lawyer-kpis">
        <MetricInline label="Cloudflare 请求" value={formatNumber(domain?.requests || metricForScope(snapshot, "requests", "domain", "fangliying.com"))} status="根域名" />
        <MetricInline label="Cloudflare 访问" value={formatNumber(cloudflareViews)} status="pageViews" />
        <MetricInline label="站内埋点" value={instrumentedViews ? formatNumber(instrumentedViews) : "待采集"} status="pageview" />
        <MetricInline label="疑似 Agent" value={agentRequests ? formatNumber(agentRequests) : "待校准"} status="近似归因" />
        <MetricInline label="AI / GEO" value={geoRequests ? formatNumber(geoRequests) : "待采集"} status={topAiAgent?.label || "User-Agent"} />
        <MetricInline label="流量大小" value={`${formatDecimal(domain?.bytesMiB || 0)} MiB`} status="近 30 天" />
      </div>
      <div className="traffic-insights">
        {snapshot.trafficInsights.map((insight) => (
          <div className={`traffic-insight ${insight.tone}`} key={insight.id}>
            <span>{insight.title}</span>
            <strong>{insight.value}</strong>
            <p>{insight.detail}</p>
          </div>
        ))}
      </div>
      <div className="analytics-grid">
        <BreakdownBarPanel title="请求地区" rows={topBreakdowns(breakdowns, "country")} />
        <BreakdownBarPanel title="请求页面 / 路径" rows={topBreakdowns(breakdowns, "path")} />
        <BreakdownBarPanel title="请求来源" rows={topBreakdowns(breakdowns, "referrer")} />
        <BreakdownBarPanel title="浏览器 / Agent" rows={topBreakdowns(breakdowns, "agent")} />
        <BreakdownBarPanel title="AI / GEO 来源" rows={topBreakdowns(breakdowns, "aiAgent")} />
        <BreakdownBarPanel title="SEO / GEO 分布" rows={topBreakdowns(breakdowns, "source")} />
      </div>
      <div className="analytics-grid">
        <TrafficCompositionPanel rows={breakdowns} />
        <Panel title="数据可信度">
          <div className="source-quality-grid">
            {sourceQualityRows(breakdowns).map((row) => (
              <MetricInline key={row.source} label={sourceLabel(row.source)} value={formatNumber(row.value)} status={row.helper} />
            ))}
          </div>
        </Panel>
        <Panel title="采集状态">
          <div className="attribution-notes">
            <p>Cloudflare Zone 指标提供根域名请求、访问、威胁和流量大小，是当前主数据源。</p>
            <p>Pageview beacon 是浏览器端页面浏览事件，用来补充路径、Referer、设备和会话；不记录原始 IP，也抓不到大多数不执行 JS 的 AI crawler。</p>
            <p>AI / GEO 来源基于 Cloudflare 边缘请求 Top 40 User-Agent 与 Top 24 Referer 的真实采样归因，不足以覆盖的长尾会落入"未知"，不再用估算比例填充；后续可接 Logpush 或 AI Crawl Control 做全量明细。</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function JovloView({ snapshot, range }: { snapshot: DashboardSnapshot; range: TimeRange }) {
  const health = snapshot.resources.find(
    (resource) => resource.type === "connector" && resource.hostnames.includes("jovlo.8xd.io"),
  );
  const healthMeta = (health?.metadata ?? {}) as {
    url?: string;
    httpStatus?: number;
    responseMs?: number;
    error?: string;
  };
  const isUp = health?.status === "active";
  const responseMs = health ? metricForScope(snapshot, "responseMs", "resource", health.id) : 0;
  const requests = metricForScope(snapshot, "requests", "hostname", "jovlo.8xd.io");
  const visits = metricForScope(snapshot, "visits", "hostname", "jovlo.8xd.io");
  const worker = snapshot.resources.find(
    (resource) => resource.type === "worker" && resource.hostnames.includes("jovlo.8xd.io"),
  );
  const workerRequests = worker ? metricForScope(snapshot, "workerRequests", "resource", worker.id) : 0;

  return (
    <div className="full-page">
      <PageHeader
        title="Jovlo.ai 站点监控"
        description="jovlo.8xd.io 的健康检查、Worker 请求与子域名流量。健康检查每 15 分钟由 Dashboard Worker 定时执行。"
        action={
          <a className="secondary-button" href="https://jovlo.8xd.io" target="_blank" rel="noreferrer">
            <Sparkles size={15} />
            jovlo.8xd.io
          </a>
        }
      />
      {health ? (
        <div className={isUp ? "site-status up" : "site-status down"}>
          {isUp ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
          <div>
            <strong>{isUp ? "服务正常" : "服务异常"}</strong>
            <span className="cell-ellipsis">
              {healthMeta.url || "https://jovlo.8xd.io/api/health"}
              {healthMeta.error ? ` · ${healthMeta.error}` : ""}
            </span>
          </div>
          <span className="muted">最近检查：{health.lastSyncedAt ? formatDateTime(health.lastSyncedAt) : "待同步"}</span>
        </div>
      ) : (
        <div className="notice">健康检查数据待首次同步，点击右上角「刷新」可立即触发。</div>
      )}
      <div className="lawyer-kpis">
        <MetricInline label="HTTP 状态" value={healthMeta.httpStatus ? String(healthMeta.httpStatus) : "—"} status="真实" />
        <MetricInline
          label="响应时间"
          value={responseMs || healthMeta.responseMs ? `${formatNumber(responseMs || Number(healthMeta.responseMs))} ms` : "—"}
          status="真实"
        />
        <MetricInline label="Worker 请求" value={formatNumber(workerRequests)} status={worker ? worker.name : "jovlo-ai"} />
        <MetricInline label="子域名请求" value={formatNumber(requests)} status="估算" />
        <MetricInline label="子域名访问" value={formatNumber(visits)} status="估算" />
        <MetricInline label="时间范围" value={rangeLabels[range]} status="Cloudflare" />
      </div>
      {snapshot.trends.length ? <TrendCard title="请求趋势" trends={snapshot.trends} compact /> : null}
      <div className="notice subtle">
        健康检查与 Worker 请求为真实数据；子域名请求 / 访问为按根域名均分的估算值，待接入 host 维度明细后替换。
      </div>
    </div>
  );
}

const compositionMeta: Record<string, { label: string; color: string }> = {
  Human: { label: "人类 / 浏览器", color: "#2563eb" },
  GEO: { label: "AI Agent / GEO", color: "#f97316" },
  SEO: { label: "搜索引擎 / SEO", color: "#16a34a" },
  Social: { label: "社交预览", color: "#0891b2" },
  Monitoring: { label: "监控 / 脚本", color: "#64748b" },
  Other: { label: "未知 / 其它", color: "#94a3b8" },
};

function TrafficCompositionPanel({ rows }: { rows: TrafficBreakdown[] }) {
  const sourceRows = rows.filter((row) => row.kind === "source");
  const totals = sourceRows.reduce<Record<string, number>>((acc, row) => {
    const bucket = row.label.split(" / ")[0];
    const key = compositionMeta[bucket] ? bucket : "Other";
    acc[key] = (acc[key] || 0) + row.value;
    return acc;
  }, {});
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const entries = Object.keys(compositionMeta)
    .filter((key) => totals[key])
    .map((key) => ({ key, ...compositionMeta[key], value: totals[key] }));

  return (
    <Panel title="人 / Agent 流量构成">
      {total > 0 ? (
        <div className="composition">
          <div className="composition-bar" role="img" aria-label="流量构成比例">
            {entries.map((entry) => (
              <i
                key={entry.key}
                style={{ width: `${(entry.value / total) * 100}%`, background: entry.color }}
                title={`${entry.label} ${Math.round((entry.value / total) * 100)}%`}
              />
            ))}
          </div>
          <div className="composition-list">
            {entries.map((entry) => (
              <div className="composition-row" key={entry.key}>
                <i style={{ background: entry.color }} />
                <span>{entry.label}</span>
                <strong>{formatNumber(entry.value)}</strong>
                <em>{((entry.value / total) * 100).toFixed(1)}%</em>
              </div>
            ))}
          </div>
          <p className="muted composition-note">
            比例基于已归因的 User-Agent / Referer 采样，覆盖不到的长尾流量计入"未知 / 其它"。
          </p>
        </div>
      ) : (
        <div className="empty-state">
          <BarChart3 size={28} />
          <strong>等待采集</strong>
          <span>同步拿到真实 User-Agent / Referer 明细后展示，不使用估算比例。</span>
        </div>
      )}
    </Panel>
  );
}

function BreakdownBarPanel({ title, rows }: { title: string; rows: TrafficBreakdown[] }) {
  const data = rows.slice(0, 8).map((row) => ({
    label: row.label.length > 18 ? `${row.label.slice(0, 18)}...` : row.label,
    fullLabel: row.label,
    value: Math.round(row.value),
    source: row.source,
    helper: row.helper,
  }));

  return (
    <Panel title={title} className="breakdown-panel">
      {data.length ? (
        <>
          <div className="bar-chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
                <CartesianGrid stroke="#eef2f7" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={118} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, borderColor: "#e2e8f0" }}
                  formatter={(value) => [formatNumber(Number(value)), "次数"]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel || ""}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {data.map((row) => (
                    <Cell key={`${row.fullLabel}-${row.source}`} fill={sourceColor(row.source)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="breakdown-list">
            {rows.slice(0, 5).map((row) => (
              <div className="breakdown-row" key={row.id}>
                <span>{row.label}</span>
                <strong>{formatNumber(row.value)}</strong>
                <em className={`source-dot ${row.source}`}>{sourceLabel(row.source)}</em>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <BarChart3 size={28} />
          <strong>等待采集</strong>
          <span>同步或站内埋点产生数据后会显示。</span>
        </div>
      )}
    </Panel>
  );
}

function WorkersPagesView({
  snapshot,
  onOpenScope,
}: {
  snapshot: DashboardSnapshot;
  onOpenScope: (scope: ScopeRef) => void;
}) {
  const resources = snapshot.resources.filter((resource) => resource.type === "worker" || resource.type === "pages");
  return (
    <div className="full-page">
      <PageHeader
        title="Workers & Pages"
        description="部署、绑定关系、请求、CPU 时间与异常状态。"
      />
      <div className="two-up">
        <Panel title="活跃部署">
          {resources.map((resource) => (
            <div className="deployment-row" key={resource.id}>
              {resource.type === "worker" ? <Box size={18} /> : <Layers3 size={18} />}
              <div>
                <strong>{resource.name}</strong>
                <span>
                  {resourceTypeLabels[resource.type]} / 绑定{" "}
                  {resource.hostnames.length ? resource.hostnames.join("、") : resource.domain || "未绑定"}
                </span>
              </div>
              <span className={resourceStatusClass(resource.status)}>
                {statusLabels[resource.status]}
              </span>
            </div>
          ))}
        </Panel>
        <TrendCard title="Worker 请求趋势" trends={snapshot.trends} compact />
      </div>
      <ResourceTable snapshot={{ ...snapshot, resources }} onOpenScope={onOpenScope} title="绑定资源" />
    </div>
  );
}

function StorageView({
  snapshot,
  onOpenScope,
}: {
  snapshot: DashboardSnapshot;
  onOpenScope: (scope: ScopeRef) => void;
}) {
  const resources = snapshot.resources.filter((resource) => resource.type === "r2" || resource.type === "kv");
  const r2Objects = metricNumber(snapshot, "r2Objects");
  const r2Storage = metricNumber(snapshot, "r2Storage");
  const r2Operations = metricNumber(snapshot, "r2Operations");
  const kvKeys = metricNumber(snapshot, "kvKeys");
  const kvStorageKiB = metricNumber(snapshot, "kvStorageKiB");
  const kvOperations = metricNumber(snapshot, "kvOperations");
  return (
    <div className="full-page">
      <PageHeader
        title="存储"
        description="R2 与 KV 的对象、容量、操作次数，以及是否为多个项目共享资源。"
      />
      <div className="two-up">
        <Panel title="R2 share-pages-content">
          <StorageGauge label="对象数" value={formatNumber(r2Objects)} helper="当前对象数量" percent={quotaPercent(r2Objects, 1000)} />
          <StorageGauge label="总大小" value={`${formatDecimal(r2Storage)} MiB`} helper="当前存储量" percent={quotaPercent(r2Storage, 10240)} />
          <StorageGauge label="R2 操作" value={formatNumber(r2Operations)} helper="近 30 天对象操作" percent={quotaPercent(r2Operations, 1000000)} />
        </Panel>
        <Panel title="KV SHARE_PAGES_CONFIG">
          <StorageGauge label="键数量" value={formatNumber(kvKeys)} helper="配置与目录元数据" percent={quotaPercent(kvKeys, 100)} />
          <StorageGauge label="存储大小" value={`${formatDecimal(kvStorageKiB)} KiB`} helper="近似值" percent={quotaPercent(kvStorageKiB, 1024)} />
          <StorageGauge label="KV 操作" value={formatNumber(kvOperations)} helper="近 30 天读写与列表" percent={quotaPercent(kvOperations, 3000000)} danger />
        </Panel>
      </div>
      <ResourceTable snapshot={{ ...snapshot, resources }} onOpenScope={onOpenScope} title="存储资源列表" />
    </div>
  );
}

function DatabaseView({ snapshot }: { snapshot: DashboardSnapshot }) {
  const emptyResources = snapshot.resources.filter((resource) =>
    ["d1", "queue", "vectorize"].includes(resource.type),
  );
  return (
    <div className="full-page">
      <PageHeader
        title="数据库与队列"
        description="D1、Queues、Vectorize 作为扩展位保留；Dashboard 自身的指标缓存使用 D1。"
      />
      <div className="empty-resource-grid">
        {emptyResources.map((resource) => (
          <Panel title={resource.name} key={resource.id}>
            {resource.status === "empty" ? (
              <div className="empty-state">
                <Database size={28} />
                <strong>{resource.metadata?.emptyLabel ? String(resource.metadata.emptyLabel) : "暂无资源"}</strong>
                <span>未来可用于 Dashboard 缓存、任务队列、向量检索和告警聚合。</span>
              </div>
            ) : (
              <div className="connector-detail">
                <span className={resourceStatusClass(resource.status)}>{statusLabels[resource.status]}</span>
                <p>类型：{resourceTypeLabels[resource.type]}</p>
              </div>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}

function ConnectorsView({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <div className="full-page">
      <PageHeader
        title="连接器 / Usage"
        description="Cloudflare 已连接；Supabase、Firebase、Google Cloud 先保留授权入口与可采集指标规划，不展示假数据。"
      />
      <div className="two-up">
        <ConnectorPanel connectors={snapshot.connectors} />
        <UsagePanel snapshot={snapshot} />
      </div>
      <div className="connector-list">
        {snapshot.connectorRecords.map((connector) => {
          const card = snapshot.connectors.find((item) => item.platform === connector.platform);
          return (
            <Panel title={connector.platform} key={connector.platform}>
              <div className="connector-detail">
                <StatusPill card={card} />
                <p>{connector.message || connectorPlanText(connector.platform)}</p>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

function AlertsView({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <div className="full-page">
      <PageHeader
        title="告警与日志"
        description="同步失败、错误率异常、请求突增、存储接近配额、域名流量异常会进入这里。"
      />
      <Panel title="当前告警">
        {snapshot.alerts.length === 0 ? (
          <div className="empty-state">
            <Shield size={28} />
            <strong>暂无未处理告警</strong>
            <span>Cloudflare 同步与当前范围的资源状态正常。</span>
          </div>
        ) : (
          snapshot.alerts.map((alert) => (
            <div className="alert-row" key={alert.id}>
              <AlertTriangle size={18} />
              <strong>{alert.title}</strong>
              <span>{alert.description}</span>
            </div>
          ))
        )}
      </Panel>
    </div>
  );
}

function SettingsView({
  snapshot,
  range,
  scope,
}: {
  snapshot: DashboardSnapshot;
  range: TimeRange;
  scope: ScopeRef;
}) {
  return (
    <div className="full-page">
      <PageHeader
        title="设置"
        description="认证、Cloudflare API、D1、同步任务和部署域名配置。"
      />
      <Panel title="运行配置">
        <div className="settings-grid">
          <MetricInline label="接口模式" value={apiModeLabel} />
          <MetricInline label="数据来源" value={snapshot.sourceLabel} />
          <MetricInline label="当前范围" value={`${scope.type}:${scope.id}`} />
          <MetricInline label="时间范围" value={rangeLabels[range]} />
          <MetricInline label="部署域名" value="dashboard.8xd.io" />
          <MetricInline label="最近生成" value={formatDateTime(snapshot.generatedAt)} />
        </div>
      </Panel>
      <Panel title="需要配置的环境变量">
        <div className="env-list">
          <code>DASHBOARD_ADMIN_PASSWORD</code>
          <code>DASHBOARD_AUTH_SECRET</code>
          <code>CF_ACCOUNT_ID</code>
          <code>CF_API_TOKEN</code>
          <code>ANALYTICS_ALLOWED_ORIGINS</code>
          <code>TURNSTILE_ENABLED</code>
          <code>TURNSTILE_SITE_KEY</code>
          <code>TURNSTILE_SECRET</code>
          <code>SUPABASE_URL</code>
          <code>SUPABASE_PUBLISHABLE_KEY</code>
          <code>DASHBOARD_ALLOWED_EMAILS</code>
          <code>HEALTHCHECK_TARGETS</code>
        </div>
      </Panel>
      <Panel title="登录方案">
        <div className="auth-provider-grid">
          {snapshot.authProviders.map((provider) => (
            <div className={`auth-provider-card ${provider.status}`} key={provider.provider}>
              <div>
                <strong>{provider.label}</strong>
                <span>{provider.costLabel}</span>
              </div>
              <p>{provider.detail}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function KpiStrip({ snapshot, compact = false }: { snapshot: DashboardSnapshot; compact?: boolean }) {
  return (
    <div className={compact ? "kpi-grid compact" : "kpi-grid"}>
      {snapshot.summary.cards.map((card) => (
        <div className={`kpi-card ${card.tone}`} key={card.label}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <small>{card.helper}</small>
          <em>{card.tone === "red" ? "未处理" : rangeLabels[snapshot.range]}</em>
        </div>
      ))}
    </div>
  );
}

type TrendMetric = "requests" | "visits" | "errors";

const trendMetricLabels: Record<TrendMetric, string> = {
  requests: "请求数",
  visits: "访问量",
  errors: "错误",
};

const trendMetricColors: Record<TrendMetric, string> = {
  requests: "#2563eb",
  visits: "#16a34a",
  errors: "#dc2626",
};

function TrendCard({
  title,
  trends,
  compact = false,
}: {
  title: string;
  trends: TrendPoint[];
  compact?: boolean;
}) {
  const [metricKey, setMetricKey] = useState<TrendMetric>("requests");
  const color = trendMetricColors[metricKey];

  return (
    <Panel
      title={title}
      className={compact ? "trend-panel compact" : "trend-panel"}
      headerExtra={
        <div className="chart-tabs">
          {(Object.keys(trendMetricLabels) as TrendMetric[]).map((key) => (
            <button
              className={key === metricKey ? "chart-tab active" : "chart-tab"}
              key={key}
              onClick={() => setMetricKey(key)}
            >
              {trendMetricLabels[key]}
            </button>
          ))}
        </div>
      }
    >
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trends} margin={{ top: 12, right: 18, bottom: 0, left: 12 }}>
            <defs>
              <linearGradient id={`trendFill-${metricKey}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#eef2f7" vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={18} />
            <YAxis tickLine={false} axisLine={false} width={58} />
            <Tooltip
              contentStyle={{ borderRadius: 10, borderColor: "#e2e8f0" }}
              formatter={(value) => [formatNumber(Number(value)), trendMetricLabels[metricKey]]}
            />
            <Area
              type="monotone"
              dataKey={metricKey}
              stroke={color}
              fill={`url(#trendFill-${metricKey})`}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function CloudflareMetrics({ snapshot }: { snapshot: DashboardSnapshot }) {
  const metrics: { label: string; value: string; trend: string; danger?: boolean }[] = [
    metricValue(snapshot, "requests", "请求数"),
    { label: "CPU 时间", value: `${formatNumber(metricNumber(snapshot, "workerCpuMs"))} ms`, trend: "估算" },
    { label: "总耗时", value: `${formatNumber(metricNumber(snapshot, "workerWallMs"))} ms`, trend: "估算" },
    metricValue(snapshot, "r2Operations", "R2 操作"),
    metricValue(snapshot, "kvOperations", "KV 操作", true),
  ];

  return (
    <Panel title="Cloudflare 核心指标">
      <div className="metric-strip">
        {metrics.map((metric) => (
          <div className="mini-metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <em className={metric.danger ? "up" : ""}>{metric.trend}</em>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ResourceTable({
  snapshot,
  onOpenScope,
  title = "资源列表",
}: {
  snapshot: DashboardSnapshot;
  onOpenScope: (scope: ScopeRef) => void;
  title?: string;
}) {
  return (
    <Panel title={title}>
      <div className="table resource-table">
        <div className="table-row table-head">
          <span>资源</span>
          <span>类型</span>
          <span>状态</span>
          <span>归属</span>
          <span>近 30 天用量</span>
          <span>操作</span>
        </div>
        {snapshot.resources.map((resource) => {
          const target = scopeForResource(resource);
          const isCurrent = scopesEqual(snapshot.activeScope, target);
          return (
            <div className="table-row" key={resource.id}>
              <span className="resource-name">
                {resourceIcon(resource)}
                <span className="cell-ellipsis">{resource.name}</span>
              </span>
              <span className="cell-ellipsis">{resourceTypeLabels[resource.type]}</span>
              <span className={resourceStatusClass(resource.status)}>
                {statusLabels[resource.status]}
              </span>
              <span className="cell-ellipsis">{resource.domain || resource.projectKey}</span>
              <span className="cell-ellipsis">{usageForResource(resource, snapshot)}</span>
              {isCurrent ? (
                <span className="text-button current" aria-disabled="true">
                  当前查看中
                </span>
              ) : (
                <button className="text-button" onClick={() => onOpenScope(target)}>
                  查看详情
                  <ChevronRight size={15} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function ConnectorPanel({ connectors }: { connectors: ConnectorCard[] }) {
  return (
    <Panel title="连接器状态">
      <div className="connector-panel">
        {connectors.map((connector) => (
          <div className="connector-row" key={connector.platform}>
            <CloudLightning size={18} />
            <span>{connector.platform}</span>
            <StatusPill card={connector} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function HealthPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  const counts = countResources(snapshot.resources);
  const extensionCount = (counts.d1 || 0) + (counts.queue || 0) + (counts.vectorize || 0);
  return (
    <Panel title="资源健康">
      <div className="health-grid">
        <MetricInline label="域名 (Zones)" value={String(counts.zone || 0)} status="正常" />
        <MetricInline label="Pages 项目" value={String(counts.pages || 0)} status="正常" />
        <MetricInline label="Worker 脚本" value={String(counts.worker || 0)} status="正常" />
        <MetricInline label="R2 存储桶" value={String(counts.r2 || 0)} status="正常" />
        <MetricInline label="KV 命名空间" value={String(counts.kv || 0)} status="正常" />
        <MetricInline label="D1 / Queues / Vectorize" value={extensionCount ? String(extensionCount) : "暂无"} status="扩展位" />
      </div>
    </Panel>
  );
}

function FreshnessPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <Panel title="数据新鲜度">
      <div className="freshness">
        <CheckCircle2 size={19} />
        <div>
          <strong>最后同步时间</strong>
          <span>{formatDateTime(snapshot.generatedAt)}</span>
        </div>
        <span className="status success">{snapshot.sourceLabel}</span>
      </div>
      <span className="muted freshness-note">数据源：Cloudflare API / D1 缓存</span>
    </Panel>
  );
}

function UsagePanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  const workerRequests = metricNumber(snapshot, "workerRequests");
  const r2Storage = metricNumber(snapshot, "r2Storage");
  const r2ClassAOperations = metricNumber(snapshot, "r2ClassAOperations") || metricNumber(snapshot, "r2Operations");
  const kvOperations = metricNumber(snapshot, "kvOperations");

  return (
    <Panel title="用量与配额">
      <QuotaLine label="Workers 请求" value={`${formatNumber(workerRequests)} / 3,000,000（月）`} percent={quotaPercent(workerRequests, 3000000)} />
      <QuotaLine label="Workers 构建分钟" value="0 / 3,000（月）" percent={0} />
      <QuotaLine label="R2 存储" value={`${formatDecimal(r2Storage)} MiB / 10 GiB（月）`} percent={quotaPercent(r2Storage, 10240)} />
      <QuotaLine label="R2 Class A 操作" value={`${formatNumber(r2ClassAOperations)} / 1,000,000（月）`} percent={quotaPercent(r2ClassAOperations, 1000000)} />
      <QuotaLine label="KV 读取" value={`${formatNumber(kvOperations)} / 3,000,000（月）`} percent={quotaPercent(kvOperations, 3000000)} />
    </Panel>
  );
}

function OriginPanel({
  snapshot,
  onOpenScope,
}: {
  snapshot: DashboardSnapshot;
  onOpenScope: (scope: ScopeRef) => void;
}) {
  return (
    <Panel title="子域名流量">
      <div className="table compact-table">
        <div className="table-row table-head">
          <span>子域名</span>
          <span>请求数</span>
          <span>访问量</span>
        </div>
        {snapshot.scopes.hostnames.slice(0, 6).map((hostname) => (
          <div className="table-row" key={hostname.id}>
            <button className="text-button" onClick={() => onOpenScope({ type: "hostname", id: hostname.id })}>
              <span className="cell-ellipsis">{hostname.label}</span>
              <ChevronRight size={14} />
            </button>
            <span>{formatNumber(metricForScope(snapshot, "requests", "hostname", hostname.id))}</span>
            <span>{formatNumber(metricForScope(snapshot, "visits", "hostname", hostname.id))}</span>
          </div>
        ))}
      </div>
      <span className="muted freshness-note">子域名流量为均分估算，待 host 维度数据校准。</span>
    </Panel>
  );
}

function Panel({
  title,
  className,
  headerExtra,
  children,
}: {
  title: string;
  className?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={className ? `panel ${className}` : "panel"}>
      <div className="panel-header">
        <h2>{title}</h2>
        {headerExtra}
      </div>
      {children}
    </section>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="segmented">
      {options.map(([optionValue, label]) => (
        <button
          className={value === optionValue ? "active" : ""}
          key={optionValue}
          onClick={() => onChange(optionValue)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function MetricInline({ label, value, status }: { label: string; value: string; status?: string }) {
  return (
    <div className="metric-inline">
      <span>{label}</span>
      <strong title={value}>{value}</strong>
      {status ? <em title={status}>{status}</em> : null}
    </div>
  );
}

function StorageGauge({
  label,
  value,
  helper,
  percent,
  danger = false,
}: {
  label: string;
  value: string;
  helper: string;
  percent: number;
  danger?: boolean;
}) {
  return (
    <div className="storage-gauge">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <small>{helper}</small>
      <div className="progress">
        <i className={danger ? "danger" : ""} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}

function QuotaLine({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <div className="quota-line">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="progress">
        <i style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}

function StatusPill({ card }: { card?: ConnectorCard }) {
  if (!card) return <span className="status muted">未知</span>;
  const className =
    card.tone === "success" ? "status success" : card.tone === "danger" ? "status danger" : "status muted";
  return <span className={className}>{card.label}</span>;
}

function resourceStatusClass(status: ResourceRecord["status"]): string {
  if (status === "active") return "status success";
  if (status === "error") return "status danger";
  return "status muted";
}

function resourceIcon(resource: ResourceRecord) {
  if (resource.type === "zone") return <Globe2 size={16} />;
  if (resource.type === "pages") return <Layers3 size={16} />;
  if (resource.type === "worker") return <Server size={16} />;
  if (resource.type === "r2") return <HardDrive size={16} />;
  if (resource.type === "kv") return <Database size={16} />;
  if (resource.type === "connector") return <Activity size={16} />;
  return <Box size={16} />;
}

function groupedScopes(snapshot: DashboardSnapshot): { label: string; options: ScopeOption[] }[] {
  const groups: { label: string; options: ScopeOption[] }[] = [
    { label: "全局", options: [snapshot.scopes.global] },
    { label: "项目", options: snapshot.scopes.projects },
    { label: "根域名", options: snapshot.scopes.domains },
    { label: "子域名", options: snapshot.scopes.hostnames },
    { label: "资源", options: snapshot.scopes.resources },
  ];
  return groups.filter((group) => group.options.length > 0);
}

function serviceForHostname(snapshot: DashboardSnapshot, hostname: string): string {
  const resource = snapshot.resources.find(
    (item) => (item.type === "worker" || item.type === "pages") && item.hostnames.includes(hostname),
  );
  return resource?.name ?? "";
}

function healthForHostname(snapshot: DashboardSnapshot, hostname: string): "ok" | "error" {
  const health = snapshot.resources.find(
    (item) => item.type === "connector" && item.hostnames.includes(hostname),
  );
  return health?.status === "error" ? "error" : "ok";
}

function metricValue(snapshot: DashboardSnapshot, key: string, label: string, danger = false) {
  const value = metricNumber(snapshot, key);
  return {
    label,
    value: `${formatNumber(value)}${key === "r2Storage" ? " MiB" : ""}`,
    trend: "当前范围",
    danger,
  };
}

function metricNumber(snapshot: DashboardSnapshot, key: string): number {
  return snapshot.metrics.filter((row) => row.key === key).reduce((sum, row) => sum + row.value, 0);
}

function metricForScope(
  snapshot: DashboardSnapshot,
  key: string,
  scopeType: ScopeRef["type"],
  scopeId: string,
): number {
  return snapshot.metrics
    .filter((row) => row.key === key && row.scopeType === scopeType && row.scopeId === scopeId)
    .reduce((sum, row) => sum + row.value, 0);
}

function topBreakdowns(
  rows: TrafficBreakdown[],
  kind: TrafficBreakdown["kind"],
): TrafficBreakdown[] {
  return rows
    .filter((row) => row.kind === kind)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

function sourceQualityRows(rows: TrafficBreakdown[]): { source: TrafficBreakdown["source"]; value: number; helper: string }[] {
  const helpers: Record<TrafficBreakdown["source"], string> = {
    real: "Cloudflare",
    instrumented: "站内",
    estimated: "估算",
    cached: "缓存",
    unavailable: "不可用",
  };
  const totals = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.source] = (acc[row.source] || 0) + row.value;
    return acc;
  }, {});
  return (Object.keys(totals) as TrafficBreakdown["source"][]).map((source) => ({
    source,
    value: totals[source] || 0,
    helper: helpers[source],
  }));
}

function sourceLabel(source: TrafficBreakdown["source"]): string {
  if (source === "real") return "真实";
  if (source === "instrumented") return "站内埋点";
  if (source === "estimated") return "估算";
  if (source === "cached") return "缓存";
  return "不可用";
}

function sourceColor(source: TrafficBreakdown["source"]): string {
  if (source === "real") return "#2563eb";
  if (source === "instrumented") return "#16a34a";
  if (source === "estimated") return "#f59e0b";
  if (source === "cached") return "#64748b";
  return "#dc2626";
}

function usageForResource(resource: ResourceRecord, snapshot: DashboardSnapshot): string {
  if (resource.status === "empty") return "暂无资源";
  if (resource.type === "connector" && resource.metadata?.url) {
    const httpStatus = Number(resource.metadata.httpStatus || 0);
    const responseMs = Number(resource.metadata.responseMs || 0);
    const parts = [resource.status === "active" ? "正常" : "异常"];
    if (httpStatus) parts.push(String(httpStatus));
    if (responseMs) parts.push(`${responseMs} ms`);
    return parts.join(" · ");
  }
  if (resource.type === "zone") {
    const requests = metricForScope(snapshot, "requests", "domain", resource.domain || resource.name);
    const domain = snapshot.domains.find((item) => item.domain === resource.domain || item.domain === resource.name);
    return `${formatNumber(requests)} 请求 / ${domain?.bytesMiB ?? 0} MiB`;
  }
  if (resource.type === "worker") return `${formatNumber(metricForScope(snapshot, "workerRequests", "resource", resource.id))} 请求`;
  if (resource.type === "r2") return `${formatNumber(metricForScope(snapshot, "r2Operations", "resource", resource.id))} 操作`;
  if (resource.type === "kv") return `${formatNumber(metricForScope(snapshot, "kvOperations", "resource", resource.id))} 操作`;
  return resource.hostnames.length ? `${resource.hostnames.length} 个子域名` : "待采集";
}

function countResources(resources: ResourceRecord[]): Partial<Record<ResourceRecord["type"], number>> {
  return resources.reduce<Partial<Record<ResourceRecord["type"], number>>>((counts, resource) => {
    if (resource.status !== "empty") counts[resource.type] = (counts[resource.type] || 0) + 1;
    return counts;
  }, {});
}

function connectorPlanText(platform: string): string {
  if (platform === "Supabase") return "未来采集 Postgres、Auth、Storage、Edge Functions 与使用量。";
  if (platform === "Firebase") return "未来采集 Firestore、Auth、Hosting、Functions 与 Crash/日志。";
  if (platform === "Google Cloud") return "未来采集 Billing、Cloud Run、Logging、Storage 与告警。";
  return "已通过 Cloudflare API 与 D1 缓存接入。";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatDecimal(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function quotaPercent(value: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, (value / limit) * 100);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

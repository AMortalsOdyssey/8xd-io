import {
  AlertTriangle,
  BarChart3,
  Bell,
  Box,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Cloud,
  CloudLightning,
  Database,
  Globe2,
  HardDrive,
  HelpCircle,
  Home,
  Layers3,
  Link2,
  Lock,
  LogOut,
  Mail,
  Menu,
  RefreshCw,
  Scale,
  Search,
  Server,
  Settings,
  Shield,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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
  signInWithSupabaseGoogle,
  syncCloudflare,
  type AuthConfig,
} from "./api";
import type { DashboardSnapshot, TimeRange, TrendPoint } from "../shared/snapshot";
import type { ConnectorCard, ResourceRecord, ScopeOption, ScopeRef, TrafficBreakdown } from "../shared/types";

type NavKey =
  | "overview"
  | "lawyer"
  | "cloudflare"
  | "domains"
  | "workers"
  | "storage"
  | "database"
  | "connectors"
  | "alerts"
  | "settings";

const navItems: { key: NavKey; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "总览", icon: Home },
  { key: "lawyer", label: "律师主页", icon: Scale },
  { key: "cloudflare", label: "Cloudflare", icon: Cloud },
  { key: "domains", label: "域名", icon: Globe2 },
  { key: "workers", label: "Workers & Pages", icon: Server },
  { key: "storage", label: "存储", icon: HardDrive },
  { key: "database", label: "数据库与队列", icon: Database },
  { key: "connectors", label: "连接器", icon: Link2 },
  { key: "alerts", label: "告警与日志", icon: Bell },
  { key: "settings", label: "设置", icon: Settings },
];

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
  connector: "连接器",
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
  const [range, setRange] = useState<TimeRange>(() => initialRange());
  const [scope, setScope] = useState<ScopeRef>(() => initialScope());
  const [activeNav, setActiveNav] = useState<NavKey>(() => initialNav());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string>("刚刚同步");

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
    fetchDashboard(range, scope)
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
  }, [authenticated, range, scope]);

  useEffect(() => {
    if (activeNav === "lawyer" && (scope.type !== "domain" || scope.id !== "fangliying.com")) {
      setScope({ type: "domain", id: "fangliying.com" });
    }
  }, [activeNav, scope.type, scope.id]);

  async function handleLogin(password: string, turnstileToken?: string) {
    await login(password, turnstileToken);
    setAuthenticated(true);
  }

  async function handleLogout() {
    await logout();
    setAuthenticated(false);
  }

  async function handleSync() {
    setSyncMessage("同步中");
    try {
      const message = await syncCloudflare();
      setSyncMessage(message);
      const nextSnapshot = await fetchDashboard(range, scope);
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
      <Sidebar activeNav={activeNav} onNavigate={setActiveNav} />
      <main className="main-shell">
        <Topbar
          snapshot={snapshot}
          scope={scope}
          range={range}
          syncMessage={syncMessage}
          loading={loading}
          onScopeChange={setScope}
          onRangeChange={setRange}
          onSync={handleSync}
          onLogout={handleLogout}
        />
        {error ? <div className="notice danger">{error}</div> : null}
        <PageContent
          nav={activeNav}
          snapshot={snapshot}
          scope={scope}
          range={range}
          onScopeChange={setScope}
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

  useEffect(() => {
    let cancelled = false;
    getAuthConfig()
      .then(async (config) => {
        if (cancelled) return;
        setAuthConfig(config);
        try {
          const exchanged = await exchangeExistingSupabaseSession(config);
          if (exchanged && !cancelled) onAuthenticated();
        } catch (sessionError) {
          if (!cancelled) setError(sessionError instanceof Error ? sessionError.message : "Supabase 登录失败");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthConfig(defaultAuthConfig);
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
      setNotice("登录链接已发送，请到邮箱中确认。");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "邮箱登录链接发送失败");
    } finally {
      setBusy(false);
    }
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
        <div className="auth-provider-panel">
          <div className="auth-provider-title">
            <KeyStatus enabled={authConfig.supabaseEnabled} />
            <span>免密登录</span>
          </div>
          {authConfig.supabaseEnabled ? (
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
          ) : (
            <p>Supabase Free 可接邮箱免密和 Google 登录；当前生产环境未配置项目 URL / publishable key，所以先保留密码登录。</p>
          )}
          <div className="auth-provider-list">
            {authConfig.authProviders.map((provider) => (
              <span className={`auth-chip ${provider.status}`} key={provider.provider} title={provider.detail}>
                {provider.label} · {provider.costLabel}
              </span>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}

function KeyStatus({ enabled }: { enabled: boolean }) {
  return enabled ? <CheckCircle2 size={16} /> : <Lock size={16} />;
}

function LoadingShell() {
  return (
    <div className="loading-shell">
      <RefreshCw className="spin" size={22} />
      <span>正在加载 Dashboard</span>
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
        <Menu size={18} />
        <span className="brand-mark">8XD</span>
        <span>8XD.IO</span>
      </div>
      <nav className="side-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={item.key === activeNav ? "nav-item active" : "nav-item"}
              key={item.key}
              onClick={() => onNavigate(item.key)}
            >
              <Icon size={17} />
              <span>{item.label}</span>
              {item.key === "connectors" ? <span className="new-badge">新</span> : null}
            </button>
          );
        })}
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
  const scopeOptions = useMemo(() => flattenScopes(snapshot), [snapshot]);

  return (
    <header className="topbar">
      <div className="search-box">
        <Search size={16} />
        <input placeholder="搜索资源、指标或文档..." />
        <kbd>⌘K</kbd>
      </div>
      <label className="scope-select">
        <span>范围</span>
        <select value={scopeValue(scope)} onChange={(event) => onScopeChange(parseScope(event.target.value))}>
          {scopeOptions.map((option) => (
            <option key={scopeValue(option)} value={scopeValue(option)}>
              {option.kindLabel} / {option.label}
            </option>
          ))}
        </select>
      </label>
      <div className="range-group" aria-label="时间范围">
        {(Object.keys(rangeLabels) as TimeRange[]).map((item) => (
          <button
            className={item === range ? "range-button active" : "range-button"}
            key={item}
            onClick={() => onRangeChange(item)}
          >
            <CalendarDays size={15} />
            {rangeLabels[item]}
          </button>
        ))}
      </div>
      <div className="sync-pill">
        <span className="sync-dot" />
        {syncMessage}
      </div>
      <button className="icon-button" onClick={onSync} title="刷新并同步 Cloudflare">
        <RefreshCw className={loading ? "spin" : undefined} size={17} />
        <span>刷新</span>
      </button>
      <button className="icon-only" title="帮助">
        <HelpCircle size={18} />
      </button>
      <button className="avatar-button" onClick={onLogout} title="退出登录">
        <span>J</span>
        <LogOut size={14} />
      </button>
    </header>
  );
}

function PageContent({
  nav,
  snapshot,
  scope,
  range,
  onScopeChange,
}: {
  nav: NavKey;
  snapshot: DashboardSnapshot;
  scope: ScopeRef;
  range: TimeRange;
  onScopeChange: (scope: ScopeRef) => void;
}) {
  if (nav === "cloudflare") return <CloudflareView snapshot={snapshot} onScopeChange={onScopeChange} />;
  if (nav === "lawyer") return <LawyerHomepageView snapshot={snapshot} onScopeChange={onScopeChange} />;
  if (nav === "domains") return <DomainsView snapshot={snapshot} onScopeChange={onScopeChange} />;
  if (nav === "workers") return <WorkersPagesView snapshot={snapshot} onScopeChange={onScopeChange} />;
  if (nav === "storage") return <StorageView snapshot={snapshot} onScopeChange={onScopeChange} />;
  if (nav === "database") return <DatabaseView snapshot={snapshot} />;
  if (nav === "connectors") return <ConnectorsView snapshot={snapshot} />;
  if (nav === "alerts") return <AlertsView snapshot={snapshot} />;
  if (nav === "settings") return <SettingsView snapshot={snapshot} range={range} scope={scope} />;
  return <OverviewView snapshot={snapshot} onScopeChange={onScopeChange} />;
}

function OverviewView({
  snapshot,
  onScopeChange,
}: {
  snapshot: DashboardSnapshot;
  onScopeChange: (scope: ScopeRef) => void;
}) {
  return (
    <div className="page-grid">
      <section className="content-column">
        <PageHeader
          title={snapshot.summary.title}
          description="所有平台的资源、用量与健康状态。当前第一版真实接入 Cloudflare，其它平台保持连接器占位。"
        />
        <KpiStrip snapshot={snapshot} />
        {snapshot.summary.emptyState ? <div className="notice">{snapshot.summary.emptyState}</div> : null}
        <TrendCard title="访问与请求趋势" trends={snapshot.trends} />
        <CloudflareMetrics snapshot={snapshot} />
        <ResourceTable snapshot={snapshot} onScopeChange={onScopeChange} />
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
  onScopeChange,
}: {
  snapshot: DashboardSnapshot;
  onScopeChange: (scope: ScopeRef) => void;
}) {
  const [typeFilter, setTypeFilter] = useState<ResourceRecord["type"] | "all">("all");
  const cloudflareResources = snapshot.resources.filter((resource) => resource.platform === "Cloudflare");
  const filteredResources =
    typeFilter === "all" ? cloudflareResources : cloudflareResources.filter((resource) => resource.type === typeFilter);

  return (
    <div className="full-page">
      <PageHeader
        title="Cloudflare 指标"
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
        <OriginPanel snapshot={snapshot} />
      </div>
      <CloudflareMetrics snapshot={snapshot} />
      <ResourceTable
        snapshot={{ ...snapshot, resources: filteredResources }}
        onScopeChange={onScopeChange}
        title="Cloudflare 资源明细"
      />
    </div>
  );
}

function DomainsView({
  snapshot,
  onScopeChange,
}: {
  snapshot: DashboardSnapshot;
  onScopeChange: (scope: ScopeRef) => void;
}) {
  return (
    <div className="full-page">
      <PageHeader
        title="域名管理"
        description="根域名、子域名、关联项目、请求、访问、威胁和最高峰日期。可从这里切换到单个域名或 hostname 的专属 Dashboard。"
      />
      <div className="notice subtle">
        根域名请求来自 Cloudflare 真实 Zone 汇总；子域名明细在 Cloudflare 未返回 host 维度时会按估算展示，并在律师主页页签单独标注数据来源。
      </div>
      <div className="domain-grid">
        {snapshot.domains.map((domain) => (
          <button className="domain-card" key={domain.domain} onClick={() => onScopeChange({ type: "domain", id: domain.domain })}>
            <div className="card-title-row">
              <Globe2 size={18} />
              <strong>{domain.domain}</strong>
              <span className="status success">{domain.status === "active" ? "正常" : domain.status}</span>
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
          <div className="table-row table-head">
            <span>子域名</span>
            <span>所属根域名</span>
            <span>状态</span>
            <span>操作</span>
          </div>
          {snapshot.domains.flatMap((domain) =>
            domain.hostnames.map((hostname) => (
              <div className="table-row" key={`${domain.domain}:${hostname}`}>
                <span>{hostname}</span>
                <span>{domain.domain}</span>
                <span className="status success">正常</span>
                <button className="text-button" onClick={() => onScopeChange({ type: "hostname", id: hostname })}>
                  查看专属 Dashboard
                  <ChevronRight size={15} />
                </button>
              </div>
            )),
          )}
        </div>
      </Panel>
    </div>
  );
}

function LawyerHomepageView({
  snapshot,
  onScopeChange,
}: {
  snapshot: DashboardSnapshot;
  onScopeChange: (scope: ScopeRef) => void;
}) {
  const domain = snapshot.domains.find((item) => item.domain === "fangliying.com");
  const breakdowns = snapshot.trafficBreakdowns.filter((row) => row.scopeId === "fangliying.com");
  const cloudflareViews = breakdowns.find((row) => row.kind === "event" && row.label.includes("Cloudflare"))?.value || domain?.visits || 0;
  const instrumentedViews = breakdowns
    .filter((row) => row.kind === "event" && row.source === "instrumented")
    .reduce((sum, row) => sum + row.value, 0);
  const agentRequests = breakdowns
    .filter((row) => row.kind === "agent" && /Agent|爬虫|监控|AI|bot/i.test(row.label))
    .reduce((sum, row) => sum + row.value, 0);

  return (
    <div className="full-page lawyer-page">
      <PageHeader
        title="律师主页流量"
        description="fangliying.com 的请求、访问、来源、地区、路径与站内埋点。Cloudflare 根域名请求和浏览器 pageview 分开展示。"
      />
      <div className="toolbar-panel">
        <button className="secondary-button" onClick={() => onScopeChange({ type: "domain", id: "fangliying.com" })}>
          <Globe2 size={15} />
          fangliying.com
        </button>
        <span className="muted">请求数包含 HTML、JS、CSS、图片、预览抓取、搜索爬虫和 Agent；站内埋点只统计浏览器页面事件。</span>
      </div>
      <div className="lawyer-kpis">
        <MetricInline label="Cloudflare 请求" value={formatNumber(domain?.requests || metricForScope(snapshot, "requests", "domain", "fangliying.com"))} status="根域名" />
        <MetricInline label="Cloudflare 访问" value={formatNumber(cloudflareViews)} status="pageViews" />
        <MetricInline label="站内埋点" value={instrumentedViews ? formatNumber(instrumentedViews) : "待采集"} status="pageview" />
        <MetricInline label="疑似 Agent" value={agentRequests ? formatNumber(agentRequests) : "待校准"} status="近似归因" />
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
      </div>
      <div className="two-up">
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
            <p>律师主页新增的 pageview beacon 会从浏览器端补充路径、Referer、设备和会话，不记录原始 IP。</p>
            <p>如果后续开启 Cloudflare Logpush 或 Bot Management，可以把 IP 属地、Bot score 和路径维度进一步做成真实明细。</p>
          </div>
        </Panel>
      </div>
    </div>
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
                <CartesianGrid stroke="#e8edf5" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={118} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, borderColor: "#dfe5ee" }}
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
  onScopeChange,
}: {
  snapshot: DashboardSnapshot;
  onScopeChange: (scope: ScopeRef) => void;
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
              <span className={resource.status === "active" ? "status success" : "status muted"}>
                {statusLabels[resource.status]}
              </span>
            </div>
          ))}
        </Panel>
        <TrendCard title="Worker 请求趋势" trends={snapshot.trends} compact />
      </div>
      <ResourceTable snapshot={{ ...snapshot, resources }} onScopeChange={onScopeChange} title="绑定资源" />
    </div>
  );
}

function StorageView({
  snapshot,
  onScopeChange,
}: {
  snapshot: DashboardSnapshot;
  onScopeChange: (scope: ScopeRef) => void;
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
      <ResourceTable snapshot={{ ...snapshot, resources }} onScopeChange={onScopeChange} title="存储资源列表" />
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
        description="D1、Queues、Vectorize 作为扩展位保留；当前 Cloudflare 账号下暂无这些资源。"
      />
      <div className="empty-resource-grid">
        {emptyResources.map((resource) => (
          <Panel title={resource.name} key={resource.id}>
            <div className="empty-state">
              <Database size={28} />
              <strong>{resource.metadata?.emptyLabel ? String(resource.metadata.emptyLabel) : "暂无资源"}</strong>
              <span>未来可用于 Dashboard 缓存、任务队列、向量检索和告警聚合。</span>
            </div>
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
        <Panel title="同步热力">
          <div className="heatmap" aria-label="同步热力">
            {Array.from({ length: 120 }, (_, index) => (
              <span className={index > 111 ? "heat active" : index % 13 === 0 ? "heat mid" : "heat"} key={index} />
            ))}
          </div>
          <div className="heat-legend">
            <span>少</span>
            <i />
            <i className="mid" />
            <i className="active" />
            <span>多</span>
          </div>
        </Panel>
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
                <button className="secondary-button">{connector.real ? "管理连接" : "待授权"}</button>
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

function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <span className="source-chip">
        <Sparkles size={14} />
        多域名 / 多项目
      </span>
    </div>
  );
}

function KpiStrip({ snapshot, compact = false }: { snapshot: DashboardSnapshot; compact?: boolean }) {
  return (
    <div className={compact ? "kpi-grid compact" : "kpi-grid"}>
      {snapshot.summary.cards.map((card) => (
        <div className={`kpi-card ${card.tone}`} key={card.label}>
          <div className="kpi-icon">
            <BarChart3 size={18} />
          </div>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <small>{card.helper}</small>
          <em>{card.tone === "red" ? "未处理" : rangeLabels[snapshot.range]}</em>
        </div>
      ))}
    </div>
  );
}

function TrendCard({
  title,
  trends,
  compact = false,
}: {
  title: string;
  trends: TrendPoint[];
  compact?: boolean;
}) {
  return (
    <Panel title={title} className={compact ? "trend-panel compact" : "trend-panel"}>
      <div className="chart-tabs">
        <span className="chart-tab active">请求数</span>
        <span className="chart-tab">访问量</span>
        <span className="chart-tab">错误</span>
      </div>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trends} margin={{ top: 12, right: 18, bottom: 0, left: 12 }}>
            <defs>
              <linearGradient id="requestsFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e8edf5" vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={18} />
            <YAxis tickLine={false} axisLine={false} width={58} />
            <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#dfe5ee" }} />
            <Area type="monotone" dataKey="requests" stroke="#2563eb" fill="url(#requestsFill)" strokeWidth={2} />
            <Line type="monotone" dataKey="visits" stroke="#f97316" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function CloudflareMetrics({ snapshot }: { snapshot: DashboardSnapshot }) {
  const metrics: { label: string; value: string; trend: string; danger?: boolean }[] = [
    metricValue(snapshot, "requests", "请求数"),
    { label: "错误率", value: "0.00%", trend: "0%" },
    { label: "CPU 时间", value: `${formatNumber(metricNumber(snapshot, "workerCpuMs"))} ms`, trend: "当前范围" },
    { label: "总耗时", value: `${formatNumber(metricNumber(snapshot, "workerWallMs"))} ms`, trend: "当前范围" },
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
            <div className="mini-spark" />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ResourceTable({
  snapshot,
  onScopeChange,
  title = "资源列表",
}: {
  snapshot: DashboardSnapshot;
  onScopeChange: (scope: ScopeRef) => void;
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
        {snapshot.resources.map((resource) => (
          <div className="table-row" key={resource.id}>
            <span className="resource-name">
              {resourceIcon(resource)}
              <span>{resource.name}</span>
            </span>
            <span>{resourceTypeLabels[resource.type]}</span>
            <span className={resource.status === "empty" ? "status muted" : "status success"}>
              {statusLabels[resource.status]}
            </span>
            <span>{resource.domain || resource.projectKey}</span>
            <span>{usageForResource(resource, snapshot)}</span>
            <button className="text-button" onClick={() => onScopeChange({ type: "resource", id: resource.id })}>
              查看详情
              <ChevronRight size={15} />
            </button>
          </div>
        ))}
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
            <ChevronRight size={15} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function HealthPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  const counts = countResources(snapshot.resources);
  return (
    <Panel title="资源健康">
      <div className="health-grid">
        <MetricInline label="域名 (Zones)" value={String(counts.zone || 0)} status="正常" />
        <MetricInline label="Pages 项目" value={String(counts.pages || 0)} status="正常" />
        <MetricInline label="Worker 脚本" value={String(counts.worker || 0)} status="正常" />
        <MetricInline label="R2 存储桶" value={String(counts.r2 || 0)} status="正常" />
        <MetricInline label="KV 命名空间" value={String(counts.kv || 0)} status="正常" />
        <MetricInline label="D1 / Queues / Vectorize" value="暂无" status="暂无" />
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
      <span className="muted">数据源：Cloudflare API / D1 缓存</span>
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

function OriginPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <Panel title="子域名 / 来源">
      <div className="origin-search">
        <Search size={15} />
        <span>搜索来源...</span>
      </div>
      <div className="table compact-table">
        <div className="table-row table-head">
          <span>来源</span>
          <span>请求数</span>
          <span>请求耗时</span>
        </div>
        {snapshot.scopes.hostnames.slice(0, 5).map((hostname) => (
          <div className="table-row" key={hostname.id}>
            <span>{hostname.label}</span>
            <span>{formatNumber(metricForScope(snapshot, "requests", "hostname", hostname.id))}</span>
            <span>0.65 ms</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Panel({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className ? `panel ${className}` : "panel"}>
      <div className="panel-header">
        <h2>{title}</h2>
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
      <strong>{value}</strong>
      {status ? <em>{status}</em> : null}
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

function resourceIcon(resource: ResourceRecord) {
  if (resource.type === "zone") return <Globe2 size={16} />;
  if (resource.type === "pages") return <Layers3 size={16} />;
  if (resource.type === "worker") return <Server size={16} />;
  if (resource.type === "r2") return <HardDrive size={16} />;
  if (resource.type === "kv") return <Database size={16} />;
  return <Box size={16} />;
}

function flattenScopes(snapshot: DashboardSnapshot): ScopeOption[] {
  return [
    snapshot.scopes.global,
    ...snapshot.scopes.projects,
    ...snapshot.scopes.domains,
    ...snapshot.scopes.hostnames,
    ...snapshot.scopes.resources,
  ];
}

function scopeValue(scope: ScopeRef): string {
  return `${scope.type}:${scope.id}`;
}

function parseScope(value: string): ScopeRef {
  const [type, ...rest] = value.split(":");
  const id = rest.join(":");
  if (type === "project" || type === "domain" || type === "hostname" || type === "resource") return { type, id };
  return { type: "global", id: "global" };
}

function initialNav(): NavKey {
  const view = new URLSearchParams(window.location.search).get("view");
  return navItems.some((item) => item.key === view) ? (view as NavKey) : "overview";
}

function initialRange(): TimeRange {
  const value = new URLSearchParams(window.location.search).get("range");
  return value === "24h" || value === "7d" || value === "30d" ? value : "30d";
}

function initialScope(): ScopeRef {
  const params = new URLSearchParams(window.location.search);
  return parseScope(`${params.get("scopeType") || "global"}:${params.get("scopeId") || "global"}`);
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
  if (source === "estimated") return "#f97316";
  if (source === "cached") return "#64748b";
  return "#ef4444";
}

function usageForResource(resource: ResourceRecord, snapshot: DashboardSnapshot): string {
  if (resource.status === "empty") return "暂无资源";
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

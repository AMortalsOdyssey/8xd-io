export type Platform = "Cloudflare" | "Supabase" | "Firebase" | "Google Cloud";

export type ResourceType =
  | "zone"
  | "hostname"
  | "pages"
  | "worker"
  | "r2"
  | "kv"
  | "d1"
  | "queue"
  | "vectorize"
  | "connector";

export type ScopeType = "global" | "project" | "domain" | "hostname" | "resource";

export type ConnectorStatus = "connected" | "disconnected" | "planned" | "failed";

export type MetricSource = "real" | "cached" | "estimated" | "instrumented" | "unavailable";

export interface ScopeRef {
  type: ScopeType;
  id: string;
}

export interface ScopeOption extends ScopeRef {
  label: string;
  kindLabel: string;
  parentId?: string;
  badge?: string;
}

export interface ScopeTree {
  global: ScopeOption;
  projects: ScopeOption[];
  domains: ScopeOption[];
  hostnames: ScopeOption[];
  resources: ScopeOption[];
}

export interface ResourceRecord {
  id: string;
  platform: Platform;
  type: ResourceType;
  name: string;
  status: "active" | "inactive" | "empty" | "error" | "planned";
  projectKey: string;
  domain?: string;
  hostnames: string[];
  shared: boolean;
  metadata?: Record<string, unknown>;
  lastSyncedAt?: string;
}

export interface MetricRow {
  key: string;
  label: string;
  value: number;
  unit: string;
  range: "24h" | "7d" | "30d";
  date: string;
  scopeType: ScopeType;
  scopeId: string;
  source: MetricSource;
}

export type BreakdownKind =
  | "country"
  | "path"
  | "referrer"
  | "agent"
  | "host"
  | "source"
  | "event";

export interface TrafficBreakdown {
  id: string;
  scopeType: ScopeType;
  scopeId: string;
  kind: BreakdownKind;
  label: string;
  value: number;
  unit: "requests" | "views" | "sessions" | "events";
  source: MetricSource;
  helper?: string;
  date?: string;
}

export interface TrafficInsight {
  id: string;
  title: string;
  value: string;
  detail: string;
  tone: "info" | "success" | "warning" | "danger" | "muted";
}

export interface AuthProviderStatus {
  provider: "password" | "supabase" | "firebase";
  label: string;
  status: "active" | "available" | "blocked" | "not_configured";
  costLabel: string;
  detail: string;
}

export interface Connector {
  platform: Platform;
  status: ConnectorStatus;
  real: boolean;
  lastSyncedAt?: string;
  message?: string;
}

export interface ConnectorCard {
  platform: Platform;
  label: string;
  tone: "success" | "muted" | "planned" | "danger";
  sourceLabel: "真实数据" | "未接入";
}

export interface KpiCard {
  label: string;
  value: string;
  helper: string;
  tone: "blue" | "orange" | "green" | "gray" | "red";
}

export interface DashboardSummary {
  title: string;
  cards: KpiCard[];
  emptyState?: string;
}

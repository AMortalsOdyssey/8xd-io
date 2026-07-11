# 8XD.IO Dashboard

独立私有 Dashboard，用于集中查看多个域名、多个项目、Cloudflare 资源、用量趋势、律师主页流量归因、存储、连接器状态和未来多平台接入状态。

## 本地开发

```bash
npm install
npm run dev
```

Vite 开发模式默认使用 `src/shared/snapshot.ts` 中的开发预览快照。若要走 Worker API，将 `.dev.vars.example` 复制为 `.dev.vars` 并设置：

```bash
VITE_USE_WORKER_API=1 npm run worker:dev
```

## 律师主页流量

`fangliying.com` 通过 `/api/collect/pageview` 写入浏览器端 pageview。接口只允许 `ANALYTICS_ALLOWED_ORIGINS` 中的来源，原始 IP 不落库，只保存 HMAC 哈希、国家/地区、路径、Referer、设备、事件名和 session id。

Dashboard 中的 `律师主页` 页签会分开展示：

- Cloudflare 根域名 HTTP 请求
- Cloudflare Web Analytics pageViews
- 站内 pageview 埋点
- 请求地区、路径、来源和 Agent 近似归因
- 每条归因数据的来源标记：真实、站内埋点、估算或缓存

## 资源同步与健康监控

生产 Worker 每 15 分钟同步一次 Cloudflare 资源和指标。同步会读取 Workers Custom Domains，自动把 Worker、根域名和子域名关联到同一个项目，不再为单个 Worker 硬编码 hostname。

`HEALTHCHECK_TARGETS` 使用 JSON 数组配置健康检查目标：

```json
[
  {
    "id": "jovlo",
    "name": "Jovlo.ai",
    "url": "https://jovlo.8xd.io/api/health",
    "projectKey": "jovlo",
    "domain": "8xd.io"
  }
]
```

每次检查会保存当前状态、HTTP 状态码和响应时间，并保留 30 天运行记录。失败时创建 Dashboard 告警，恢复后自动关闭对应告警。

## 登录方案

当前生产默认使用管理员密码、HttpOnly Session Cookie 和 Cloudflare Turnstile。

Supabase 已作为可选登录提供方接入：配置 `SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY` 和 `DASHBOARD_ALLOWED_EMAILS` 后，前端可使用 Magic Link 或 Google OAuth 登录，并通过 `/api/auth/supabase/exchange` 换取 Dashboard Session。

Firebase Auth 支持 Google 登录，Spark 计划可免费起步；但一旦启用 GCP/Blaze 相关服务会进入按量计费边界，因此本 Dashboard 暂不默认启用 Firebase。

## Cloudflare 部署准备

1. 创建 D1 数据库 `8xd_dashboard_metrics`。
2. 将 `wrangler.jsonc` 中的 `database_id` 替换为真实 D1 database id。
3. 配置 secrets：

```bash
npx wrangler secret put DASHBOARD_ADMIN_PASSWORD
npx wrangler secret put DASHBOARD_AUTH_SECRET
npx wrangler secret put CF_ACCOUNT_ID
npx wrangler secret put CF_API_TOKEN
npx wrangler secret put DASHBOARD_ALLOWED_EMAILS
```

4. 执行迁移并部署：

```bash
npm run build
npm run db:migrate:remote
npx wrangler deploy
```

5. 在 Cloudflare Workers Routes / Custom Domains 中绑定 `dashboard.8xd.io`。

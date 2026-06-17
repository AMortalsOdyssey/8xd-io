# Image Host / 图床服务

**中文**：`apps/img-host` 是一个 Cloudflare Worker 图床模块。根路径返回展示页，其他路径按对象 key 从对象存储读取文件，并返回公开读取所需的 CORS 头。

**English**: `apps/img-host` is a Cloudflare Worker image-host module. The root path serves a landing page, while other paths map to object keys in object storage and return browser-safe CORS headers.

## Local Setup / 本地配置

Copy the public example config before deploying:

```bash
cp wrangler.example.jsonc wrangler.jsonc
```

Then replace the placeholder route and bucket values with your local deployment settings.

复制公开模板后再部署：

```bash
cp wrangler.example.jsonc wrangler.jsonc
```

然后在本地 `wrangler.jsonc` 中替换路由和存储桶配置。真实部署配置不应提交到 public 仓库。

## Commands / 命令

```bash
npm run check
npm run deploy:dry-run
npm run deploy
```

## Public Safety / 公开安全

- Keep secrets in local environment files only.
- Keep deployment identifiers out of committed config.
- Commit reusable Worker logic and example configuration only.

- 密钥只放在本地环境文件中。
- 不提交真实部署标识。
- 仓库只提交可复用 Worker 逻辑和公开配置模板。

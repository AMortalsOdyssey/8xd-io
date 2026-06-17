# Cloudflare Templates / Cloudflare 模板

This folder stores public Cloudflare deployment templates and notes.

本目录存放可公开的 Cloudflare 部署模板与说明。

## Rules / 规则

- Commit example configuration only.
- Keep account IDs, zone IDs, tokens, and private bucket names out of git.
- Prefer `*.example.jsonc` files for Worker configuration.
- Keep `.dev.vars` and real `wrangler.jsonc` files local.

- 只提交示例配置。
- 不提交 account ID、zone ID、Token 或私有 bucket 名称。
- Worker 配置优先使用 `*.example.jsonc`。
- `.dev.vars` 和真实 `wrangler.jsonc` 只保留在本地。

<p align="center">
  <img src="./assets/readme/hero-banner.png" alt="8xd.io pixel banner showing a quiet blue-robed figure overlooking misty mountain infrastructure" width="100%">
</p>

# 8xd.io Monorepo

![License](https://img.shields.io/badge/license-MIT-0f8f8c)
![Node](https://img.shields.io/badge/node-%3E%3D20-15212f)
![Runtime](https://img.shields.io/badge/runtime-Cloudflare%20Workers-f4b860)
![Structure](https://img.shields.io/badge/structure-public%20monorepo-657386)

**中文**：这是 8xd.io 的公开主仓库，用来统一管理这个域名下的前端、后端、边缘服务、共享组件、Skills、工作流和基础设施模板。

**English**: This is the public root repository for 8xd.io, organized as a monorepo for frontends, backends, edge services, shared packages, skills, workflows, and infrastructure templates.

## Repository Shape / 仓库结构

```text
8xd-io/
  apps/                 # Domain-facing applications and large public modules
  services/             # APIs, workers, queues, and backend services
  packages/             # Shared UI, config, utilities, and reusable code
  skills/               # Public agent skills, workflows, and prompt templates
  infra/                # Public infrastructure templates and deployment notes
  docs/                 # Architecture notes and runbooks
  assets/readme/        # README images and visual assets
  scripts/              # Public maintenance scripts
  templates/            # Starter templates for future modules
```

## Current Modules / 当前模块

| Path | Type | Description |
| --- | --- | --- |
| `apps/img-host` | Cloudflare Worker | Public image delivery backed by object storage. |
| `apps/homepage` | App submodule | Public homepage module managed as an independent repository. |
| `apps/share-pages` | App submodule | Public share-page module managed as an independent repository. |
| `packages/ui` | Package | Shared interface components. |
| `packages/config` | Package | Shared lint, TypeScript, and tool configuration. |
| `packages/utils` | Package | Small shared utilities. |
| `skills/` | Skills | Public skills, workflows, and prompt templates. |

## Dependencies / 依赖

Minimum local tools:

- Node.js `>=20`
- npm with workspace support
- Wrangler for Cloudflare Worker development and deployment
- A Cloudflare account and an object storage bucket for modules that need them

常用本地工具：

- Node.js `>=20`
- 支持 workspace 的 npm
- 用于 Cloudflare Worker 开发和部署的 Wrangler
- 需要部署相关模块时，再配置 Cloudflare 账号与对象存储桶

## Development / 开发

Install dependencies:

```bash
npm install
```

Clone submodules after a normal clone:

```bash
git submodule update --init --recursive
```

Run all available checks:

```bash
npm run check
```

Run the image-host syntax check:

```bash
npm run img-host:check
```

## Module Strategy / 模块策略

**中文**：小模块直接放在这个仓库中，方便统一维护、复用组件和共享配置。已经足够大、拥有独立发布节奏或历史提交的模块，可以保留独立仓库，再作为 submodule 挂到 `apps/` 或 `services/` 下。

**English**: Small modules live directly in this monorepo for easier maintenance and reuse. Larger modules with their own release cadence or history can stay in separate repositories and be mounted as submodules under `apps/` or `services/`.

## Security / 安全边界

This is a public repository. Keep it safe by default:

- Do not commit secrets, tokens, private keys, cookies, or credentials.
- Do not commit local machine paths or personal environment details.
- Do not commit private service URLs, private model endpoints, or proprietary model source code.
- Use `*.example.*` files for deploy configuration templates.
- Keep real deployment files such as `wrangler.jsonc`, `.dev.vars`, and `.env` files local.

这是一个 public 仓库，默认按公开安全标准维护：

- 不提交密钥、Token、私钥、Cookie 或凭证。
- 不提交本机路径、个人环境信息。
- 不提交私有服务 URL、私有模型端点或非公开模型源码。
- 部署配置使用 `*.example.*` 模板。
- 真实部署文件，例如 `wrangler.jsonc`、`.dev.vars`、`.env`，只保留在本地环境。

## License / 许可证

MIT License. See [LICENSE](./LICENSE).

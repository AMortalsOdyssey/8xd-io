# Architecture Notes / 架构说明

This folder records public architecture notes for the 8xd.io monorepo.

本目录用于记录 8xd.io 主仓库中可以公开的架构说明。

## Boundaries / 边界

- `apps/`: user-facing applications and large modules
- `services/`: APIs, workers, and background services
- `packages/`: reusable code and shared configuration
- `skills/`: agent skills, workflows, and prompt templates
- `infra/`: public deployment templates and runbooks

Sensitive runtime details belong in local configuration, not in this repository.

敏感运行时信息只应保存在本地配置中，不进入本仓库。

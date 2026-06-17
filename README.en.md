<p align="center">
  <img src="./assets/readme/hero-banner.png" alt="8xd.io banner" width="100%">
</p>

<p align="center">
  <a href="./README.md">中文</a> · English
</p>

# 8xd.io

8xd.io is where I keep the public things that live under the 8xd.io domain: small tools, web pages, image hosting, share pages, reusable pieces, and lightweight automation.

It is not one single product, and it is not a temporary demo folder. It is a long-running public workspace where new ideas can start small, become useful, and later grow into standalone apps, services, packages, or skills.

## What It Does

- Hosts public pages and small apps under the 8xd.io domain
- Keeps lightweight services such as image hosting, share pages, and display pages together
- Collects reusable UI pieces, configs, scripts, and utilities
- Stores public skills, workflows, and prompt templates
- Gives the whole domain one clear home instead of scattering work across unrelated repositories

## What Is Here

| Module | Purpose |
| --- | --- |
| `img-host` | Public image hosting and image-host landing page |
| `homepage` | The 8xd.io homepage |
| `share-pages` | Public share pages |
| `packages` | Reusable components, configs, and utilities |
| `skills` | Public skills, workflows, and prompt templates |

## How It Grows

Small modules stay here so they are easy to maintain and reuse.

When a module becomes large enough, or needs its own release rhythm, it can live in a separate repository and stay connected from here. That keeps the workspace organized without losing the single domain-level entry point.

## Public Boundary

This repository is public, so it only contains things that are safe to publish.

It does not include:

- Secrets, tokens, cookies, or private keys
- Local machine paths or personal environment details
- Private service URLs
- Private model endpoints or non-public model source code
- Real deployment configuration

## Maintenance

Main tools:

- Node.js 20+
- npm
- Wrangler, only for modules that deploy edge services

Common checks:

```bash
npm install
npm run check
```

## License

MIT

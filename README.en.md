<h1 align="center">8xd.io</h1>

<p align="center">
  <strong>A place for public tools, pages, and creative building blocks to grow.</strong>
</p>

<p align="center">
  Image hosting, share pages, the homepage, components, skills, and lightweight automation start here.
</p>

<p align="center">
  <img alt="public repository" src="https://img.shields.io/badge/public-repository-15212f">
  <img alt="license MIT" src="https://img.shields.io/badge/license-MIT-0f8f8c">
  <img alt="image host" src="https://img.shields.io/badge/image_host-online-1f8fbc">
  <img alt="apps and skills" src="https://img.shields.io/badge/apps_%2B_skills-growing-f4b860">
</p>

<p align="center">
  <a href="https://8xd.io">Website</a>
  · <a href="https://img.8xd.io">Image Host</a>
  · <a href="./apps">Apps</a>
  · <a href="./skills">Skills</a>
  · <a href="./README.md">中文</a>
</p>

<p align="center">
  <a href="./README.md">中文</a> | <strong>English</strong>
</p>

<p align="center">
  <img src="./assets/readme/hero-banner.png" alt="8xd.io banner" width="100%">
</p>

## What This Is

8xd.io is my public workspace. It keeps the small tools, image hosting, share pages, homepage, and reusable pieces around this domain in one place.

It is intentionally lightweight. New ideas can start as something small and usable; the ones that last can grow into apps, services, packages, or skills.

## What It Can Do

- Publish public pages, small tools, and display-focused services
- Keep public images and shareable content accessible
- Reuse UI, configuration, scripts, and utilities
- Maintain public skills, workflows, and prompt templates
- Give the domain one clear entry point

## Current Entrypoints

| Entry | Purpose |
| --- | --- |
| [`img-host`](./apps/img-host) | Image hosting and image-host landing page |
| [`homepage`](./apps/homepage) | The 8xd.io homepage |
| [`share-pages`](./apps/share-pages) | Public share pages |
| [`packages`](./packages) | Reusable components, configs, and utilities |
| [`skills`](./skills) | Public skills, workflows, and prompt templates |

## How It Grows

Small modules stay here so they are easy to try, change, and reuse.

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

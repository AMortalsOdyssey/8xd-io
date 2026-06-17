<h1 align="center">8xd.io</h1>

<p align="center">
  <strong>一个给公开小工具、页面和创作能力生长的地方。</strong>
</p>

<p align="center">
  图床、分享页、主站、组件、Skills 和轻量自动化，都从这里找到入口。
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
  · <a href="./README.en.md">English</a>
</p>

<p align="center">
  <strong>中文</strong> | <a href="./README.en.md">English</a>
</p>

<p align="center">
  <img src="./assets/readme/hero-banner.png" alt="8xd.io banner" width="100%">
</p>

## 这是什么

8xd.io 是我的公开工作台。它把围绕这个域名的小工具、图床、分享页、主站和可复用能力放在一起。

这里不追求一次把系统设计得很重。新的想法可以先落成一个能用的小东西；用得久了，再沉淀成独立应用、服务、组件或 Skill。

## 可以做什么

- 对外发布页面、小工具和展示型服务
- 存放可以公开访问的图片与分享内容
- 复用 UI、配置、脚本和工具
- 维护可以公开的 Skills、工作流和提示词模板
- 让同一域名下的能力有一个统一入口

## 当前入口

| 入口 | 用来做什么 |
| --- | --- |
| [`img-host`](./apps/img-host) | 图床与图片展示页 |
| [`homepage`](./apps/homepage) | 8xd.io 主站 |
| [`share-pages`](./apps/share-pages) | 公开分享页 |
| [`packages`](./packages) | 可复用组件、配置和工具 |
| [`skills`](./skills) | 可以公开的 Skills、工作流和提示词模板 |

## 生长方式

小模块直接放在这里，方便快速试、快速改、快速复用。

如果某个模块变得足够大，或者需要自己的发布节奏，它可以拆成独立仓库，再挂回这里。这样既有总入口，也不会把所有东西搅在一起。

## 公开边界

这个仓库是公开的，所以这里只放可以公开的内容。

不会提交：

- 密钥、Token、Cookie、私钥
- 本机路径、个人环境信息
- 私有服务地址
- 私有模型地址或非公开模型源码
- 真实部署配置

## 维护

主要依赖：

- Node.js 20+
- npm
- Wrangler，仅用于需要部署边缘服务的模块

常用检查：

```bash
npm install
npm run check
```

## License

MIT

# Dashboard Analytics Monitoring Implementation Plan

> **For Codex:** Execute each phase in order and verify before deployment.

**Goal:** Move the private Dashboard into the public `8xd-io` monorepo, add lawyer-homepage traffic attribution and pageview collection, expose auth-provider guidance, and deploy the updated Worker.

**Architecture:** Keep Cloudflare as the metrics source of truth, add privacy-preserving first-party pageview events for `fangliying.com`, and show both sources separately in the UI. Supabase Auth is implemented as an optional provider that can exchange a verified Supabase session for the existing Dashboard session cookie when project credentials are configured.

**Tech Stack:** React, Vite, Recharts, Cloudflare Workers, D1, Wrangler, optional Supabase Auth.

### Phase 1: Repository Migration

- Copy the existing local Dashboard app to `apps/dashboard`.
- Register it as an npm workspace and add root scripts.
- Keep real `wrangler.jsonc` local-only; commit `wrangler.example.jsonc`.

### Phase 2: Analytics Data Model

- Add D1 tables for `traffic_breakdowns` and privacy-safe `page_events`.
- Extend shared snapshot types with traffic breakdowns, insights, and auth provider status.
- Read detailed Cloudflare/D1 breakdown data with seed fallbacks.

### Phase 3: Worker APIs

- Add unauthenticated CORS endpoint for pageview collection.
- Store hashed IP, country, path, referrer, device, user agent summary, event name, and session id.
- Add optional Supabase session exchange endpoint gated by configured URL/key and allowed emails.

### Phase 4: UI

- Add a dedicated `律师主页` page with KPI cards, attribution conclusions, and bar charts.
- Add auth-provider status to login/settings.
- Clarify root-domain request totals versus hostname/pageview estimates.

### Phase 5: Lawyer Homepage Instrumentation

- Add a small browser pageview beacon to the lawyer homepage.
- Deploy the homepage after build verification.

### Phase 6: Verify, Commit, Push, Deploy

- Run install, typecheck, tests, build, D1 migration, Worker deploy, and live endpoint smoke tests.
- Commit and push both repositories after successful verification.

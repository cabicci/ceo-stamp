# Update Protocol

**Update this file after every meaningful change:** what changed, why, and any new pending items.

---

## Working Rules (for any AI/agent continuing this project)

- Never hardcode UI strings — every user-facing string goes through i18n `t("...")` with keys in both `ar.json` and `en.json` from the start. English must be idiomatic/contextual, **not** a literal translation.
- Arabic-first, RTL by default; AR/EN toggle must work on every screen. Platform brand names (Instagram, etc.) stay native.
- Ask before any big architectural decision or new dependency — don't assume. Present trade-offs briefly.
- API keys and secrets are strictly server-side (`.server.ts`). Never expose provider keys to the client bundle.
- Never store user passwords. Authenticated scraping stores only an encrypted Browserbase `contextId`.
- Dev is **Windows PowerShell**: run `git add` / `commit` / `push` as **separate commands** — never chain with `&&`.
- After every meaningful change: update this tracker (Done/Pending/Changelog) and commit + push.
- Generated marketing content is **Egyptian Arabic by default**; `framework_applied` + a specific rationale is mandatory on every generated item (Arabic rationale for `locale='ar'`; English rationale when generating English).
- Keep one source of truth — don't duplicate config or logic (e.g. `marketing-frameworks.ts`, `campaign-packages.ts`, `AdaptedPlan` pipeline).

---

## Owner & Workflow Context

- Owner is non-technical ("zero coding") — explain in simple terms, give copy-paste commands, label each command clearly as **[Cursor agent]** or **[Lovable agent]**, and never assume prior technical knowledge.
- The owner works across multiple projects/tools at once (Lovable + Cursor on two projects). Be explicit about which project/tool each instruction targets.
- Two editors edit the same repo: **Lovable** and **Cursor**, both sync via GitHub `main`. Always **pull before working** and **push after**, to avoid divergence.
- Preferred communication: **Egyptian Arabic**, concise, one decision at a time.

---

## Product Vision (the bigger picture)

- **Marketing CEO** is module 1 of a planned **"AI CEO"** platform.
- It should feel like a **senior strategist**, not a generic content generator — every output is grounded in named marketing science and explained.
- Campaign creation has **two entry points** (predefined packages + conversational AI strategist) that converge on one **approved-plan → generation** pipeline.
- **Human-in-the-loop:** AI drafts, the human reviews and approves (reflected in the green "approved" stamp design motif).

---

## 1. Overview

**Marketing CEO** is an Arabic-first (RTL) SaaS that analyzes a client's website, builds a brand profile, and generates scientifically grounded marketing campaigns.

- First module of a planned larger **"AI CEO"** platform.
- First test client: **masaarat.ai**
- Default UI locale: Arabic (`ar`); English (`en`) via AR/EN toggle with full i18n.

---

## 2. Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React 19, **TanStack Router** + **TanStack Start** (Vite), Tailwind CSS 4 |
| Backend / data | **Supabase** — Auth, Postgres, RLS, Storage (`campaign-media` bucket) |
| AI (text) | `callAI` / `callAIChat` in `src/lib/ai/ai.server.ts` — task routing map; **Anthropic `claude-sonnet-4-6`** active for all text tasks; OpenAI + Gemini providers wired but not routed |
| AI (images) | `generateImage` in `ai.server.ts` — **Gemini Imagen** (`imagen-4.0-generate-001`); exposed via `generate-post-image.functions.ts` |
| Authenticated scraping | **Browserbase** — login flow captures encrypted session handle only |
| Editing / deploy | **Lovable** + **Cursor**, both sync via GitHub (`main`) |
| Dev environment | **Windows PowerShell** (no `&&` chaining in git scripts) |
| Icons | Phosphor (`strokeWidth` 1.5–1.75, bold where needed) |

---

## 3. Key Architectural Decisions

- **API keys strictly server-side** — `.server.ts` files and TanStack Start server functions; client never sees provider keys.
- **Admin via `user_roles` + `is_admin()`** — roles live in a dedicated table, not on `profiles`. Seeded admin email: `khalil.wahid@gmail.com` (auto-promoted on signup via `handle_new_user` trigger).
- **Passwords never stored** — authenticated scraping opens a real Browserbase session; user logs in on their site. We persist only an **AES-256-GCM** encrypted `contextId` in `connected_sites.session_data_encrypted` (`crypto.server.ts`). Browserbase holds the actual session. Connect flow navigates to `login_url` via page-level `debuggerUrl` CDP (same as scrape) before showing the live view; connect errors use i18n keys (no raw HTML in UI).
- **`available_channels` is the hard ceiling** — stored on `brand_profiles`; package gallery, strategist, and generation all filter through `constrainPlanToAvailableChannels()`.
- **Single campaign pipeline** — both entry points (6 package gallery + AI strategist chat) produce an **`AdaptedPlan`** → `approveCampaignPlan` saves `campaigns.campaign_plan` → `generateCampaign` writes `content_items` + `ad_copies`.
- **Marketing science layer** — `marketing-frameworks.ts` is the single source of truth (17 frameworks: Cialdini×6, Schwartz×5, Byron Sharp×3, StoryBrand, AIDA, PAS). Selective prompt injection into generation/strategist; **no RAG by design**.
- **Every generated item** carries `framework_applied` + Arabic `rationale` (enforced in generation system prompt).
- **i18n from the start** — all UI chrome via `t("...")` in `I18nProvider`; keys in `src/i18n/locales/ar.json` + `en.json`. Platform brand names stay native (Instagram, etc.). AI-generated content may still be Arabic regardless of UI locale.

---

## Key Decisions & Rationale (why, not just what)

- **No RAG for the marketing science layer** — the framework set is small (~17 entries); selective prompt injection from `marketing-frameworks.ts` is cheaper and simpler. Revisit only if a large example/case-study library is added later.
- **Passwords never stored** — chosen over a credential vault so the password stays the client's responsibility (lower security liability for a small SaaS). Browserbase session + encrypted `contextId` only.
- **`available_channels` per project is the hard ceiling** — clients don't all have every platform; packages and strategist adapt down to what's available via `constrainPlanToAvailableChannels()`.
- **Billing is intentionally LAST** — finish the core loop (analyze → plan → generate → review → export) before charging.
- **`PROJECT_TRACKER.md` is the cross-session memory file** — agents update it; `/admin` displays it via `?raw` import (display only, not a second source of truth).
- **Content language "both" uses `adapted_from_id`** — English versions are culturally adapted rewrites, not literal translations, linked to Arabic originals.

---

## 4. Database Schema

RLS pattern: **owner read/write** on project-scoped data; **`is_admin()` read-only** oversight on all tables below.

| Table | Purpose |
|-------|---------|
| `profiles` | User email + `created_at` (no roles here) |
| `user_roles` | `admin` / `user` enum; service_role mutates only |
| `projects` | Client project: `name`, `website_url`, `owner_id` |
| `website_analysis` | Scrape results (`pages_scraped`), AI output (`ai_analysis`), `status`, errors |
| `brand_profiles` | Per-project brand: `tone_of_voice`, `brand_colors`, `personas`, `usps`, `content_pillars`, **`available_channels`** |
| `connected_sites` | Login-gated sites: `label`, `login_url`, encrypted session, `status`, expiry |
| `campaigns` | Campaign run: `objective`, `channels`, dates, `status`, **`campaign_plan`** (jsonb `AdaptedPlan`), `cloned_from_id`, `is_template`, `archived` |
| `content_items` | Generated posts: `platform`, `copy`, `media_brief`, `image_text` (short hook for on-image overlay; generation only — burning pending), `framework_applied`, `rationale`, `scheduled_date`, `image_url`, `image_source`, publish fields |
| `ad_copies` | Generated ads: per-platform variants (`headline`, `body`, `cta`, framework + rationale) |
| `post_metrics` | Performance snapshots per content item (reach, engagement, spend, etc.) |
| `social_connections` | OAuth/manual platform connections per project (schema ready; UI not built) |
| `publish_jobs` | Scheduled publish queue per content item (schema ready; worker not built) |
| `subscriptions` | Billing plan per owner (schema ready; UI not built) |
| `usage_counters` | Monthly usage: campaigns, images, tokens (schema ready; enforcement partial via `plan-limits.ts`) |
| `ai_generation_log` | Audit log: task, provider, model, token/cost estimates |

---

## 5. Done So Far

- **Design system** — "The Ledger & The Stamp": paper/ink palette, pastel-yellow accent (`--accent`), green approved stamp (`StatusStamp`), flat/no shadows, Arabic-first RTL + AR/EN toggle.
- **Auth** — Supabase email/password; protected `_authenticated` routes.
- **Admin dashboard** — `/admin`: user/project/campaign/content totals (RLS-gated).
- **Website intelligence** — public scrape + **Browserbase** authenticated scrape; shared `analysis-pipeline.server.ts`; marketing-focused analysis output (Egyptian Arabic): USPs, audience pain points, content opportunities, marketing angles — no generic business audit; editable on project page Step 2. **Timeouts + zombie cleanup:** 30s homepage fetch, 90s AI call, stale `scraping`/`analyzing` rows (>5 min) marked `error` on server start and before each run. **Client watchdog:** 2.5 min polling timeout marks stuck runs `error` via `failAnalysisWatchdog`.
- **Marketing report PDF (extensible)** — `src/lib/report/` modular section builder (`ReportSectionModule` + `composeReportDocument`); first section **التحليل التسويقي** exported via server fn (`@react-pdf/renderer` + embedded Cairo woff2 for Arabic RTL shaping); Step 2 **تصدير التقرير PDF** button. **Full campaign PDF** — overview + posts + ad copies sections via `CAMPAIGN_REPORT_SECTIONS`; **تصدير الحملة PDF** on `/campaigns/$campaignId`.
- **Brand profile** — auto-upserted from analysis into `brand_profiles`; channel settings UI.
- **Campaign packages** — 6 packages in `campaign-packages.ts` with channel adaptation.
- **AI strategist chat** — multi-turn planning → `AdaptedPlan` → approve.
- **Marketing science layer** — `marketing-frameworks.ts` wired into strategist + generation prompts.
- **Approved-plan → generation** — `CampaignGeneratePanel` + `generate-campaign.functions.ts`; campaign view at `/campaigns/$campaignId` with **copyable post text** (نسخ + تم النسخ) and **manual per-platform publish** buttons (clipboard + composer URL + image download).
- **Post previews** — realistic mocks for **5 platforms** (Facebook, Instagram, TikTok, LinkedIn, X/Twitter); **3 image sources** (AI generate / upload / paste URL) via `ImageSlot`. **Auto AI images on campaign generation:** each `content_item` gets an Imagen image from `media_brief` + `image_text_language` during `generateCampaign` (60s timeout per image, per-item failure resilient, quota-aware via `plan-limits` + `usage_counters`).
- **URL auto-normalize** — `normalizeWebsiteUrl()` + `projectSchema`; project edit form on detail page.
- **Full i18n pass** — ~160 UI strings moved to locale files (commit `a17b7bc`).
- **Content language + image text-language** — `content_language` and `image_text_language` stored on `campaign_plan` (jsonb). User picks both in `CampaignGeneratePanel` before generate: content **ar** / **en** / **both**; image text **none** / **ar** / **en** (independent). **Both:** Arabic originals first (`locale='ar'`, `adapted_from_id=null`), then culturally-adapted English versions (`locale='en'`, `adapted_from_id` → Arabic row) — not literal translation. **Post count formula:** `content_items` = post slots per channel × channels × languages (e.g. 1 post × 2 langs × 2 channels = 4 rows). Campaign view lists each locale × channel variant separately (ordered: slot → language → channel). `media_brief` carries image-text direction; `generate-post-image` reads `image_text_language` from the plan.
- **Admin Project Tracker view** — `/admin` renders `PROJECT_TRACKER.md` via a build-time `?raw` import (single source of truth, no duplicate content); collapsible panel with markdown display + copy button (admin-only).
- **Mobile-responsive navigation** — `AppShell` sidebar becomes an off-canvas drawer on small screens: hamburger top bar, backdrop overlay, close on nav tap or route change; desktop sidebar unchanged. Main content uses responsive horizontal/vertical padding.
- **Lovable preview `/index` redirect** — `src/routes/[index].tsx` redirects `/index` → `/` so Lovable's preview URL no longer 404s.
- **Project detail wizard** — `/projects/$id` restructured into a guided sequential flow: **Step 1** Analyze Website (one-time foundation; optional **Connected Sites** sub-panel at top — expanded by default, usable before first analysis) → **Step 2** Brand Profile (review/edit) → **Step 3** Available Channels → **Step 4** Campaigns (repeatable — package gallery + AI strategist). Later steps are gated/locked with Arabic hints until the prior step completes; completed steps stay collapsible. Progress indicator (1→4) via `projects.flow.*` i18n keys. Wizard focuses Step 2 after first analysis completes. **Delete project** in settings (confirm dialog, cascade delete, redirect to list).
- **`t()` interpolation typing** — `TranslateFn` exported from `I18nProvider`; optional `vars` object for `{placeholder}` substitution. Fixes pre-existing type error in `ConnectedSitesSection.tsx` (`lastConnected`, etc.).
- **Supabase service role key + stale-run cleanup confirmed working** — `SUPABASE_SERVICE_ROLE_KEY` is wired server-side (`.env` secret); `analysis-lifecycle.server.ts` uses `supabaseAdmin` to reliably mark abandoned `scraping`/`analyzing` rows (>5 min) as `error` on every server cold start and before each new analysis run. No client-side changes.
- **Browserbase connect session hygiene** — proactive release of stale RUNNING sessions (>2 min) before each connect; on 429/concurrent-limit, release all RUNNING sessions for the project and retry once. `releaseRunningSessions` lists via Browserbase API (project-filtered client-side), logs failures instead of swallowing them. `startConnectSession` always ends leaked sessions in `finally`; `abandonConnectSession` ends Browserbase session on modal cancel.
- **Connected Sites i18n errors** — `connected_sites.error_message` keys (`connectedSites.errors.*`) resolved via `translateConnectedSitesError()` in row UI + connect/capture banners (no raw keys shown).
- **Definitive Browserbase connect lifecycle** — `browserbase_session_id` + `connect_started_at` on `connected_sites`; before every connect, release all RUNNING orphan sessions except actively-tracked connects (<2 min). On 429: release all, wait 1s, retry once; clear Arabic capacity message. `captureSession` persists encrypted contextId immediately after flush (before any further cleanup); always-close via `try/finally` on start/capture/abandon. Success banner: `connectedSites.connectSuccess`.
- **Preview stability hardening** — `/index` preview entry and the protected-route auth gate no longer wait indefinitely on the auth `/user` check; they prefer the local session and fall back/redirect after short timeouts. The boot fallback now sits below real app/error UI and is explicitly removed by the root error boundary, preventing hidden blank/error screens.
- **AI JSON parsing/output hardening** — `callAI(..., jsonMode: true)` now tolerates malformed markdown fences such as `'''json` and extracts the first balanced JSON object/array. Content generation also uses a larger provider output budget to avoid truncated campaign JSON (`Unterminated string`).
- **PDF render hardening** — campaign/analysis PDF report styles avoid React-PDF crash paths: no border primitives, no oversized `wrap={false}` cards, and no dynamic total-pages footer render; separators use filled bars instead.
- **My Campaigns workspace** — `/campaigns` lists all saved campaigns (RLS-scoped); project Step 4 embeds the same list. Per row: objective/package name, channels, dates, status, post count. Actions: open, clone (`cloned_from_id` + full `content_items`/`ad_copies` copy with ` (نسخة)` suffix), archive/unarchive with archived filter. Sidebar **الحملات** links to the list — campaigns persist and are reachable after reload.
- **`image_text` on campaign generation** — AI now returns a short punchy hook (3–6 words) per `content_item`, stored in `content_items.image_text` (nullable). Arabic/English prompts + EN adaptation rules wired; persisted on insert. **Image burning / overlay not built yet** — `post-image.server.ts` unchanged.

### Routes (implemented)

| Route | Purpose |
|-------|---------|
| `/auth` | Login / signup |
| `/` | Projects list + create |
| `/projects/$id` | Project hub: settings + gated 4-step wizard (analyze → brand → channels → campaigns) |
| `/campaigns` | **My Campaigns** — all saved campaigns (open, clone, archive); sidebar link |
| `/campaigns/$campaignId` | Generated content + ad copies preview |
| `/post-previews` | Platform preview gallery (dev/demo) |
| `/admin` | Admin dashboard |

Nav links for `/analysis`, `/review` exist in sidebar but **routes are not implemented** (placeholders).

---

## 6. Current Status / Next Steps

**Now:** First end-to-end real run on **masaarat.ai** confirmed working: analyze → plan → approve → generate → AI images per post → copy/publish → PDF export → My Campaigns persistence.

### Confirmed Working (tested on masaarat.ai)

- Website analysis end-to-end (Egyptian Arabic marketing intelligence + PDF export).
- Campaign generation end-to-end (copy + `framework_applied` + rationale per post).
- AI image generation per post (campaign-media storage RLS fixed); posts show Imagen images.
- Copyable post text + manual per-platform publish buttons (نسخ + انشر على {platform}) under each post.
- Full campaign PDF export (overview + posts + ad copies).
- **My Campaigns** workspace: `/campaigns` list + sidebar link + clone + archive; campaigns persist after reload.
- Post count formula: `content_items = post slots × channels × languages`. Each post is its own card labelled "بوست {n} · {channel} · {language}", ordered post → language (ar then en) → channel.

### Pending (not yet built / open issues)

| Item | Notes |
|------|-------|
| **Arabic text inside AI-generated images is garbled** | Imagen can't render Arabic reliably. **`image_text` field now generated and stored** — next step: burn/overlay hook onto image (resvg or similar) instead of relying on Imagen typography. |
| **Prompt/media-brief leakage into post copy** | Instructions sometimes leak into visible post text — needs prompt hardening + output sanitization. |
| **PDF Arabic letter shaping still broken** | Cairo ligatures in `@react-pdf/renderer` don't shape Arabic correctly — affects both analysis and campaign reports. |
| Manual image flow verification | `توليد صورة` / `رفع صورة` in `ImageSlot` — verify end-to-end after the storage RLS fix. |
| **Browserbase authenticated login (deferred)** | Code-complete but blocked at runtime after account upgrade: connect fails with `fetch failed` / `hasWebSocket:false` in Lovable's workerd runtime. Likely needs a real `ws` client or Playwright `connectOverCDP` instead of the hand-rolled fetch-upgrade. Deferred. |
| Review / approve workflow for generated content | Nav stub only; `content_items.status` exists |
| Campaign strategy visualization page | Plan → calendar / funnel view |
| Performance metrics UI | `post_metrics` table ready |
| Social publishing | `social_connections`, `publish_jobs` schema only |
| Billing | `subscriptions` + `usage_counters` — **last priority** |
| Full strategy PDF (campaign + posts sections) | Campaign PDF shipped; extend with review workflow sections later |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-22 | Created `PROJECT_TRACKER.md` as cross-session memory file. |
| 2026-06-22 | Full i18n pass: ~160 hardcoded UI strings → `t()` + `ar.json`/`en.json`. |
| 2026-06-22 | Added content-language choice (ar/en/both) + image-text-language choice to campaign generation. |
| 2026-06-22 | Added Project Tracker viewer + copy button to /admin (raw import, single source of truth). |
| 2026-06-22 | Expanded tracker with Working Rules, Owner/Workflow context, Product Vision, and Key Decisions rationale for cross-session continuity. |
| 2026-06-22 | Mobile-responsive AppShell: off-canvas sidebar drawer, hamburger bar, and responsive content padding for small screens. |
| 2026-06-22 | Added `/index` → `/` redirect route so Lovable preview URLs stop returning 404. |
| 2026-06-22 | Restructured project page into a gated 4-step wizard; fixed `t()` interpolation typing. |
| 2026-06-22 | Surfaced Connected Sites at top of wizard Step 2 (collapsible sub-panel); Step 2 becomes current after first analysis; Step 1 hint for login-protected pages. |
| 2026-06-22 | Moved Connected Sites to Step 1 (visible before analysis); optional collapsible sub-panel with pre-analysis connect hint. |
| 2026-06-22 | Refocused website analysis on marketing-usable intelligence: `content_opportunities` + `marketing_angles`, Egyptian Arabic output, no SWOT/weaknesses. |
| 2026-06-22 | Extensible PDF marketing report (`src/lib/report/`): analysis section with Arabic RTL via Cairo + react-pdf; Step 2 export button. |
| 2026-06-22 | Analysis timeouts + zombie-row cleanup: 30s homepage fetch, 90s AI timeout, stale `scraping`/`analyzing` rows (>5 min) → `error`; i18n `analysis.errors.*` keys. |
| 2026-06-22 | Client analysis watchdog (2.5 min), Connected Sites expanded by default in Step 1, delete-project with confirm + cascade. |
| 2026-06-22 | Browserbase connect navigates to `login_url` via CDP before live view; `login_url` normalized on insert (`normalizeWebsiteUrl`). |
| 2026-06-22 | Fix connect CDP: use session `wsUrl` (not debugger HTML URL); dismiss JS dialogs; no `alert()` / no page source in errors. |
| 2026-06-22 | Fix connect CDP: align with scrape — page `debuggerUrl` (not session `wsUrl`); structured `[connect-nav]` server logs only. |
| 2026-06-22 | Confirmed `SUPABASE_SERVICE_ROLE_KEY` wired server-side + stale-run cleanup (`analysis-lifecycle.server.ts`) working via `supabaseAdmin` on cold start and before each run. |
| 2026-06-22 | Browserbase connect: proactive session release + always-close on failure/cancel; fixed raw `connectedSites.errors.*` i18n keys in UI. |
| 2026-06-22 | Definitive Browserbase session lifecycle: orphan cleanup (DB-tracked active connects), always-close, persist-on-login-confirm, success/capacity i18n. |
| 2026-06-26 | Hardened Lovable preview boot/auth routing: `/index` and `_authenticated` gate now use session-first auth with short timeouts to avoid blank screens when auth verification is slow. |
| 2026-06-26 | Hardened root boot fallback: lower z-index + error-boundary cleanup so real errors are visible instead of being hidden behind the loading screen. |
| 2026-06-27 | Hardened `callAI` JSON parsing for malformed model fences (`'''json`/extra prose) so campaign generation can continue when the model returns valid JSON wrapped incorrectly. |
| 2026-06-27 | Increased text-generation output budgets per AI task, especially campaign generation, to prevent truncated JSON causing `Unterminated string` parse failures. |
| 2026-06-27 | Removed React-PDF border primitives from report header/footer/section/persona styles and replaced separators with filled bars to stop `clipBorderTop unsupported number` crashes. |
| 2026-06-27 | Removed unbreakable post/ad PDF cards and dynamic total-pages footer render to stop React-PDF `translate unsupported number` crashes on long campaign reports. |
| 2026-06-22 | Auto AI image generation per post during campaign generation (`post-image.server.ts`); resilient per-item failures (60s timeout), quota-aware via `plan-limits` + `usage_counters`; campaign view loads `image_url`/`image_source`. |
| 2026-06-22 | Campaign view: copyable post text (نسخ / تم النسخ) + manual per-platform publish buttons (composer URL, clipboard hint, image download link). |
| 2026-06-29 | **Post count = slots × channels × languages** — packages use post count per channel (not divided); generation validates `total_posts × languageCount`; campaign view shows each channel+language variant separately (ordered slot → lang → channel). |
| 2026-06-29 | **My Campaigns workspace** — `/campaigns` list (open, clone, archive), project Step 4 embed, sidebar link; campaigns reachable after reload. |
| 2026-06-30 | **`image_text` field** — campaign generation prompts + JSON schema now produce a short on-image hook per post; `content_items.image_text` column (nullable migration). Burning text onto images still pending. |
| 2026-06-30 | End-to-end run on masaarat.ai confirmed: analyze → plan → generate → AI images → copy/publish → PDF → My Campaigns persistence. Tracker updated with confirmed-working list and open issues (Arabic-in-image garbled, prompt leakage in copy, PDF Arabic shaping, Browserbase connect deferred on workerd). |

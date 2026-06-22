# Update Protocol

**Update this file after every meaningful change:** what changed, why, and any new pending items.

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
- **Passwords never stored** — authenticated scraping opens a real Browserbase session; user logs in on their site. We persist only an **AES-256-GCM** encrypted `contextId` in `connected_sites.session_data_encrypted` (`crypto.server.ts`). Browserbase holds the actual session.
- **`available_channels` is the hard ceiling** — stored on `brand_profiles`; package gallery, strategist, and generation all filter through `constrainPlanToAvailableChannels()`.
- **Single campaign pipeline** — both entry points (6 package gallery + AI strategist chat) produce an **`AdaptedPlan`** → `approveCampaignPlan` saves `campaigns.campaign_plan` → `generateCampaign` writes `content_items` + `ad_copies`.
- **Marketing science layer** — `marketing-frameworks.ts` is the single source of truth (17 frameworks: Cialdini×6, Schwartz×5, Byron Sharp×3, StoryBrand, AIDA, PAS). Selective prompt injection into generation/strategist; **no RAG by design**.
- **Every generated item** carries `framework_applied` + Arabic `rationale` (enforced in generation system prompt).
- **i18n from the start** — all UI chrome via `t("...")` in `I18nProvider`; keys in `src/i18n/locales/ar.json` + `en.json`. Platform brand names stay native (Instagram, etc.). AI-generated content may still be Arabic regardless of UI locale.

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
| `content_items` | Generated posts: `platform`, `copy`, `media_brief`, `framework_applied`, `rationale`, `scheduled_date`, `image_url`, `image_source`, publish fields |
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
- **Website intelligence** — public scrape + **Browserbase** authenticated scrape; shared `analysis-pipeline.server.ts`; editable analysis on project page.
- **Brand profile** — auto-upserted from analysis into `brand_profiles`; channel settings UI.
- **Campaign packages** — 6 packages in `campaign-packages.ts` with channel adaptation.
- **AI strategist chat** — multi-turn planning → `AdaptedPlan` → approve.
- **Marketing science layer** — `marketing-frameworks.ts` wired into strategist + generation prompts.
- **Approved-plan → generation** — `CampaignGeneratePanel` + `generate-campaign.functions.ts`; campaign view at `/campaigns/$campaignId`.
- **Post previews** — realistic mocks for **5 platforms** (Facebook, Instagram, TikTok, LinkedIn, X/Twitter); **3 image sources** (AI generate / upload / paste URL) via `ImageSlot`.
- **URL auto-normalize** — `normalizeWebsiteUrl()` + `projectSchema`; project edit form on detail page.
- **Full i18n pass** — ~160 UI strings moved to locale files (commit `a17b7bc`).
- **Content language + image text-language** — `content_language` and `image_text_language` stored on `campaign_plan` (jsonb). User picks both in `CampaignGeneratePanel` before generate: content **ar** / **en** / **both**; image text **none** / **ar** / **en** (independent). **Both:** Arabic originals first (`locale='ar'`, `adapted_from_id=null`), then culturally-adapted English versions (`locale='en'`, `adapted_from_id` → Arabic row) — not literal translation. Campaign view (`/campaigns/$campaignId`) groups pairs with an **AR/EN per-item toggle**. `media_brief` carries image-text direction; `generate-post-image` reads `image_text_language` from the plan.
- **Admin Project Tracker view** — `/admin` renders `PROJECT_TRACKER.md` via a build-time `?raw` import (single source of truth, no duplicate content); collapsible panel with markdown display + copy button (admin-only).

### Routes (implemented)

| Route | Purpose |
|-------|---------|
| `/auth` | Login / signup |
| `/` | Projects list + create |
| `/projects/$id` | Project hub: settings, analysis, connected sites, channels, campaign setup |
| `/campaigns/$campaignId` | Generated content + ad copies preview |
| `/post-previews` | Platform preview gallery (dev/demo) |
| `/admin` | Admin dashboard |

Nav links for `/analysis`, `/campaigns`, `/review` exist in sidebar but **routes are not implemented** (placeholders).

---

## 6. Current Status / Next Steps

**Now:** About to run first **end-to-end real generation test** on masaarat.ai (analyze → plan → approve → generate → preview).

### Pending (not yet built)

| Item | Notes |
|------|-------|
| AI image generation (production-ready) | Server fn + UI exist; needs end-to-end test, error handling, usage limits |
| Review / approve workflow for generated content | Nav stub only; `content_items.status` exists |
| Campaign strategy visualization page | Plan → calendar / funnel view |
| Performance metrics UI | `post_metrics` table ready |
| History / clone / templates | `cloned_from_id`, `is_template`, `archived` columns exist |
| Social publishing | `social_connections`, `publish_jobs` schema only |
| Billing | `subscriptions` + `usage_counters` — **last priority** |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-22 | Created `PROJECT_TRACKER.md` as cross-session memory file. |
| 2026-06-22 | Full i18n pass: ~160 hardcoded UI strings → `t()` + `ar.json`/`en.json`. |
| 2026-06-22 | Added content-language choice (ar/en/both) + image-text-language choice to campaign generation. |
| 2026-06-22 | Added Project Tracker viewer + copy button to /admin (raw import, single source of truth). |

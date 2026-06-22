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
- **Passwords never stored** — authenticated scraping opens a real Browserbase session; user logs in on their site. We persist only an **AES-256-GCM** encrypted `contextId` in `connected_sites.session_data_encrypted` (`crypto.server.ts`). Browserbase holds the actual session.
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
- **Project detail wizard** — `/projects/$id` restructured into a guided sequential flow: **Step 1** Analyze Website (one-time foundation) → **Step 2** Brand Profile (review/edit + optional connected sites) → **Step 3** Available Channels → **Step 4** Campaigns (repeatable — package gallery + AI strategist). Later steps are gated/locked with Arabic hints until the prior step completes; completed steps stay collapsible. Progress indicator (1→4) via `projects.flow.*` i18n keys.
- **`t()` interpolation typing** — `TranslateFn` exported from `I18nProvider`; optional `vars` object for `{placeholder}` substitution. Fixes pre-existing type error in `ConnectedSitesSection.tsx` (`lastConnected`, etc.).

### Routes (implemented)

| Route | Purpose |
|-------|---------|
| `/auth` | Login / signup |
| `/` | Projects list + create |
| `/projects/$id` | Project hub: settings + gated 4-step wizard (analyze → brand → channels → campaigns) |
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
| 2026-06-22 | Expanded tracker with Working Rules, Owner/Workflow context, Product Vision, and Key Decisions rationale for cross-session continuity. |
| 2026-06-22 | Restructured project page into a gated 4-step wizard; fixed `t()` interpolation typing. |

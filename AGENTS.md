<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## MANDATORY: Keep PROJECT_TRACKER.md updated

- `PROJECT_TRACKER.md` at the repo root is the **single source of truth** for project memory across sessions.
- After **ANY meaningful change** (new feature, schema change, architectural decision, bug fix that affects behavior), you **MUST** update `PROJECT_TRACKER.md` in the **SAME change set** — before committing:
  - Move items between Pending and "Done So Far" as appropriate.
  - Add a Changelog row with the date and a one-line description of what changed and why.
  - Update any affected section (schema, routes, decisions).
- **Never commit a meaningful change without updating the tracker.** Treat the tracker update as part of the task, not optional.
- Keep the existing structure and style. Don't duplicate entries.

---

## Project rules (always follow)

- **Dev environment is Windows PowerShell** — run `git add`, `git commit`, and `git push` as **separate commands**; never chain with `&&`.
- **i18n for all UI strings** — every user-facing string goes through `t("...")` with keys in both `src/i18n/locales/ar.json` and `en.json`. English must be idiomatic/contextual, not a literal translation. Never hardcode UI strings.
- **Secrets stay server-side** — API keys and secrets live strictly in `.server.ts` and server functions. Never expose provider keys to the client bundle.
- **Arabic-first, RTL by default** — default locale is Arabic; layout and copy assume RTL unless the user toggles English.

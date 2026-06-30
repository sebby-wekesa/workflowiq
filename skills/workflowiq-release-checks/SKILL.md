---
name: workflowiq-release-checks
description: WorkflowIQ release and verification checklist. Use before deploying, preparing a PR, handing off work, changing Supabase migrations, changing environment-dependent auth/setup behavior, or when the user asks to verify, ship, deploy, or check readiness for this repo.
---

# WorkflowIQ Release Checks

## Standard Checks

- Run `git status --short` before and after work. Preserve unrelated user changes.
- Run `pnpm run build` for TypeScript and production bundle validation.
- Treat Vite chunk-size warnings as warnings unless the task is performance or bundle-size focused.
- Do not commit generated `dist/` output unless the repo already tracks it and the user asked for it.

## Supabase Checks

- Confirm migration filenames preserve execution order.
- Prefer additive, idempotent migrations: `create table if not exists`, `add column if not exists`, guarded constraints, and `create or replace function`.
- Check RLS policies and `org_id` scoping for every new table.
- For `security definer` functions, verify explicit user, role, and organization checks.
- For accounting migrations, verify the required system account keys and `is_postable` behavior.
- If no database is available, report that SQL syntax/runtime execution was not verified.

## App Checks

- Verify `.env` expectations against `README.md`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and optional `VITE_ENABLE_GOOGLE_AUTH`.
- Check that direct client routes are covered by `vercel.json` rewrites.
- When auth, setup, or callback routes change, review Supabase redirect URL notes in `README.md`.
- When adding new Supabase columns used by the client, update `src/lib/supabase.ts` and run the build.

## Handoff

- Summarize changed files by purpose, not every line.
- Include the exact validation commands run and any warnings.
- Call out manual deployment or migration steps that still need to happen in Supabase or Vercel.

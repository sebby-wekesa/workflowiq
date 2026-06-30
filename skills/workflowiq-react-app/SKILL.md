---
name: workflowiq-react-app
description: WorkflowIQ React/Vite application conventions. Use when editing src/App.tsx, src/pages, src/components, src/lib/api.ts, src/lib/supabase.ts, auth providers, accounting screens, dashboard workflows, forms, routes, TanStack Query hooks, or UI styling in this repo.
---

# WorkflowIQ React App

## App Shape

- Treat `src/lib/api.ts` as the data-access layer. Add or reuse hooks there, then consume them from pages and components.
- Keep Supabase client setup and table types in `src/lib/supabase.ts`.
- Keep provider wiring under `src/components/providers`.
- Preserve route-level behavior in `src/App.tsx` and page components under `src/pages`.
- Use existing lightweight UI components and `src/styles.css` before introducing new component systems.

## Data And State

- Use TanStack Query hooks from `src/lib/api.ts` for server state.
- Invalidate the narrowest useful query keys on mutations. Existing accounting mutations invalidate `["accounting"]`; customer-impacting flows also invalidate `["customers"]`.
- Use the shared `unwrap` pattern for Supabase responses in `src/lib/api.ts`.
- Keep page components mostly orchestration and form state; keep cross-screen data logic in API helpers.

## UI Patterns

- Match the existing operational dashboard style: dense, work-focused, restrained, and scan-friendly.
- Use lucide-react icons where buttons need icons.
- Avoid landing-page or marketing layouts. The first screen should be the usable product surface.
- Keep cards for actual panels, tables, forms, repeated items, or modals. Do not wrap page sections in nested cards.
- Ensure text fits in compact dashboard controls on mobile and desktop. Prefer smaller headings inside panels.

## Accounting UI

- Account pickers used for posting must filter out inactive accounts and `is_postable = false` headers.
- Chart views may show header accounts, but label them as headers and avoid linking them into posting actions.
- Keep money formatting with `Intl.NumberFormat("en-KE", { currency: "KES" })` unless a specific account currency is displayed.
- Preserve the current navigation views: home, chart, journal, transactions, ledger, ledgers, reports.

## Validation

- Run `pnpm run build` after UI, type, API hook, or route changes.
- Start `pnpm dev --host 127.0.0.1` when the user needs to try the app locally.
- If a change touches layout significantly, inspect the relevant route in browser or explain why visual verification was not run.

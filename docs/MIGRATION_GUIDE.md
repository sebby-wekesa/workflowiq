# Hercules → Supabase Migration Guide

This moves your workshop app off Convex/Hercules onto **Supabase** (Postgres +
Auth + RLS). The hard, error-prone parts — the database schema, your real data,
the security rules, and the transactional stock logic — are **done and tested**.
What remains is mechanical: pointing your React pages at the new data layer.

## What you've got

| File | What it is |
|---|---|
| `01_schema.sql` | Full Postgres schema: tables, enums, indexes, search, RLS, and all the job/stock business logic as functions. |
| `02_data.sql` | Your real snapshot loaded in: 3 users, 55 customers, 56 stock items, 55 jobs, 105 stock movements. |
| `frontend/lib/supabase.ts` | The Supabase client + TypeScript types. |
| `frontend/lib/api.ts` | A data-access layer with one hook per old Convex function (`useJobs`, `useCreateJob`, …). |
| `frontend/providers/auth.tsx` | Auth provider replacing Hercules OIDC. |
| `frontend/pages/auth/Callback.tsx` | Sign-in redirect handler. |
| `frontend/.env.example` | The two env vars you now need. |

## How Convex maps to Supabase

| Convex | Supabase |
|---|---|
| `convex/schema.ts` (document tables) | Postgres tables in `01_schema.sql` |
| `v.union(...)` literals | Postgres `enum` types |
| nested objects (materials, statusHistory…) | `jsonb` columns |
| `searchIndex` | `pg_trgm` (`ilike` / trigram index) |
| queries/mutations in `convex/*.ts` | simple CRUD → `supabase.from()`; transactional → `supabase.rpc()` |
| Hercules OIDC + `ctx.auth.getUserIdentity()` | Supabase Auth + Row Level Security |
| `useQuery`/`useMutation` from `convex/react` | the hooks in `api.ts` (built on TanStack Query, already a dependency) |
| Convex IDs (`jh70cvmy…`) | UUIDs (deterministically remapped in `02_data.sql`, relationships preserved) |

The transactional logic from `convex/jobs.ts` and `convex/stock.ts` — auto stock
deduction on job creation, reversal on job delete/update, the pipeline
(`received → workshop → relining → qc → done → collected`), and movement audit
trail — now lives in Postgres functions (`create_job`, `delete_job`, `adjust_stock`,
etc.) so it stays atomic and correct. This was tested: creating a job deducts
stock, deleting it restores stock exactly.

## Step 1 — Create the database

1. Create a project at supabase.com.
2. Open **SQL Editor**, paste **all of `01_schema.sql`**, run it.
3. New query, paste **all of `02_data.sql`**, run it. You should see your
   55 customers, 55 jobs, etc.

## Step 2 — Turn on Auth

In **Authentication → Providers**, enable **Email** (magic link). Optionally
enable Google. Under **URL Configuration**, add your dev and prod URLs plus the
`/auth/callback` redirect.

Your three existing users (`singhpuee@gmail.com`, `adnandin@live.co.uk`,
`sebbywakis@gmail.com`) keep their admin roles automatically — the database
links each account to its existing row by email the first time they sign in.
The very first person to ever sign up on a fresh database becomes admin.

## Step 3 — Wire up the frontend

```bash
npm install @supabase/supabase-js
npm uninstall convex @usehercules/auth @usehercules/sdk @usehercules/vite @usehercules/eslint-plugin oidc-client-ts react-oidc-context @convex-dev/eslint-plugin
```

Then:
- Copy `frontend/lib/supabase.ts` → `src/lib/supabase.ts`
- Copy `frontend/lib/api.ts` → `src/lib/api.ts`
- Replace `src/components/providers/auth.tsx` with the new one
- Add `src/pages/auth/Callback.tsx`
- Delete `src/components/providers/convex.tsx` and the whole `convex/` folder
- Copy `.env.example` → `.env` and fill in your URL + anon key
- In `src/components/providers/default.tsx`, remove `<ConvexProvider>` and keep
  `<AuthProvider>` wrapping `<QueryClientProvider>` (TanStack Query stays).

## Step 4 — Update the pages (the mechanical part)

Every page currently imports from `convex/react` and `@/convex/_generated/api`.
Swap those for the matching hook in `api.ts`. The shapes line up; the main
difference is **field names are now snake_case** (`job.jobNumber` → `job.job_number`,
`customer.createdBy` → `customer.created_by`). Reference table:

| Old Convex call | New hook from `api.ts` |
|---|---|
| `useQuery(api.jobs.list)` | `useJobs()` |
| `useQuery(api.jobs.getByCustomer, {customerId})` | `useJobsByCustomer(customerId)` |
| `useMutation(api.jobs.create)` | `useCreateJob()` |
| `useMutation(api.jobs.update)` | `useUpdateJob()` |
| `useMutation(api.jobs.advance)` | `useAdvanceJob()` |
| `useMutation(api.jobs.collect)` | `useCollectJob()` |
| `useMutation(api.jobs.markDone)` / `undoMarkDone` | `useMarkJobDone()` / `useUndoMarkDone()` |
| `useMutation(api.jobs.remove)` | `useDeleteJob()` |
| `useQuery(api.customers.list)` / `search` | `useCustomers()` / `useCustomerSearch(q)` |
| `api.customers.create/update/remove` | `useCreateCustomer()` / `useUpdateCustomer()` / `useDeleteCustomer()` |
| `useQuery(api.stock.list)` | `useStock()` |
| `useQuery(api.stock.getMovements, {stockId})` | `useStockMovements(stockId)` |
| `api.stock.create/update/adjust/remove` | `useCreateStock()` / `useUpdateStock()` / `useAdjustStock()` / `useDeleteStock()` |
| `useQuery(api.staff.list)` / `listActive` | `useStaff()` / `useActiveStaff()` |
| `api.staff.create/update/remove/toggleActive` | `useCreateStaff()` / `useUpdateStaff()` / `useDeleteStaff()` / `useToggleStaff()` |
| `useQuery(api.users.listAll)` | `useAllUsers()` |
| `api.users.changeRole/toggleActive/inviteUser/cancelInvite` | `useChangeRole()` / `useToggleUserActive()` / `useInviteUser()` / `useCancelInvite()` |
| `useQuery(api.users.getCurrentUser)` | `useAuth().appUser` |

Calling a mutation hook: `const create = useCreateJob();` then
`await create.mutateAsync({ ... })` (instead of Convex's `create({ ... })`).

### Dashboard, Reports, Deliveries
These were read-only aggregations in `convex/dashboard.ts` and `convex/reports.ts`.
The simplest port: fetch with `useJobs()` + `useStock()` and compute the numbers
in the component (the chart components already take arrays). The **Deliveries**
page just filters jobs by status (`done` = ready for collection, `collected` =
history) — feed it `useJobs()`. If you'd rather push the math into the database
later, the pattern is a Postgres `view` or an `rpc` returning the aggregates.

### Job notes & photos
`job_notes` is ready in the schema (it was empty in your snapshot). Photos that
used Convex `_storage` now go in **Supabase Storage** — create a bucket and store
the file path in `job_notes.photo_path`.

### Invite emails
`useInviteUser()` creates the pending user row. To actually email the invite
(the old `convex/emails.ts` action), use Supabase's
`supabase.auth.admin.inviteUserByEmail()` from a small **Edge Function**, or just
have invited users sign in with the magic link — the email-match linking will
attach them to the pending row and role you set.

## Handoff prompt for your AI assistant

> I've migrated my workshop app's backend from Convex to Supabase. The new
> database is live and I have a data-access layer at `src/lib/api.ts` that
> exposes a React Query hook for every old Convex function (e.g. `useJobs()`,
> `useCreateJob()`, `useStock()`, `useAdjustStock()`), plus `src/lib/supabase.ts`
> with the types and a new Supabase auth provider at
> `src/components/providers/auth.tsx` exposing `useAuth()` with
> `{ user, appUser, isAuthenticated, isLoading, signInWithEmail, signInWithGoogle, signOut }`.
>
> Go through every file under `src/pages/` and `src/components/` and replace all
> Convex usage: remove imports from `convex/react` and `@/convex/_generated/api`,
> and swap each `useQuery(api.X.Y, args)` / `useMutation(api.X.Y)` for the
> matching hook from `@/lib/api` (see the mapping I'll paste below). Mutations now
> use `.mutateAsync(args)`. Update field names to snake_case to match Postgres
> (e.g. `jobNumber`→`job_number`, `currentQty`→`current_qty`, `createdBy`→`created_by`,
> `roleSkill`→`role_skill`, `minThreshold`→`min_threshold`). For getCurrentUser,
> use `useAuth().appUser`. For Dashboard and Reports, fetch with `useJobs()` and
> `useStock()` and compute aggregates in the component. Keep all UI/styling
> identical. Do one file at a time and list what you changed.

[paste the mapping table above]

## Multi-tenant (multiple workshops on one deployment)

After `01` and `02`, run **`03_multitenant.sql`** to turn the app into a
multi-tenant SaaS. What it does:

- Adds an `organizations` table and an `org_id` on every table.
- Puts all your existing data into one founding workshop
  (**"Nanak Mechanical Engineers"** — rename it in Settings or in the SQL).
- Re-scopes all RLS so a workshop only ever sees its own rows. Tested: a second
  workshop sees **zero** of the first's jobs, and attempts to reach another
  workshop's data by ID are blocked at both the RPC and RLS layers.
- Makes **job numbers per-workshop** (each new workshop starts at JB0001).
- Auto-creates a workshop on brand-new signup: the first person to sign up with
  a new email gets their own isolated workshop and becomes its admin. Invited
  users join the inviter's workshop and inherit their assigned role.

**Run order:** `01_schema.sql` → `02_data.sql` → `03_multitenant.sql`.

### The model
One account belongs to one workshop (`app_users.org_id`); role is per workshop.
Simple and fast for RLS. If you later need one login to manage several
workshops, that's a membership join table — a clean follow-up, not a rewrite.
Isolation is enforced by the database, so the pages barely change: inserts
auto-stamp `org_id`, every read is RLS-filtered. The only additions are in
`auth.tsx` (`organization`, `signUpNewWorkshop`) and `useOrganization()` /
`useRenameWorkshop()` in `api.ts`.

### Frontend bits to add
- A **sign-up screen** collecting name + workshop name that calls
  `signUpNewWorkshop(email, fullName, workshopName)`. `signInWithEmail(email)`
  stays for returning/invited users.
- Optionally show `useAuth().organization?.name` in the header, plus a Settings
  field using `useRenameWorkshop()` so an admin can rename the workshop.
- Nothing else in the pages changes — `useJobs()`, `useStock()`, etc. already
  return only the current workshop's data.

## Gotchas
- **Tenant isolation is on the database.** Never add an `org_id` filter in
  frontend queries yourself and never disable RLS — that's what keeps workshops
  apart.
- **snake_case everywhere** is the most common break. Postgres columns are
  `job_number`, not `jobNumber`.
- `materials` JSON still uses the key `stockId` inside the array (the functions
  expect that) — the inner IDs were remapped to UUIDs for you.
- RLS means a query returns nothing if you're not signed in — that's expected,
  not a bug. Test while logged in.
- Only **admins** can delete (jobs, stock, customers, staff, users); managers
  get a silent no-op on delete, same as before.
- Realtime: Convex pushed live updates automatically. TanStack Query refetches
  on mutation here. If you want live updates across devices, add
  `supabase.channel(...).on('postgres_changes', ...)` later — optional.

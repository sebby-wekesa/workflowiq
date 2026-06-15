# WorkflowIQ

WorkflowIQ is a Vite/React workshop operations dashboard backed by Supabase. It
tracks jobs through the workshop pipeline, customers, stock, and collection
status in an isolated workspace for each organization.

## Project structure

```text
src/
  components/          Shared UI and auth provider
  lib/                 Supabase client, types, and data hooks
  pages/               Setup, authentication, and dashboard screens
supabase/migrations/   Schema, seed snapshot, and multi-tenant migration
docs/                  Detailed migration guide
```

## Start locally

```bash
pnpm install
pnpm dev
```

The app starts in setup mode when no Supabase credentials are present.

To connect a backend:

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then run the SQL files
in `supabase/migrations` in filename order from the Supabase SQL editor. Restart
the dev server after changing `.env`.

In Supabase **Authentication > URL Configuration**, set the local Site URL to
`http://127.0.0.1:5173` and add
`http://127.0.0.1:5173/auth/callback` and
`http://localhost:5173/auth/callback` to the allowed redirect URLs. Google
sign-in only appears after enabling and configuring the Google provider in
Supabase and setting `VITE_ENABLE_GOOGLE_AUTH=true`.

See [docs/MIGRATION_GUIDE.md](docs/MIGRATION_GUIDE.md) for the supplied backend
migration details.

# WorkflowIQ Standard Operating Procedure

Last updated: 2026-06-22

## Purpose

This SOP defines how to operate, maintain, and support WorkflowIQ, a workshop
operations dashboard for jobs, customers, stock, deliveries, staff access, and
accounting records.

Use this document for day-to-day workshop operations, local development,
deployment checks, user administration, and incident response.

## Scope

This SOP applies to:

- Admins who manage the workshop workspace, team members, and settings.
- Managers who run daily workshop workflows.
- Developers who maintain the Vite/React frontend and Supabase backend schema.

The app uses Supabase for authentication, data storage, row-level security, and
Postgres functions. The frontend is built with Vite, React, React Router,
TanStack Query, and TypeScript.

## Roles And Access

| Role | Responsibilities |
| --- | --- |
| Admin | Manage workshop settings, invite members, change member roles, activate or deactivate users, and oversee data quality. |
| Manager | Create and update jobs, customers, stock records, and accounting activity where access is available. |
| Developer | Maintain source code, migrations, deployment settings, and production support fixes. |

Access rules:

- Every user must authenticate through Supabase.
- Organization data is isolated by Supabase row-level security.
- Admin-only controls are available from **Settings**.
- Never place Supabase service-role keys or private credentials in frontend
  environment variables.

## Required Systems

- Node.js and pnpm.
- Supabase project with authentication enabled.
- Vercel project for production hosting, if deployed.
- Local `.env` file for development credentials.

Required frontend environment variables:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ENABLE_GOOGLE_AUTH=
```

`VITE_ENABLE_GOOGLE_AUTH` is only required when Google sign-in is configured in
Supabase.

## Local Setup Procedure

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create a local `.env` file and set:

   ```text
   VITE_SUPABASE_URL=your-supabase-project-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

3. Apply Supabase migrations from `supabase/migrations` in filename order.

4. Configure Supabase auth URLs:

   ```text
   Site URL: http://127.0.0.1:5173
   Redirect URL: http://127.0.0.1:5173/auth/callback
   Redirect URL: http://localhost:5173/auth/callback
   ```

5. Start the app:

   ```bash
   pnpm dev
   ```

6. Open the local Vite URL, usually `http://127.0.0.1:5173`.

If Supabase credentials are missing, the app opens in setup mode instead of the
authenticated dashboard.

## Daily Workshop Operation

### Start Of Day

1. Sign in to WorkflowIQ.
2. Open **Dashboard** and check:
   - Active jobs.
   - Ready-to-collect jobs.
   - Urgent jobs.
   - Low-stock items.
3. Review any low-stock items before work begins.
4. Confirm the team is using the correct workshop workspace name in the sidebar.

### Customer Intake

1. Open **Customers**.
2. Search for the customer before creating a new record.
3. If the customer does not exist, create a customer with:
   - Name.
   - Phone.
   - Location, when available.
   - Notes, when useful for future service.
4. Avoid duplicate customer records. If a duplicate is discovered, choose one
   primary record for future jobs and escalate cleanup to an admin or developer.

### Job Creation

1. Open **Jobs**.
2. Select **Create job**.
3. Record:
   - Customer name and phone.
   - Description of work.
   - Quantity.
   - Item condition.
   - Date received.
   - Priority.
   - Intake notes, if applicable.
   - Materials, if known.
4. Confirm the generated job card appears in the job list.

Job status flow:

```text
received -> workshop -> relining -> qc -> done -> collected
```

Use `done` only when the item is ready for collection. Use `collected` only
after the item has left the workshop and collection details have been recorded.

### Job Updates

1. Keep each job in the correct pipeline status.
2. Mark urgent work with the urgent priority.
3. Update materials when stock usage changes.
4. Add clear notes for damaged items, customer requests, or exceptions.
5. Do not mark a job collected until the customer or authorized collector has
   received the item.

### Stock Control

1. Open **Stock**.
2. Create stock records with:
   - Item name.
   - Category.
   - Unit of measure.
   - Current quantity.
   - Minimum threshold.
   - Supplier, when available.
3. Review low-stock items daily from the dashboard.
4. Record every stock adjustment with a clear reason.
5. Investigate stock counts that fall below the minimum threshold.

Stock movements should be used for:

- New stock received.
- Stock consumed by workshop jobs.
- Manual corrections after a physical count.
- Reversals or corrections caused by job changes.

### Deliveries And Collection

1. Confirm the job is ready before release.
2. Record:
   - Collection date.
   - Person collecting.
   - What was delivered.
   - Delivery condition.
   - Any notes or follow-up requirements.
3. Mark the job as collected only after release is complete.
4. If the customer disputes condition or quantity, keep the job open and add
   notes before escalation.

### Accounting Operation

1. Open **Accounting**.
2. On first use, set up the chart of accounts.
3. Record daily accounting activity from **Transactions**:
   - Invoices.
   - Bills.
   - Expenses.
   - Payments received.
   - Payments made.
4. Use **Journal** only for balanced manual debit and credit entries.
5. Review **Ledgers** for customer and supplier balances.
6. Review **Reports** for:
   - Trial balance.
   - Profit and loss.
   - Balance sheet.

Accounting controls:

- Post entries only when source documents are available.
- Use the correct bank account for cash and bank transactions.
- Do not edit accounting data directly in Supabase unless a developer-approved
  correction is required.
- Investigate any trial balance difference immediately.

### Team And Settings

1. Open **Settings** as an admin.
2. Review active, pending, and inactive members.
3. Invite only users who require access.
4. Assign the lowest sufficient role.
5. Deactivate users who leave the workshop or no longer need access.
6. Rename the workshop only when the business name or workspace naming changes.

Operational note: user invites create pending app-user records. Confirm the
production email invite path is configured before relying on automated invite
delivery.

## Deployment Procedure

1. Confirm local typecheck and build:

   ```bash
   pnpm run typecheck
   pnpm run build
   ```

2. Confirm all required Supabase migrations have been applied to production.

3. In Vercel, set:

   ```text
   Build command: pnpm run build
   Output directory: dist
   VITE_SUPABASE_URL=production-supabase-url
   VITE_SUPABASE_ANON_KEY=production-supabase-anon-key
   ```

4. In Supabase Authentication URL Configuration, set:

   ```text
   Site URL: https://YOUR-DOMAIN
   Redirect URL: https://YOUR-DOMAIN/auth/callback
   ```

5. Deploy to Vercel.

6. After deployment, verify:
   - Sign-in works.
   - Auth callback returns to the app.
   - Dashboard data loads.
   - Jobs can be created and moved through statuses.
   - Stock changes persist.
   - Accounting chart and reports load.
   - Admin settings load for admin users only.

## Change Management

Before changing production behavior:

1. Create or review the relevant issue or task.
2. Check current migrations and data dependencies.
3. Add a migration for database changes.
4. Test locally against a development Supabase project.
5. Run typecheck and build.
6. Deploy to preview first when possible.
7. Verify production after release.

Do not edit production database tables manually unless:

- The issue is urgent.
- A backup or rollback path exists.
- The change has been reviewed.
- The exact correction is documented.

## Data Protection

- Do not commit `.env` files or secrets.
- Do not expose Supabase service-role keys in frontend code.
- Use Supabase row-level security for organization isolation.
- Limit admin access to trusted users.
- Back up production data before applying high-risk migrations.
- Treat customer phone numbers and accounting records as sensitive business
  data.

## Incident Response

### Users Cannot Sign In

1. Check Supabase authentication status.
2. Confirm the site URL and redirect URLs match the current domain.
3. Confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set.
4. Check whether the user is active in **Settings**.
5. If Google sign-in is used, confirm the provider is enabled and configured in
   Supabase.

### Dashboard Fails To Load

1. Confirm the user is authenticated.
2. Check Supabase project health.
3. Confirm migrations have been applied.
4. Review browser console and network errors.
5. Confirm row-level security policies allow the user's organization access.

### Stock Quantity Looks Wrong

1. Review stock movements for the item.
2. Compare movements against job material usage and purchase records.
3. Perform a physical count.
4. Apply an adjustment with a clear reason.
5. Escalate repeated mismatches for investigation.

### Accounting Is Out Of Balance

1. Open **Reports** and check the trial balance.
2. Review recent manual journals.
3. Confirm each journal has equal debits and credits.
4. Check recent invoices, bills, expenses, and payments.
5. Escalate to a developer before manually editing ledger tables.

### Production Deployment Fails

1. Review Vercel build logs.
2. Run `pnpm run build` locally.
3. Confirm TypeScript errors are fixed.
4. Confirm required environment variables exist in Vercel.
5. Redeploy after fixes are merged.

## Maintenance Cadence

Daily:

- Review active jobs and low stock.
- Record collections and accounting activity.
- Confirm urgent jobs are visible.

Weekly:

- Review inactive or pending users.
- Reconcile stock for high-value or fast-moving items.
- Review receivables and payables.

Monthly:

- Export or back up key Supabase data.
- Review financial reports.
- Review access for admins and managers.
- Confirm production dependencies and migrations are documented.

## Support Checklist

When reporting a problem, include:

- User email.
- Workshop or organization name.
- Page or workflow affected.
- Exact time the issue occurred.
- Screenshot or error message.
- Steps to reproduce.
- Whether the issue affects one user or all users.


# MoneyMates

MoneyMates is a mobile-first household budgeting PWA for shared households. It uses manual expense entry, private Supabase household data, manual budget items, category limits, recurring payments, notifications, exports, and a Netlify Function for calm OpenAI budget coaching.

## Stack

- React, Vite, TypeScript
- Tailwind CSS
- Supabase Auth, Postgres, Row Level Security
- Recharts
- Netlify and Netlify Functions
- OpenAI Responses API
- PWA manifest and service worker
- CSV, Excel, and PDF exports

## Folder Structure

```text
MoneyMates/
  netlify/
    functions/
      budget-coach.ts
  public/
    icons/
    manifest.webmanifest
    service-worker.js
  src/
    components/
    contexts/
    lib/
    pages/
    App.tsx
    main.tsx
    index.css
  supabase/
    migrations/
      202605010001_initial_schema.sql
  netlify.toml
  package.json
  tailwind.config.js
  vite.config.ts
```

## Local Setup

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_WEB_PUSH_PUBLIC_KEY=optional-public-vapid-key
```

Only `VITE_` variables are exposed to the browser. For `netlify dev` or Netlify production functions, keep server-only values in the Netlify environment:

```bash
SUPABASE_SERVICE_ROLE_KEY=server-only-supabase-service-role-key
VAPID_PUBLIC_KEY=optional-public-vapid-key
VAPID_PRIVATE_KEY=server-only-vapid-private-key
VAPID_SUBJECT=mailto:alerts@example.com
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4.1-mini
```

Run the app:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

## Supabase Setup

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `supabase/migrations/202605010001_initial_schema.sql`.
4. Confirm email settings in Supabase Auth. For fastest household testing or private sharing, disable email confirmation. For real public sharing, configure Custom SMTP.
5. Add the frontend environment variables from the Supabase project settings.

The migration creates:

- `profiles`
- `households`
- `household_members`
- `categories`
- `budget_months`
- `budget_limits`
- `planned_budget_items`
- `expenses`
- `recurring_payments`
- `ai_insights`
- `notifications`
- `push_subscriptions`

RLS is enabled on every public table. Users can only read household data where they are members. Members can add their own expenses and manage household budget items. Users can update and delete only their own expenses. Household owners manage categories, monthly limits, and recurring payments. Members join through the safe `join_household_by_code` RPC.

Do not put a Supabase service role key in the frontend.

For the generic budget item UI, run the migrations through:

```text
supabase/migrations/20260502_fix_planned_budget_items_schema.sql
supabase/migrations/202605030002_generic_budget_items_notifications_push.sql
supabase/migrations/202605030003_rename_budget_items_to_planned_budget_items.sql
```

The `20260502_fix_planned_budget_items_schema.sql` migration is an idempotent production safety fix for older Supabase projects where `planned_budget_items` exists but is missing columns such as `archived_at`. It only creates/adds columns, policies, and indexes; it does not delete, reset, seed, or overwrite household data.

The frontend reads and writes planned budget items through `planned_budget_items`. If optional budget item fields are temporarily missing, expenses and household data should still load while the Budget page shows a warning.

### Auth Email Limits

Supabase's built-in auth email sender is only for testing and has a very low project-wide email limit. If signup says email rate limit exceeded, choose one of these:

- Private sharing: go to Supabase **Authentication > Providers > Email** and turn **Confirm email** off.
- Production sharing: go to Supabase **Authentication > SMTP Settings** and configure a provider such as Resend, SendGrid, Mailgun, Postmark, or your domain email SMTP.

After enabling Custom SMTP, check **Authentication > Rate Limits** if you need to allow more signup emails.

## OpenAI and Netlify Function

The frontend calls:

```text
/.netlify/functions/budget-coach
```

The Netlify Function reads:

```bash
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4.1-mini
```

Only summarized monthly budget data is sent to the function. The OpenAI key stays server-side in Netlify.

Expected AI JSON:

```json
{
  "summary": "...",
  "suggestions": ["...", "...", "..."],
  "savingsIdea": "...",
  "needsVsWants": "...",
  "safeSpendingSuggestion": "...",
  "disclaimer": "This is general budgeting guidance, not financial advice.",
  "warning": "...",
  "todayAction": "..."
}
```

The coach is a general budgeting helper, not a licensed financial adviser. It must not promise returns, recommend specific financial products, or provide tax, legal, loan, insurance-policy, or investment advice. App copy follows public financial-literacy concepts such as ASIC MoneySmart budgeting guidance, needs-versus-wants budgeting, emergency fund habits, and regular spending tracking.

## Netlify Deployment

`netlify.toml` is already configured:

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"
```

In Netlify:

1. Connect the GitHub repo.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Add `VITE_WEB_PUSH_PUBLIC_KEY` only if phone push is configured.
4. Add `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` in Netlify only if phone push is configured. Do not expose the service role key or VAPID private key in frontend variables.
5. Add `OPENAI_API_KEY` and `OPENAI_MODEL`.
6. Deploy.

## PWA Install

The app includes:

- `public/manifest.webmanifest`
- `public/service-worker.js`
- 192px, 512px, and Apple touch icons
- `display: standalone`
- Theme color `#0f3d3e`

After deploying over HTTPS, Android browsers should show install support. On iPhone, use Safari Share, then Add to Home Screen.

## Notes

- Month tracking starts at `2026-05-01`.
- Bank sync is intentionally not included.
- The Supabase client uses `persistSession: true` and `autoRefreshToken: true`.
- `xlsx` is included for Excel export as requested. `npm audit` currently reports known no-fix advisories in that package, so avoid importing untrusted spreadsheet files in this app.

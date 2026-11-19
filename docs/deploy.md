# Deploying Trade Receipts (free, no card)

| Piece | Host | URL |
|---|---|---|
| Home page + IDE | Cloudflare Pages | https://tradereceipts.io |
| API (FastAPI) | Vercel, free Hobby plan | https://api.tradereceipts.io |
| Sign-in | Supabase Auth, free plan | your Supabase project URL |

Keys: the Helius key lives only in Vercel's settings. Each visitor's AI key stays in their own browser and goes
only with their own requests. The Supabase URL and anon key are public by design.

## 1. Supabase (sign-in)

1. At supabase.com, create a project named `trade-receipts`, in a region near your users.
2. **Authentication → Sign In / Providers → Email**: on. Turn **Confirm email** off.
   - Why: Supabase's built-in email sender only delivers to your own team's addresses. Turn confirmation back on once you add your own email sender (Authentication → Emails → SMTP).
3. **Authentication → URL Configuration**:
   - Site URL: `https://tradereceipts.io`.
   - Redirect URLs: add `https://tradereceipts.io/**` and `http://localhost:5173/**`.
4. **Project Settings → API**: copy the **Project URL** and the **anon public** key for steps 2 and 3.

## 2. Vercel (the API)

From `backend/`:

```bash
npx vercel@latest login
```

```bash
sh deploy/package.sh --deploy
```

The first run asks to set up and link a project: choose your account and name it `trade-receipts-api`. Keep the
defaults. Then, in the Vercel dashboard, open the project and:

1. **Settings → Environment Variables** (Production). Add these, then **Redeploy**: they apply from the next deploy.
   - `HELIUS_API_KEY`: your Helius key.
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`: from step 1.
   - `ALLOWED_ORIGINS`: `https://tradereceipts.io,https://www.tradereceipts.io`
2. **Settings → Domains**: add `api.tradereceipts.io`. Vercel shows a CNAME record.
3. In **Cloudflare → tradereceipts.io → DNS**, add that record:
   - Type `CNAME`, name `api`, target the value Vercel showed (usually `cname.vercel-dns.com`).
   - Proxy status: **DNS only** (grey cloud).
4. Check it at https://api.tradereceipts.io/api/health. It should show `{"ok":true}`.

To deploy a later change, run `sh deploy/package.sh --deploy` again.

## 3. Cloudflare Pages (the site)

1. In `frontend/`, create `.env.production` (gitignored) with:

   ```
   VITE_API_URL=https://api.tradereceipts.io
   VITE_SUPABASE_URL=<Project URL from step 1>
   VITE_SUPABASE_ANON_KEY=<anon public key from step 1>
   ```

2. Build:

   ```bash
   npm run build
   ```

3. **Cloudflare → Workers & Pages → trade-receipts → Create deployment**: drag in `frontend/dist`.
4. Open https://tradereceipts.io, create an account, and check that the tour plays once and a live check runs.

## Limits to know

- **Live checks:** each visitor account gets 6 live checks and backtests an hour, and the site gets 60 a day (`CHECKS_PER_HOUR`, `CHECKS_PER_DAY` in Vercel). That keeps Helius inside its free 900,000 credits a month.
  - These counts live in memory, so a new Vercel instance starts them over. They're a brake, not a hard cap.
  - Helius's own monthly limit is the hard stop.
- **Long checks:** a busy token's check stops fetching after 200 seconds and builds from what it read, with the gaps marked, so it finishes inside Vercel's 300-second limit.
- **Supabase:** a free project pauses after a week with no activity. Restore it from the dashboard if it does.
- **Vercel:** the Hobby plan is for non-commercial use. Moving to a paid plan is the step if the site starts making money.

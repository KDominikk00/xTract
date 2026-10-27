# xTract

<p align="center">
  <img src="/public/xtract-banner.svg" alt="xTract banner" width="100%" />
</p>

xTract is an AI-powered stock intelligence platform built to help users move from raw market noise to faster, clearer decisions.

It combines live market data, personalized watchlists, and AI-driven analysis into one focused interface.

## Highlights

- Real-time market overview (gainers, losers, trending news, market heatmap)
- Stock detail pages with charting, fundamentals, and AI buy/hold/sell suggestions
- AI assistant chat that understands on-screen context and answers broader stock questions
- Followed stocks workflow with watchlist previews and dedicated followed page
- Tiered usage model (Free / Plus / Pro) with server-enforced AI quotas
- Stripe billing integration for subscriptions and plan management

## Product Focus

xTract is designed to be:

- Fast to scan
- Opinionated in presentation
- Practical for everyday market tracking

## Hosting Status

xTract currently runs on free hosting tiers while it is a young project. In practice this means:

- The site may be slow on the first visit after a quiet period, because free services go to sleep when idle and need up to a minute to wake up.
- Market data can take a moment to appear right after a wake-up.

Moving to always-on hosting costs money, and I want that to be driven by real use. If people find xTract useful and there is enough interest and funding to cover the costs, the plan is to upgrade to paid, always-on infrastructure for faster loads and better reliability. Feedback is always welcome and helps me prioritize what to improve.

## Tech Stack

- Next.js (App Router)
- TypeScript + Tailwind CSS
- Supabase (Auth + Postgres)
- Stripe (billing and subscriptions)
- Gemini API (AI features)
- FastAPI stock service

## Repository Structure

- `app/`, `components/`, `lib/` - Next.js web app (App Router, API routes under `app/api`)
- `stock-api/` - FastAPI stock data service (FMP + Yahoo)
- `supabase/migrations/` - SQL migrations (see `supabase/README.md`)
- `tests/` - Vitest unit tests; `stock-api/test_main.py` - pytest tests for the stock API
- `render.yaml` - Render Blueprint for the stock API

## Local Development

```bash
cp .env.example .env.local   # then fill in the values
npm install
npm run dev                  # http://localhost:3000
```

Stock API (separate terminal):

```bash
cd stock-api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn main:app --reload --port 8000
```

Checks (also run in CI):

```bash
npm run lint
npm run typecheck
npm test
cd stock-api && python -m pytest -q
```

## Deployment

- **Web app (Next.js):** hosted on Vercel, serving `xtract.top`. Import the repo as a Vercel project (framework: Next.js, root directory `.`) and add the environment variables below.
- **Stock API (FastAPI):** hosted on Render from `render.yaml` (`xtract-stock-api`).

Vercel can't reach Render's internal network, so the web app calls the stock API over its public URL: set `STOCK_API_BASE_URL` to the Render service URL, and set the same `STOCK_API_SECRET` on both sides. The web server sends it as `X-Stock-Api-Key`; the stock API rejects requests without it (except `/health`).

### Environment variables

Web app on Vercel (see `.env.example`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # server-only, never expose to the client
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash-lite   # optional
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PLUS_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
NEXT_PUBLIC_APP_URL=https://xtract.top
STOCK_API_BASE_URL=https://your-stock-api.onrender.com
STOCK_API_SECRET=...                 # same value as on the stock API
```

Stock API service (Render):

```bash
FMP_API_KEY=...
FRONTEND_ORIGINS=https://xtract.top   # comma-separated; only needed for direct browser calls
STOCK_API_SECRET=...                  # same value as on the web app
```

Use live Stripe keys with live price IDs (and test with test), and keep `NEXT_PUBLIC_APP_URL` equal to your deployed domain.

### Supabase

Apply the SQL in `supabase/migrations/` in order (SQL editor, or the Supabase CLI as described in `supabase/README.md`).

### Stripe

1. Create a monthly price for Plus and one for Pro, and put their IDs in `STRIPE_PLUS_PRICE_ID` / `STRIPE_PRO_PRICE_ID`.
2. Create a webhook endpoint at `https://your-domain.com/api/billing/webhook` subscribed to:
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_succeeded`, `invoice_payment.paid`.
3. Put the endpoint's signing secret in `STRIPE_WEBHOOK_SECRET`.

Local webhook testing: `stripe listen --forward-to localhost:3000/api/billing/webhook`

## Plans and Server-Enforced Rules

| Plan | AI chat | AI suggestions | Followed stocks |
| --- | --- | --- | --- |
| Free | 3 / day | 3 / day | 3 |
| Plus ($5) | 1000 / month | 300 / month | 10 |
| Pro ($15) | unlimited | unlimited | unlimited |

- The plan is stored in the user's `app_metadata` (service-role only) and is recomputed from active subscriptions on every Stripe event. It is never read from user-editable metadata.
- AI quota is reserved before the model call and refunded if the call fails.
- Follow limits are enforced atomically in SQL (`follow_stock`).
- Public stock routes are rate limited per IP, and AI/checkout routes per user.

## Post-Deploy Checklist

1. Signup, login and logout work.
2. Stripe checkout works for Plus and Pro; webhook deliveries return 200 in the Stripe dashboard.
3. `billing_customers`, `user_subscriptions` and `ai_usage` rows are created and updated.
4. Plan behavior matches the purchased tier (quota limits, follow limits, paid-only market report).
5. Home page, charts, gainers/losers and news load through the stock API.

## Common Gotchas

- Stripe test/live mode mismatch between keys, prices and webhook secret.
- Migrations not applied in Supabase.
- `NEXT_PUBLIC_APP_URL` missing or wrong, which breaks checkout redirects.
- `FMP_API_KEY` missing on the stock API (falls back to Yahoo, which is rate limited).
- `STOCK_API_SECRET` set on only one side, Vercel or Render (all stock requests then fail with 401).

## Vision

xTract aims to be a reliable stock copilot: strong at real-time context, clear explanations, and practical signals users can act on.

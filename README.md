# xTract

<p align="center">
  <img src="/xtract-frontend/public/xtract-banner.svg" alt="xTract banner" width="100%" />
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

## Tech Stack

- Next.js (App Router)
- TypeScript + Tailwind CSS
- Supabase (Auth + Postgres)
- Stripe (billing and subscriptions)
- Gemini API (AI features)
- FastAPI stock service

## Repository Structure

- `xtract/` - main web app
- `xtract/stock-api/` - stock data backend service
- `xtract/supabase/sql/` - SQL migrations and DB setup scripts

## Vision

xTract aims to be a reliable stock copilot: strong at real-time context, clear explanations, and practical signals users can act on.

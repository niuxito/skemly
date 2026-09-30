# Skemly

An AI-first diagramming tool. Describe your architecture, flowchart, sequence diagram, or mind map in plain language and Skemly generates it instantly using a lightweight DSL optimized for AI generation.

## Features

- **AI chat interface** — describe or iterate on diagrams in natural language (Claude-powered)
- **Custom DSL** — minimal syntax for boxes, cylinders, diamonds, clouds, and cards with directed/bidirectional edges, labels, tags, icons, and groups
- **Multiple layout engines** — hierarchical (ELK), mind map, tree, sequence, and ER
- **Three visual themes** — Clean, Handdrawn (roughjs), Cyberpunk
- **Voice input** — dictate prompts via browser speech recognition
- **File attachments** — send images, PDFs, or text files to Claude as context
- **Multi-session** — tabbed diagram history with auto-titles and thumbnails
- **Sharing** — server-side shareable URLs (`/s/slug`) or client-side base64 URL fallback
- **Export** — SVG and PNG download, copy DSL to clipboard
- **Cloud sync** — sessions persisted to PostgreSQL for Starter/Pro users
- **Auth** — email + password with OTP verification
- **Payments** — Stripe subscriptions (Free / Starter $12/mo / Pro $24/mo)
- **Admin panel** — user management, plan config, per-user feature overrides
- **i18n** — English and Spanish

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS v4 |
| AI | Anthropic Claude (claude-sonnet-4-6 / claude-haiku-4-5) |
| Diagrams | elkjs (graph layout), roughjs (sketch theme), lucide-react (icons) |
| Backend | Vercel serverless functions (Node.js ESM) |
| Database | Neon PostgreSQL (`@neondatabase/serverless`) |
| Auth | JWT (HttpOnly cookie) + bcryptjs |
| Email | Resend |
| Payments | Stripe |
| Tests | Vitest |

## Getting Started

### Prerequisites

- Node.js 18+
- A Neon PostgreSQL database
- An Anthropic API key

### Install

```bash
npm install
```

### Configure

Create a `.env.local` file at the project root:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret

# Auth emails (Resend)
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@yourdomain.com

# Stripe (optional). Without STRIPE_SECRET_KEY billing is disabled:
# no plans page, no checkout, and signed-in users get every feature.
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
APP_URL=https://yourapp.vercel.app

# Optional limits (defaults shown)
DAILY_LIMIT=20
FILE_DAILY_LIMIT_ANON=5
```

### Database Schema

Run the following SQL against your Neon database:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  plan TEXT DEFAULT 'free',
  plan_expires_at TIMESTAMPTZ,
  is_admin BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  stripe_customer_id TEXT,
  token_version INTEGER DEFAULT 0,
  otp_code TEXT,
  otp_expires_at TIMESTAMPTZ
);

CREATE TABLE rate_limits (
  ip_address TEXT,
  user_id INTEGER,
  window_date DATE,
  request_count INTEGER DEFAULT 0,
  file_count INTEGER DEFAULT 0,
  login_count INTEGER DEFAULT 0,
  otp_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  register_count INTEGER DEFAULT 0,
  injection_count INTEGER DEFAULT 0,
  PRIMARY KEY (ip_address, window_date)
);

CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title TEXT,
  dsl TEXT,
  messages JSONB,
  chat_history JSONB,
  title_manual BOOLEAN DEFAULT FALSE,
  thumbnail_svg TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shared_diagrams (
  id SERIAL PRIMARY KEY,
  short_id TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  title TEXT,
  dsl TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE plan_config (
  plan TEXT PRIMARY KEY,
  features JSONB NOT NULL
);

CREATE TABLE user_feature_overrides (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  features JSONB NOT NULL,
  notes TEXT
);
```

### Run (development)

```bash
npm run dev
```

Opens on `http://localhost:5173`. All API routes are served via Vite middleware — no separate server needed.

### Run (production, self-hosted)

```bash
npm run build
node server.js
```

Serves `dist/` on port 3000 (set `PORT` env var to override). Only `/api/chat` is proxied in standalone mode — auth, sessions, and billing require Vercel.

## DSL Reference

Skemly uses a lightweight text syntax. A few quick examples:

```
# Basic flowchart
[User] -> "request" -> (API Server) -> [Database]

# Tags and icons
[Auth Service] #danger @icon=Shield
[Cache] #info @icon=Database

# Groups
group "Backend" #info {
  (API) -> [DB]
}

# Directives
vibe: handdrawn
layout: LR
```

**Node shapes:** `[box]` `(cylinder)` `?diamond?` `<cloud>` `{card|header|body}`  
**Edges:** `->` (directed), `<->` (bidirectional), `-> "label" ->` (labeled)  
**Tags:** `#danger` `#safe` `#info` `#warning`  
**Layouts:** `TD` `LR` `MM` (mind map) `TREE` `SEQ` (sequence) `ER`  
**Themes:** `clean` `handdrawn` `cyberpunk`

See `claude.md` for the full DSL specification.

## Deployment

The project is configured for Vercel:

```bash
vercel deploy --prod
```

Or connect the GitHub repository to a Vercel project and push to `main`. The `vercel.json` at the project root handles build config, SPA routing rewrites, and security headers (CSP, HSTS, Permissions-Policy).

## Project Structure

```
src/
  components/     # React UI components (ChatPanel, DiagramRenderer, Header, …)
  lib/            # Parser, layout engines, themes, i18n, chat API client
  features/       # Auth, sessions, editor helpers
  pages/          # Admin, Pricing, Gallery, Terms, Privacy
api/              # Vercel serverless functions
  auth/           # register, login, logout, me, verify-otp
  _*.js           # Shared helpers (auth, rate limit, plans, prompt guard, …)
tests/            # Vitest unit tests
examples/         # Built-in .vibe DSL example files
```

## Self-hosting

`ANTHROPIC_API_KEY` is mandatory: `npm run dev` and `node server.js` refuse to start without it. The diagrams are generated with your own key, so you pay for your own usage.

Billing is optional. [skemly.app](https://skemly.app) runs with Stripe and paid plans; a self-hosted instance without `STRIPE_SECRET_KEY` hides the plans and unlocks every feature for signed-in users. Anonymous visitors keep the free daily limits, so a public instance cannot drain your key.

## License

[MIT](LICENSE)

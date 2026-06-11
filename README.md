# مدار AI — Madar AI

**AI-powered financial intelligence for restaurant owners.**

Built for restaurants using Foodics in Saudi Arabia. Delivers daily P&L, purchase tracking, and AI-driven business insights — no accounting knowledge required.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | tRPC, Prisma 7, Node.js |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth |
| AI | Claude API (claude-sonnet-4-6) |
| Hosting | Vercel |

---

## Sprint 1 Features

- **Auth** — Register, login, forgot password, email verification
- **Restaurant Profile** — CR number, VAT, city, timezone
- **Foodics Integration** — OAuth connect, auto-sync sales & branches
- **Invoice Upload** — Drag & drop PDF/image, AI OCR extraction via Claude
- **Expense Tracking** — Categorized expenses with date tracking
- **Financial Dashboard** — Daily sales, expenses, gross profit
- **AI Assistant** — Chat in Arabic/English about your business
- **AI Insights** — Auto-generated business observations and alerts

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/[your-username]/madar-ai.git
cd madar-ai
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

Required:
- `DATABASE_URL` — Supabase PostgreSQL connection string (with `?pgbouncer=true`)
- `DIRECT_URL` — Direct Supabase connection (without pgbouncer)
- `NEXT_PUBLIC_SUPABASE_URL` — Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key
- `ANTHROPIC_API_KEY` — Claude API key from console.anthropic.com

### 3. Database setup

```bash
# Run migrations
npx prisma migrate dev --name init

# Or push schema directly (no migration history)
npx prisma db push
```

### 4. Supabase Storage

Create a storage bucket named `invoices` in your Supabase project (set to public).

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel

1. Push to GitHub
2. Import repo in Vercel dashboard
3. Add all environment variables from `.env.example`
4. Deploy

---

## Roadmap

- **Phase 1** ✅ AI CFO (current)
- **Phase 2** Consumption & ingredient intelligence
- **Phase 3** Supplier price benchmarking
- **Phase 4** Procurement marketplace
- **Phase 5** Multi-industry expansion

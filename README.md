# Майсторко

Каталог на майстори по свободни дни. Майсторът пише какво работи, колко струва и кога е свободен. Клиентът търси по вид работа, град и дата и му пише директно.

> „Виж кой може, колко струва и кога е свободен – после просто му пиши.“

**Stack:** Next.js 16 (App Router, TypeScript, Tailwind 4) + Supabase (Postgres, Auth, Storage, Realtime) via `@supabase/ssr`. No other backend, no ORM.

```
maistori-mvp/
├── supabase/
│   ├── config.toml
│   └── migrations/              ← versioned schema, functions, RLS, reference data
├── web/                         ← Next.js app
│   ├── src/app/                 ← routes (Bulgarian URLs)
│   ├── src/components/
│   ├── src/lib/                 ← supabase clients, validation, formatting, search params
│   ├── scripts/seed.ts          ← demo data (service role, local only)
│   ├── scripts/test-rls.ts      ← RLS test suite
│   └── public/demo/work/        ← synthetic demo work illustrations
├── scripts/make-demo-art.py     ← regenerates the demo illustrations
├── PRODUCT.md / DESIGN.md       ← product truth and design system
└── package.json                 ← convenience scripts
```

---

## 1. Local run (Supabase in Docker)

Requirements: Node 20.9+, Docker Desktop (running), ~4 GB free RAM for the Supabase containers.

```bash
npm install          # installs the Supabase CLI (root)
npm run setup        # installs the web app
npm run db:start     # starts local Supabase and applies supabase/migrations
```

Copy the keys printed by `npm run db:status` (or `npx supabase status -o env`) into `web/.env.local`:

```bash
cp web/.env.example web/.env.local
```

| Variable | Where from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `API_URL` (http://127.0.0.1:54321) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `ANON_KEY` |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` |
| `SUPABASE_SERVICE_ROLE_KEY` | `SERVICE_ROLE_KEY`. **Only for the seed/test scripts.** Never prefix it with `NEXT_PUBLIC_`, never commit it. The app never reads it. |

Then:

```bash
npm run seed         # demo users, 25 craftsmen, calendars, chats, reviews
npm run dev          # http://localhost:3000
```

Useful local URLs: Supabase Studio http://127.0.0.1:54323 · email inbox (Mailpit, for sign-up confirmations and password reset) http://127.0.0.1:54324.

Start over at any time: `npm run db:reset && npm run seed`.

### Demo accounts (password for all: `demo12345`)

| Role | Email |
|---|---|
| Client | `klient@maistorko.test` |
| Craftsman | `maistor@maistorko.test` (Георги Петров, electrician, София) |
| Admin | `admin@maistorko.test` |

Other seeded craftsmen log in as `<slug>@maistorko.test`, e.g. `ivan-dimitrov@maistorko.test`. The seed is idempotent: it deletes and recreates every `@maistorko.test` user.

## 2. Hosted Supabase

1. Create a project at supabase.com. Under **Project Settings → API**, copy the URL, the anon key and the service role key.
2. Apply the migrations:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push          # applies supabase/migrations in order
   ```
   (Alternative: paste each file from `supabase/migrations/` in order into the SQL editor.)
3. **Authentication → URL Configuration:** set Site URL to your domain and add `https://<your-domain>/auth/callback` to the redirect URLs. Configure SMTP for real emails. Decide whether "Confirm email" stays on (recommended); the app handles both cases.
4. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SITE_URL` in your hosting provider (e.g. Vercel). Do **not** add the service role key there.
5. Demo data is optional. The seed refuses non-local URLs unless you run it deliberately with `SEED_ALLOW_REMOTE=1` and the service key in `web/.env.local`.
6. Promote your first admin in the SQL editor: `update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');`

## 3. Checks

```bash
npm run test:rls     # 60 Row Level Security assertions (incl. bookings and phone visibility) against local Supabase
npm run lint
npm run build
npm --prefix web run typecheck
```

`test:rls` creates throwaway users with the service role, runs every assertion through the public anon key as anonymous / client / craftsman / admin, then deletes them. It covers private profiles, chat privacy, spoofed senders, reviews only after a real conversation, protected columns (verified badge, rating, role), storage folder ownership and MIME limits, hidden and banned users.

---

## How it works

### Data model (`supabase/migrations`)

| Table | Purpose |
|---|---|
| `profiles` | 1:1 with `auth.users`; role `client`/`craftsman`/`admin`, name, city, phone (private), ban flag. Created by a trigger on sign-up (role from metadata, never `admin`). |
| `craftsman_profiles` | Public craftsman card: slug, bio, experience, languages, pricing extras, `short_notice`, `last_confirmed_at`, verified/hidden, rating aggregates, derived headline price and search vector. |
| `categories` | Editable 2-level tree (20 top-level, ~70 sub) with search keywords. |
| `craftsman_categories`, `craftsman_service_areas` | What they do, where they travel. |
| `services` | Price list: fixed / "от X €" / "по оглед", unit per job/hour/m²/piece/meter/day. |
| `availability_rules` | Weekly recurring blocks (weekday + time range). |
| `availability_exceptions` | Date-range overrides: free or busy, whole day or hours. |
| `work_photos` | Gallery (Storage paths). |
| `conversations`, `messages` | One conversation per client–craftsman pair, optional requested date and job type; read markers per side. |
| `reviews` | 1 per client per craftsman, only after the craftsman has replied in chat. Aggregates maintained by trigger. |
| `saved_craftsmen`, `cities`, `search_synonyms` | Saved list, reference data, query expansion. |

### Bookings (agreed visits) and inspection terms
- **Inspection terms:** on the prices page a craftsman chooses how the first visit works: free inspection, paid, paid but deducted from the job, or no inspection. They can add a fee and a free-text "Как работя" note. The profile shows this under the prices, with a reminder that prices are indicative and are agreed in the chat.
- **Hours on the public calendar:** clicking a day shows its free intervals on a 06–22 bar, and which parts of the day (сутрин / следобед / вечер) are free. The chosen part of day travels with the first message.
- **Bookings from the chat:** the "Уговорка" button proposes a day and time (оглед or работа). A client's proposal waits for the craftsman to confirm. A craftsman's is saved straight into his calendar. Confirmed bookings are subtracted from the free time everywhere: search, profile, the rule strip. Either side can cancel, and every action leaves a line in the chat. Upcoming visits are listed on both dashboards and the calendar page. The `bookings` table is written only through `propose_booking()` / `respond_booking()`, and only the two participants can read it. There is still no payment involved.

### Publish gate
A craftsman appears in search, category counts and the home page only after the profile is usable: at least one category, a price (or "по оглед") and a weekly schedule (`craftsman_is_listed()`, migration `…05_publish_gate.sql`). Until then the dashboard checklist explains what is missing. The profile URL still works for the owner.

### Availability engine
Free time on a day = (weekly blocks ∪ "free" exceptions) − "busy" exceptions, computed with Postgres `tsmultirange` (`day_free_ranges`). A day is **free** at 4h or more, **partial** at under 4h, **busy** at 0. Editing the calendar touches `last_confirmed_at`. After 14 days a calendar is *stale*: it ranks lower in search and the craftsman sees a "confirm your week" banner. After 45 days it is *expired*: it is excluded from date searches and the calendar is hidden on the profile. The calendar is informational; the conversation carries `requested_date`, so a real booking table (`bookings` with status) can be added later without changing it.

### Search (`search_craftsmen` RPC)
Prefix full-text search on a weighted `tsvector` (name > categories/keywords > services > bio) with light Bulgarian stemming (definite articles and endings), a synonym table ("чешма" → смесител, кран), and `pg_trgm` `strict_word_similarity` for typos. Filters: category (includes subcategories), city including service areas, date or date range (up to 31 days) × time of day, price range on the headline price, minimum rating, verified only. Sorts: soonest free, price, rating, newest, relevance. Stale calendars rank lower. Paginated with a window count. If no craftsman matches every word, the app retries with "any word" and says so. All search state lives in shareable Bulgarian query params (`?q=&kategoria=&grad=&data=&do=&chas=&tsena_do=&reyting=&provereni=1&sort=&str=`).

### Security
- RLS is enabled on **every** table. Public read only for listed craftsmen data, categories and cities.
- `profiles` (phone, ban flag) are readable only by the owner and admins.
- A craftsman's phone is exposed only through `craftsman_phone()`, which applies their `phone_visibility` choice (`public`, `login`, `chat` = after they replied, `hidden`). The profile page never puts the number in its HTML; it is fetched on "Покажи телефона".
- Chats are visible only to the two participants, including to admins. Conversations can be created only through `start_conversation()`.
- Protected columns (`role`, `is_banned`, `is_verified`, `is_hidden`, ratings, derived price/search fields) are guarded by triggers for API calls.
- Admin checks go through `is_admin()` (a `profiles.role` lookup) in policies and RPCs.
- Storage: `avatars` (2 MB) and `work-photos` (5 MB) accept JPG/PNG/WEBP only and are publicly readable. Users can write only to `<bucket>/<their user id>/…`.
- The service role key is used only by `web/scripts/*`.

### Realtime
The `messages` and `conversations` tables are in the `supabase_realtime` publication, and RLS filters every event per subscriber. The thread subscribes to its conversation. The header badge and conversation list refresh unread counts live (`unread_total()`, `my_conversations()`).

### Routes

| Path | Page |
|---|---|
| `/` | Home |
| `/maistori` | Catalog and search |
| `/maistori/[slug]` | Profile: calendar, prices, gallery, reviews, chat |
| `/kategorii`, `/kategorii/[slug]` | Categories |
| `/vhod`, `/registratsia`, `/zabravena-parola`, `/nova-parola` | Auth |
| `/tabla` (+ `/kalendar`, `/tseni`, `/snimki`, `/profil`, `/zapazeni`) | Dashboards |
| `/saobshtenia` | Chat |
| `/admin`, `/admin/kategorii` | Admin |

## Notes
- Demo work photos are synthetic SVG illustrations labelled "Демо изображение" (`scripts/make-demo-art.py`). Craftsman avatars are monograms until a photo is uploaded.
- No payments, subscriptions or billing exist anywhere. A craftsman subscription can later hang off `craftsman_profiles` (e.g. a `plan` table plus a boost factor in the search ORDER BY) without touching the catalog model.
- Windows + Docker Desktop: if Docker fails with "copying distribution … being used by another process", quit Docker Desktop, run `wsl --shutdown`, then start it once.

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
cp supabase/.env.example supabase/.env   # then put a long random string in SUPABASE_AUTH_JWT_SECRET
npm run db:start     # starts local Supabase and applies supabase/migrations
```

The own JWT secret replaces the CLI's publicly known default, so tokens can't be forged when the demo is exposed through the tunnel (section 4).

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

## 4. Public demo (nginx + Cloudflare tunnel)

Lets friends open the local site from anywhere at a random `https://….trycloudflare.com` address. Nothing on the router changes.

```bash
npm run db:start     # local Supabase (with the own JWT secret from supabase/.env)
npm run build:demo   # build where the browser reaches Supabase through the site's own origin
npm start            # the site on :3000
npm run demo:up      # nginx (local http://localhost:8080) + tunnel; prints the public URL
npm run demo:down    # stop nginx + tunnel
```

- nginx (`demo/nginx.conf`) serves the app and proxies only `/rest/v1`, `/auth/v1`, `/storage/v1` and `/realtime/v1` to Supabase. Studio, Mailpit, pg-meta and the auth admin API are not reachable. The CLI's public `sb_secret_` key is rejected, and auth calls are rate-limited.
- The quick-tunnel URL changes every time the tunnel restarts; `npm run demo:url` prints the current one. No rebuild is needed when it changes.
- Port 80 on Windows is often taken by IIS (W3SVC). The tunnel does not need it. To use port 80 locally anyway, stop IIS and run `DEMO_PORT=80 npm run demo:up`.
- A `build:demo` build expects nginx in front of it. For plain local development use `npm run dev` or a normal `npm run build`.
- The demo accounts and their password are in this README, which is public on GitHub. Anyone who gets the tunnel URL can log in as them, including the admin.

## 5. Notifications, e-mails and cleanup (worker)

Events (new message, booking, review, weekly calendar reminder) create a notification: the bell in the header (messages keep their own badge). Each one also queues an e-mail with a delay (10 minutes for messages, so several messages become one mail, and nothing is sent if the person read it in the app). Users switch kinds off under Профил, and every mail has a "stop" link (`/otpiska/<token>`).

Mails are only queued by the database. A worker sends them and runs the maintenance jobs:

```bash
npm run worker        # loops every minute; Mailpit shows the mails at http://127.0.0.1:54324
npm run worker:once   # one pass
```

- Sends due mails through `SMTP_URL` (see `web/.env.example`); skips mails whose notification was already read.
- Nightly (after 03:00 Sofia): `cleanup_old_chats(60)` deletes message texts of conversations idle for 60 days. Who talked to whom, bookings and the right to review stay.
- Sundays (after 17:00): reminds craftsmen whose calendar was not confirmed for a week.

The worker uses the service role key, so it is a server-side process of its own, never part of the web app. In production run it as a separate process or scheduled job.

Review links: a craftsman creates one per finished job (Поръчки → "Поискай отзив") and sends it to the client, who signs in and rates at `/otzyv/<token>`. A link works once and expires after 90 days.

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

### Fair ranking ("Препоръчани", the default sort)
`search_craftsmen(p_sort => 'recommended', p_seed => …)`. Everybody is scored by the same public rules (`/kak-podrejdame`): 0.35 availability + 0.20 Bayesian rating + 0.20 responsiveness + 0.15 calendar freshness + 0.10 profile completeness + a fading newcomer bonus (+ text match when searching). Then an exposure-fairness correction (±0.10: whoever was shown less than their share of the last 30 days moves up, whoever was shown more moves down; shown positions are recorded as weighted counters, `daily_stats.exposure`) and a seeded Gumbel tie-break so close scores take turns. The app derives the seed from the visitor and the day (`web/src/lib/rank-seed.ts`), then forgets it: no cookie, nothing stored. Years of experience, the verified badge, price and company status are not part of the score. The home page picks 3 from the top 12 with different trades and one newcomer slot. Paid placements do not exist yet; when added they must be labeled and kept apart from this ranking.

### Security
- RLS is enabled on **every** table. Public read only for listed craftsmen data, categories and cities.
- `profiles` (phone, ban flag) are readable only by the owner and admins.
- A craftsman's phone is exposed only through `craftsman_phone()`, which applies their `phone_visibility` choice (`public`, `login`, `chat` = after they replied, `hidden`). The profile page never puts the number in its HTML; it is fetched on "Покажи телефона".
- Chats are visible only to the two participants, including to admins. Conversations can be created only through `start_conversation()`.
- Protected columns (`role`, `is_banned`, `is_verified`, `is_hidden`, ratings, derived price/search fields) are guarded by triggers for API calls.
- Admin checks go through `is_admin()` (a `profiles.role` lookup) in policies and RPCs.
- Storage: `avatars` (2 MB) and `work-photos` (5 MB) accept JPG/PNG/WEBP only and are publicly readable. Users can write only to `<bucket>/<their user id>/…`.
- The service role key is used only by `web/scripts/*`.
- Security headers (`web/next.config.ts`): Content-Security-Policy (no foreign scripts, no framing, no plugins, forms only to the site itself; `script-src` keeps `'unsafe-inline'` because Next.js writes inline bootstrap scripts), `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and HSTS when `NEXT_PUBLIC_SITE_URL` is https.
- Uploaded photos are always redrawn on a canvas before upload, which drops EXIF/GPS data; a JPEG that cannot be re-encoded is refused.
- Abuse controls (database triggers): 20 messages a minute, 3+ links in a message refused, the same text to 8+ conversations in an hour refused and flagged for admins, 30 new conversations and 3 reviews a day. "Докладвай" on profiles and chats feeds `/admin/dokladi`; every admin action is written to the audit log `/admin/dnevnik`.
- Optional Cloudflare Turnstile on sign-up, sign-in and password reset (see `web/.env.example`). For production also turn on e-mail confirmation (`enable_confirmations` in the hosted project's Auth settings).

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

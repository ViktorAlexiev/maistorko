# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Pinned by the user: Next.js (App Router) + TypeScript + Tailwind, @supabase/ssr. Backend is Supabase only (Postgres, Auth, Storage, Realtime); no custom backend, no ORM. Development runs against local Supabase in Docker; hosted Supabase is supported via env vars.

## Users

- **Майстори (craftsmen):** Bulgarian tradespeople (electricians, plumbers, painters, handymen, etc.), often not tech-savvy, using a phone, usually between jobs or in the evening. Job: show what they do, what it costs, and when they are free, then answer client messages.
- **Клиенти (clients):** households and small businesses in Bulgarian cities needing a repair or job done on a specific day. Job: find someone who can do it, at a known price, who is free on the day they need; then talk to them. Can browse without an account.
- **Admin:** operator who manages categories, hides/bans users, and grants the "verified" badge manually.

## Product Purpose

A browse-by-availability catalog of craftsmen. Core promise: «Виж кой може, колко струва и кога е свободен – после просто му пиши.» Success: a client finds a free, suitable craftsman for their date in one search and starts a chat; craftsmen keep calendars fresh because it brings them work.

## Positioning

Not a "post a job and collect bids" site and not pay-per-lead. The differentiator is the craftsman's own availability calendar and own prices, searchable by date. The calendar is informational (not hard booking); agreement happens in chat.

## Operating Context

- Launch focus: София, Пловдив, Варна, Бургас, Русе plus surrounding towns as service areas.
- Craftsmen update calendars on phones; one-tap actions matter more than precision.
- Clients and craftsmen often chat in the evening.
- UI language Bulgarian; prices in EUR (€).

## Capabilities and Constraints

- Roles: client, craftsman, admin. Email+password auth, password reset.
- Search in Postgres (FTS + pg_trgm + availability-on-date), shareable URLs.
- Realtime chat with unread state; reviews only from clients who chatted with the craftsman.
- Pricing: optional hourly rate, named services (fixed or "от X €", units per job/hour/m²/piece), "по оглед" option, call-out fee, travel fee, materials-included flag.
- Non-goals: payments, subscriptions, commissions, invoices, billing of any kind. Architecture must allow a craftsman subscription later.
- Stale calendars (no confirmation for X days) are de-prioritized in search.

## Brand Commitments

- Name: **Майсторко** (chosen by Claude on the user's delegation; not yet validated with users or trademark-checked).
- Voice: plain, direct, friendly Bulgarian; addresses users with "ти" in UI microcopy only where warm, formal enough to feel trustworthy.

## Evidence on Hand

None. No real craftsmen, reviews, testimonials, user counts, or partner logos exist. All seed data is synthetic demo data and must never be presented as real statistics or testimonials on public marketing copy.

## Product Principles

1. Availability first: "when is he free" is as visible as "what does he do".
2. Honest prices: always show a headline price or clearly say "по оглед".
3. Phone-first for craftsmen: every calendar action reachable with one thumb in one or two taps.
4. Talk, don't transact: the goal of every page is a well-informed first message.
5. Private by default: contact details are never forced public; chat is the channel.

## Accessibility & Inclusion

WCAG 2.2 AA. Large tap targets and legible type for older, less tech-savvy craftsmen; forms with clear Bulgarian validation messages.

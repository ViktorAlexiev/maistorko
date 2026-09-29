-- Майсторко: core schema
-- Profiles linked to auth.users, craftsman catalog, pricing, availability,
-- messaging, reviews, saved craftsmen.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('client', 'craftsman', 'admin');
create type public.price_kind as enum ('fixed', 'from', 'quote');
create type public.price_unit as enum ('job', 'hour', 'm2', 'piece', 'meter', 'day');
create type public.exception_kind as enum ('free', 'busy');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Bulgarian -> Latin transliteration (official streamlined system, 2009 law)
create or replace function public.bg_translit(input text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select
    replace(replace(replace(replace(replace(replace(replace(replace(
    translate(
      replace(replace(replace(replace(replace(replace(replace(replace(
        lower(coalesce(input, '')),
      'щ', 'sht'), 'ж', 'zh'), 'ц', 'ts'), 'ч', 'ch'), 'ш', 'sh'), 'ю', 'yu'), 'я', 'ya'), 'ьо', 'yo'),
      'абвгдезийклмнопрстуфхъь',
      'abvgdeziyklmnoprstufhay'
    ),
    'ё', 'yo'), 'э', 'e'), 'ы', 'y'), 'є', 'ye'), 'ї', 'yi'), 'і', 'i'), 'ґ', 'g'), '’', '')
$$;

create or replace function public.slugify(input text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    regexp_replace(public.bg_translit(input), '[^a-z0-9]+', '-', 'g'),
    '-{2,}', '-', 'g'))
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reference data tables
-- ---------------------------------------------------------------------------
create table public.cities (
  id smallint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  region text not null,
  is_major boolean not null default false,
  sort smallint not null default 100
);

create table public.categories (
  id smallint generated always as identity primary key,
  parent_id smallint references public.categories (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(name) between 2 and 80),
  description text check (char_length(description) <= 400),
  icon text,
  keywords text[] not null default '{}',
  sort smallint not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);
create index categories_parent_idx on public.categories (parent_id);

-- Free-text synonyms: what people type -> words that exist in the catalog
create table public.search_synonyms (
  term text primary key,
  expands_to text not null
);

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'client',
  full_name text not null default '' check (char_length(full_name) <= 120),
  city_id smallint references public.cities (id) on delete set null,
  phone text check (phone is null or phone ~ '^\+?[0-9 ()-]{6,20}$'),
  avatar_url text,
  is_banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.craftsman_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  display_name text not null check (char_length(display_name) between 2 and 120),
  business_name text check (char_length(business_name) <= 120),
  bio text not null default '' check (char_length(bio) <= 1500),
  years_experience smallint check (years_experience between 0 and 70),
  city_id smallint references public.cities (id) on delete set null,
  languages text[] not null default '{bg}',
  avatar_url text,
  -- pricing
  hourly_rate numeric(8,2) check (hourly_rate is null or hourly_rate between 1 and 1000),
  callout_fee numeric(8,2) check (callout_fee is null or callout_fee between 0 and 1000),
  travel_fee numeric(8,2) check (travel_fee is null or travel_fee between 0 and 1000),
  materials_included boolean not null default false,
  quote_on_inspection boolean not null default false,
  price_from numeric(8,2),               -- maintained by trigger: headline price
  price_from_unit public.price_unit,     -- maintained by trigger
  -- availability
  short_notice boolean not null default false,
  last_confirmed_at timestamptz not null default now(),
  -- contact preferences
  contact_hours text check (char_length(contact_hours) <= 80),
  phone_after_chat boolean not null default false,
  -- moderation / reputation (protected columns)
  is_verified boolean not null default false,
  is_hidden boolean not null default false,
  rating_avg numeric(3,2) not null default 0,
  rating_count integer not null default 0,
  -- search
  search_text text not null default '',
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index craftsman_city_idx on public.craftsman_profiles (city_id);
create index craftsman_price_idx on public.craftsman_profiles (price_from);
create index craftsman_rating_idx on public.craftsman_profiles (rating_avg desc);
create index craftsman_search_idx on public.craftsman_profiles using gin (search_vector);
create index craftsman_search_trgm_idx on public.craftsman_profiles using gin (search_text extensions.gin_trgm_ops);
create index craftsman_visible_idx on public.craftsman_profiles (is_hidden, last_confirmed_at desc);
create trigger craftsman_profiles_updated_at before update on public.craftsman_profiles
  for each row execute function public.set_updated_at();

create table public.craftsman_service_areas (
  craftsman_id uuid not null references public.craftsman_profiles (id) on delete cascade,
  city_id smallint not null references public.cities (id) on delete cascade,
  primary key (craftsman_id, city_id)
);
create index service_areas_city_idx on public.craftsman_service_areas (city_id);

create table public.craftsman_categories (
  craftsman_id uuid not null references public.craftsman_profiles (id) on delete cascade,
  category_id smallint not null references public.categories (id) on delete cascade,
  primary key (craftsman_id, category_id)
);
create index craftsman_categories_cat_idx on public.craftsman_categories (category_id);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  craftsman_id uuid not null references public.craftsman_profiles (id) on delete cascade,
  category_id smallint references public.categories (id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  description text check (char_length(description) <= 300),
  price_kind public.price_kind not null default 'fixed',
  price numeric(8,2) check (price is null or price between 0 and 100000),
  unit public.price_unit not null default 'job',
  sort smallint not null default 100,
  created_at timestamptz not null default now(),
  check ((price_kind = 'quote') = (price is null))
);
create index services_craftsman_idx on public.services (craftsman_id);

create table public.work_photos (
  id uuid primary key default gen_random_uuid(),
  craftsman_id uuid not null references public.craftsman_profiles (id) on delete cascade,
  path text not null,
  caption text check (char_length(caption) <= 140),
  sort smallint not null default 100,
  created_at timestamptz not null default now()
);
create index work_photos_craftsman_idx on public.work_photos (craftsman_id);

-- ---------------------------------------------------------------------------
-- Availability (informational calendar; open for real booking later)
-- ---------------------------------------------------------------------------
-- Weekly recurring blocks. weekday: ISO 1 = Monday ... 7 = Sunday
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  craftsman_id uuid not null references public.craftsman_profiles (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index availability_rules_craftsman_idx on public.availability_rules (craftsman_id, weekday);

-- Date exceptions: free/busy for a date range, optionally only certain hours.
create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  craftsman_id uuid not null references public.craftsman_profiles (id) on delete cascade,
  kind public.exception_kind not null,
  start_date date not null,
  end_date date not null,
  start_time time,
  end_time time,
  note text check (char_length(note) <= 140),
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (end_date - start_date <= 366),
  check ((start_time is null) = (end_time is null)),
  check (end_time is null or end_time > start_time)
);
create index availability_exceptions_idx on public.availability_exceptions (craftsman_id, start_date, end_date);

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  craftsman_id uuid not null references public.craftsman_profiles (id) on delete cascade,
  requested_date date,
  category_id smallint references public.categories (id) on delete set null,
  last_message_at timestamptz not null default now(),
  last_message_preview text not null default '',
  last_sender_id uuid,
  client_last_read_at timestamptz not null default now(),
  craftsman_last_read_at timestamptz not null default 'epoch',
  created_at timestamptz not null default now(),
  unique (client_id, craftsman_id),
  check (client_id <> craftsman_id)
);
create index conversations_client_idx on public.conversations (client_id, last_message_at desc);
create index conversations_craftsman_idx on public.conversations (craftsman_id, last_message_at desc);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Reviews & saved
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  craftsman_id uuid not null references public.craftsman_profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 1000),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (craftsman_id, client_id)
);
create index reviews_craftsman_idx on public.reviews (craftsman_id, created_at desc);
create trigger reviews_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

create table public.saved_craftsmen (
  client_id uuid not null references public.profiles (id) on delete cascade,
  craftsman_id uuid not null references public.craftsman_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, craftsman_id)
);
create index saved_craftsman_idx on public.saved_craftsmen (craftsman_id);

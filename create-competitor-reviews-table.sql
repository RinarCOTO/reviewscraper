-- ReviewIntel: competitor_reviews table
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- Safe to run multiple times — uses IF NOT EXISTS

create table if not exists competitor_reviews (
  id                      uuid primary key default gen_random_uuid(),

  -- Provider identity
  provider_name           text not null,
  brand_name              text,
  location_city           text not null,
  location_state          text not null,
  method_used             text,

  -- Review content
  review_text             text,
  star_rating             smallint check (star_rating between 1 and 5),
  reviewer_name           text,
  reviewer_local_guide    boolean default false,
  verified_source         text default 'Google',

  -- Dates
  review_date             text,                    -- raw relative string ("2 months ago")
  review_date_iso         timestamptz,             -- real date from SerpAPI
  review_date_edited_iso  timestamptz,             -- edit date from SerpAPI
  review_date_estimated   text,                    -- our YYYY-MM conversion
  review_date_label       text,                    -- full disclosure label
  review_date_source      text default 'estimated' -- estimated | verified | verified_serpapi

    check (review_date_source in ('estimated', 'verified', 'verified_serpapi')),

  -- Analysis fields (populated by analyze-v4.mjs)
  result_rating           text check (result_rating in ('Positive', 'Negative', 'Mixed', 'Neutral', 'unknown')),
  pain_level              text,
  scarring_mentioned      text,
  sessions_completed      text,
  skin_type               text,
  use_case                text,

  -- Flags
  has_text                boolean default true,
  location_transition     boolean default false,
  transition_note         text,
  multi_location_brand    boolean default false,

  -- Audit trail
  _place_title            text,
  _place_id               text,
  _scrape_date            date,
  _scrape_mode            text check (_scrape_mode in ('full', 'incremental')),
  scrape_version          text default 'v4',

  -- Workflow status
  status                  text not null default 'draft'
    check (status in ('draft', 'published', 'flagged')),

  -- Timestamps
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- Auto-update updated_at on any row change
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists competitor_reviews_updated_at on competitor_reviews;
create trigger competitor_reviews_updated_at
  before update on competitor_reviews
  for each row execute function set_updated_at();

-- Separator bucket field (inkout | tatt2away — null for competitor rows)
alter table if exists competitor_reviews add column if not exists bucket text
  check (bucket in ('inkout', 'tatt2away'));

-- Indexes for the queries the dashboard will run most
create index if not exists idx_cr_provider       on competitor_reviews (provider_name);
create index if not exists idx_cr_brand          on competitor_reviews (brand_name);
create index if not exists idx_cr_city           on competitor_reviews (location_city, location_state);
create index if not exists idx_cr_status         on competitor_reviews (status);
create index if not exists idx_cr_star           on competitor_reviews (star_rating);
create index if not exists idx_cr_date           on competitor_reviews (review_date_iso desc);
create index if not exists idx_cr_place          on competitor_reviews (_place_id);
create index if not exists idx_cr_transition     on competitor_reviews (location_transition);
create index if not exists idx_cr_bucket         on competitor_reviews (bucket);

-- Row Level Security: only authenticated users can read
alter table competitor_reviews enable row level security;

create policy "Authenticated users can read competitor_reviews"
  on competitor_reviews for select
  to authenticated
  using (true);

create policy "Service role has full access"
  on competitor_reviews for all
  to service_role
  using (true);

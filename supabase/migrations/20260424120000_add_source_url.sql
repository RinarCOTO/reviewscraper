-- Add source_url to competitor_reviews.
-- Captures the direct Google Maps review permalink from SerpAPI (r.link field).
-- Populated for inkOUT scrapes only in the initial rollout; competitor rows stay null
-- until the feature is extended. No backfill of existing rows.
-- Project: rxrhvbfutjahgwaambqd

ALTER TABLE competitor_reviews
  ADD COLUMN IF NOT EXISTS source_url text;

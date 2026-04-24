-- Add audit trail and review workflow fields to competitor_reviews.
-- All columns are nullable additions — no existing columns are modified.
-- Project: rxrhvbfutjahgwaambqd (RinarCOTO's Project, Northeast Asia Tokyo)

ALTER TABLE competitor_reviews
  ADD COLUMN IF NOT EXISTS routing_reason   text,
  ADD COLUMN IF NOT EXISTS reviewed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_decision text;

-- Backfill: rows already in the table get legacy_unknown so the audit trail
-- is honest about when routing_reason tracking began.
UPDATE competitor_reviews
SET routing_reason = 'legacy_unknown'
WHERE routing_reason IS NULL;

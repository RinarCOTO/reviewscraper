-- Chunk 5 additions
-- last_analyzed_at: populated whenever routing.py or classify-relevance.mjs touches a row.
-- relevance_reason: explains why is_tattoo_removal was set to a given value.
ALTER TABLE competitor_reviews ADD COLUMN IF NOT EXISTS last_analyzed_at timestamptz;
ALTER TABLE competitor_reviews ADD COLUMN IF NOT EXISTS relevance_reason text;

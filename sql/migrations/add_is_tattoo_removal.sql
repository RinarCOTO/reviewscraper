-- Add relevance flag to separate off-topic reviews from tattoo removal metrics.
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/rxrhvbfutjahgwaambqd/sql
ALTER TABLE competitor_reviews ADD COLUMN IF NOT EXISTS is_tattoo_removal boolean;

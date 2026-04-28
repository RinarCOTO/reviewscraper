-- Run this in Supabase Dashboard > SQL Editor
-- Fixes the null brand_name on Removery South Congress Austin

UPDATE competitor_reviews 
SET brand_name = 'Removery' 
WHERE provider_name = 'Removery (South Congress)' 
  AND brand_name IS NULL;

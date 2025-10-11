-- Drop the invalid constraint that references the non-existent has_coping column
ALTER TABLE pool_variants 
DROP CONSTRAINT IF EXISTS has_coping_if_not_unconfigured;
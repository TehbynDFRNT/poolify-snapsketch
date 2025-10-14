-- Remove redundant coping fields from pool_variants table
-- The coping calculation is now handled entirely by the standalone
-- copingCalculation.ts utility with global DEFAULT_COPING_OPTIONS

ALTER TABLE pool_variants 
DROP COLUMN IF EXISTS coping_width,
DROP COLUMN IF EXISTS grout_width,
DROP COLUMN IF EXISTS coping_layout,
DROP COLUMN IF EXISTS coping_options,
DROP COLUMN IF EXISTS paver_size;
-- Add coping_options JSONB field to pool_variants table
ALTER TABLE pool_variants 
ADD COLUMN IF NOT EXISTS coping_options JSONB DEFAULT '[]'::jsonb;

-- Migrate existing pools with 3 default coping options
UPDATE pool_variants
SET coping_options = jsonb_build_array(
  jsonb_build_object(
    'id', 'coping-400x400',
    'name', 'Coping 400×400',
    'tile', jsonb_build_object('along', 400, 'inward', 400),
    'rows', jsonb_build_object('sides', 1, 'shallow', 1, 'deep', 2),
    'cornerStrategy', 'corner-first',
    'balanceCuts', 'two-small-on-long-edges'
  ),
  jsonb_build_object(
    'id', 'coping-600x400',
    'name', 'Coping 600×400',
    'tile', jsonb_build_object('along', 600, 'inward', 400),
    'rows', jsonb_build_object('sides', 1, 'shallow', 1, 'deep', 2),
    'cornerStrategy', 'corner-first',
    'balanceCuts', 'two-small-on-long-edges'
  ),
  jsonb_build_object(
    'id', 'coping-400x600',
    'name', 'Coping 400×600',
    'tile', jsonb_build_object('along', 400, 'inward', 600),
    'rows', jsonb_build_object('sides', 1, 'shallow', 1, 'deep', 2),
    'cornerStrategy', 'corner-first',
    'balanceCuts', 'two-small-on-long-edges'
  )
)
WHERE coping_options IS NULL OR coping_options = '[]'::jsonb;
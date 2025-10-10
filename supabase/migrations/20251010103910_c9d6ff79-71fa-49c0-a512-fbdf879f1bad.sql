-- Drop ALL existing constraints first
ALTER TABLE pool_variants
DROP CONSTRAINT IF EXISTS pool_variants_status_check CASCADE;

ALTER TABLE pool_variants
DROP CONSTRAINT IF EXISTS valid_status CASCADE;

ALTER TABLE pool_variants
DROP CONSTRAINT IF EXISTS has_coping_if_not_unconfigured CASCADE;

-- Update pool_variants table schema

-- Step 1: Drop columns with CASCADE
ALTER TABLE pool_variants
DROP COLUMN IF EXISTS display_name CASCADE;

ALTER TABLE pool_variants
DROP COLUMN IF EXISTS variant_name CASCADE;

ALTER TABLE pool_variants
DROP COLUMN IF EXISTS length CASCADE;

ALTER TABLE pool_variants
DROP COLUMN IF EXISTS width CASCADE;

ALTER TABLE pool_variants
DROP COLUMN IF EXISTS coping_type CASCADE;

-- Step 2: Rename columns (only if they exist)
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns 
            WHERE table_name='pool_variants' AND column_name='outline_points') THEN
    ALTER TABLE pool_variants RENAME COLUMN outline_points TO outline;
  END IF;
  
  IF EXISTS(SELECT 1 FROM information_schema.columns 
            WHERE table_name='pool_variants' AND column_name='shallow_end') THEN
    ALTER TABLE pool_variants RENAME COLUMN shallow_end TO shallow_end_position;
  END IF;
  
  IF EXISTS(SELECT 1 FROM information_schema.columns 
            WHERE table_name='pool_variants' AND column_name='deep_end') THEN
    ALTER TABLE pool_variants RENAME COLUMN deep_end TO deep_end_position;
  END IF;
END $$;

-- Step 3: Handle paver_size column
ALTER TABLE pool_variants
DROP COLUMN IF EXISTS has_coping CASCADE;

ALTER TABLE pool_variants
ADD COLUMN IF NOT EXISTS paver_size TEXT;

-- Step 4: Update existing rows to comply with new schema
UPDATE pool_variants
SET status = 'unconfigured',
    paver_size = NULL
WHERE coping_layout IS NULL OR paver_size IS NULL;

UPDATE pool_variants
SET status = 'draft'
WHERE coping_layout IS NOT NULL 
  AND paver_size IS NOT NULL 
  AND status NOT IN ('published', 'archived');

-- Step 5: Update status column default
ALTER TABLE pool_variants
ALTER COLUMN status SET DEFAULT 'unconfigured';

-- Step 6: Add new constraints
ALTER TABLE pool_variants
ADD CONSTRAINT valid_status CHECK (status IN ('unconfigured', 'draft', 'published', 'archived'));

ALTER TABLE pool_variants
ADD CONSTRAINT has_coping_if_not_unconfigured CHECK (
  (status = 'unconfigured') OR 
  (status != 'unconfigured' AND coping_layout IS NOT NULL AND paver_size IS NOT NULL)
);

-- Step 7: Update indexes
DROP INDEX IF EXISTS idx_pool_variants_status;
DROP INDEX IF EXISTS idx_pool_variants_pool_name;
DROP INDEX IF EXISTS idx_pool_variants_created_at;

CREATE INDEX idx_pool_variants_status ON pool_variants(status);
CREATE INDEX idx_pool_variants_pool_name ON pool_variants(pool_name);
CREATE INDEX idx_pool_variants_created_at ON pool_variants(created_at DESC);
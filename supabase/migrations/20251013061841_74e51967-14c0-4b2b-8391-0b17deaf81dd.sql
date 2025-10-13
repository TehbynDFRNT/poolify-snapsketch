-- Add zone_of_influence column to pool_variants table
ALTER TABLE pool_variants 
ADD COLUMN zone_of_influence jsonb NULL;

COMMENT ON COLUMN pool_variants.zone_of_influence IS 
'Optional reference boundary showing minimum clearance zone. Format: array of {x, y} coordinates in mm.';
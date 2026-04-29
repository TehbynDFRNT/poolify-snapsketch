-- Backfill org_id on existing projects that were created before the
-- JWT template included org_id.  All current users belong to MFP Easy.
UPDATE public.projects
SET org_id = 'org_39jfpmFYpPuCg5CI5BCAxbtqivc'
WHERE org_id IS NULL;

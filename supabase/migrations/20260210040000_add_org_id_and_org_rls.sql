-- Add org_id column to projects for Clerk organisation-based visibility
-- Org members can VIEW all org projects; only owner can edit/delete

-- Step 1: Add org_id column + index
ALTER TABLE public.projects ADD COLUMN org_id text;
CREATE INDEX idx_projects_org_id ON public.projects (org_id);

-- Step 2: Helper function to extract org_id from Clerk JWT
CREATE OR REPLACE FUNCTION public.requesting_org_id()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT (select auth.jwt()->>'org_id')
$function$;

-- Step 3: Replace SELECT policy to include org visibility
DROP POLICY IF EXISTS "Users can view own or shared projects" ON public.projects;

CREATE POLICY "Users can view own or shared or org projects" ON public.projects
  FOR SELECT TO PUBLIC
  USING (
    owner_id = requesting_user_id()
    OR id IN (
      SELECT project_shares.project_id
      FROM project_shares
      WHERE project_shares.user_id = requesting_user_id()
        AND project_shares.revoked_at IS NULL
    )
    OR (
      org_id IS NOT NULL
      AND org_id = requesting_org_id()
    )
  );

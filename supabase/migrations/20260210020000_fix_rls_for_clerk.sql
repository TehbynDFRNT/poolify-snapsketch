-- Fix RLS policies to use auth.jwt()->>'sub' instead of auth.uid()
-- Clerk user IDs are text strings (user_xxx), not UUIDs

-- Helper: get current user ID as text from JWT sub claim
CREATE OR REPLACE FUNCTION public.requesting_user_id()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT (select auth.jwt()->>'sub')
$function$;

-- === Drop all existing policies ===

-- Profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Companies
DROP POLICY IF EXISTS "Users can view their company" ON public.companies;
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Company owners can update" ON public.companies;

-- Projects
DROP POLICY IF EXISTS "Users can create own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view shared projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update shared projects with edit permission" ON public.projects;
DROP POLICY IF EXISTS "Users can delete shared projects with admin permission" ON public.projects;
DROP POLICY IF EXISTS "Users can view own or shared projects" ON public.projects;

-- Project shares
DROP POLICY IF EXISTS "Users can view their received shares" ON public.project_shares;
DROP POLICY IF EXISTS "Users can view shares they created" ON public.project_shares;
DROP POLICY IF EXISTS "Users can create shares for their projects" ON public.project_shares;
DROP POLICY IF EXISTS "Users can update shares for their projects" ON public.project_shares;
DROP POLICY IF EXISTS "Users can delete shares for their projects" ON public.project_shares;

-- Project public links
DROP POLICY IF EXISTS "owners can read their links" ON public.project_public_links;
DROP POLICY IF EXISTS "owners can create links" ON public.project_public_links;
DROP POLICY IF EXISTS "owners can update/revoke links" ON public.project_public_links;

-- Project versions
DROP POLICY IF EXISTS "Users can view versions of accessible projects" ON public.project_versions;
DROP POLICY IF EXISTS "Project owners and editors can insert versions" ON public.project_versions;
DROP POLICY IF EXISTS "Project owners can delete versions" ON public.project_versions;

-- Activity log
DROP POLICY IF EXISTS "Users can view activity for accessible projects" ON public.activity_log;
DROP POLICY IF EXISTS "Users can create activity logs" ON public.activity_log;

-- Comments
DROP POLICY IF EXISTS "Users can view comments on accessible projects" ON public.comments;
DROP POLICY IF EXISTS "Users can create comments on accessible projects" ON public.comments;

-- Pool variants
DROP POLICY IF EXISTS "Admins can manage pool variants" ON public.pool_variants;
DROP POLICY IF EXISTS "Everyone can view published pools" ON public.pool_variants;

-- Pool activity log
DROP POLICY IF EXISTS "Admins can view activity log" ON public.pool_activity_log;
DROP POLICY IF EXISTS "Admins can create activity log" ON public.pool_activity_log;

-- === Recreate all policies using requesting_user_id() ===

-- Profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO PUBLIC USING (requesting_user_id() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO PUBLIC WITH CHECK (requesting_user_id() = id);

-- Companies
CREATE POLICY "Users can view their company" ON public.companies FOR SELECT TO PUBLIC USING ((owner_id = requesting_user_id()) OR (id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = requesting_user_id())));
CREATE POLICY "Users can create companies" ON public.companies FOR INSERT TO PUBLIC WITH CHECK (requesting_user_id() = owner_id);
CREATE POLICY "Company owners can update" ON public.companies FOR UPDATE TO PUBLIC USING (requesting_user_id() = owner_id);

-- Projects
CREATE POLICY "Users can create own projects" ON public.projects FOR INSERT TO PUBLIC WITH CHECK (requesting_user_id() = owner_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE TO PUBLIC USING (requesting_user_id() = owner_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE TO PUBLIC USING (requesting_user_id() = owner_id);
CREATE POLICY "Users can view own or shared projects" ON public.projects FOR SELECT TO PUBLIC USING ((owner_id = requesting_user_id()) OR (id IN (SELECT project_shares.project_id FROM project_shares WHERE project_shares.user_id = requesting_user_id() AND project_shares.revoked_at IS NULL)));
CREATE POLICY "Users can update shared projects with edit permission" ON public.projects FOR UPDATE TO PUBLIC USING (EXISTS (SELECT 1 FROM project_shares WHERE project_shares.project_id = projects.id AND project_shares.user_id = requesting_user_id() AND project_shares.permission = ANY (ARRAY['edit'::share_permission, 'admin'::share_permission]) AND project_shares.revoked_at IS NULL));
CREATE POLICY "Users can delete shared projects with admin permission" ON public.projects FOR DELETE TO PUBLIC USING (EXISTS (SELECT 1 FROM project_shares WHERE project_shares.project_id = projects.id AND project_shares.user_id = requesting_user_id() AND project_shares.permission = 'admin'::share_permission AND project_shares.revoked_at IS NULL));

-- Project shares
CREATE POLICY "Users can view their received shares" ON public.project_shares FOR SELECT TO PUBLIC USING (user_id = requesting_user_id());
CREATE POLICY "Users can view shares they created" ON public.project_shares FOR SELECT TO PUBLIC USING (shared_by = requesting_user_id());
CREATE POLICY "Users can create shares for their projects" ON public.project_shares FOR INSERT TO PUBLIC WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_shares.project_id AND projects.owner_id = requesting_user_id()));
CREATE POLICY "Users can update shares for their projects" ON public.project_shares FOR UPDATE TO PUBLIC USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_shares.project_id AND projects.owner_id = requesting_user_id()));
CREATE POLICY "Users can delete shares for their projects" ON public.project_shares FOR DELETE TO PUBLIC USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_shares.project_id AND projects.owner_id = requesting_user_id()));

-- Project public links
CREATE POLICY "owners can read their links" ON public.project_public_links FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_public_links.project_id AND p.owner_id = requesting_user_id()));
CREATE POLICY "owners can create links" ON public.project_public_links FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_public_links.project_id AND p.owner_id = requesting_user_id()));
CREATE POLICY "owners can update/revoke links" ON public.project_public_links FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_public_links.project_id AND p.owner_id = requesting_user_id()));

-- Project versions
CREATE POLICY "Users can view versions of accessible projects" ON public.project_versions FOR SELECT TO PUBLIC USING (project_id IN (SELECT projects.id FROM projects WHERE projects.owner_id = requesting_user_id() UNION SELECT project_shares.project_id FROM project_shares WHERE project_shares.user_id = requesting_user_id()));
CREATE POLICY "Project owners and editors can insert versions" ON public.project_versions FOR INSERT TO PUBLIC WITH CHECK (project_id IN (SELECT projects.id FROM projects WHERE projects.owner_id = requesting_user_id() UNION SELECT project_shares.project_id FROM project_shares WHERE project_shares.user_id = requesting_user_id() AND project_shares.permission = ANY (ARRAY['edit'::share_permission, 'admin'::share_permission])));
CREATE POLICY "Project owners can delete versions" ON public.project_versions FOR DELETE TO PUBLIC USING (project_id IN (SELECT projects.id FROM projects WHERE projects.owner_id = requesting_user_id()));

-- Activity log
CREATE POLICY "Users can view activity for accessible projects" ON public.activity_log FOR SELECT TO PUBLIC USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = activity_log.project_id AND (projects.owner_id = requesting_user_id() OR EXISTS (SELECT 1 FROM project_shares WHERE project_shares.project_id = projects.id AND project_shares.user_id = requesting_user_id() AND project_shares.revoked_at IS NULL))));
CREATE POLICY "Users can create activity logs" ON public.activity_log FOR INSERT TO PUBLIC WITH CHECK (requesting_user_id() = user_id);

-- Comments
CREATE POLICY "Users can view comments on accessible projects" ON public.comments FOR SELECT TO PUBLIC USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = comments.project_id AND (projects.owner_id = requesting_user_id() OR EXISTS (SELECT 1 FROM project_shares WHERE project_shares.project_id = projects.id AND project_shares.user_id = requesting_user_id() AND project_shares.revoked_at IS NULL))));
CREATE POLICY "Users can create comments on accessible projects" ON public.comments FOR INSERT TO PUBLIC WITH CHECK (requesting_user_id() = user_id AND EXISTS (SELECT 1 FROM projects WHERE projects.id = comments.project_id AND (projects.owner_id = requesting_user_id() OR EXISTS (SELECT 1 FROM project_shares WHERE project_shares.project_id = projects.id AND project_shares.user_id = requesting_user_id() AND project_shares.revoked_at IS NULL))));

-- Pool variants
CREATE POLICY "Admins can manage pool variants" ON public.pool_variants FOR ALL TO PUBLIC USING (is_admin(requesting_user_id()));
CREATE POLICY "Everyone can view published pools" ON public.pool_variants FOR SELECT TO PUBLIC USING (status = 'published'::text);

-- Pool activity log
CREATE POLICY "Admins can view activity log" ON public.pool_activity_log FOR SELECT TO PUBLIC USING (is_admin(requesting_user_id()));
CREATE POLICY "Admins can create activity log" ON public.pool_activity_log FOR INSERT TO PUBLIC WITH CHECK (is_admin(requesting_user_id()));

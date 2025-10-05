-- Drop all policies to start fresh
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view shared projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update shared projects with edit permission" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete with admin share permission" ON public.projects;

DROP POLICY IF EXISTS "Project owners can create shares" ON public.project_shares;
DROP POLICY IF EXISTS "Project owners can update shares" ON public.project_shares;
DROP POLICY IF EXISTS "Project owners can delete shares" ON public.project_shares;
DROP POLICY IF EXISTS "Users can view shares for their projects" ON public.project_shares;
DROP POLICY IF EXISTS "Users can view their own shares" ON public.project_shares;

DROP POLICY IF EXISTS "Users can view activity for their projects" ON public.activity_log;
DROP POLICY IF EXISTS "Users can create activity logs" ON public.activity_log;

DROP POLICY IF EXISTS "Users can view comments on accessible projects" ON public.comments;
DROP POLICY IF EXISTS "Users can create comments on accessible projects" ON public.comments;

-- Drop old functions
DROP FUNCTION IF EXISTS public.user_owns_project(uuid, uuid);
DROP FUNCTION IF EXISTS public.user_has_project_access(uuid, uuid);
DROP FUNCTION IF EXISTS public.user_has_project_permission(uuid, uuid, share_permission);

-- Create simplified security definer function that doesn't cause recursion
-- This function checks project_shares WITHOUT querying projects table
CREATE OR REPLACE FUNCTION public.check_user_project_access(project_id uuid, user_id uuid)
RETURNS TABLE (
  has_access boolean,
  permission share_permission
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    true as has_access,
    ps.permission
  FROM project_shares ps
  WHERE ps.project_id = check_user_project_access.project_id
    AND ps.user_id = check_user_project_access.user_id
    AND ps.revoked_at IS NULL
  LIMIT 1;
$$;

-- Projects policies (no circular reference to project_shares)
CREATE POLICY "Users can view own projects"
ON public.projects
FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Users can view shared projects"
ON public.projects
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.project_shares
    WHERE project_shares.project_id = projects.id
      AND project_shares.user_id = auth.uid()
      AND project_shares.revoked_at IS NULL
  )
);

CREATE POLICY "Users can create own projects"
ON public.projects
FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own projects"
ON public.projects
FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Users can update shared projects with edit permission"
ON public.projects
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.project_shares
    WHERE project_shares.project_id = projects.id
      AND project_shares.user_id = auth.uid()
      AND project_shares.permission IN ('edit'::share_permission, 'admin'::share_permission)
      AND project_shares.revoked_at IS NULL
  )
);

CREATE POLICY "Users can delete own projects"
ON public.projects
FOR DELETE
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete shared projects with admin permission"
ON public.projects
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.project_shares
    WHERE project_shares.project_id = projects.id
      AND project_shares.user_id = auth.uid()
      AND project_shares.permission = 'admin'::share_permission
      AND project_shares.revoked_at IS NULL
  )
);

-- Project_shares policies (simplified - no reference back to projects)
CREATE POLICY "Users can view their received shares"
ON public.project_shares
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can view shares they created"
ON public.project_shares
FOR SELECT
USING (shared_by = auth.uid());

CREATE POLICY "Users can create shares for their projects"
ON public.project_shares
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_shares.project_id
      AND projects.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can update shares for their projects"
ON public.project_shares
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_shares.project_id
      AND projects.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can delete shares for their projects"
ON public.project_shares
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_shares.project_id
      AND projects.owner_id = auth.uid()
  )
);

-- Activity log policies
CREATE POLICY "Users can view activity for accessible projects"
ON public.activity_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = activity_log.project_id
      AND (
        projects.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_shares
          WHERE project_shares.project_id = projects.id
            AND project_shares.user_id = auth.uid()
            AND project_shares.revoked_at IS NULL
        )
      )
  )
);

CREATE POLICY "Users can create activity logs"
ON public.activity_log
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Users can view comments on accessible projects"
ON public.comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = comments.project_id
      AND (
        projects.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_shares
          WHERE project_shares.project_id = projects.id
            AND project_shares.user_id = auth.uid()
            AND project_shares.revoked_at IS NULL
        )
      )
  )
);

CREATE POLICY "Users can create comments on accessible projects"
ON public.comments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = comments.project_id
      AND (
        projects.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_shares
          WHERE project_shares.project_id = projects.id
            AND project_shares.user_id = auth.uid()
            AND project_shares.revoked_at IS NULL
        )
      )
  )
);
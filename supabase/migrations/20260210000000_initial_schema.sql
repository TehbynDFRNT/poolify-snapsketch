-- ============================================================================
-- SnapSketch Schema (Clerk Auth Edition)
-- ============================================================================
-- Generated from Lovable/Supabase instance: nosjgcmommgvbnijslbs
-- Adapted for Clerk authentication (not Supabase Auth)
--
-- Key differences from original:
--   - User ID columns are TEXT (Clerk IDs: "user_xxx"), not UUID
--   - Foreign keys to auth.users are removed (Clerk manages users externally)
--   - profiles table is the local user record, keyed by Clerk user ID
--   - RLS policies still use auth.uid() — this maps to the JWT "sub" claim
--     when Supabase is configured to verify Clerk-signed JWTs
--   - handle_new_user() trigger removed (Clerk handles user creation)
--   - same_email_domain() commented out (references auth.users)
--
-- Prerequisites:
--   1. Create a Supabase project
--   2. In Clerk Dashboard: JWT template "supabase" with HS256 + Supabase JWT secret
--   3. Paste this into Supabase SQL Editor and run
-- ============================================================================

-- === EXTENSIONS ===
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- === ENUMS ===
CREATE TYPE public.app_role AS ENUM ('sales_rep', 'designer', 'admin');
CREATE TYPE public.share_permission AS ENUM ('view', 'edit', 'admin');

-- === TABLES ===

CREATE TABLE IF NOT EXISTS public.profiles (
  id text NOT NULL,
  full_name text NOT NULL,
  role app_role NOT NULL DEFAULT 'sales_rep'::app_role,
  company_id uuid,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  company_id uuid,
  customer_name text NOT NULL,
  address text NOT NULL,
  notes text,
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_archived boolean NOT NULL DEFAULT false,
  stage text DEFAULT 'proposal'::text,
  status text DEFAULT 'draft'::text
);

CREATE TABLE IF NOT EXISTS public.project_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id text NOT NULL,
  permission share_permission NOT NULL DEFAULT 'view'::share_permission,
  shared_by text NOT NULL,
  shared_at timestamp with time zone NOT NULL DEFAULT now(),
  revoked_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.project_public_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  token text NOT NULL,
  permission text NOT NULL DEFAULT 'view'::text,
  allow_export boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_by text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  version_number integer NOT NULL,
  stage text NOT NULL,
  components jsonb NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  created_by text
);

CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id text NOT NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pool_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pool_name text NOT NULL,
  outline jsonb NOT NULL,
  shallow_end_position jsonb,
  deep_end_position jsonb,
  features jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'unconfigured'::text,
  published_at timestamp with time zone,
  published_by text,
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by text,
  zone_of_influence jsonb
);

CREATE TABLE IF NOT EXISTS public.pool_activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pool_variant_id uuid,
  action text NOT NULL,
  user_id text,
  changes jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- === PRIMARY KEYS ===
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.companies ADD CONSTRAINT companies_pkey PRIMARY KEY (id);
ALTER TABLE public.projects ADD CONSTRAINT projects_pkey PRIMARY KEY (id);
ALTER TABLE public.project_shares ADD CONSTRAINT project_shares_pkey PRIMARY KEY (id);
ALTER TABLE public.project_public_links ADD CONSTRAINT project_public_links_pkey PRIMARY KEY (id);
ALTER TABLE public.project_versions ADD CONSTRAINT project_versions_pkey PRIMARY KEY (id);
ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);
ALTER TABLE public.comments ADD CONSTRAINT comments_pkey PRIMARY KEY (id);
ALTER TABLE public.pool_variants ADD CONSTRAINT pool_variants_pkey PRIMARY KEY (id);
ALTER TABLE public.pool_activity_log ADD CONSTRAINT pool_activity_log_pkey PRIMARY KEY (id);

-- === UNIQUE CONSTRAINTS ===
ALTER TABLE public.companies ADD CONSTRAINT companies_name_key UNIQUE (name);
ALTER TABLE public.project_shares ADD CONSTRAINT project_shares_project_id_user_id_key UNIQUE (project_id, user_id);
ALTER TABLE public.project_public_links ADD CONSTRAINT project_public_links_token_key UNIQUE (token);
ALTER TABLE public.project_versions ADD CONSTRAINT project_versions_project_id_version_number_key UNIQUE (project_id, version_number);

-- === FOREIGN KEYS (public tables only — no auth.users references) ===
ALTER TABLE public.profiles ADD CONSTRAINT profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD CONSTRAINT projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.projects ADD CONSTRAINT projects_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE public.project_shares ADD CONSTRAINT project_shares_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.project_public_links ADD CONSTRAINT project_public_links_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.project_public_links ADD CONSTRAINT project_public_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
ALTER TABLE public.project_versions ADD CONSTRAINT project_versions_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.comments ADD CONSTRAINT comments_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.pool_variants ADD CONSTRAINT pool_variants_published_by_fkey FOREIGN KEY (published_by) REFERENCES profiles(id);
ALTER TABLE public.pool_variants ADD CONSTRAINT pool_variants_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
ALTER TABLE public.pool_activity_log ADD CONSTRAINT pool_activity_log_pool_variant_id_fkey FOREIGN KEY (pool_variant_id) REFERENCES pool_variants(id) ON DELETE CASCADE;
ALTER TABLE public.pool_activity_log ADD CONSTRAINT pool_activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);

-- === INDEXES (excluding those already created by unique constraints) ===
CREATE INDEX idx_projects_owner ON public.projects USING btree (owner_id);
CREATE INDEX idx_projects_company ON public.projects USING btree (company_id);
CREATE INDEX idx_project_shares_project ON public.project_shares USING btree (project_id);
CREATE INDEX idx_project_shares_user ON public.project_shares USING btree (user_id);
CREATE INDEX idx_project_public_links_token ON public.project_public_links USING btree (token);
CREATE INDEX idx_project_public_links_project ON public.project_public_links USING btree (project_id);
CREATE INDEX idx_project_versions_project_id ON public.project_versions USING btree (project_id);
CREATE INDEX idx_project_versions_created_at ON public.project_versions USING btree (created_at DESC);
CREATE INDEX idx_activity_log_project ON public.activity_log USING btree (project_id);
CREATE INDEX idx_comments_project ON public.comments USING btree (project_id);
CREATE INDEX idx_pool_variants_published ON public.pool_variants USING btree (status) WHERE (status = 'published'::text);
CREATE INDEX idx_pool_variants_name ON public.pool_variants USING btree (pool_name);
CREATE INDEX idx_pool_variants_status ON public.pool_variants USING btree (status);
CREATE INDEX idx_pool_variants_created_at ON public.pool_variants USING btree (created_at DESC);
CREATE INDEX idx_pool_activity_variant ON public.pool_activity_log USING btree (pool_variant_id);

-- === FUNCTIONS ===

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- NOTE: handle_new_user() removed — Clerk handles user creation externally.
-- Profiles are created by the app on first sign-in, not by a DB trigger.

-- NOTE: same_email_domain() commented out — references auth.users directly.
-- If needed, adapt to query profiles table or pass email as parameter.
/*
CREATE OR REPLACE FUNCTION public.same_email_domain(_user_id uuid, _owner_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    split_part((SELECT email FROM auth.users WHERE id = _user_id), '@', 2)
    =
    split_part((SELECT email FROM auth.users WHERE id = _owner_id), '@', 2)
$function$;
*/

CREATE OR REPLACE FUNCTION public.is_admin(_user_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.check_user_project_access(project_id uuid, user_id text)
 RETURNS TABLE(has_access boolean, permission share_permission)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    true as has_access,
    ps.permission
  FROM project_shares ps
  WHERE ps.project_id = check_user_project_access.project_id
    AND ps.user_id = check_user_project_access.user_id
    AND ps.revoked_at IS NULL
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_project(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_link project_public_links%rowtype;
  v_proj record;
begin
  select *
    into v_link
  from project_public_links
  where token = p_token
    and revoked_at is null
    and (expires_at is null or expires_at > now())
  limit 1;

  if not found then
    return null;
  end if;

  select
    p.id,
    p.customer_name,
    p.address,
    p.notes,
    p.updated_at,
    p.components
  into v_proj
  from projects p
  where p.id = v_link.project_id
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'project', jsonb_build_object(
      'id', v_proj.id,
      'customerName', v_proj.customer_name,
      'address', v_proj.address,
      'notes', v_proj.notes,
      'updatedAt', v_proj.updated_at,
      'components', v_proj.components
    ),
    'allow_export', coalesce(v_link.allow_export, true)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.accept_project_via_share(p_token text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_link project_public_links%ROWTYPE;
  v_project projects%ROWTYPE;
  v_version_number INT;
BEGIN
  SELECT * INTO v_link FROM project_public_links
  WHERE token = p_token AND revoked_at IS NULL
  AND (expires_at IS NULL OR expires_at > NOW());

  IF v_link IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired link');
  END IF;

  SELECT * INTO v_project FROM projects WHERE id = v_link.project_id;

  IF v_project IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Project not found');
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version_number
  FROM project_versions WHERE project_id = v_project.id;

  INSERT INTO project_versions (project_id, version_number, stage, components, notes)
  VALUES (
    v_project.id,
    v_version_number,
    COALESCE(v_project.stage, 'proposal'),
    COALESCE(v_project.components, '[]'::jsonb),
    'Customer Accepted'
  );

  UPDATE projects SET status = 'approved' WHERE id = v_project.id;

  RETURN json_build_object(
    'success', true,
    'version_number', v_version_number,
    'stage', COALESCE(v_project.stage, 'proposal')
  );
END;
$function$;

-- === TRIGGERS ===
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER update_pool_variants_updated_at BEFORE UPDATE ON pool_variants FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- === ROW LEVEL SECURITY ===
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_public_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_activity_log ENABLE ROW LEVEL SECURITY;

-- === RLS POLICIES ===
-- NOTE: auth.uid() will resolve to the "sub" claim from the Clerk JWT
-- once Supabase is configured to verify Clerk-signed tokens.

-- Profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO PUBLIC USING ((auth.uid()::text = id));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO PUBLIC WITH CHECK ((auth.uid()::text = id));

-- Companies
CREATE POLICY "Users can view their company" ON public.companies FOR SELECT TO PUBLIC USING (((owner_id = auth.uid()::text) OR (id IN ( SELECT profiles.company_id FROM profiles WHERE (profiles.id = auth.uid()::text)))));
CREATE POLICY "Users can create companies" ON public.companies FOR INSERT TO PUBLIC WITH CHECK ((auth.uid()::text = owner_id));
CREATE POLICY "Company owners can update" ON public.companies FOR UPDATE TO PUBLIC USING ((auth.uid()::text = owner_id));

-- Projects
CREATE POLICY "Users can create own projects" ON public.projects FOR INSERT TO PUBLIC WITH CHECK ((auth.uid()::text = owner_id));
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE TO PUBLIC USING ((auth.uid()::text = owner_id));
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE TO PUBLIC USING ((auth.uid()::text = owner_id));
CREATE POLICY "Users can view shared projects" ON public.projects FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1 FROM project_shares WHERE ((project_shares.project_id = projects.id) AND (project_shares.user_id = auth.uid()::text) AND (project_shares.revoked_at IS NULL)))));
CREATE POLICY "Users can update shared projects with edit permission" ON public.projects FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1 FROM project_shares WHERE ((project_shares.project_id = projects.id) AND (project_shares.user_id = auth.uid()::text) AND (project_shares.permission = ANY (ARRAY['edit'::share_permission, 'admin'::share_permission])) AND (project_shares.revoked_at IS NULL)))));
CREATE POLICY "Users can delete shared projects with admin permission" ON public.projects FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1 FROM project_shares WHERE ((project_shares.project_id = projects.id) AND (project_shares.user_id = auth.uid()::text) AND (project_shares.permission = 'admin'::share_permission) AND (project_shares.revoked_at IS NULL)))));
-- NOTE: same_email_domain policy commented out — function references auth.users
/*
CREATE POLICY "Users can view projects from same domain" ON public.projects FOR SELECT TO PUBLIC USING (((owner_id = auth.uid()::text) OR (id IN ( SELECT project_shares.project_id FROM project_shares WHERE ((project_shares.user_id = auth.uid()::text) AND (project_shares.revoked_at IS NULL)))) OR same_email_domain(auth.uid(), owner_id)));
*/
-- Simplified replacement: owners + shared users can view
CREATE POLICY "Users can view own or shared projects" ON public.projects FOR SELECT TO PUBLIC USING (((owner_id = auth.uid()::text) OR (id IN ( SELECT project_shares.project_id FROM project_shares WHERE ((project_shares.user_id = auth.uid()::text) AND (project_shares.revoked_at IS NULL))))));

-- Project shares
CREATE POLICY "Users can view their received shares" ON public.project_shares FOR SELECT TO PUBLIC USING ((user_id = auth.uid()::text));
CREATE POLICY "Users can view shares they created" ON public.project_shares FOR SELECT TO PUBLIC USING ((shared_by = auth.uid()::text));
CREATE POLICY "Users can create shares for their projects" ON public.project_shares FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1 FROM projects WHERE ((projects.id = project_shares.project_id) AND (projects.owner_id = auth.uid()::text)))));
CREATE POLICY "Users can update shares for their projects" ON public.project_shares FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1 FROM projects WHERE ((projects.id = project_shares.project_id) AND (projects.owner_id = auth.uid()::text)))));
CREATE POLICY "Users can delete shares for their projects" ON public.project_shares FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1 FROM projects WHERE ((projects.id = project_shares.project_id) AND (projects.owner_id = auth.uid()::text)))));

-- Project public links
CREATE POLICY "owners can read their links" ON public.project_public_links FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_public_links.project_id) AND (p.owner_id = auth.uid()::text)))));
CREATE POLICY "owners can create links" ON public.project_public_links FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_public_links.project_id) AND (p.owner_id = auth.uid()::text)))));
CREATE POLICY "owners can update/revoke links" ON public.project_public_links FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_public_links.project_id) AND (p.owner_id = auth.uid()::text)))));

-- Project versions
CREATE POLICY "Users can view versions of accessible projects" ON public.project_versions FOR SELECT TO PUBLIC USING ((project_id IN ( SELECT projects.id FROM projects WHERE (projects.owner_id = auth.uid()::text) UNION SELECT project_shares.project_id FROM project_shares WHERE (project_shares.user_id = auth.uid()::text))));
CREATE POLICY "Project owners and editors can insert versions" ON public.project_versions FOR INSERT TO PUBLIC WITH CHECK ((project_id IN ( SELECT projects.id FROM projects WHERE (projects.owner_id = auth.uid()::text) UNION SELECT project_shares.project_id FROM project_shares WHERE ((project_shares.user_id = auth.uid()::text) AND (project_shares.permission = ANY (ARRAY['edit'::share_permission, 'admin'::share_permission]))))));
CREATE POLICY "Project owners can delete versions" ON public.project_versions FOR DELETE TO PUBLIC USING ((project_id IN ( SELECT projects.id FROM projects WHERE (projects.owner_id = auth.uid()::text))));

-- Activity log
CREATE POLICY "Users can view activity for accessible projects" ON public.activity_log FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1 FROM projects WHERE ((projects.id = activity_log.project_id) AND ((projects.owner_id = auth.uid()::text) OR (EXISTS ( SELECT 1 FROM project_shares WHERE ((project_shares.project_id = projects.id) AND (project_shares.user_id = auth.uid()::text) AND (project_shares.revoked_at IS NULL)))))))));
CREATE POLICY "Users can create activity logs" ON public.activity_log FOR INSERT TO PUBLIC WITH CHECK ((auth.uid()::text = user_id));

-- Comments
CREATE POLICY "Users can view comments on accessible projects" ON public.comments FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1 FROM projects WHERE ((projects.id = comments.project_id) AND ((projects.owner_id = auth.uid()::text) OR (EXISTS ( SELECT 1 FROM project_shares WHERE ((project_shares.project_id = projects.id) AND (project_shares.user_id = auth.uid()::text) AND (project_shares.revoked_at IS NULL)))))))));
CREATE POLICY "Users can create comments on accessible projects" ON public.comments FOR INSERT TO PUBLIC WITH CHECK (((auth.uid()::text = user_id) AND (EXISTS ( SELECT 1 FROM projects WHERE ((projects.id = comments.project_id) AND ((projects.owner_id = auth.uid()::text) OR (EXISTS ( SELECT 1 FROM project_shares WHERE ((project_shares.project_id = projects.id) AND (project_shares.user_id = auth.uid()::text) AND (project_shares.revoked_at IS NULL))))))))));

-- Pool variants
CREATE POLICY "Admins can manage pool variants" ON public.pool_variants FOR ALL TO PUBLIC USING (is_admin(auth.uid()::text));
CREATE POLICY "Everyone can view published pools" ON public.pool_variants FOR SELECT TO PUBLIC USING ((status = 'published'::text));

-- Pool activity log
CREATE POLICY "Admins can view activity log" ON public.pool_activity_log FOR SELECT TO PUBLIC USING (is_admin(auth.uid()::text));
CREATE POLICY "Admins can create activity log" ON public.pool_activity_log FOR INSERT TO PUBLIC WITH CHECK (is_admin(auth.uid()::text));

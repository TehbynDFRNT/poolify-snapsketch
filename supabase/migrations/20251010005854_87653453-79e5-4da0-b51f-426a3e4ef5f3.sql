-- Create pool variants table for admin-managed pool library
CREATE TABLE IF NOT EXISTS public.pool_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  pool_name TEXT NOT NULL,
  variant_name TEXT NOT NULL,
  display_name TEXT GENERATED ALWAYS AS (pool_name || ' - ' || variant_name) STORED,
  
  -- Dimensions (base pool in mm)
  length INTEGER NOT NULL,
  width INTEGER NOT NULL,
  
  -- Pool Shape (JSON)
  outline_points JSONB NOT NULL,
  shallow_end JSONB,
  deep_end JSONB,
  
  -- Features (steps, benches, etc.)
  features JSONB DEFAULT '[]'::jsonb,
  
  -- Coping Configuration
  has_coping BOOLEAN DEFAULT false,
  coping_type TEXT,
  coping_width INTEGER DEFAULT 400,
  grout_width INTEGER DEFAULT 5,
  
  -- Coping Layout (pre-calculated)
  coping_layout JSONB,
  
  -- Publishing
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES public.profiles(id),
  
  -- Metadata
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  
  -- Unique constraint
  CONSTRAINT unique_pool_variant UNIQUE (pool_name, variant_name)
);

-- Create pool activity log
CREATE TABLE IF NOT EXISTS public.pool_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_variant_id UUID REFERENCES public.pool_variants(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'published', 'unpublished', 'archived')),
  user_id UUID REFERENCES public.profiles(id),
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pool_variants_status ON public.pool_variants(status);
CREATE INDEX IF NOT EXISTS idx_pool_variants_published ON public.pool_variants(status) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_pool_variants_name ON public.pool_variants(pool_name);
CREATE INDEX IF NOT EXISTS idx_pool_activity_variant ON public.pool_activity_log(pool_variant_id);

-- Enable RLS
ALTER TABLE public.pool_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_activity_log ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check admin role
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role = 'admin'
  );
$$;

-- RLS Policies for pool_variants
CREATE POLICY "Admins can manage pool variants"
  ON public.pool_variants FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Everyone can view published pools"
  ON public.pool_variants FOR SELECT
  USING (status = 'published');

-- RLS Policies for pool_activity_log
CREATE POLICY "Admins can view activity log"
  ON public.pool_activity_log FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can create activity log"
  ON public.pool_activity_log FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_pool_variants_updated_at
  BEFORE UPDATE ON public.pool_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
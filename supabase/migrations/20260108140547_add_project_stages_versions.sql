-- Add stage and status columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'proposal';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

-- Create project_versions table for storing design snapshots
CREATE TABLE IF NOT EXISTS project_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  stage TEXT NOT NULL,
  components JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(project_id, version_number)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_versions_project_id ON project_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_versions_created_at ON project_versions(created_at DESC);

-- Enable RLS on project_versions
ALTER TABLE project_versions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view versions of projects they own or have access to
CREATE POLICY "Users can view versions of accessible projects"
  ON project_versions FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT project_id FROM project_shares WHERE user_id = auth.uid()
    )
  );

-- Policy: Project owners and editors can insert versions
CREATE POLICY "Project owners and editors can insert versions"
  ON project_versions FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT project_id FROM project_shares
      WHERE user_id = auth.uid() AND permission IN ('edit', 'admin')
    )
  );

-- Policy: Project owners can delete versions
CREATE POLICY "Project owners can delete versions"
  ON project_versions FOR DELETE USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

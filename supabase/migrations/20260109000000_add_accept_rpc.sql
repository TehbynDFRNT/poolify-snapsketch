-- RPC function to accept a project via share link
-- Creates a version snapshot and updates project status to approved

CREATE OR REPLACE FUNCTION accept_project_via_share(p_token TEXT)
RETURNS JSON AS $$
DECLARE
  v_link project_public_links%ROWTYPE;
  v_project projects%ROWTYPE;
  v_version_number INT;
BEGIN
  -- Find valid share link
  SELECT * INTO v_link FROM project_public_links
  WHERE token = p_token AND revoked_at IS NULL
  AND (expires_at IS NULL OR expires_at > NOW());

  IF v_link IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired link');
  END IF;

  -- Get the project
  SELECT * INTO v_project FROM projects WHERE id = v_link.project_id;

  IF v_project IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Project not found');
  END IF;

  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version_number
  FROM project_versions WHERE project_id = v_project.id;

  -- Create version snapshot with acceptance note
  INSERT INTO project_versions (project_id, version_number, stage, components, notes)
  VALUES (
    v_project.id,
    v_version_number,
    COALESCE(v_project.stage, 'proposal'),
    COALESCE(v_project.components, '[]'::jsonb),
    'Customer Accepted'
  );

  -- Update project status to approved
  UPDATE projects SET status = 'approved' WHERE id = v_project.id;

  RETURN json_build_object(
    'success', true,
    'version_number', v_version_number,
    'stage', COALESCE(v_project.stage, 'proposal')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

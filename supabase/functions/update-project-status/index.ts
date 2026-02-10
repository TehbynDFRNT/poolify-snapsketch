// Supabase Edge Function: Update Project Stage/Status
// Allows integrated apps to update stage and status on projects
// Creates a version snapshot before updating (like accept_project_via_share RPC)
// Auth: CPQ_API_KEY (same pattern as search-projects)
//
// Valid stages: proposal | contract_site_plan | contract_variations
// Valid statuses: draft | approved

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const VALID_STAGES = ['proposal', 'contract_site_plan', 'contract_variations'] as const
const VALID_STATUSES = ['draft', 'approved'] as const

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate API key (same as search-projects)
    const authHeader = req.headers.get('Authorization')
    const expectedKey = Deno.env.get('CPQ_API_KEY')

    if (!expectedKey) {
      console.error('CPQ_API_KEY environment variable not set')
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const providedKey = authHeader.replace('Bearer ', '').trim()
    if (providedKey !== expectedKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { project_id, stage, status, notes } = await req.json()

    if (!project_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing project_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!stage && !status) {
      return new Response(
        JSON.stringify({ success: false, error: 'Must provide stage or status to update' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (stage && !VALID_STAGES.includes(stage)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 1: Fetch current project
    const { data: currentProject, error: fetchError } = await supabase
      .from('projects')
      .select('id, stage, status, components')
      .eq('id', project_id)
      .maybeSingle()

    if (fetchError) {
      console.error('Fetch project error:', fetchError)
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!currentProject) {
      return new Response(
        JSON.stringify({ success: false, error: 'Project not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 2: Get next version number
    const { data: versionData, error: versionError } = await supabase
      .from('project_versions')
      .select('version_number')
      .eq('project_id', project_id)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (versionError) {
      console.error('Version query error:', versionError)
      return new Response(
        JSON.stringify({ success: false, error: versionError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const nextVersionNumber = (versionData?.version_number || 0) + 1

    // Step 3: Insert version snapshot
    const { error: insertError } = await supabase
      .from('project_versions')
      .insert({
        project_id: project_id,
        version_number: nextVersionNumber,
        stage: stage || currentProject.stage || 'proposal',
        components: currentProject.components || [],
        notes: notes || 'Stage/Status updated',
        created_by: null
      })

    if (insertError) {
      console.error('Insert version error:', insertError)
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Version snapshot created:', nextVersionNumber)

    // Step 4: Update project
    const updateData: Record<string, string> = {}
    if (stage) updateData.stage = stage
    if (status) updateData.status = status

    const { data, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', project_id)
      .select('id, stage, status, updated_at')
      .single()

    if (error) {
      console.error('Update error:', error)
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        project: data,
        version_number: nextVersionNumber
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Supabase Edge Function: Update Project Owner
// Allows integrated apps (Poolify) to reassign project ownership
// Auth: CPQ_API_KEY (same pattern as search-projects / update-project-status)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate API key
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
    const { project_id, new_owner_email } = await req.json()

    if (!project_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing project_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!new_owner_email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing new_owner_email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Look up new owner by email
    const { data: newOwner, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', new_owner_email)
      .maybeSingle()

    if (profileError) {
      console.error('Profile lookup error:', profileError)
      return new Response(
        JSON.stringify({ success: false, error: profileError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!newOwner) {
      return new Response(
        JSON.stringify({ success: false, error: 'No user found with that email' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify project exists and get previous owner info
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('id, owner_id, customer_name, profiles!projects_owner_id_fkey(email, full_name)')
      .eq('id', project_id)
      .maybeSingle()

    if (fetchError) {
      console.error('Fetch project error:', fetchError)
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!project) {
      return new Response(
        JSON.stringify({ success: false, error: 'Project not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update owner
    const { data, error } = await supabase
      .from('projects')
      .update({ owner_id: newOwner.id })
      .eq('id', project_id)
      .select('id, owner_id, customer_name, updated_at')
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
        new_owner: { id: newOwner.id, email: newOwner.email, full_name: newOwner.full_name },
        previous_owner: {
          id: project.owner_id,
          email: (project as any).profiles?.email ?? null,
          full_name: (project as any).profiles?.full_name ?? null,
        },
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

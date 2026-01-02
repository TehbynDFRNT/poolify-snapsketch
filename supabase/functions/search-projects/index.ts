// Supabase Edge Function: Search Projects for CPQ Integration
// Allows external systems to search projects and get embed URLs

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
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
        JSON.stringify({
          success: false,
          error: 'Server configuration error'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing or invalid Authorization header'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const providedKey = authHeader.replace('Bearer ', '').trim()
    if (providedKey !== expectedKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid API key'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse request body
    const { search } = await req.json()

    if (!search || typeof search !== 'string' || search.trim().length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing or invalid search parameter'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get base URL for embed links
    const baseUrl = Deno.env.get('BASE_URL') || supabaseUrl.replace('.supabase.co', '.com')

    // Search projects with public links
    const { data: projects, error } = await supabase
      .from('projects')
      .select(`
        id,
        customer_name,
        address,
        notes,
        updated_at,
        created_at,
        project_public_links!inner (
          token,
          allow_export,
          expires_at,
          revoked_at
        )
      `)
      .ilike('customer_name', `%${search}%`)
      .is('project_public_links.revoked_at', null)
      .order('updated_at', { ascending: false })
      .limit(50)

    // Also search by address
    const { data: projectsByAddress } = await supabase
      .from('projects')
      .select(`
        id,
        customer_name,
        address,
        notes,
        updated_at,
        created_at,
        project_public_links!inner (
          token,
          allow_export,
          expires_at,
          revoked_at
        )
      `)
      .ilike('address', `%${search}%`)
      .is('project_public_links.revoked_at', null)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Database query failed'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Combine and deduplicate results
    const allProjects = [...(projects || []), ...(projectsByAddress || [])]
    const uniqueProjects = Array.from(
      new Map(allProjects.map(p => [p.id, p])).values()
    )

    // Format results
    const results = uniqueProjects
      .filter(project => {
        const link = project.project_public_links[0]
        // Filter out expired links
        return !link.expires_at || new Date(link.expires_at) > new Date()
      })
      .map(project => {
        const link = project.project_public_links[0]
        const embedUrl = `${baseUrl}/share/${link.token}`

        return {
          id: project.id,
          customerName: project.customer_name,
          address: project.address,
          notes: project.notes,
          embedToken: link.token,
          embedUrl: embedUrl,
          embedCode: `<iframe src="${embedUrl}" width="800" height="600" frameborder="0" title="${project.customer_name} Pool Design"></iframe>`,
          allowExport: link.allow_export,
          expiresAt: link.expires_at,
          updatedAt: project.updated_at,
          createdAt: project.created_at,
        }
      })

    return new Response(
      JSON.stringify({
        success: true,
        count: results.length,
        results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

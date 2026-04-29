// Supabase Edge Function: Proxy SnapSketch -> Poolify integration calls.
// Keeps the Poolify integration key server-side.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const actionToEndpoint: Record<string, string> = {
  searchProjects: 'search-pool-projects',
  checkLink: 'check-snapsketch-link',
  linkProject: 'link-snapsketch',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const poolifyApiUrl = Deno.env.get('POOLIFY_API_URL')
    const poolifyApiKey = Deno.env.get('POOLIFY_API_KEY') || Deno.env.get('CPQ_API_KEY')

    if (!poolifyApiUrl || !poolifyApiKey) {
      console.error('POOLIFY_API_URL or POOLIFY_API_KEY environment variable not set')
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { action, payload } = await req.json()
    const endpoint = actionToEndpoint[action]

    if (!endpoint) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid Poolify proxy action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const response = await fetch(`${poolifyApiUrl.replace(/\/$/, '')}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${poolifyApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload ?? {}),
    })

    const body = await response.text()
    return new Response(body, {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': response.headers.get('Content-Type') || 'application/json' },
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

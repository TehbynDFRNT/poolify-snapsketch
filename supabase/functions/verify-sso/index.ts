// Supabase Edge Function: Verify SnapSketch SSO tokens.
// Keeps the shared HMAC secret server-side instead of bundling it into the app.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SSOPayload {
  email: string
  name: string
  snapsketchProjectId: string
  iat: number
  exp: number
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=')
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

function decodePayload(payload: string): SSOPayload {
  const decoded = new TextDecoder().decode(base64UrlToBytes(payload))
  return JSON.parse(decoded) as SSOPayload
}

function isValidPayload(payload: SSOPayload): boolean {
  return Boolean(
    payload &&
    typeof payload.email === 'string' &&
    typeof payload.name === 'string' &&
    typeof payload.snapsketchProjectId === 'string' &&
    typeof payload.iat === 'number' &&
    typeof payload.exp === 'number'
  )
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { token } = await req.json()
    const secret = Deno.env.get('CPQ_API_KEY')

    if (!secret) {
      console.error('CPQ_API_KEY environment variable not set')
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!token || typeof token !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing SSO token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const parts = token.split('.')
    if (parts.length !== 3) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid SSO token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const [header, payload, signature] = parts
    const message = `${header}.${payload}`
    let verified = false
    let decodedPayload: SSOPayload | null = null

    try {
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify'],
      )

      verified = await crypto.subtle.verify(
        'HMAC',
        cryptoKey,
        base64UrlToBytes(signature),
        new TextEncoder().encode(message),
      )

      decodedPayload = decodePayload(payload)
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid SSO token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!verified) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid SSO token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!decodedPayload || !isValidPayload(decodedPayload)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid SSO payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (decodedPayload.exp < Date.now() / 1000) {
      return new Response(
        JSON.stringify({ success: false, error: 'SSO token has expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, payload: decodedPayload }),
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

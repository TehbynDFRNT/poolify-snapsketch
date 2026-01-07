# SnapSketch ↔ Poolify Integration Guide

## Overview

Add "Sync to Poolify" functionality to SnapSketch's NewProjectModal, allowing users to link new SnapSketch projects to existing Poolify pool_projects during creation.

---

## Environment Variables

### SnapSketch `.env` (add these)

```env
# Poolify Integration
VITE_POOLIFY_API_URL=https://mapshmozorhiewusdgor.supabase.co/functions/v1
VITE_POOLIFY_API_KEY=684874ff9c4ea32648ed417bfa89a5b0a111eea0b6be8037854ac48897914060
```

> **Note**: Using the same shared key that Poolify uses to call SnapSketch (`VITE_SNAPSKETCH_API_KEY` = `CPQ_API_KEY`). This creates bidirectional trust.

### Poolify Supabase Edge Function Secrets (already exists)

The edge function will validate using `CPQ_API_KEY` which is already set:
```
CPQ_API_KEY=684874ff9c4ea32648ed417bfa89a5b0a111eea0b6be8037854ac48897914060
```

---

## Poolify Database Schema

### Table: `pool_projects`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key |
| `owner1` | `text` | Customer name (primary) |
| `owner2` | `text?` | Customer name (secondary) |
| `site_address` | `text?` | Installation address |
| `home_address` | `text` | Customer home address |
| `email` | `text` | Customer email |
| `phone` | `text` | Customer phone |
| `proposal_name` | `text` | Project/proposal name |
| `pd_deal_id` | `number?` | Pipedrive deal ID |
| `current_status` | `text` | Project status |
| `created_at` | `timestamp` | Creation date |
| `updated_at` | `timestamp` | Last update |

### SnapSketch Link Columns (already exist)

| Column | Type | Description |
|--------|------|-------------|
| `snapsketch_uuid` | `uuid?` | Linked SnapSketch project ID |
| `snapsketch_customer_name` | `text?` | Customer name from SnapSketch |
| `snapsketch_address` | `text?` | Address from SnapSketch |
| `snapsketch_embed_token` | `text?` | Public link token |
| `snapsketch_embed_code` | `jsonb?` | `{ embedUrl, embedCode, allowExport, expiresAt }` |

---

## API Endpoints (Poolify Edge Functions)

### 1. Search Pool Projects

**Endpoint**: `POST /functions/v1/search-pool-projects`

**Request**:
```typescript
// Headers
Authorization: Bearer 684874ff9c4ea32648ed417bfa89a5b0a111eea0b6be8037854ac48897914060
Content-Type: application/json

// Body
{
  "search": "smith"  // searches owner1, owner2, site_address, proposal_name
}
```

**Response**:
```typescript
{
  "success": true,
  "count": 3,
  "results": [
    {
      "id": "uuid-here",
      "owner1": "John Smith",
      "owner2": null,
      "siteAddress": "123 Pool St, Brisbane QLD",
      "homeAddress": "456 Home Ave, Brisbane QLD",
      "proposalName": "Smith Pool Project",
      "email": "john@example.com",
      "currentStatus": "quote",
      "hasSnapSketch": false,  // true if already linked
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### 2. Check SnapSketch Link Status

**Endpoint**: `POST /functions/v1/check-snapsketch-link`

**Request**:
```typescript
// Headers
Authorization: Bearer 684874ff9c4ea32648ed417bfa89a5b0a111eea0b6be8037854ac48897914060
Content-Type: application/json

// Body
{
  "snapsketchId": "uuid-of-snapsketch-project"
}
```

**Response (not linked)**:
```typescript
{
  "success": true,
  "linked": false
}
```

**Response (linked)**:
```typescript
{
  "success": true,
  "linked": true,
  "poolProject": {
    "id": "uuid-here",
    "owner1": "John Smith",
    "owner2": null,
    "siteAddress": "123 Pool St, Brisbane QLD",
    "homeAddress": "456 Home Ave, Brisbane QLD",
    "proposalName": "Smith Pool Project",
    "email": "john@example.com",
    "currentStatus": "quote",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

### 3. Link SnapSketch to Pool Project

**Endpoint**: `POST /functions/v1/link-snapsketch`

**Request**:
```typescript
// Headers
Authorization: Bearer 684874ff9c4ea32648ed417bfa89a5b0a111eea0b6be8037854ac48897914060
Content-Type: application/json

// Body
{
  "poolProjectId": "uuid-of-pool-project",
  "snapsketch": {
    "id": "uuid-of-snapsketch-project",
    "customerName": "John Smith",
    "address": "123 Pool St, Brisbane QLD",
    "embedToken": "abc123token",
    "embedUrl": "https://poolify-snapsketch.vercel.app/share/abc123token",
    "embedCode": "<iframe src=\"...\" />",
    "allowExport": true,
    "expiresAt": null
  }
}
```

**Response**:
```typescript
{
  "success": true,
  "message": "SnapSketch project linked successfully"
}
```

---

## SnapSketch Implementation

### 1. Types (`src/types/poolify.ts`)

```typescript
export interface PoolifyProject {
  id: string;
  owner1: string;
  owner2: string | null;
  siteAddress: string | null;
  homeAddress: string;
  proposalName: string;
  email: string;
  currentStatus: string;
  hasSnapSketch: boolean;
  createdAt: string;
}

export interface PoolifySearchResponse {
  success: boolean;
  count: number;
  results: PoolifyProject[];
  error?: string;
}

export interface PoolifyLinkRequest {
  poolProjectId: string;
  snapsketch: {
    id: string;
    customerName: string;
    address: string;
    embedToken: string;
    embedUrl: string;
    embedCode: string;
    allowExport: boolean;
    expiresAt: string | null;
  };
}
```

### 2. Hook (`src/hooks/usePoolifyIntegration.ts`)

```typescript
import { useState, useCallback } from 'react';
import { PoolifyProject, PoolifySearchResponse, PoolifyLinkRequest } from '@/types/poolify';

const POOLIFY_API_URL = import.meta.env.VITE_POOLIFY_API_URL;
const POOLIFY_API_KEY = import.meta.env.VITE_POOLIFY_API_KEY;

export const usePoolifyIntegration = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchProjects = useCallback(async (searchTerm: string): Promise<PoolifyProject[]> => {
    if (!searchTerm || searchTerm.length < 2) return [];
    if (!POOLIFY_API_URL || !POOLIFY_API_KEY) {
      throw new Error('Poolify API configuration missing');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${POOLIFY_API_URL}/search-pool-projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${POOLIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ search: searchTerm }),
      });

      const data: PoolifySearchResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Search failed');
      }

      return data.results;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const linkToPoolify = useCallback(async (request: PoolifyLinkRequest): Promise<void> => {
    if (!POOLIFY_API_URL || !POOLIFY_API_KEY) {
      throw new Error('Poolify API configuration missing');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${POOLIFY_API_URL}/link-snapsketch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${POOLIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Link failed');
      }
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    searchProjects,
    linkToPoolify,
    loading,
    error,
  };
};
```

### 3. NewProjectModal Changes

Add to `NewProjectModal.tsx`:

```typescript
// New state
const [linkToPoolify, setLinkToPoolify] = useState(false);
const [poolifySearch, setPoolifySearch] = useState('');
const [poolifyResults, setPoolifyResults] = useState<PoolifyProject[]>([]);
const [selectedPoolifyProject, setSelectedPoolifyProject] = useState<PoolifyProject | null>(null);
const [poolifySearching, setPoolifySearching] = useState(false);

// New prop in onSubmit callback
onSubmit: (data: {
  customerName: string;
  address: string;
  coordinates?: { lat: number; lng: number };
  notes?: string;
  poolifyProjectId?: string;  // NEW
}) => void;
```

**UI Addition** (after notes field):

```tsx
<div className="grid gap-2">
  <div className="flex items-center gap-2">
    <Checkbox
      id="linkPoolify"
      checked={linkToPoolify}
      onCheckedChange={(checked) => setLinkToPoolify(!!checked)}
    />
    <Label htmlFor="linkPoolify">Link to Poolify project</Label>
  </div>

  {linkToPoolify && (
    <div className="space-y-3 mt-2 p-3 border rounded-lg bg-muted/50">
      <div className="relative">
        <Input
          placeholder="Search Poolify by customer name or address..."
          value={poolifySearch}
          onChange={(e) => handlePoolifySearch(e.target.value)}
        />
        {poolifySearching && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin" />}
      </div>

      {poolifyResults.length > 0 && (
        <div className="max-h-48 overflow-y-auto space-y-2">
          {poolifyResults.map((project) => (
            <div
              key={project.id}
              className={cn(
                "p-2 border rounded cursor-pointer hover:bg-accent",
                selectedPoolifyProject?.id === project.id && "border-primary bg-accent"
              )}
              onClick={() => setSelectedPoolifyProject(project)}
            >
              <p className="font-medium">{project.owner1}</p>
              <p className="text-sm text-muted-foreground">{project.siteAddress || project.homeAddress}</p>
              {project.hasSnapSketch && (
                <Badge variant="secondary" className="mt-1">Already linked</Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedPoolifyProject && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Will link to: {selectedPoolifyProject.owner1}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )}
</div>
```

### 4. CloudHomePage Changes

Update `handleCreateProject` in `CloudHomePage.tsx`:

```typescript
const handleCreateProject = async (data: {
  customerName: string;
  address: string;
  coordinates?: { lat: number; lng: number };
  notes?: string;
  poolifyProjectId?: string;  // NEW
}) => {
  if (!user) return;

  try {
    // 1. Create the project (existing code)
    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        owner_id: user.id,
        customer_name: data.customerName,
        address: data.address,
        notes: data.notes,
        components: [],
      })
      .select()
      .single();

    if (error) throw error;

    // 2. If linking to Poolify, create public link and sync
    if (data.poolifyProjectId && newProject) {
      // Create public link for the project
      const { data: publicLink, error: linkError } = await supabase
        .from('project_public_links')
        .insert({
          project_id: newProject.id,
          token: crypto.randomUUID(),
          permission: 'view',
          allow_export: true,
          created_by: user.id,
        })
        .select()
        .single();

      if (linkError) {
        console.error('Failed to create public link:', linkError);
      } else {
        // Link to Poolify
        const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;
        const embedUrl = `${baseUrl}/share/${publicLink.token}`;

        await linkToPoolify({
          poolProjectId: data.poolifyProjectId,
          snapsketch: {
            id: newProject.id,
            customerName: data.customerName,
            address: data.address,
            embedToken: publicLink.token,
            embedUrl: embedUrl,
            embedCode: `<iframe src="${embedUrl}" width="800" height="600" frameborder="0" title="${data.customerName} Pool Design"></iframe>`,
            allowExport: true,
            expiresAt: null,
          },
        });

        toast({
          title: 'Project linked to Poolify',
          description: 'Site plan will be available in Poolify automatically.',
        });
      }
    }

    // Rest of existing code...
  } catch (error) {
    // error handling...
  }
};
```

---

## Poolify Edge Functions (to be created)

### `supabase/functions/search-pool-projects/index.ts`

```typescript
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

    if (!authHeader?.startsWith('Bearer ') || authHeader.replace('Bearer ', '').trim() !== expectedKey) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { search } = await req.json()
    if (!search || search.length < 2) {
      return new Response(JSON.stringify({ success: false, error: 'Search term too short' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Search by owner1, owner2, site_address, proposal_name
    const { data, error } = await supabase
      .from('pool_projects')
      .select('id, owner1, owner2, site_address, home_address, proposal_name, email, current_status, snapsketch_uuid, created_at')
      .or(`owner1.ilike.%${search}%,owner2.ilike.%${search}%,site_address.ilike.%${search}%,proposal_name.ilike.%${search}%`)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error

    const results = (data || []).map(p => ({
      id: p.id,
      owner1: p.owner1,
      owner2: p.owner2,
      siteAddress: p.site_address,
      homeAddress: p.home_address,
      proposalName: p.proposal_name,
      email: p.email,
      currentStatus: p.current_status,
      hasSnapSketch: !!p.snapsketch_uuid,
      createdAt: p.created_at,
    }))

    return new Response(JSON.stringify({ success: true, count: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

### `supabase/functions/link-snapsketch/index.ts`

```typescript
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
    const authHeader = req.headers.get('Authorization')
    const expectedKey = Deno.env.get('CPQ_API_KEY')

    if (!authHeader?.startsWith('Bearer ') || authHeader.replace('Bearer ', '').trim() !== expectedKey) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { poolProjectId, snapsketch } = await req.json()

    if (!poolProjectId || !snapsketch?.id) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { error } = await supabase
      .from('pool_projects')
      .update({
        snapsketch_uuid: snapsketch.id,
        snapsketch_customer_name: snapsketch.customerName,
        snapsketch_address: snapsketch.address,
        snapsketch_embed_token: snapsketch.embedToken,
        snapsketch_embed_code: {
          embedUrl: snapsketch.embedUrl,
          embedCode: snapsketch.embedCode,
          allowExport: snapsketch.allowExport,
          expiresAt: snapsketch.expiresAt,
        },
      })
      .eq('id', poolProjectId)

    if (error) throw error

    return new Response(JSON.stringify({ success: true, message: 'SnapSketch project linked successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

---

## Summary

| What | Where | Action |
|------|-------|--------|
| `VITE_POOLIFY_API_URL` | SnapSketch `.env` | Add |
| `VITE_POOLIFY_API_KEY` | SnapSketch `.env` | Add |
| `src/types/poolify.ts` | SnapSketch | Create |
| `src/hooks/usePoolifyIntegration.ts` | SnapSketch | Create |
| `src/components/NewProjectModal.tsx` | SnapSketch | Modify |
| `src/components/CloudHomePage.tsx` | SnapSketch | Modify |
| `search-pool-projects` | Poolify Edge Functions | Create |
| `link-snapsketch` | Poolify Edge Functions | Create |

**Shared API Key**: `684874ff9c4ea32648ed417bfa89a5b0a111eea0b6be8037854ac48897914060`

This key is already used for SnapSketch→Poolify communication (`CPQ_API_KEY`), so we reuse it for bidirectional trust.

---

## SSO Token Exchange (Poolify → SnapSketch)

Allows Poolify users to click "Edit in SnapSketch" and be automatically logged in.

### Flow
```
Poolify user clicks "Edit in SnapSketch"
  → Poolify generates signed JWT
  → Redirect to: https://poolify-snapsketch.vercel.app/sso?token=<jwt>
  → SnapSketch validates token, creates/finds user, sets session
  → Redirect to /project/:snapsketchProjectId
```

### JWT Structure

**Header:**
```json
{ "alg": "HS256", "typ": "JWT" }
```

**Payload:**
```typescript
{
  email: string;              // User's email (e.g., "john@mfpeasy.com.au")
  name: string;               // User's full name
  snapsketchProjectId: string; // UUID of SnapSketch project to open
  iat: number;                // Issued at (Unix timestamp)
  exp: number;                // Expires at (iat + 5 minutes)
}
```

**Secret:** Same as `CPQ_API_KEY` / `VITE_SNAPSKETCH_API_KEY`:
```
684874ff9c4ea32648ed417bfa89a5b0a111eea0b6be8037854ac48897914060
```

### SnapSketch Implementation Required

**1. Create SSO Route/Page**: `/sso`

**2. Implement SSO Handler**:

```typescript
// /pages/SSO.tsx or edge function

// 1. Get token from URL
const token = searchParams.get('token');

// 2. Validate JWT signature (HMAC-SHA256 with CPQ_API_KEY)
const isValid = await verifyJWT(token);
if (!isValid) return error('Invalid token');

// 3. Check expiry
const payload = decodeJWT(token);
if (payload.exp < Date.now() / 1000) return error('Token expired');

// 4. Find or create user by email
let { data: profile } = await supabase
  .from('profiles')
  .select('id')
  .eq('email', payload.email)
  .single();

if (!profile) {
  // Create user via Supabase Auth admin API or magic link
  // Then create profile
}

// 5. Sign in user (use Supabase Auth session)
// Option A: Generate magic link and auto-click it
// Option B: Use service role to create session token

// 6. Redirect to project
navigate(`/project/${payload.snapsketchProjectId}`);
```

### JWT Verification Utility (SnapSketch side)

```typescript
// src/utils/ssoVerify.ts
const SSO_SECRET = import.meta.env.VITE_CPQ_API_KEY;

export async function verifyJWT(token: string): Promise<boolean> {
  const [header, payload, signature] = token.split('.');
  const message = `${header}.${payload}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SSO_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // Decode signature from base64url
  const sigBytes = Uint8Array.from(
    atob(signature.replace(/-/g, '+').replace(/_/g, '/')),
    c => c.charCodeAt(0)
  );

  return crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(message));
}

export function decodeJWT(token: string) {
  const [, payload] = token.split('.');
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
}
```

### Files to Create (SnapSketch)

| File | Action |
|------|--------|
| `src/pages/SSO.tsx` | **CREATE** - SSO landing page |
| `src/utils/ssoVerify.ts` | **CREATE** - JWT verification |
| `src/App.tsx` | **MODIFY** - Add `/sso` route |

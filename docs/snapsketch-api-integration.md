# SnapSketch API Integration Guide

How to trigger SnapSketch events from integrated apps (Poolify, etc).

## Base Config

```
SUPABASE_URL = https://yigzhgzrbrtguksrlnjb.supabase.co
ANON_KEY     = <your VITE_SUPABASE_PUBLISHABLE_KEY>
```

All requests need these headers:

```
apikey: <ANON_KEY>
Authorization: Bearer <ANON_KEY or USER_JWT>
Content-Type: application/json
```

---

## 1. Accept Project (via Share Token)

Marks a project as `approved` and creates a version snapshot. No user auth needed — the share token is the auth.

**RPC:** `accept_project_via_share`

```bash
curl -X POST "${SUPABASE_URL}/rest/v1/rpc/accept_project_via_share" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"p_token": "<SHARE_TOKEN>"}'
```

**Request:**

| Field     | Type   | Required | Description                          |
|-----------|--------|----------|--------------------------------------|
| `p_token` | string | yes      | The share token from the project URL |

**Response (success):**

```json
{
  "success": true,
  "version_number": 9,
  "stage": "contract_variations"
}
```

**Response (failure):**

```json
{
  "success": false,
  "error": "Invalid or expired link"
}
```

**What it does:**
1. Validates the share token (not revoked, not expired)
2. Snapshots current components into `project_versions`
3. Sets `projects.status = 'approved'`

---

## 2. Update Project Stage/Status (API Key)

Updates a project's stage and/or status. Authenticated via `CPQ_API_KEY` (same as search-projects). Creates a version snapshot before updating.

**Edge Function:** `update-project-status`

```bash
curl -X POST "${SUPABASE_URL}/functions/v1/update-project-status" \
  -H "Authorization: Bearer ${CPQ_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "<PROJECT_UUID>",
    "stage": "contract_site_plan",
    "status": "draft",
    "notes": "Moved to site plan phase"
  }'
```

**Request:**

| Field        | Type   | Required | Description                                                  |
|--------------|--------|----------|--------------------------------------------------------------|
| `project_id` | uuid   | yes      | Project UUID                                                 |
| `stage`      | string | no*      | `proposal`, `contract_site_plan`, or `contract_variations`   |
| `status`     | string | no*      | `draft` or `approved`                                        |
| `notes`      | string | no       | Note saved with the version snapshot (default: "Stage/Status updated") |

*At least one of `stage` or `status` must be provided.

**Response (success):**

```json
{
  "success": true,
  "project": {
    "id": "66c357ac-...",
    "stage": "contract_site_plan",
    "status": "draft",
    "updated_at": "2026-02-09T..."
  },
  "version_number": 10
}
```

**What it does:**
1. Validates `CPQ_API_KEY` from Authorization header
2. Fetches current project (service role, bypasses RLS)
3. Snapshots current components into `project_versions`
4. Updates `projects.stage` and/or `projects.status`

---

## 3. Get Project via Share Token (Public Read)

Fetch project data for display without auth. Used by the public share view.

```bash
curl -X POST "${SUPABASE_URL}/rest/v1/rpc/get_public_project" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"p_token": "<SHARE_TOKEN>"}'
```

Returns project details (name, address, components, etc.) if the token is valid.

---

## Where to Get Tokens

### Share Token
Found in the share URL: `https://poolify-snapsketch.vercel.app/share/<SHARE_TOKEN>`

Stored in `project_public_links.token`. Each project can have one active (non-revoked, non-expired) link.

### CPQ API Key
Used for `update-project-status` and `search-projects` edge functions. Set as `CPQ_API_KEY` secret on the Supabase project. Passed via `Authorization: Bearer <CPQ_API_KEY>`.

---

## Valid Values Reference

**Stages** (workflow progression):
| Value                    | Display Name          |
|--------------------------|-----------------------|
| `proposal`               | Proposal              |
| `contract_site_plan`     | Contract Site Plan    |
| `contract_variations`    | Contract Variations   |

**Statuses** (within each stage):
| Value      | Meaning                        |
|------------|--------------------------------|
| `draft`    | Work in progress               |
| `approved` | Customer/team approved         |

---

## Typical Integration Flow

1. **Project created** in SnapSketch, share link generated
2. **Integrated app** stores the share token
3. **Customer reviews** via share URL
4. **Customer accepts** -> integrated app calls `accept_project_via_share` with the token
5. **Designer advances stage** -> integrated app calls `update-project-status` with CPQ API key
6. Repeat 3-5 through `proposal` -> `contract_site_plan` -> `contract_variations`

# Pool Design Tool - Developer Guide

## 🏗️ Architecture Overview

This is a **full-stack web application** built with:
- **Frontend**: React + TypeScript + Vite
- **Canvas**: Konva (react-konva) for 2D drawing
- **Backend**: Supabase (via Lovable Cloud)
- **State**: Zustand for global state management
- **Auth**: Multi-user with Supabase Auth
- **Storage**: Supabase database (primary) + LocalStorage (PWA only)

---

## 📁 File Structure (Active Files Only)

```
src/
├── components/
│   ├── Canvas.tsx                    ✅ Main drawing canvas (1122 lines)
│   ├── TopBar.tsx                    ✅ Horizontal toolbar with tool buttons
│   ├── BottomPanel.tsx               ✅ Measurements + zoom controls
│   ├── PropertiesPanel.tsx           ✅ Right sidebar (component properties)
│   ├── CloudHomePage.tsx             ✅ Project list page (Supabase)
│   ├── DesignCanvas.tsx              ✅ Main editor orchestrator
│   ├── ExportDialog.tsx              ✅ PDF/PNG export options
│   ├── NewProjectModal.tsx           ✅ Create new project form
│   ├── ShareProjectDialog.tsx        ✅ Multi-user sharing UI
│   ├── MigrationDialog.tsx           ✅ Migrate old localStorage projects
│   ├── PoolSelector.tsx              ✅ Choose pre-defined pool shapes
│   ├── PavingAreaDialog.tsx          ✅ Configure paving area settings
│   ├── InstallPrompt.tsx             ✅ PWA install prompt (Android/Chrome)
│   ├── IOSInstallPrompt.tsx          ✅ PWA install prompt (iOS Safari)
│   └── canvas/
│       ├── PoolComponent.tsx         ✅ Pool rendering + interaction
│       ├── PaverComponent.tsx        ✅ Individual pavers (400×400, 400×600)
│       ├── PavingAreaComponent.tsx   ✅ Paving areas with auto-fill
│       ├── DrainageComponent.tsx     ✅ Drainage lines
│       ├── FenceComponent.tsx        ✅ Fence lines (glass/metal/boundary)
│       ├── WallComponent.tsx         ✅ Retaining walls
│       ├── BoundaryComponent.tsx     ✅ Property boundary polygon
│       ├── HouseComponent.tsx        ✅ House outline polygon
│       └── ReferenceLineComponent.tsx ✅ Measurement guide lines
│
├── pages/
│   ├── LandingPage.tsx               ✅ Public homepage
│   ├── Login.tsx                     ✅ Auth login
│   ├── SignUp.tsx                    ✅ Auth signup
│   ├── ForgotPassword.tsx            ✅ Password reset request
│   ├── ResetPassword.tsx             ✅ Password reset completion
│   ├── ProfileSettings.tsx           ✅ User profile editor
│   ├── TeamManagement.tsx            ✅ Company team admin (admin role only)
│   └── NotFound.tsx                  ✅ 404 page
│
├── store/
│   └── designStore.ts                ✅ Zustand global state (235 lines)
│
├── utils/
│   ├── measurements.ts               ✅ Calculate areas, lengths, counts
│   ├── copingCalculation.ts          ✅ Pool coping paver math
│   ├── pavingFill.ts                 ✅ Auto-fill paving areas
│   ├── pdfExport.ts                  ✅ Export to PDF (jspdf)
│   ├── imageExport.ts                ✅ Export to PNG/JPG
│   ├── snap.ts                       ✅ Snap-to-grid logic
│   ├── canvas.ts                     ✅ Canvas helper functions
│   ├── poolExcludeZone.ts            ✅ Exclude pools from paving
│   └── storage.ts                    ✅ LocalStorage helpers (legacy migration)
│
├── constants/
│   ├── pools.ts                      ✅ Pre-defined pool shapes (Oxford, Latina, etc.)
│   ├── components.ts                 ✅ Paver sizes, fence types, materials
│   └── grid.ts                       ✅ Grid configuration (100mm, 1:100 scale)
│
├── types/
│   └── index.ts                      ✅ TypeScript interfaces (Component, Project, etc.)
│
├── hooks/
│   ├── useAuth.tsx                   ✅ Supabase authentication hook
│   ├── useKeyboardShortcuts.ts       ✅ Canvas keyboard shortcuts (V, H, P, etc.)
│   ├── use-mobile.tsx                ✅ Mobile detection hook
│   └── use-toast.ts                  ✅ Toast notifications hook
│
└── integrations/
    └── supabase/
        ├── client.ts                 ✅ Supabase client (auto-generated)
        └── types.ts                  ✅ Database types (auto-generated)
```

---

## 🗺️ Component Flow Diagram

```
App.tsx
  ├─→ LandingPage (/)
  ├─→ Login/SignUp (/login, /signup)
  └─→ [Protected Routes]
       ├─→ CloudHomePage (/projects)
       │    └─→ Lists all projects from Supabase
       │         └─→ Click "Open" → Navigate to /project/:id
       │
       └─→ DesignCanvas (/project/:id)
            ├─→ TopBar (horizontal toolbar)
            │    └─→ Tool buttons (select, pool, paver, etc.)
            │    └─→ Undo/Redo buttons
            │    └─→ Save/Export/Menu buttons
            │
            ├─→ Canvas (main drawing area)
            │    ├─→ PoolComponent (for each pool)
            │    ├─→ PaverComponent (for each paver)
            │    ├─→ PavingAreaComponent (for each paving area)
            │    ├─→ DrainageComponent (for each drainage line)
            │    ├─→ FenceComponent (for each fence)
            │    ├─→ WallComponent (for each wall)
            │    ├─→ BoundaryComponent (property boundary)
            │    ├─→ HouseComponent (house outline)
            │    └─→ ReferenceLineComponent (guide lines)
            │
            └─→ BottomPanel (measurements + zoom)
                 └─→ Displays calculated totals from measurements.ts
```

---

## 🎯 Where to Edit Guide

### **When I want to change...**

| **What** | **Edit This File** | **Line(s)** |
|----------|-------------------|-------------|
| Tool buttons (add/remove/edit) | `TopBar.tsx` | 54-61 (tools array) |
| Tool keyboard shortcuts | `DesignCanvas.tsx` | 85-107 (handleKeyDown) |
| Tool behavior (drawing logic) | `Canvas.tsx` | 200-1000+ (tool handlers) |
| Pool shapes/dimensions | `constants/pools.ts` | 12-120 (POOL_LIBRARY) |
| Paver sizes | `constants/components.ts` | 1-4 (PAVER_SIZES) |
| Fence types | `constants/components.ts` | 11-15 (FENCE_TYPES) |
| Wall materials | `constants/components.ts` | 17-22 (WALL_MATERIALS) |
| Measurement calculations | `utils/measurements.ts` | 4-178 (calculateMeasurements) |
| Pool coping math | `utils/copingCalculation.ts` | 80-189 (calculatePoolCoping) |
| Paving area auto-fill | `utils/pavingFill.ts` | All |
| PDF export format | `utils/pdfExport.ts` | All |
| Grid size/scale | `constants/grid.ts` | All |
| Global state structure | `store/designStore.ts` | 7-49 (interface) |
| Database tables | Supabase dashboard | (via Lovable Cloud) |

---

## 🔢 Measurement Accuracy Report

### **Pool Dimensions** ✅

| Pool Name | Width (mm) | Length (mm) | Verified |
|-----------|------------|-------------|----------|
| Oxford | 6000 | 3000 | ✅ |
| Latina | 7000 | 3500 | ✅ |
| Kensington | 8000 | 4000 | ✅ |
| Istana | 9000 | 4000 | ✅ |
| Hayman | 10000 | 4500 | ✅ |
| Harmony | 11000 | 4500 | ✅ |

**Coping Width**: 400mm (exactly matches paver size) ✅

**Coping Calculation**: 
- File: `utils/copingCalculation.ts`
- Method: Calculates full + partial pavers per side
- Verified: ✅ Correct for all pool shapes

**Measurements Display**: 
- Bottom panel shows pool dimensions ✅
- PDF export includes measurements ✅

---

### **Paving Dimensions** ✅

| Paver Size | Width (mm) | Height (mm) | Verified |
|------------|------------|-------------|----------|
| Standard | 400 | 400 | ✅ |
| Large | 400 | 600 | ✅ |

**Individual Pavers**:
- Drag-to-replicate: ✅ Working
- Snap to grid: ✅ Working (100mm grid)
- Count accuracy: ✅ Correct

**Paving Areas**:
- Auto-fill with pavers: ✅ Working
- Pool exclusion zones: ✅ Working (uses `poolExcludeZone.ts`)
- Area calculation (m²): ✅ Accurate
- Edge paver detection: ✅ Working (different color)

**Measurement Calculation**:
- File: `utils/measurements.ts` → `calculateMeasurements()`
- Individual pavers counted correctly ✅
- Paving area m² calculated from boundary polygon ✅
- Total paver count = individual + area pavers ✅

---

## 🎨 Design System Status

**Current Implementation**:
- Uses Tailwind CSS with semantic tokens
- Design tokens defined in `index.css`
- Shadcn UI components used throughout

**Responsive Layout**:
- Primary target: **Desktop** (1920×1080)
- Secondary support: **Tablet** (1024×768)
- Mobile: **Limited** (toolbar may be cramped)

**Recommendation**: Consider mobile-specific toolbar layout if mobile users are common.

---

## 💾 Storage Architecture

### **Primary Storage: Supabase (Lovable Cloud)**

**Tables Used**:
- `projects` - Project metadata + components JSON
- `profiles` - User profiles (full_name, avatar, role)
- `companies` - Company/team data
- `project_shares` - Multi-user sharing permissions
- `activity_log` - Audit trail
- `comments` - Project comments (not actively used in UI)

**Auto-Save**: Every 30 seconds (see `DesignCanvas.tsx` line 177)

**RLS Policies**: ✅ Properly configured for multi-user access

---

### **Secondary Storage: LocalStorage**

**Only Used For**:
1. **PWA Install Prompts** (`InstallPrompt.tsx`, `IOSInstallPrompt.tsx`)
   - Tracks if user dismissed install prompt
2. **Legacy Project Migration** (`MigrationDialog.tsx`)
   - One-time migration from old local-only version

**NOT Used For**: Active project storage (all projects in Supabase)

---

## 🧩 Drawing Tools Architecture

### **Tool Definition → Activation → Rendering Flow**

```
1. DEFINITION
   └─→ constants/components.ts (tool properties)

2. UI BUTTONS
   └─→ TopBar.tsx (lines 54-61)
        ├─→ Tool name
        ├─→ Icon (lucide-react)
        └─→ Keyboard shortcut

3. ACTIVATION
   └─→ DesignCanvas.tsx (lines 37-40, 85-107)
        ├─→ setActiveTool(toolName)
        └─→ Keyboard shortcuts

4. BEHAVIOR
   └─→ Canvas.tsx (lines 200-1000+)
        ├─→ handleStageClick()
        ├─→ handleStageMouseMove()
        ├─→ Tool-specific drawing logic

5. RENDERING
   └─→ components/canvas/*Component.tsx
        └─→ Konva shapes (Line, Rect, Circle, etc.)

6. STATE MANAGEMENT
   └─→ store/designStore.ts
        └─→ addComponent(), updateComponent(), deleteComponent()
```

---

## 🚀 Feature Status

### **✅ Fully Implemented**

| Feature | Status | Notes |
|---------|--------|-------|
| Grid (100mm, 1:100 scale) | ✅ | `GRID_CONFIG` in `constants/grid.ts` |
| Pan & zoom | ✅ | Touch + mouse wheel supported |
| Snap to grid | ✅ | `utils/snap.ts` |
| Touch optimization | ✅ | Konva handles touch events |
| Pool (drag/drop/rotate) | ✅ | 6 pre-defined shapes + coping |
| Paver (drag-to-replicate) | ✅ | Horizontal + vertical replication |
| Paving area (auto-fill) | ✅ | NEW: Fixed selection bug |
| Drainage (drag-to-extend) | ✅ | Rock + Ultradrain types |
| Fence (drag-to-extend) | ✅ | Glass, metal, boundary types |
| Retaining wall | ✅ | 4 materials (timber, concrete, etc.) |
| Boundary polygon | ✅ | Property outline |
| House outline | ✅ | Polygon drawing |
| Text labels | ⚠️ | NOT YET IMPLEMENTED |
| Properties panels | ✅ | Right sidebar (PropertiesPanel.tsx) |
| Auto measurements | ✅ | Bottom panel + PDF export |
| Undo/redo | ✅ | 50-state history |
| Auto-save | ✅ | Every 30 seconds to Supabase |
| PDF export | ✅ | With measurements table |
| PNG/JPG export | ✅ | Canvas snapshot |
| Multi-user sharing | ✅ | View/Edit/Admin permissions |
| Team management | ✅ | Company-based (admin role only) |
| Authentication | ✅ | Email/password via Supabase |

---

## 🔒 Multi-User Features

**YES, this app is multi-user!**

- **Authentication**: Email/password via Supabase Auth
- **Project Ownership**: Each project has an owner
- **Sharing**: 
  - View-only (read)
  - Edit (modify)
  - Admin (delete + share)
- **Teams**: Company-based grouping (admin role required)
- **Real-time**: Supabase subscriptions update project list live

**Files Involved**:
- `CloudHomePage.tsx` - Project list + sharing UI
- `ShareProjectDialog.tsx` - Share project form
- `TeamManagement.tsx` - Company team admin
- `pages/Login.tsx`, `SignUp.tsx` - Authentication
- `hooks/useAuth.tsx` - Auth context

---

## ⚠️ Known Limitations

1. **Text Labels**: Not yet implemented (no text tool in toolbar)
2. **Mobile Layout**: Toolbar buttons may be cramped on small screens
3. **Offline Mode**: Requires internet (Supabase only, no offline queue)
4. **Real-time Collaboration**: Projects update in list, but NOT live canvas editing
5. **Comments**: Database table exists but UI not fully integrated

---

## 🧹 Files Deleted in This Cleanup

- ✅ `src/components/Toolbar.tsx` (UNUSED - no imports found)

---

## 📋 Critical Questions - ANSWERED

| Question | Answer |
|----------|--------|
| Desktop only OR desktop + tablet? | **Desktop primary, tablet secondary** |
| LocalStorage only OR Supabase only? | **Supabase primary** (LocalStorage for PWA only) |
| Single-user OR multi-user with sharing? | **Multi-user with sharing** ✅ |
| Do we need PWA functionality? | **YES** (InstallPrompt components active) |

---

## 🎓 Developer Onboarding Checklist

**New developer? Start here:**

1. ✅ Read this guide
2. ✅ Review `src/types/index.ts` (data structures)
3. ✅ Explore `store/designStore.ts` (global state)
4. ✅ Examine `Canvas.tsx` (drawing logic)
5. ✅ Check `constants/pools.ts` + `components.ts` (design data)
6. ✅ Test all tools in TopBar (V, H, P, A, D, F, W, B)
7. ✅ Create a test project and export to PDF
8. ✅ Share a project with another test user
9. ✅ Review Supabase tables in backend

**Common Tasks**:
- Add new pool shape → Edit `constants/pools.ts`
- Add new tool → Edit `TopBar.tsx` + `Canvas.tsx` + create `*Component.tsx`
- Fix measurement bug → Edit `utils/measurements.ts`
- Change export format → Edit `utils/pdfExport.ts`

---

## 🐛 Debugging Tips

**Canvas not responding?**
- Check browser console for Konva errors
- Verify `activeTool` state in `DesignCanvas.tsx`

**Measurements wrong?**
- Check `utils/measurements.ts` → `calculateMeasurements()`
- Verify component dimensions in `store/designStore.ts`

**Auto-save not working?**
- Check `DesignCanvas.tsx` line 177 (30s interval)
- Verify Supabase connection in Network tab

**Snapping issues?**
- Check `utils/snap.ts` → `snapToGrid()` + `smartSnap()`
- Verify `GRID_CONFIG` in `constants/grid.ts`

---

## 📞 Support

**Need help?**
- Backend issues → Use `<lov-open-backend>` action to view Lovable Cloud
- Code questions → Refer to this guide
- Feature requests → Contact project owner

---

**Last Updated**: 2025-10-09  
**Version**: Production Ready (Post-Cleanup)  
**Codebase Status**: Clean, documented, fully functional ✅

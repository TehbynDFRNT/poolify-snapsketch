# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SnapSketch is a pool design and landscaping planning application built with React, Konva (for canvas rendering), and Supabase (for backend/auth). The app allows users to create detailed pool and landscaping designs with measurements, export to PDF/images, and manage projects in the cloud.

## Development Commands

### Running the Application
- `npm run dev` - Start development server on port 8080
- `npm run build` - Production build
- `npm run build:dev` - Development build
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Supabase (if working with database)
The project uses Supabase for authentication and cloud project storage. Migrations are in `supabase/migrations/`.

## Architecture Overview

### State Management (Zustand)
- **Central Store**: `src/store/designStore.ts`
  - Manages canvas components (pools, pavers, boundaries, etc.)
  - Handles undo/redo history (last 50 states)
  - Controls zoom, pan, grid visibility, snap settings
  - Project loading/saving to Supabase
  - Auto-save interval: 30 seconds

### Canvas System (Konva/React-Konva)
- **Main Canvas**: `src/components/Canvas.tsx`
  - Renders all design components using Konva Stage/Layer
  - Handles tool interactions (select, hand, pool, paver, boundary, etc.)
  - Manages drawing states for polygon tools (boundary, house, paving area)
  - Smart snapping system via `src/utils/snap.ts`

- **Component Renderers**: `src/components/canvas/`
  - Each component type (pool, paver, fence, wall, etc.) has its own component
  - Components handle their own rendering, selection, drag, and rotation
  - **Click Detection Pattern**: All components use invisible hit rectangles for reliable clicking
    - Invisible `Rect` with `fill="transparent"` as first child in Group
    - Covers full component dimensions (width × height)
    - Extends slightly beyond visible bounds (typically +10px) for easier clicking
    - Ensures consistent click behavior across all component types

- **Render Order**: `src/constants/renderOrder.ts`
  - Components render in a fixed type-based layer order (z-index)
  - Order from back to front:
    1. Pavers & Paving Areas (layer 0)
    2. Pools (layer 1)
    3. Boundaries (layer 2) - Property lines, reference element
    4. Walls (layer 3)
    5. Drainage (layer 4)
    6. Fences (layer 5)
    7. Houses (layer 6)
    8. Reference Lines & Measurements (layer 7)
  - Within the same layer, components stack by creation order (newer on top)
  - The `sortComponentsByRenderOrder()` function automatically sorts components before rendering
  - No manual z-index control - layer is fixed by component type
  - Click detection uses `hitStrokeWidth` on line-based components (boundaries, houses, references) to avoid blocking clicks to lower layers

### Pool Coping System
The pool coping calculation is a corner-first system that provides visual display and material calculations:
- **Configuration**: `src/utils/copingCalculation.ts`
  - Global tile orientation (x/y dimensions)
  - Per-edge row counts (sides, shallow, deep)
  - MIN_CUT_MM = 200, GROUT_MM = 5
  - Corner-first layout with center-only cuts
  - Mirrored left/right and shallow/deep
- **Display**: Static visual representation of coping around pool edges
- **Calculations**: Provides full/partial paver counts and total area for materials summary

### Paving Area System
- **Fill Algorithm**: `src/utils/pavingFill.ts`
  - Fills arbitrary polygons with pavers using scanline approach
  - Calculates edge pavers with cut percentages
  - Wastage calculation and order quantities
  - Validates boundaries (must be closed, non-self-intersecting)

### Component Types & Tools
From `src/types/index.ts`:
- **pool**: Swimming pool with coping
- **paver**: Single paver or paver grid
- **paving_area**: Polygon filled with pavers
- **drainage**: Rock or ultradrain drainage lines
- **fence**: Glass/metal/boundary fences with gates
- **wall**: Timber/concrete/sandstone walls (proposed/existing)
- **boundary**: Property boundary polygon with labeled segments
- **house**: House footprint
- **reference_line**: Measurement reference lines
- **quick_measure**: Temporary measurement tool

### Routing & Authentication
- **App.tsx**: Main routing with protected routes
  - Public: `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`
  - Protected: `/projects`, `/project/:id`, `/settings/*`
- **Auth**: `src/hooks/useAuth.tsx` wraps Supabase auth
- **Project Permissions**: owner/admin/edit/view levels checked in `DesignCanvas.tsx`

### Project Storage
- **Local**: `src/utils/storage.ts` - localStorage for offline/fallback
- **Cloud**: Auto-saves to Supabase `projects` table every 30 seconds
- **Components Array**: Stored as JSONB in `projects.components`

### Export System
- **PDF**: `src/utils/pdfExport.ts` using jsPDF
- **Images**: `src/utils/imageExport.ts` (PNG/JPEG at various resolutions)
- Options include scale, grid, measurements, legend, summary, paper size

### DXF Import
`src/utils/dxfParser.ts` - Imports DXF files and converts to boundary components

## Key Development Patterns

### Adding a New Component Type
1. Add type to `ComponentType` union in `src/types/index.ts`
2. Add properties interface to `ComponentProperties`
3. Define render order in `src/constants/renderOrder.ts` (RENDER_ORDER constant)
4. Create component renderer in `src/components/canvas/YourComponent.tsx`
   - **IMPORTANT**: Add invisible hit rect as first child for click detection:
     ```tsx
     <Rect x={0} y={-5} width={componentWidth} height={componentHeight + 10} fill="transparent" />
     ```
   - Root Group must have `onClick={onSelect}` and `onTap={onSelect}`
   - Extends beyond visible bounds for easier clicking
5. Add to Canvas.tsx component mapping
6. Add tool to Toolbar.tsx
7. Update measurements calculation in `src/utils/measurements.ts`

### Working with History/Undo
- History is managed automatically in `designStore.ts`
- Each `addComponent`, `updateComponent`, `deleteComponent` pushes new state
- Keep last 50 states only (memory optimization)

### Coordinate System
- All measurements in millimeters (mm)
- Canvas uses pixel coordinates, converted via zoom/pan
- Grid snapping: `GRID_CONFIG` in `src/constants/grid.ts`

### Keyboard Shortcuts
Defined in `src/hooks/useKeyboardShortcuts.ts` and `DesignCanvas.tsx`:
- `v` - Select tool
- `h` - Hand (pan) tool
- `b` - Boundary
- `p` - Pool
- `a` - Paver
- `d` - Drainage
- `f` - Fence
- `w` - Wall
- `m` - Quick measure
- `r` - Reference line
- `Cmd/Ctrl+Z` - Undo
- `Cmd/Ctrl+Shift+Z` - Redo
- `Cmd/Ctrl+S` - Save
- `Delete/Backspace` - Delete selected

## Common Gotchas

### Pool Coping Extension
When modifying pool coping logic, understand that:
- Base coping is calculated from pool dimensions + config
- Extension pavers are separate and positioned relative to base pavers
- Corner pavers can extend in two directions (user picks via CornerDirectionPicker)
- Deleted pavers/rows must be tracked in `copingSelection.deletedPaverIds` and `deletedRows`
- Auto-extension only happens for pools without existing selections

### Paving Fill Performance
Large paving areas can be slow. The algorithm:
- Scans polygon row by row
- Calculates intersections for each row
- Places pavers and checks containment
- For very large areas, consider optimizing or warning users

### Zustand Store Updates
- Always update via store actions (`addComponent`, `updateComponent`, etc.)
- Never mutate `components` array directly
- Store pushes to history automatically - don't manually manage history in components

### TypeScript Configuration
`tsconfig.json` has relaxed settings:
- `noImplicitAny: false`
- `strictNullChecks: false`
- `noUnusedLocals: false`
- `noUnusedParameters: false`

When adding new code, follow existing patterns. Consider tightening strictness for new modules if desired.

## UI Components

Built with shadcn/ui (Radix UI + Tailwind CSS). Components are in `src/components/ui/`. Use existing UI components when building new features.

## Path Alias

`@/*` maps to `src/*` (configured in vite.config.ts and tsconfig.json). Always use this alias for imports within the project.

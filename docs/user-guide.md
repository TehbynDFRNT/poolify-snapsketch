# SnapSketch User Guide

A comprehensive guide to using the SnapSketch pool design and landscaping tool.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Canvas Navigation](#canvas-navigation)
3. [View Modes](#view-modes)
4. [Tools Overview](#tools-overview)
5. [Select & Pan](#select--pan-tool)
6. [Boundary](#boundary-tool)
7. [House](#house-tool)
8. [Pool](#pool-tool)
9. [Area (Pavers / Concrete / Grass)](#area-tool)
10. [Fence](#fence-tool)
11. [Drainage](#drainage-tool)
12. [Wall](#wall-tool)
13. [Measure](#measure-tool)
14. [Height](#height-tool)
15. [Decoration](#decoration-tool)
16. [Pool Coping System](#pool-coping-system)
17. [Properties Panel](#properties-panel)
18. [Saving & Auto-Save](#saving--auto-save)
19. [Undo & Redo](#undo--redo)
20. [Exporting](#exporting)
21. [Keyboard Shortcuts Reference](#keyboard-shortcuts-reference)
22. [Mobile & Touch](#mobile--touch)

---

## Getting Started

SnapSketch is a browser-based pool design tool built on an interactive canvas. You place and draw components — pools, boundaries, fences, walls, paving, drainage — then export professional drawings as PDF or image files.

All measurements are in **millimeters (mm)**. The canvas grid defaults to 100mm spacing with major lines every 1000mm (1 meter).

---

## Canvas Navigation

### Zooming

| Method | Action |
|--------|--------|
| Scroll wheel | Zoom in/out centered on cursor |
| Pinch gesture (touch) | Zoom in/out centered between fingers |
| Zoom buttons | + / - buttons in bottom panel |
| Fit to View | Resets zoom to 1x and pan to origin |

**Zoom range**: 0.1x to 4.0x

**Zoom Lock** (press **L**): Prevents accidental zooming while panning. Toggle via the lock icon in the bottom panel or the L key.

### Panning

| Method | Action |
|--------|--------|
| Hand tool (**H**) | Click and drag to pan |
| Shift + drag | Temporary pan while in Select mode (nothing selected) |
| Two-finger drag (touch) | Pan on touch devices |

### Bottom Panel Controls

The bottom panel shows:
- Current zoom percentage
- Zoom In / Out / Fit to View buttons
- Zoom lock toggle
- Undo / Redo buttons
- **Materials tab**: Auto-calculated quantities from your design
- **Notes tab**: Editable project notes

The panel is resizable — drag the top edge to expand or collapse it.

---

## View Modes

Toggle these independently via checkboxes in the top bar (desktop) or the hamburger menu (mobile).

### Grid

- **Toggle**: Checkbox in top bar or press **G**
- Shows a 100mm grid with major lines every meter
- Persists between sessions
- Components snap to grid when placed or dragged

### Satellite

- **Toggle**: Checkbox in top bar
- **Requires**: A geocoded property address (lat/lng)
- Displays Google Maps satellite imagery underneath the design
- **Compass Rotator** (bottom-left): Rotate satellite imagery to align with property orientation
- Automatically selects best zoom level based on your current view

### Annotations

- **Toggle**: Checkbox in top bar
- Shows measurement labels, component annotations, and text overlays
- On by default
- When off, measurements only appear on selected components

### Blueprint Mode

- **Toggle**: Checkbox in top bar
- Switches to a technical drawing style with monochromatic blue-tone colors
- Useful for construction documentation
- Decorations are hidden in blueprint mode
- Does not persist between sessions

---

## Tools Overview

All tools are accessed from the **left toolbar** (desktop) or the **floating bubble menu** (mobile). Many tools have sub-options accessible by **right-clicking** the tool button (desktop) or **tapping** the button (mobile/touch).

| Tool | Shortcut | Sub-options |
|------|----------|-------------|
| Select / Pan | **V** / **H** | Select, Hand |
| Boundary | **B** | — |
| House | **U** | — |
| Pool | **O** | — |
| Area | — | Pavers, Concrete, Grass |
| Fence | **F** | Glass, Metal, Gate |
| Drainage | **D** | Rock, Ultradrain |
| Wall | **W** | Timber, Concrete, Concrete Sleeper, Sandstone |
| Measure | **M** | Measure, Height |
| Decoration | **C** | Bush, Umbrella, Water Feature, Deck Chairs |

---

## Select & Pan Tool

### Select (V)

The default tool. Use it to interact with placed components.

- **Click a component** to select it — a blue outline and drag handles appear
- **Click empty canvas** to deselect
- **Drag a selected component** to reposition it (snaps to grid)
- **Press Delete/Backspace** to remove the selected component
- **Arrow keys** move selected component by 2.5mm per press
- **Shift + Arrow keys** move by 25mm per press (10x faster)

### Pan (H)

Activates continuous panning mode.

- Click and drag anywhere on the canvas to move the viewport
- Cursor changes to a grab hand
- Alternatively, hold **Shift** while in Select mode and drag (only works when nothing is selected)

---

## Boundary Tool

**Shortcut**: B

Draws the property boundary as a polygon. **Only one boundary is allowed per project** — the tool is disabled once a boundary exists.

### How to Draw

1. Press **B** to activate
2. Click to place the first point
3. Click to add more points — a preview line follows your cursor
4. **Hold Shift** while placing points to lock to horizontal or vertical lines
5. To **close the shape**: click near the first point (within ~15px) when you have 3+ points
6. To **finish as an open shape**: press **Enter** with 2+ points
7. Press **Escape** to cancel, or **Z** to undo the last point

### After Placement

- Select the boundary to see edge measurements
- **Shift + drag a node** to edit the shape
- **Open boundaries** show green circles at endpoints — click one to extend from that end
- Edge lengths display automatically when selected or when annotations are visible

---

## House Tool

**Shortcut**: U

Draws a house footprint as a closed polygon.

### How to Draw

1. Press **U** to activate
2. Click to place points forming the house outline
3. **Must be closed** — click near the first point to finish (houses cannot be open shapes)
4. Press **Enter** to auto-close (3+ points required)
5. Hold **Shift** to lock to horizontal/vertical axes

### After Placement

- Displays calculated area in m^2 inside the shape
- Light gray fill with black outline
- **Shift + drag nodes** to edit the shape
- Edge measurements display when selected

---

## Pool Tool

**Shortcut**: O

Places a pool from the pool catalog.

### How to Place

1. Press **O** to activate
2. Click on the canvas where you want the pool
3. A **Pool Selector** dialog opens with the available pool library
4. Choose a pool design and configure coping options
5. Confirm to place the pool

### After Placement

- Pool renders with its outline, deep end (DE) and shallow end (SE) markers
- Edge measurements display along pool walls
- If coping is enabled, a ring of tiles renders around the pool edge
- Select the pool to see a green boundary polygon with draggable nodes for extending the coping area
- **Shift + click on a coping boundary line** to insert a new node

See [Pool Coping System](#pool-coping-system) for details on coping configuration.

---

## Area Tool

**Right-click** the Area button to choose: **Pavers**, **Concrete**, or **Grass**.

Draws a filled polygon representing a surface area.

### Sub-Types

| Type | Color | Use |
|------|-------|-----|
| Pavers | Sandstone/tan | Pool surrounds, walkways |
| Concrete | Light gray | Driveways, hardscaping |
| Grass | Green | Lawn areas |

### How to Draw

1. Select the area type from the toolbar sub-menu
2. Click to place polygon points
3. Close the shape by clicking near the first point or pressing **Enter**
4. The area fills with the selected surface type

### After Placement

- Displays total area (m^2) and perimeter (linear meters)
- **Shift + drag vertices** to modify the shape
- Measurements update in real-time during editing

---

## Fence Tool

**Shortcut**: F

Draws fence lines. Right-click the Fence button to choose: **Glass**, **Metal**, or **Gate**.

### Sub-Types

| Type | Color | Details |
|------|-------|---------|
| Glass | Blue | Translucent panes with metal feet, 80mm gaps between panels |
| Metal | Gray | Solid band with square posts at panel boundaries, 50mm gaps |
| Gate | — | Door/gate opening in fence line |

### How to Draw

**Single segment**: Click once to place a 2400mm fence segment.

**Multi-segment**: Click multiple points to create connected segments, then press **Enter** to finish.

### After Placement

- Per-segment measurements in mm
- Total length in linear meters
- Glass fences render individual panels with posts
- Metal fences render as a solid band with posts at boundaries
- **Shift + drag nodes** to edit the polyline
- Drag the right handle on straight fences to extend/shorten

---

## Drainage Tool

**Shortcut**: D

Draws drainage lines. Right-click to choose: **Rock** or **Ultradrain**.

### Sub-Types

| Type | Width | Appearance |
|------|-------|------------|
| Rock | 100mm | Random pea gravel pattern (light gray) |
| Ultradrain | 100mm | Vertical slat/perforated pattern (silver) |

### How to Draw

**Single segment**: Click once to place a 1000mm drainage line.

**Multi-segment**: Click multiple points, then press **Enter**.

### After Placement

- Per-segment length measurements
- Total length in linear meters
- **Shift + drag nodes** to edit the path
- Drag right handle to extend straight drainage

---

## Wall Tool

**Shortcut**: W

Draws retaining walls. Right-click to choose material: **Timber**, **Concrete**, **Concrete Sleeper**, or **Sandstone**.

### Sub-Types

| Material | Color | Label |
|----------|-------|-------|
| Timber | Brown | Timber |
| Concrete | Light gray | Drop Edge |
| Concrete Sleeper | Medium gray | Concrete Sleeper |
| Sandstone | Tan | Sandstone |

### How to Draw

**Single segment**: Click once to place a 1000mm wall.

**Multi-segment**: Click multiple points, then press **Enter**.

### After Placement

- Per-segment length measurements
- Height annotations can be stored per node (displayed as A:, B:, C: labels)
- **Shift + drag nodes** to edit the path
- Drag right handle to extend straight walls

---

## Measure Tool

**Shortcut**: M

Creates measurement reference lines on the canvas.

### How to Use

1. Press **M** to activate
2. Click to set the start point
3. Move the mouse — a live distance preview follows your cursor
4. Click again to set the end point
5. A red measurement line appears with the distance in mm

**Hold Shift** while placing the end point to lock to horizontal or vertical.

### After Placement

- **Length (mm)**: Editable in properties panel — adjusting maintains the angle
- **Annotation**: Optional text label (e.g., "Width: 1500mm")
- Drag endpoints to reposition
- **Shift + drag endpoint**: Rotate around the other endpoint (hinge mode) while maintaining length

---

## Height Tool

Accessed via the Measure sub-menu (right-click Measure button, select **Height**).

### How to Use

1. Open the Measure sub-menu and select Height
2. Click on the canvas to place a height marker
3. Default height: 100mm

### Visual Appearance

- Diagonal slash at the base (marks the 0 point)
- Vertical line extending upward proportional to the height value
- Horizontal cap at the top
- Red color (blue in blueprint mode)

### After Placement

- **Height (mm)**: Editable in properties panel
- **Annotation**: Optional label text

---

## Decoration Tool

**Shortcut**: C

Places decorative elements on the design. Right-click to choose: **Bush**, **Umbrella**, **Water Feature**, or **Deck Chairs**.

### How to Use

1. Press **C** or right-click the Decoration button
2. Select a decoration type
3. Click on the canvas to place it
4. Snaps to grid automatically

### Notes

- Decorations render as PNG images at scale
- **Hidden in Blueprint mode** — they disappear entirely
- Can be dragged to reposition after placement

---

## Pool Coping System

When a pool is placed with coping enabled, a ring of tiles renders around the pool edge.

### Configuration

- **Tile Size**: 400x400mm or 400x600mm
- **Rows Per Side**: 1-3 rows of tiles per pool edge
- **Tile Orientation**: Vertical or horizontal
- **Grout Gap**: 5mm between tiles
- **Minimum Cut**: 200mm (tiles won't be cut smaller than this)

### Editing Coping

- **Select the pool** to see the green coping boundary polygon
- **Drag boundary nodes** to extend or contract the coping area
- **Shift + click on a boundary edge** to insert a new node

### Coping Statistics

Automatically calculated:
- Base coping area (m^2)
- Extension area (m^2)
- Total area (m^2)
- Tile counts

---

## Properties Panel

When you select a component, a floating properties card appears showing editable settings.

### Common Properties

- **Position**: X, Y coordinates (mm)
- **Rotation**: Degrees
- **Dimensions**: Width, height

### Component-Specific Properties

Each component type shows additional relevant settings (pool coping config, wall material, fence type, paver size, measurement annotation, etc.).

### Context Menu

**Right-click** on any component to access:
- Delete
- Add annotation

---

## Saving & Auto-Save

### Auto-Save

- Triggers 500ms after any change (debounced)
- Also runs every 30 seconds as a fallback
- Saves to Supabase cloud storage
- Status indicator in top bar: "Auto-saved: X minutes ago"

### Manual Save

- **Shortcut**: Ctrl/Cmd + S
- **Button**: Save button in top bar
- Toast notification confirms success

### Unsaved Changes Warning

If you try to leave the page with unsaved changes, the browser will show a confirmation dialog.

---

## Undo & Redo

- **Undo**: Ctrl/Cmd + Z (up to 50 states)
- **Redo**: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
- History is maintained per project and persists in localStorage
- Undo/Redo buttons also available in the bottom panel

Operations that create history entries: adding, updating, or deleting components.

Operations that don't: dragging (until release), selection changes, drawing previews.

---

## Exporting

Access via the **Export** button in the top bar.

### PDF Export

- Format: A4 landscape
- Includes: Header (project name, address, date), design drawing, component legend, materials summary
- Optional: Legend, materials summary, measurements
- Output: `{CustomerName}_PoolDesign.pdf`

### Image Export (PNG / JPEG)

- Formats: PNG (transparent background) or JPEG (white background)
- Resolutions: 1080p, 4K, 8K
- Same layout as PDF
- Output: `{CustomerName}_PoolDesign.{ext}`

### DXF Import

Import AutoCAD drawings via file upload.

---

## Keyboard Shortcuts Reference

### Tool Selection

| Key | Tool |
|-----|------|
| **V** | Select |
| **H** | Hand / Pan |
| **B** | Boundary |
| **U** | House |
| **O** | Pool |
| **A** | Paver |
| **F** | Fence |
| **D** | Drainage |
| **W** | Wall |
| **M** | Measure |
| **C** | Decoration |

### Global

| Keys | Action |
|------|--------|
| **Ctrl/Cmd + Z** | Undo |
| **Ctrl/Cmd + Shift + Z** | Redo |
| **Ctrl/Cmd + S** | Save |
| **Delete** / **Backspace** | Delete selected |
| **Escape** | Deselect / Cancel drawing |
| **G** | Toggle grid |
| **L** | Toggle zoom lock |

### While Drawing

| Keys | Action |
|------|--------|
| **Enter** | Finish shape |
| **Escape** | Cancel drawing |
| **Z** | Undo last point |
| **Shift** | Lock to horizontal/vertical axis |

### Selected Component

| Keys | Action |
|------|--------|
| **Arrow keys** | Move 2.5mm |
| **Shift + Arrow keys** | Move 25mm |
| **Shift + drag node** | Edit polygon vertices |

---

## Mobile & Touch

On smaller screens, the interface adapts:

- **Floating bubble menu** replaces the left toolbar — tap to open, select a tool
- **Hamburger menu** in the top bar contains view toggles (grid, satellite, annotations, blueprint)
- **Pinch** to zoom, **two-finger drag** to pan
- **Shift toggle button** (floating) replaces the physical Shift key for axis-locking and node editing
- **Tap** a tool button to open its sub-menu (instead of right-click)
- **Long-press** a tool button to access sub-options

All touch targets are sized for comfortable interaction (minimum 44x44px).

---

## Render Order

Components are rendered in a fixed order (bottom to top). You cannot manually change z-order.

1. Satellite imagery
2. Grid
3. Pavers & Paving Areas
4. Pools
5. Boundaries
6. Walls
7. Drainage
8. Fences
9. Houses
10. Decorations
11. Reference Lines / Measurements / Heights

The currently selected component always renders on top regardless of type.

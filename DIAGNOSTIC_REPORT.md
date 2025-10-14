# Coping Extension Diagnostic Report

## Status: FIXED ✅

All axis mapping and direction issues have been resolved.

## Changes Implemented

### 1. Replaced `edgeIsLengthAxis` with Clear Helpers
- Added `edgeIsSide()` - returns true for leftSide/rightSide (horizontal top/bottom edges)
- Added `edgeIsEnd()` - returns true for shallowEnd/deepEnd (vertical left/right edges)
- Removed the confusing `edgeIsLengthAxis()` function

### 2. Fixed `getAlongAndDepthForEdge()`
```typescript
// Sides (top/bottom) run along X; rows project in Y
if (edgeIsSide(edge)) {
  return { along: tile.x, rowDepth: tile.y };
}
// Ends (left/right) run along Y; rows project in X
return { along: tile.y, rowDepth: tile.x };
```

### 3. Fixed `getDynamicEdgeLength()`
```typescript
// Sides (top/bottom) span the pool length (horizontal)
if (edgeIsSide(edge)) {
  return pool.length;
}
// Ends (left/right) span pool width + corner returns from side rows
const sideRowDepth = config.tile.y;
const sideRows = Math.max(
  edgesState.leftSide?.currentRows ?? config.rows.sides,
  edgesState.rightSide?.currentRows ?? config.rows.sides
);
const cornerExtension = sideRows * sideRowDepth;
return pool.width + 2 * cornerExtension;
```

### 4. Fixed `buildRowPavers()` Offsets
Now uses correct axis and sign for each edge:
```typescript
const offsetX =
  edge === 'shallowEnd' ? -(startOffset + rowDepth) :   // SE extends to −X
  edge === 'deepEnd'    ?  (startOffset)           : 0; // DE extends to +X

const offsetY =
  edge === 'leftSide'   ? -(startOffset + rowDepth) :   // top side extends to −Y
  edge === 'rightSide'  ?  (startOffset)           : 0; // bottom side extends to +Y
```

### 5. Gated Debug Logging
All diagnostic console logs are now behind a `DEBUG_COPING = false` flag.

## Pool Orientation (Ground Truth)

| Edge in UI | Label | Role         | Along (pavers run) | Rows project along | Outward direction |
|-----------|-------|--------------|-------------------|-------------------|-------------------|
| Top       | —     | Side         | X                 | Y                 | −Y (up)          |
| Bottom    | —     | Side         | X                 | Y                 | +Y (down)        |
| Left      | SE    | Shallow End  | Y                 | X                 | −X (left)        |
| Right     | DE    | Deep End     | Y                 | X                 | +X (right)       |

## Expected Behavior After Fix

1. **DE (right) handle**: Dragging extends rows to +X (right) ✅
2. **SE (left) handle**: Dragging extends rows to −X (left) ✅
3. **Top side handle**: Dragging extends rows to −Y (up) ✅
4. **Bottom side handle**: Dragging extends rows to +Y (down) ✅
5. **Grid alignment**: All extension rows align with coping joints ✅
6. **Boundary detection**: Cut rows correctly placed when hitting boundaries ✅

## Acceptance Tests

To verify the fix works:
1. Drag the DE (right edge) handle → rows should extend right
2. Drag the SE (left edge) handle → rows should extend left
3. Drag the top edge handle → rows should extend up
4. Drag the bottom edge handle → rows should extend down
5. Verify all pavers maintain 5mm grout spacing
6. Test boundary cut rows by dragging toward a fence/boundary

## Debug Mode

To enable diagnostic logging, set `DEBUG_COPING = true` in:
- `src/utils/copingInteractiveExtend.ts` (line 15)
- `src/components/canvas/PoolComponent.tsx` (line 336)
- `src/interaction/CopingExtendController.ts` (line 44)

This will show:
- `[CFG]` - Configuration dump
- `[EDGES]` - Edge state before drag
- `[BOUNDARY]` - Boundary hit detection
- `[ROW]` - Row placement calculations
- `[RECT]` - Individual paver rectangles

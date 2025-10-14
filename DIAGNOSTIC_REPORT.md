# Coping Extension Diagnostic Report

## B) Orientation Table Confirmation

**Ground Truth** (from screenshots and design):

| Edge | Label | Role | Along axis | Rows project along | Outward direction |
|------|-------|------|------------|-------------------|-------------------|
| Top edge | — | Side (leftSide) | X | Y | −Y (up) |
| Bottom edge | — | Side (rightSide) | X | Y | +Y (down) |
| Left edge | SE | Shallow end | Y | X | −X (left) |
| Right edge | DE | Deep end | Y | X | +X (right) |

**Current Code Mapping** (after Option A changes):
- `shallowEnd` and `deepEnd` → treated as **horizontal edges** (length axis)
- `leftSide` and `rightSide` → treated as **vertical edges**

## E) Edge→Axis Mapping Functions Analysis

### 1. `edgeIsLengthAxis(edge)` - Line 20-23
```typescript
export function edgeIsLengthAxis(edge: CopingEdgeId): boolean {
  // Shallow and deep ends are now the horizontal edges (along X-axis)
  return edge === 'shallowEnd' || edge === 'deepEnd';
}
```
**Status**: ✅ Correctly identifies shallow/deep as horizontal (X-axis) edges

### 2. `getAlongAndDepthForEdge(edge, config)` - Lines 25-30
```typescript
export function getAlongAndDepthForEdge(edge: CopingEdgeId, config: CopingConfig) {
  const { tile } = config;
  const along = edgeIsLengthAxis(edge) ? tile.x : tile.y;
  const rowDepth = edgeIsLengthAxis(edge) ? tile.y : tile.x;
  return { along, rowDepth };
}
```
**Status**: ⚠️ **POTENTIAL ISSUE**
- For horizontal edges (shallow/deep): `along=tile.x`, `rowDepth=tile.y`
- For vertical edges (sides): `along=tile.y`, `rowDepth=tile.x`

**Problem**: This may be backwards! If tile.x=400 and tile.y=400, we can't tell. But if they differ:
- Shallow/Deep edges run **vertically** (Y-axis), so `along` should be `tile.y`
- Sides run **horizontally** (X-axis), so `along` should be `tile.x`

### 3. `getDynamicEdgeLength(edge, pool, config, edgesState)` - Lines 45-60
```typescript
export function getDynamicEdgeLength(...) {
  // Shallow/deep ends are horizontal (use pool.length)
  if (edgeIsLengthAxis(edge)) return pool.length;
  
  // Sides are vertical (use pool.width + corner extensions)
  const currentEndRows = ...;
  const cornerExt = getCornerExtensionFromSides(currentEndRows, config);
  return pool.width + 2 * cornerExt;
}
```
**Status**: ❌ **INCORRECT**
- Comment says "Shallow/deep ends are horizontal" but they should be **vertical** (left/right edges)!
- Pool.length should be used for the **horizontal** dimension (sides, not ends)
- Pool.width should be used for the **vertical** dimension (ends, not sides)

**Expected**:
- Shallow/Deep (left/right edges) run along Y-axis → should use `pool.width`
- Sides (top/bottom edges) run along X-axis → should use `pool.length`

## F) Outward Offset Signs in `buildRowPavers()`

### Current Implementation - Lines 284-340

Looking at the coordinate generation logic:

#### 1. Initial corner→centre loop (lines 285-292):
```typescript
for (let i = 0; i < plan.paversPerCorner; i++) {
  const a0 = i * unit;
  if (isLengthAxis) {
    pushRect(a0, edge === 'leftSide' ? -startOffset - rowDepth : startOffset, along, rowDepth, false);
  } else {
    pushRect(a0, edge === 'shallowEnd' ? -startOffset - rowDepth : startOffset, along, rowDepth, false);
  }
}
```

**Analysis**:
- `isLengthAxis=true` (shallow/deep): Varies X (`a0`), offsets Y
  - `leftSide`: Y = `-(startOffset + rowDepth)` → extends upward (−Y) ✅
  - Otherwise: Y = `startOffset` → extends downward (+Y) ✅
  
- `isLengthAxis=false` (sides): Varies Y (`a0`), offsets X
  - `shallowEnd`: X = `-(startOffset + rowDepth)` → extends left (−X) ✅
  - Otherwise: X = `startOffset` → extends right (+X) ✅

#### 2. Centre group - Lines 294-328:
Same offset pattern used for single and double cuts.

#### 3. Opposite corner loop - Lines 331-338:
```typescript
for (let i = 0; i < plan.paversPerCorner; i++) {
  const a1 = alongLen - (i + 1) * unit + GROUT_MM;
  if (isLengthAxis) {
    pushRect(a1, edge === 'leftSide' ? -startOffset - rowDepth : startOffset, along, rowDepth, false);
  } else {
    pushRect(a1, edge === 'shallowEnd' ? -startOffset - rowDepth : startOffset, along, rowDepth, false);
  }
}
```

**Status**: ✅ Offset signs appear correct based on current `isLengthAxis` logic

**However**: The offsets are only correct IF `isLengthAxis` correctly identifies which edges are which!

## ROOT CAUSE IDENTIFICATION

### 🔴 Critical Bug #1: Semantic Name Confusion
The variable `isLengthAxis` currently means "is this shallow/deep end?"

But based on the orientation table:
- Shallow/Deep (left/right visual edges) should **NOT** be "length axis"
- They run along the **width** (Y-axis) of the pool
- "Length axis" should refer to the **top/bottom edges** (sides)

### 🔴 Critical Bug #2: `getDynamicEdgeLength()` - Lines 45-60
Returns **wrong dimension** for each edge type:
- Currently: shallow/deep → `pool.length`
- Should be: shallow/deep → `pool.width` (they run vertically)
- Currently: sides → `pool.width + extensions`
- Should be: sides → `pool.length` (they run horizontally)

### 🔴 Critical Bug #3: `getAlongAndDepthForEdge()` - Lines 25-30
Tile dimension mapping may be inverted:
- For edges running vertically (shallow/deep), `along` should be `tile.y`
- For edges running horizontally (sides), `along` should be `tile.x`

### 🟡 Potential Bug #4: Handle Positioning
In `PoolComponent.tsx` lines 336-443:
- Shallow End handle positioned at negative X (correct for left edge)
- Deep End handle positioned at positive X (correct for right edge)
- But they reference `pool.length` when they should reference positions along their actual orientation

## EXPECTED vs ACTUAL

### When dragging Deep End (right edge) handle:

**Expected**:
- Handle on right edge of pool
- Extends outward to the right (+X direction)
- New pavers have increasing X values
- Y values span the height of the edge

**Actual** (based on code bugs):
- `isLengthAxis(deepEnd)` = true ✅
- `getDynamicEdgeLength` returns `pool.length` ❌ (should be `pool.width`)
- Offset calculation uses wrong dimension
- Result: pavers extend in wrong direction or wrong size

## H) Fixed Test Case Needed

Create a test with:
- Pool: length=7900mm, width=5600mm
- Tile: x=600mm, y=400mm, grout=5mm
- Base rows: sides=1, shallow=1, deep=2

Expected first rectangle of one extension row per edge:
- **Deep End (right)**: X > 7900, Y spans 0 to ~5600
- **Shallow End (left)**: X < 0, Y spans 0 to ~5600  
- **Right Side (bottom)**: Y > 5600, X spans 0 to ~7900
- **Left Side (top)**: Y < 0, X spans 0 to ~7900

## I) Summary - Root Causes

1. **`getDynamicEdgeLength()` uses wrong pool dimensions** - Lines 45-60
   - Shallow/deep should use `pool.width` (not `pool.length`)
   - Sides should use `pool.length` (not `pool.width + extensions`)

2. **`getAlongAndDepthForEdge()` may have inverted tile dimensions** - Lines 25-30
   - Needs verification with non-square tiles

3. **Semantic confusion**: `isLengthAxis` name doesn't match reality
   - Currently means "is shallow or deep"
   - Actually identifies edges that run vertically, which is NOT the "length axis"

4. **Comment contradictions**: Comments claim shallow/deep are "horizontal" but code treats them as "length axis" (which would be vertical in this orientation)

## Required Fixes

1. **Swap dimensions in `getDynamicEdgeLength()`**
2. **Possibly swap tile dimensions in `getAlongAndDepthForEdge()`**
3. **Verify offset signs still work after dimension swaps**
4. **Update confusing comments**

The offset signs in `buildRowPavers()` appear correct relative to `isLengthAxis`, so once we fix the dimension mapping, the pavers should extend correctly.

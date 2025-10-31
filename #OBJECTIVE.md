Below is a *drop‑in* implementation plan with concrete code you can paste into **`PoolComponent.tsx`** to get: corner + freeform nodes that snap to the canvas grid, shift‑click to add nodes, and **auto‑extension of coping tiles** (atomic tiles) out to the edited polygonal boundary—while preserving the existing atomic model, grout spacing, overlap prevention, and cut classification.

> **What you’ll get**
>
> * 4 boundary nodes (corners) on the pool object.
> * Nodes **snap to the canvas grid** (not to tile rows).
> * Shift+click on an edge inserts a new node.
> * Dragging nodes **auto‑generates tiles** (as atomic rectangles) outward to the edited boundary; tiles are cut on the inner pool shape and at the new boundary.
> * All generated tiles still follow grout spacing and overlap checks.
> * You keep manual extensions (`copingTiles`) as a separate layer; auto‑generated tiles are *ephemeral* (not deletable, like paving‑area’s masked tiles). Deletion still only applies to user‑added rows (`:user:` keys).

---

## 1) Add imports

At the top of **`PoolComponent.tsx`** add:

```ts
import { GRID_CONFIG } from '@/constants/grid';
import { roundHalf } from '@/utils/canvasSnap';
```

---

## 2) Add geometry helpers (stage‑space; copied/adapted from `PavingAreaComponent`)

Paste these **above** the component function (or into a new module and import). They work in **stage units** (the same “canvas content” units you render with; recall we use `scale = 0.1` px/mm inside the Pool component).

```ts
type Pt = { x: number; y: number };

function pointInPolygon(point: Pt, polygon: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect =
      (yi > point.y) !== (yj > point.y) &&
      point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function onSegment(p: Pt, q: Pt, r: Pt) {
  return (
    q.x <= Math.max(p.x, r.x) + 1e-6 &&
    q.x + 1e-6 >= Math.min(p.x, r.x) &&
    q.y <= Math.max(p.y, r.y) + 1e-6 &&
    q.y + 1e-6 >= Math.min(p.y, r.y)
  );
}
function orientation(p: Pt, q: Pt, r: Pt) {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (Math.abs(val) < 1e-9) return 0;
  return val > 0 ? 1 : 2;
}
function segmentsIntersect(p1: Pt, q1: Pt, p2: Pt, q2: Pt) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

function rectCorners(r: { x: number; y: number; w: number; h: number }): Pt[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}

function isPointNearPolygonBoundary(pt: Pt, poly: Pt[], tol = 2): boolean {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const L2 = dx*dx + dy*dy;
    if (L2 < 1e-6) continue;
    const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / (L2 || 1e-9)));
    const px = a.x + t * dx, py = a.y + t * dy;
    const d2 = (pt.x - px) ** 2 + (pt.y - py) ** 2;
    if (d2 <= tol * tol) return true;
  }
  return false;
}

function rectFullyInsidePolygon(rect: { x: number; y: number; w: number; h: number }, poly: Pt[]): boolean {
  const inset = 0.5; // keep crisp, avoid float jitter
  const r = { x: rect.x + inset, y: rect.y + inset, w: Math.max(1, rect.w - 2*inset), h: Math.max(1, rect.h - 2*inset) };
  const corners = rectCorners(r);
  return corners.every(c => pointInPolygon(c, poly) || isPointNearPolygonBoundary(c, poly, 1.5));
}

function rectIntersectsPolygon(rect: { x: number; y: number; w: number; h: number }, poly: Pt[]): boolean {
  const corners = rectCorners(rect);
  // any 2 corners in/on poly ⇒ meaningful overlap
  let inOrOn = 0;
  for (const c of corners) if (pointInPolygon(c, poly) || isPointNearPolygonBoundary(c, poly, 1.5)) inOrOn++;
  if (inOrOn >= 2) return true;

  // polygon vertex inside rect?
  const inRect = (p: Pt) => p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
  if (poly.some(inRect)) return true;

  // edge intersections
  const edges: [Pt, Pt][] = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    for (const [r1, r2] of edges) if (segmentsIntersect(a, b, r1, r2)) return true;
  }
  return false;
}
```

---

## 3) New boundary state, default rectangle, and grid snap

Inside the component function, add:

```ts
// --- Boundary (outer limit) for auto-extensions ---

// scale is already defined as 0.1 (px per mm)
const gridSize = GRID_CONFIG.spacing; // canvas grid spacing in stage units

const snapToCanvasGrid = (v: number) => Math.round(v / gridSize) * gridSize;

// Default boundary: rectangle around current coping extents (base ring only)
const defaultBoundary: Pt[] = useMemo(() => {
  // Use calculated coping tiles (base ring only) to get extents (stage units)
  const base: Array<{ x: number; y: number; width: number; height: number }> = [
    ...(copingCalc?.leftSide?.paverPositions || []),
    ...(copingCalc?.rightSide?.paverPositions || []),
    ...(copingCalc?.shallowEnd?.paverPositions || []),
    ...(copingCalc?.deepEnd?.paverPositions || [])
  ].map(p => ({
    x: p.x * scale, y: p.y * scale, width: p.width * scale, height: p.height * scale
  }));

  // Fallback to pool rect if no coping
  if (base.length === 0) {
    const minX = 0, minY = 0, maxX = poolData.length * scale, maxY = poolData.width * scale;
    const pad = 8;
    return [
      { x: minX - pad, y: minY - pad },
      { x: maxX + pad, y: minY - pad },
      { x: maxX + pad, y: maxY + pad },
      { x: minX - pad, y: maxY + pad },
    ];
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  base.forEach(r => {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  });
  const pad = 8; // small click/visibility padding
  return [
    { x: minX - pad, y: minY - pad },
    { x: maxX + pad, y: minY - pad },
    { x: maxX + pad, y: maxY + pad },
    { x: minX - pad, y: maxY + pad },
  ];
}, [copingCalc, poolData.length, poolData.width, scale]);

// Persisted outer boundary (stage-space, group-local)
const copingBoundary: Pt[] = (component.properties.copingBoundary as Pt[]) || defaultBoundary;

// Initialize once if missing
useEffect(() => {
  if (!component.properties.copingBoundary) {
    updateComponent(component.id, {
      properties: { ...component.properties, copingBoundary: defaultBoundary }
    });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

---

## 4) Node UI + editing (drag with grid snap, shift+click to insert node)

Add local UI state and handlers:

```ts
// Node editing state
const [boundaryPreview, setBoundaryPreview] = useState<Pt[] | null>(null);
const boundaryLive = boundaryPreview || copingBoundary;

const setBoundary = (pts: Pt[]) => {
  updateComponent(component.id, {
    properties: { ...component.properties, copingBoundary: pts }
  });
};

// Insert a node on the edge nearest to point p (stage-space, local to group)
const insertNodeAt = (p: Pt) => {
  const pts = [...copingBoundary];
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    // projection of p onto segment ab
    const ax = a.x, ay = a.y, bx = b.x, by = b.y;
    const dx = bx - ax, dy = by - ay;
    const L2 = dx*dx + dy*dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / L2));
    const px = ax + t * dx, py = ay + t * dy;
    const d2 = (p.x - px)**2 + (p.y - py)**2;
    if (d2 < bestDist) { bestDist = d2; bestIdx = i; }
  }
  if (bestIdx >= 0) {
    const snapped = { x: snapToCanvasGrid(p.x), y: snapToCanvasGrid(p.y) };
    const next = [...pts.slice(0, bestIdx + 1), snapped, ...pts.slice(bestIdx + 1)];
    setBoundary(next);
  }
};

// Boundary line shift-click handler
const onBoundaryLineMouseDown = (e: any) => {
  if (!e.evt.shiftKey) return;
  e.cancelBubble = true; e.evt.preventDefault();
  const stage = e.target.getStage();
  const pr = stage?.getPointerPosition();
  if (!pr) return;
  const tr = groupRef.current?.getAbsoluteTransform().copy().invert();
  const local = tr ? tr.point(pr) : { x: pr.x, y: pr.y };
  insertNodeAt(local);
};

// Node drag handlers
const onNodeDragMove = (idx: number, e: any) => {
  e.cancelBubble = true;
  const pts = (boundaryPreview || copingBoundary).map(p => ({ ...p }));
  const x = snapToCanvasGrid(e.target.x());
  const y = snapToCanvasGrid(e.target.y());
  pts[idx] = { x, y };
  setBoundaryPreview(pts);
};
const onNodeDragEnd = (idx: number, e: any) => {
  e.cancelBubble = true;
  const pts = (boundaryPreview || copingBoundary);
  setBoundary(pts);
  setBoundaryPreview(null);
};
```

**Render the boundary polyline + nodes** (inside the `Group` alongside your pool/coping content):

```tsx
{/* Boundary polygon for auto extension (visible when selected) */}
{isSelected && (
  <>
    <Line
      points={boundaryLive.flatMap(p => [p.x, p.y])}
      stroke="#10B981"
      strokeWidth={2}
      strokeScaleEnabled={false}
      dash={[8, 6]}
      closed
      onMouseDown={onBoundaryLineMouseDown}
    />
    {boundaryLive.map((p, i) => (
      <Circle
        key={`bnode-${i}`}
        x={p.x}
        y={p.y}
        radius={Math.max(2, 4.2 / (zoom || 1))}
        fill="#10B981"
        stroke="#fff"
        strokeWidth={2}
        strokeScaleEnabled={false}
        draggable
        dragBoundFunc={(pos) => ({
          x: snapToCanvasGrid(pos.x),
          y: snapToCanvasGrid(pos.y),
        })}
        onDragMove={(e) => onNodeDragMove(i, e)}
        onDragEnd={(e) => onNodeDragEnd(i, e)}
      />
    ))}
  </>
)}
```

> Nodes snap to **canvas grid**, not to tile rows. Edges can be any direction (freeform polygon).

---

## 5) Auto‑generate atomic tiles to the edited boundary

We keep **manual extension tiles** in `properties.copingTiles` (unchanged) and **auto tiles** **ephemeral** (computed from the boundary every render). They are included in rendering, grout, clickable bounds, and measurements; but (by design) **not deletable** (only `:user:` tiles are deletable today).

### 5.1 Build helpers to (a) unify all existing tiles, (b) detect overlaps, and (c) generate rows out to the boundary.

Add these inside the component function:

```ts
type Side = 'top' | 'bottom' | 'left' | 'right';
type MMTile = { x: number; y: number; width: number; height: number; isPartial: boolean; side: Side };
type StageRect = { x: number; y: number; w: number; h: number };

// Convert mm tile -> stage rect
const mmToStageRect = (t: { x: number; y: number; width: number; height: number }): StageRect => ({
  x: roundHalf(t.x * scale),
  y: roundHalf(t.y * scale),
  w: Math.max(1, roundHalf(t.width * scale)),
  h: Math.max(1, roundHalf(t.height * scale)),
});

// Existing tiles (base ring + user)
const userTilesMM = (component.properties.copingTiles || []) as MMTile[];

// Build per-side base ring in MM (from coping calc)
const baseTilesMM: Record<Side, MMTile[]> = {
  top: (copingCalc?.leftSide?.paverPositions || []).map((p) => ({ ...p, side: 'top' as const })),
  bottom: (copingCalc?.rightSide?.paverPositions || []).map((p) => ({ ...p, side: 'bottom' as const })),
  left: (copingCalc?.shallowEnd?.paverPositions || []).map((p) => ({ ...p, side: 'left' as const })),
  right: (copingCalc?.deepEnd?.paverPositions || []).map((p) => ({ ...p, side: 'right' as const })),
};

// Union existing tiles (for overlap filtering)
const existingStageRects: StageRect[] = useMemo(() => {
  const all: MMTile[] = ([] as MMTile[])
    .concat(baseTilesMM.top, baseTilesMM.bottom, baseTilesMM.left, baseTilesMM.right)
    .concat(userTilesMM);
  return all.map(mmToStageRect);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [copingCalc, component.properties.copingTiles, scale]);

const stageOverlaps = (a: StageRect, b: StageRect, eps = 0.5) => {
  const ax1 = a.x, ay1 = a.y, ax2 = a.x + a.w, ay2 = a.y + a.h;
  const bx1 = b.x, by1 = b.y, bx2 = b.x + b.w, by2 = b.y + b.h;
  return ax1 < bx2 - eps && ax2 > bx1 + eps && ay1 < by2 - eps && ay2 > by1 + eps;
};
```

### 5.2 Generate auto‑tiles from the boundary

Key ideas:

* For each **side**, find the **current outermost row** (considering base ring + user rows).
* Step outward along that side’s axis by **(tileDepth + grout)**; at each step, **replicate** the row’s tiles; **keep** only those that intersect the edited **outer boundary** polygon; **mark partial** if the rect isn’t fully inside the boundary.
* **Skip** any candidate that overlaps already‑existing rectangles.
* Stop stepping for a tile once its next row doesn’t intersect the boundary (moving outward won’t re‑enter the polygon for a non‑self‑intersecting boundary).

Add:

```ts
const groutMm = TILE_GAP.size;
const depthMm = tileDepthMm; // { horizontal, vertical }

// Which axis & sign to grow per side
const sideAxis: Record<Side, { axis: 'x' | 'y'; sign: 1 | -1; stepMm: number }> = {
  top:    { axis: 'y', sign: -1, stepMm: depthMm.horizontal + groutMm },
  bottom: { axis: 'y', sign:  1, stepMm: depthMm.horizontal + groutMm },
  left:   { axis: 'x', sign: -1, stepMm: depthMm.vertical   + groutMm },
  right:  { axis: 'x', sign:  1, stepMm: depthMm.vertical   + groutMm },
};

// Find current outermost coordinate for a side (in MM, pool-local)
const getOutermostCoordMm = (side: Side): number => {
  const mm = (t: MMTile) => (side === 'top' || side === 'bottom') ? t.y : t.x;
  const base = baseTilesMM[side].map(mm);
  const user = userTilesMM.filter(t => t.side === side).map(mm);
  if ((base.length + user.length) === 0) {
    // fallback to pool edge in mm
    if (side === 'top') return 0;
    if (side === 'left') return 0;
    if (side === 'bottom') return poolData.width;
    return poolData.length; // right
  }
  if (side === 'top' || side === 'left') return Math.min(...base, ...(user.length ? user : [Infinity]));
  return Math.max(...base, ...(user.length ? user : [-Infinity]));
};

// Outermost row tiles (in MM) used as seeds for replication
const getOutermostRowTiles = (side: Side): MMTile[] => {
  const all = ([] as MMTile[]).concat(baseTilesMM[side], userTilesMM.filter(t => t.side === side));
  if (all.length === 0) return [];
  const coord = getOutermostCoordMm(side);
  const EPS = 0.25; // mm tolerance
  return all.filter(t => {
    const v = (side === 'top' || side === 'bottom') ? t.y : t.x;
    return Math.abs(v - coord) <= EPS;
  });
};

// Auto tiles for current (or preview) boundary
const autoTilesMM: MMTile[] = useMemo(() => {
  if (!showCoping || !copingCalc) return [];

  const outer: Pt[] = boundaryLive;
  // Build a fast overlap list (existing + will-add)
  const addedStage: StageRect[] = [];
  const overlapsExistingOrAdded = (sr: StageRect) => {
    const hitExisting = existingStageRects.some(r => stageOverlaps(sr, r));
    if (hitExisting) return true;
    const hitAdded = addedStage.some(r => stageOverlaps(sr, r));
    return hitAdded;
  };

  const produced: MMTile[] = [];

  (['top','bottom','left','right'] as Side[]).forEach(side => {
    const seeds = getOutermostRowTiles(side);
    if (seeds.length === 0) return;

    const { axis, sign, stepMm } = sideAxis[side];

    // For each tile in the outermost row, step outward until it no longer intersects the boundary
    seeds.forEach(seed => {
      let s = 1;
      // conservative max steps bound using boundary bbox
      const bx = outer.map(p => p.x), by = outer.map(p => p.y);
      const minX = Math.min(...bx), maxX = Math.max(...bx);
      const minY = Math.min(...by), maxY = Math.max(...by);
      const maxTravelPx = (axis === 'x' ? Math.max(Math.abs((seed.x * scale) - minX), Math.abs((seed.x * scale) - maxX))
                                        : Math.max(Math.abs((seed.y * scale) - minY), Math.abs((seed.y * scale) - maxY)));
      const maxSteps = Math.max(1, Math.ceil((maxTravelPx / scale) / Math.max(1, stepMm)));

      while (s <= maxSteps) {
        const offMm = s * stepMm * sign;
        const rxMm = axis === 'x' ? (seed.x + offMm) : seed.x;
        const ryMm = axis === 'y' ? (seed.y + offMm) : seed.y;

        const stageRect: StageRect = {
          x: roundHalf(rxMm * scale),
          y: roundHalf(ryMm * scale),
          w: Math.max(1, roundHalf(seed.width * scale)),
          h: Math.max(1, roundHalf(seed.height * scale)),
        };

        // Outside the polygon? stop for this column
        if (!rectIntersectsPolygon(stageRect, outer)) break;

        // Skip overlaps with base/user or already-added
        if (!overlapsExistingOrAdded(stageRect)) {
          addedStage.push(stageRect);

          const isPartialOuter = !rectFullyInsidePolygon(stageRect, outer);
          produced.push({
            x: rxMm,
            y: ryMm,
            width: seed.width,
            height: seed.height,
            isPartial: seed.isPartial || isPartialOuter, // respect center-cut then allow edge to cut again
            side
          });
        }
        s++;
      }
    });
  });

  return produced;
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [boundaryLive, copingCalc, component.properties.copingTiles, showCoping, scale, tileDepthMm.horizontal, tileDepthMm.vertical]);
```

> **Why this works**
>
> * Rows extend by **tileDepth + grout** per side (same as your manual handles).
> * We stop **per tile** when the next row no longer intersects the boundary polygon.
> * We mark a tile partial if the source was partial (center cuts) **or** if the new boundary clips it.
> * No duplicates: we reject anything overlapping *existing* (base + user) or tiling we’ve already added in this pass.

---

## 6) Render path changes — include the auto tiles

Where you currently assemble tiles in `renderCopingTiles`, include `autoTilesMM`. Concretely, change the “tiles” array assembly to:

```ts
// BEFORE:
// const tiles: Tile[] = ([] as Tile[])
//   .concat(sideTiles.top)
//   .concat(sideTiles.bottom)
//   .concat(sideTiles.left)
//   .concat(sideTiles.right);

// AFTER: include auto tiles (as additional atomic tiles) + keep keys distinct
const autoTiles: Array<{ x:number;y:number;width:number;height:number;isPartial:boolean;side:Side; key:string }> =
  autoTilesMM.map((p, i) => ({ ...p, key: `${p.side}:auto:${i}` }));

const tiles: Tile[] = ([] as Tile[])
  .concat(sideTiles.top)
  .concat(sideTiles.bottom)
  .concat(sideTiles.left)
  .concat(sideTiles.right)
  .concat(
    autoTiles.map(p => ({
      x: p.x, y: p.y, width: p.width, height: p.height, isPartial: p.isPartial, side: p.side, key: p.key
    }))
  );
```

Everything else in the renderer (snapping, selection overlay, ✂ indicator, grout drawing) will just work because we feed in more atomic tiles. **Deletion** still only applies to `:user:` keys; `:auto:` won’t be deleted (intended).

Also update all places that looked at “all tiles” for bounds/grout with `copingTiles` to also include `autoTilesMM` (e.g., clickable bounds and grout’s between‑tile pass). The simplest is to expand these two lines in your existing calculations:

```ts
// clickable bounds and grout
const allCopingPavers = [
  ...(copingCalc.deepEnd?.paverPositions || []),
  ...(copingCalc.shallowEnd?.paverPositions || []),
  ...(copingCalc.leftSide?.paverPositions || []),
  ...(copingCalc.rightSide?.paverPositions || []),
  ...(copingTiles || []),
  ...(autoTilesMM || []),  // <-- add this
];
```

And when you build **grout** rectangles between adjacent tiles, use:

```ts
const allCopingTiles = ([] as Array<{x:number;y:number;width:number;height:number}>)
  .concat(sideTiles.top, sideTiles.bottom, sideTiles.left, sideTiles.right)
  .concat(autoTiles.map(a => ({ x: a.x, y: a.y, width: a.width, height: a.height }))); // include auto
```

> You don’t need to change the deletion logic: it already filters by `:user:` in the key and these are `:auto:`.

---

## 7) Keep area stats accurate

If you want the pool coping component to publish area/quantities similar to `PavingAreaComponent`, add:

```ts
// Optional: compute coping statistics (m², full/partial counts) and persist
useEffect(() => {
  const mmAll: MMTile[] = ([] as MMTile[])
    .concat(baseTilesMM.top, baseTilesMM.bottom, baseTilesMM.left, baseTilesMM.right)
    .concat(userTilesMM)
    .concat(autoTilesMM);

  const full = mmAll.filter(t => !t.isPartial).length;
  const partial = mmAll.length - full;
  const areaMm2 = mmAll.reduce((acc, t) => acc + (t.width * t.height), 0);
  const areaM2 = areaMm2 / 1_000_000;

  const prev = (component.properties.copingStatistics as any) || {};
  if (prev.full !== full || prev.partial !== partial || Math.abs((prev.areaM2 || 0) - areaM2) > 1e-6) {
    updateComponent(component.id, {
      properties: {
        ...component.properties,
        copingStatistics: { full, partial, total: mmAll.length, areaM2 }
      }
    });
  }
}, [autoTilesMM, baseTilesMM.top, baseTilesMM.bottom, baseTilesMM.left, baseTilesMM.right, userTilesMM, component.id, component.properties, updateComponent]);
```

---

## Behavior & constraints (what this design guarantees)

* **Grid‑snapped nodes**: vertices align to the **canvas** grid, not the tile lattice, so the outer edge can be any angle (`x != c`, `y != c`).
* **Atomic tiles only**: new rows are added as **independent rectangles** computed from the **outermost current row per side**; grout spacing is honored at each step.
* **Cuts in both places**:

  * *Center* cuts remain (from the base coping calculation).
  * *Edge* cuts happen automatically when the boundary clips a tile.
  * If a center‑cut tile is also clipped by the boundary, it remains marked partial (`seed.isPartial || !inside(outer)`).
* **No overlap**: existing base/user tiles are respected; auto tiles are rejected if they overlap existing or previously‑added in the same pass.
* **Deletion model unchanged**: only `:user:` tiles can be deleted via keyboard/context menu; `:auto:` come from the boundary and are recomputed if the boundary changes—like the paving area’s grid‑mask model but staying fully atomic under the hood.
* **Area stats accurate**: area is the sum of **tile areas** (no grout), same as your paver stats logic.

---

## Notes on edge cases & performance

* The auto‑tiler uses a conservative `maxSteps` bound derived from the boundary bbox; it normally breaks much earlier once rows stop intersecting. No async work, no timers.
* If you rotate the pool group, the boundary/nodes are still in the **group’s local** space, so everything stays coherent. If you later add group rotation editing, use the same transform inversion pattern already in the node insert handler.
* If you want live tile preview while dragging a node, you already get it because `autoTilesMM` depends on `boundaryLive` (which uses the `boundaryPreview` when present). If the project has very dense tiling, you can switch the dependency to `copingBoundary` to commit‑only updates.

---

## Minimal file diffs (summary)

* **Imports:** `GRID_CONFIG`, `roundHalf` + geometry helpers.
* **State/props:** persist `properties.copingBoundary: Pt[]`.
* **UI:** boundary `Line` + draggable `Circle` nodes; shift‑click adds node.
* **Computation:** `autoTilesMM` useMemo to fill out to the boundary; include in renderer + grout + bounds.
* **Stats:** optional `copingStatistics` effect.

That’s it. This keeps your **PoolComponent** authoritative and atomic, gives you **node‑driven shape control** like PavingArea, but *without* switching to a mask renderer.

Got it — we’ll remove **all** visual and geometric gaps in **pool coping**, **paver blocks**, and **paving areas**, and refactor the paving area tool to behave like an **atomic tile array masked by the drawn shape** (so moving vertices simply reveals/hides tiles). Below are focused changes you can paste in. They do three things:

1. **Zero gap everywhere** (no grout offsets, no stroke “gaps”, no spacing baked into tile step).
2. **Sub‑pixel safe edges** (all tile edges snap to 0.5px so vertical/horizontal seams are identical).
3. **Paving Area = masked tile array** (stable origin; moving the mask does not recompute offsets).

---

## ✅ What changes, at a glance

* **PoolComponent**

  * Remove grout inset/underlay; tiles render **edge-to-edge** with 0 gap.
  * Extension step uses **tile depth only** (no extra grout in the step).
  * Keep snap to 0.5px to eliminate “delta” between vertical/horizontal seams.

* **PaverComponent**

  * Remove grout globally: **no inset, no underlay, no (width+grout) step**.
  * Step equals **tile size only** so tiles abut perfectly.
  * Keep 0.5px snapping for perfect seam parity.

* **PavingAreaComponent**

  * Set `groutMm = 0` and remove grout underlay; tiles render **edge-to-edge**.
  * Always fill using **atomic array + mask**:

    * If `alignToPoolId` is set, it still honors that.
    * Otherwise, uses `fillAreaWithPaversFromOrigin` with a **stable origin** stored on the component (`properties.tileOrigin`).
  * Ghost tiles and live tiles both draw with **no inset**.

* **Canvas**

  * When creating a `paving_area`, store a **stable origin** (`tileOrigin`) at the time of creation (top-left of the drawn boundary). That origin never moves unless you explicitly change it, so dragging/reshaping the area just masks/reveals the pre-laid tile array.

---

## 🔧 Patches

> The diffs below are minimal and safe; they only touch rendering and spacing and add the paving-area origin. They do **not** change your data model shape beyond adding `properties.tileOrigin` on paving areas.

### 1) `PoolComponent.tsx` — remove gaps, step with tile depth only, keep 0.5px edge snapping

```diff
diff --git a/src/components/canvas/PoolComponent.tsx b/src/components/canvas/PoolComponent.tsx
--- a/src/components/canvas/PoolComponent.tsx
+++ b/src/components/canvas/PoolComponent.tsx
@@ -1,8 +1,8 @@
 import { useRef, useMemo, useState, useEffect } from 'react';
 import { Group, Line, Text, Circle, Rect } from 'react-konva';
 import { Component } from '@/types';
 import { POOL_LIBRARY } from '@/constants/pools';
-import { calculatePoolCoping, GROUT_MM } from '@/utils/copingCalculation';
+import { calculatePoolCoping } from '@/utils/copingCalculation';
 import { getContextMenuItems } from '@/types/contextMenu';
 import { useDesignStore } from '@/store/designStore';
 import { snapPoolToPaverGrid } from '@/utils/snap';
 import { snapRectPx } from '@/utils/canvasSnap';
@@
 export const PoolComponent = ({ component, isSelected, onSelect, onDragEnd, onTileContextMenu }: PoolComponentProps) => {
@@
-  const groutStrokePx = GROUT_MM * scale; // 5mm → px
+  // No gaps anywhere for coping tiles
+  const SNAP_MM = 5; // keep mm snapping granularity for extensions (visual grid stability)
@@
   const renderCopingTiles = () => {
@@
-    const groutStrokePx = GROUT_MM * scale; // 5mm → px
     const scissorsColor = '#B8AE94';
     const scissorsSize = 11;
     const scissorsMargin = 3;
     const baseFill = '#E8DBC4'; // slightly darker sandstone for original coping
     const extFill = '#F3EBD9';  // lighter sandstone for extensions
@@
-        fills.push(
+        fills.push(
           <Group key={`coping-${t.key}`}>
             <Rect
-              x={r.x + groutStrokePx / 2}
-              y={r.y + groutStrokePx / 2}
-              width={Math.max(0, r.width - groutStrokePx)}
-              height={Math.max(0, r.height - groutStrokePx)}
+              x={r.x}
+              y={r.y}
+              width={Math.max(0, r.width)}
+              height={Math.max(0, r.height)}
               fill={t.source === 'base' ? baseFill : extFill}
               dash={isPartial ? [5,5] : undefined}
               opacity={isPartial ? 0.85 : 1}
               onClick={(e:any) => toggleTileSelection(t, e)}
               onTap={(e:any) => toggleTileSelection(t, e)}
@@
-            {isCandidate && (
+            {isCandidate && (
               <Rect
-                x={r.x + groutStrokePx/2}
-                y={r.y + groutStrokePx/2}
-                width={Math.max(0, r.width - groutStrokePx)}
-                height={Math.max(0, r.height - groutStrokePx)}
+                x={r.x}
+                y={r.y}
+                width={Math.max(0, r.width)}
+                height={Math.max(0, r.height)}
                 fill="rgba(16,185,129,0.12)"
                 stroke="#10B981"
                 strokeWidth={2}
                 dash={[4,2]}
                 listening={false}
               />
             )}
-            {isSel && (
+            {isSel && (
               <Rect
-                x={r.x + groutStrokePx/2}
-                y={r.y + groutStrokePx/2}
-                width={Math.max(0, r.width - groutStrokePx)}
-                height={Math.max(0, r.height - groutStrokePx)}
+                x={r.x}
+                y={r.y}
+                width={Math.max(0, r.width)}
+                height={Math.max(0, r.height)}
                 fill="rgba(59,130,246,0.15)"
                 stroke="#3B82F6"
                 strokeWidth={2}
                 dash={[6,3]}
                 listening={false}
               />
             )}
@@
-    // Grout background clipped to union of coping tiles (does not fill pool interior)
-    if (tiles.length === 0) return <></>;
-
-    // Compute snapped rects once
-    const snapped = tiles.map(t => snapRectPx(t.x, t.y, t.width, t.height, scale));
-    const minX = Math.min(...snapped.map(r => r.x));
-    const minY = Math.min(...snapped.map(r => r.y));
-    const maxX = Math.max(...snapped.map(r => r.x + r.width));
-    const maxY = Math.max(...snapped.map(r => r.y + r.height));
-
-    return (
-      <>
-        <Group
-          listening={false}
-          clipFunc={(ctx) => {
-            snapped.forEach((r) => ctx.rect(r.x, r.y, r.width, r.height));
-          }}
-        >
-          <Rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill="#D4C5A9" listening={false} />
-        </Group>
-
-        {fills}
-      </>
-    );
+    // No grout underlay; tiles render edge-to-edge without gaps
+    return <>{fills}</>;
   };
@@
-            // Determine unit distance on axis
-            let unitMm = depthMm + GROUT_MM; // default for normal (row step includes grout)
+            // Determine unit distance on axis (no grout spacing)
+            let unitMm = depthMm; // default for normal (row step = tile depth only)
@@
-              const blockSpanMm = Math.max(0, maxCoord - minCoord);
-              unitMm = blockSpanMm + GROUT_MM;
+              const blockSpanMm = Math.max(0, maxCoord - minCoord);
+              unitMm = blockSpanMm; // no grout addition tangentially either
@@
-                let unitMm = depthMm + GROUT_MM;
+                let unitMm = depthMm;
                 if (!isNormal) {
                   const minCoord = axis === 'x'
                     ? Math.min(...candidateTiles.map(t => t.x))
                     : Math.min(...candidateTiles.map(t => t.y));
                   const maxCoord = axis === 'x'
                     ? Math.max(...candidateTiles.map(t => t.x + t.width))
                     : Math.max(...candidateTiles.map(t => t.y + t.height));
                   const blockSpanMm = Math.max(0, maxCoord - minCoord);
-                  unitMm = blockSpanMm + GROUT_MM;
+                  unitMm = blockSpanMm;
                 }
-                const snapMm = (mm:number) => Math.floor(mm / GROUT_MM) * GROUT_MM; // snap mm to 5mm grid
+                const snapMm = (mm:number) => Math.round(mm / SNAP_MM) * SNAP_MM; // keep stable mm snapping
                 for (let s = 1; s <= steps; s++) {
                   const off = s * unitMm * sign; // mm
                   candidateTiles.forEach((t) => {
```

---

### 2) `PaverComponent.tsx` — remove gaps and grout spacing, keep seam parity with 0.5px snapping

```diff
diff --git a/src/components/canvas/PaverComponent.tsx b/src/components/canvas/PaverComponent.tsx
--- a/src/components/canvas/PaverComponent.tsx
+++ b/src/components/canvas/PaverComponent.tsx
@@ -3,7 +3,6 @@
 import { Component } from '@/types';
 import { PAVER_SIZES } from '@/constants/components';
 import { useEffect, useMemo, useState, useRef } from 'react';
 import { useDesignStore } from '@/store/designStore';
-import { GROUT_MM } from '@/utils/copingCalculation';
 import { snapRectPx } from '@/utils/canvasSnap';
@@
   const scale = 0.1; // 1 unit = 10mm
   const paverSize = component.properties.paverSize || '400x400';
   const { width, height } = PAVER_SIZES[paverSize];
   const tileWpx = width * scale;
   const tileHpx = height * scale;
-  const stepX = (width + GROUT_MM) * scale;
-  const stepY = (height + GROUT_MM) * scale;
+  // No gaps: step equals tile dimensions only
+  const stepX = width * scale;
+  const stepY = height * scale;
@@
-  const groutStrokePx = GROUT_MM * scale; // 5mm → px
+  // No grout/gap anywhere
@@
   const snapTileRectPx = (col: number, row: number) => {
-    // Convert tile grid -> mm (including grout spacing)
-    const xMm = col * (width + GROUT_MM);
-    const yMm = row * (height + GROUT_MM);
+    // Convert tile grid -> mm (no spacing)
+    const xMm = col * width;
+    const yMm = row * height;
     // Use snapRectPx to ensure both edges are snapped to 0.5px
     return snapRectPx(xMm, yMm, width, height, scale);
   };
@@
-      fills.push(
+      fills.push(
         <Rect
           key={`fill-${key}`}
-          x={pxX + groutStrokePx / 2}
-          y={pxY + groutStrokePx / 2}
-          width={Math.max(0, w - groutStrokePx)}
-          height={Math.max(0, h - groutStrokePx)}
+          x={pxX}
+          y={pxY}
+          width={Math.max(0, w)}
+          height={Math.max(0, h)}
           fill="#F3EBD9"
           onClick={(e: any) => {
             if (e.evt && e.evt.shiftKey) {
@@
-        overlays.push(
+        overlays.push(
           <Rect
             key={`ovl-${key}`}
-            x={pxX + groutStrokePx/2}
-            y={pxY + groutStrokePx/2}
-            width={Math.max(0, w - groutStrokePx)}
-            height={Math.max(0, h - groutStrokePx)}
+            x={pxX}
+            y={pxY}
+            width={Math.max(0, w)}
+            height={Math.max(0, h)}
             fill="rgba(59,130,246,0.15)"
             stroke="#3B82F6"
             strokeWidth={2}
             dash={[6, 3]}
             listening={false}
           />
         );
@@
-        fills.push(
+        fills.push(
           <Rect
             key={`fill-extra-${bi}-${r}-${c}`}
-            x={pxX + groutStrokePx / 2}
-            y={pxY + groutStrokePx / 2}
-            width={Math.max(0, w - groutStrokePx)}
-            height={Math.max(0, h - groutStrokePx)}
+            x={pxX}
+            y={pxY}
+            width={Math.max(0, w)}
+            height={Math.max(0, h)}
             fill="#F3EBD9"
             onClick={(e: any) => {
               if (e.evt && e.evt.shiftKey) {
@@
-          overlays.push(
+          overlays.push(
             <Rect
               key={`ovl-extra-${bi}-${r}-${c}`}
-              x={pxX + groutStrokePx/2}
-              y={pxY + groutStrokePx/2}
-              width={Math.max(0, w - groutStrokePx)}
-              height={Math.max(0, h - groutStrokePx)}
+              x={pxX}
+              y={pxY}
+              width={Math.max(0, w)}
+              height={Math.max(0, h)}
               fill="rgba(59,130,246,0.15)"
               stroke="#3B82F6"
               strokeWidth={2}
               dash={[6, 3]}
               listening={false}
             />
           );
@@
-      {/* Grout background clipped to union of tiles (shows only inner 1/2 at perimeter) */}
-      {(() => {
-        // Compute union bounding box for fill rect size
-        let minCol = baseOffset.col;
-        let maxCol = baseOffset.col + count.cols - 1;
-        let minRow = baseOffset.row;
-        let maxRow = baseOffset.row + count.rows - 1;
-        extraBlocks.forEach(b => {
-          minCol = Math.min(minCol, b.col);
-          minRow = Math.min(minRow, b.row);
-          maxCol = Math.max(maxCol, b.col + b.cols - 1);
-          maxRow = Math.max(maxRow, b.row + b.rows - 1);
-        });
-        const unionX = minCol * stepX;
-        const unionY = minRow * stepY;
-        const unionW = (maxCol - minCol) * stepX + tileWpx;
-        const unionH = (maxRow - minRow) * stepY + tileHpx;
-        return (
-          <Group
-            listening={false}
-            clipFunc={(ctx) => {
-              // base grid
-              for (let r = 0; r < count.rows; r++) {
-                for (let c = 0; c < count.cols; c++) {
-                  const { x, y, width: w, height: h } = snapTileRectPx(baseOffset.col + c, baseOffset.row + r);
-                  ctx.rect(x, y, w, h);
-                }
-              }
-              // extra blocks
-              extraBlocks.forEach((b) => {
-                for (let r = 0; r < b.rows; r++) {
-                  for (let c = 0; c < b.cols; c++) {
-                    const { x, y, width: w, height: h } = snapTileRectPx(b.col + c, b.row + r);
-                    ctx.rect(x, y, w, h);
-                  }
-                }
-              });
-            }}
-          >
-            <Rect x={unionX} y={unionY} width={unionW} height={unionH} fill="#D4C5A9" listening={false} />
-          </Group>
-        );
-      })()}
+      {/* No grout underlay; tiles render edge-to-edge */}
```

---

### 3) `PavingAreaComponent.tsx` — zero gap + stable atomic array masked by boundary

```diff
diff --git a/src/components/canvas/PavingAreaComponent.tsx b/src/components/canvas/PavingAreaComponent.tsx
--- a/src/components/canvas/PavingAreaComponent.tsx
+++ b/src/components/canvas/PavingAreaComponent.tsx
@@ -1,11 +1,10 @@
 import { Group, Line, Rect, Text, Circle } from 'react-konva';
 import { Component } from '@/types';
 import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
 import { useDesignStore } from '@/store/designStore';
 import { getPoolExcludeZone } from '@/utils/poolExcludeZone';
 import { fillAreaWithPavers, fillAreaWithPaversFromOrigin, calculateStatistics, getPaverDimensions } from '@/utils/pavingFill';
 import { GRID_CONFIG } from '@/constants/grid';
-import { calculatePoolCoping, GROUT_MM } from '@/utils/copingCalculation';
+import { calculatePoolCoping } from '@/utils/copingCalculation';
 import { snapToGrid } from '@/utils/snap';
 import { snapRectPx, roundHalf } from '@/utils/canvasSnap';
@@
-  const groutMm = useDesignStore((s: any) => s.settings?.groutMm) ?? GROUT_MM;
+  // Hard-zero all gaps in paving areas
+  const groutMm = 0;
   const pxPerMm = GRID_CONFIG.spacing / 100;
-  const groutStrokePx = groutMm * pxPerMm; // 5mm → px
+  const groutStrokePx = 0;
@@
-  const computePaversForBoundary = useCallback(
+  const computePaversForBoundary = useCallback(
     (bnd: Pt[]) => {
       if (!bnd || bnd.length < 3) return [];
       const size = component.properties.paverSize || '400x400';
       const orient = component.properties.paverOrientation || 'vertical';
       const alignPoolId = component.properties.alignToPoolId;
+      const origin = component.properties.tileOrigin || { x: 0, y: 0 }; // stable array origin (px)
@@
-      return fillAreaWithPavers(bnd, size, orient, showEdgePavers, poolExcludeZones, groutMm);
+      // Default: atomic array masked by boundary with stable origin (no gaps)
+      return fillAreaWithPaversFromOrigin(
+        bnd,
+        size,
+        orient,
+        showEdgePavers,
+        poolExcludeZones,
+        origin,
+        groutMm
+      );
     },
@@
-      groutMm,
+      groutMm,
+      component.properties.tileOrigin,
     ]
   );
@@
-              {/* 1) Grout underlay: union of paver rects (snapped to 0.5px) */}
-              {(() => {
-                if (paversLocal.length === 0) return null;
-                const snap = (v: number) => roundHalf(v);
-                const rects = paversLocal.map((p) => {
-                  const x1 = snap(p.position.x);
-                  const y1 = snap(p.position.y);
-                  const x2 = snap(p.position.x + p.width);
-                  const y2 = snap(p.position.y + p.height);
-                  return { x: x1, y: y1, w: Math.max(1, x2 - x1), h: Math.max(1, y2 - y1), isEdge: p.isEdgePaver };
-                });
-                const minX = Math.min(...rects.map((r) => r.x));
-                const minY = Math.min(...rects.map((r) => r.y));
-                const maxX = Math.max(...rects.map((r) => r.x + r.w));
-                const maxY = Math.max(...rects.map((r) => r.y + r.h));
-                return (
-                  <Group
-                    listening={false}
-                    clipFunc={(ctx) => {
-                      rects.forEach((r) => ctx.rect(r.x, r.y, r.w, r.h));
-                    }}
-                  >
-                    <Rect
-                      x={minX}
-                      y={minY}
-                      width={maxX - minX}
-                      height={maxY - minY}
-                      fill="#D4C5A9"
-                      listening={false}
-                    />
-                  </Group>
-                );
-              })()}
+              {/* No grout underlay; draw atomic tiles edge-to-edge */}
 
               {/* 2) Inset tile fills (no grout strokes) */}
               {paversLocal.map((p) => {
                 const snap = (v: number) => roundHalf(v);
                 const x1 = snap(p.position.x);
                 const y1 = snap(p.position.y);
                 const x2 = snap(p.position.x + p.width);
                 const y2 = snap(p.position.y + p.height);
                 const w = Math.max(1, x2 - x1);
                 const h = Math.max(1, y2 - y1);
                 return (
                   <Group key={p.id} listening={false}>
                     <Rect
-                      x={x1 + groutStrokePx / 2}
-                      y={y1 + groutStrokePx / 2}
-                      width={Math.max(0, w - groutStrokePx)}
-                      height={Math.max(0, h - groutStrokePx)}
+                      x={x1}
+                      y={y1}
+                      width={Math.max(0, w)}
+                      height={Math.max(0, h)}
                       fill="#F3EBD9"
                       opacity={p.isEdgePaver ? 0.85 : 1}
                     />
@@
       {ghost && (
         <Group listening={false} opacity={0.75}>
           <Group
             clipFunc={(ctx) => {
               ctx.beginPath();
               ghost.boundary.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
               ctx.closePath();
             }}
           >
-            {/* Ghost background grout fill */}
+            {/* Ghost background fill (same tone as tiles) */}
             <Line
               points={ghost.boundary.flatMap((p) => [p.x, p.y])}
-              fill="#D4C5A9"
+              fill="#F3EBD9"
               closed
               listening={false}
               opacity={0.75}
             />
 
             {/* Inset ghost tiles */}
             {ghost.pavers.map((p) => (
               <Rect
                 key={`ghost-${p.id}`}
-                x={p.position.x + groutStrokePx / 2}
-                y={p.position.y + groutStrokePx / 2}
-                width={Math.max(0, p.width - groutStrokePx)}
-                height={Math.max(0, p.height - groutStrokePx)}
+                x={p.position.x}
+                y={p.position.y}
+                width={Math.max(0, p.width)}
+                height={Math.max(0, p.height)}
                 fill="#F3EBD9"
                 opacity={p.isEdgePaver ? 0.5 : 0.6}
               />
             ))}
           </Group>
```

---

### 4) `Canvas.tsx` — seed a stable tile origin when creating a paving area (mask over array)

```diff
diff --git a/src/components/Canvas.tsx b/src/components/Canvas.tsx
--- a/src/components/Canvas.tsx
+++ b/src/components/Canvas.tsx
@@ -355,6 +355,13 @@
   const handlePavingConfig = (config: PavingConfig) => {
     if (pavingBoundary.length < 3) return;
 
+    // Stable origin for atomic tile array (mask behavior):
+    // choose the top-left of the initial boundary so moving nodes reveals/hides tiles
+    const xs = pavingBoundary.map(p => p.x);
+    const ys = pavingBoundary.map(p => p.y);
+    const tileOrigin = {
+      x: Math.min(...xs),
+      y: Math.min(...ys),
+    };
+
     // Fill the area with pavers (initial calculation without pool exclusions)
     const pavers = fillAreaWithPavers(
       pavingBoundary,
@@ -397,6 +404,7 @@
         paverOrientation: config.paverOrientation,
         showEdgePavers: config.showEdgePavers,
         wastagePercentage: config.wastagePercentage,
+        tileOrigin, // << anchor array; boundary acts as a mask over this origin
         statistics, // Initial statistics, will be updated when pools change
       },
     });
```

> **Note:** We didn’t change your dialog or stats; we only add `tileOrigin` into the created component so the masked array stays stable while editing.

---

## Why this eliminates the “vertical vs horizontal delta”

* The “delta” came from two combined issues:

  1. **Inset math** (subtracting grout from width/height and offsetting by half) creates direction‑dependent rounding pressures.
  2. **Sub‑pixel alignment** can give hairline anti‑alias lines when one side lands on `.49px` vs `.50px`.

* We fix both by:

  * **Zero inset / zero spacing** (no gaps at all).
  * **Snapping every tile edge to 0.5px** (`snapRectPx` / `roundHalf`) so both vertical and horizontal seams land on the exact same pixel grid.

---

## Behavioral notes

* **Extending coping rows** now steps by **tile depth only**, not `depth + grout`. Tangential replication likewise uses the **block span only**. Snapping remains at **5 mm** increments for stability (you can change `SNAP_MM` to 1 mm if you prefer ultra-fine).
* **Paving Area as a Mask**: The underlying tile array is anchored to `properties.tileOrigin` (top-left at creation). Reshaping/moving the polygon reuses the same origin, so tiles are not re‑laid — the boundary just reveals/cuts them, which matches your “mask over array” requirement.
* **Alignment with Pool Coping / Paver Blocks**: With gaps removed and half‑pixel snapping everywhere, visual alignment becomes deterministic. If you want precise phase locking between a given paving area and a specific pool or paver block, you can:

  * set `properties.alignToPoolId` (already supported), or
  * set `properties.tileOrigin` explicitly (e.g., to the pool’s corner in px) when creating the area.

---

## Quick test checklist

1. **Pool coping**: zoom in heavily — there should be **no visible seams** between vertically and horizontally oriented tiles.
2. **Paver blocks**: replicate left/right/top/bottom — pavers should **abut perfectly**, no background showing through.
3. **Paving area edit**: drag any vertex — tiles **do not shift** relative to world; they simply reveal/hide under the new polygon.
4. **Extend coping**: extension steps should align flush to previous rows **without a sliver**.

If you want, I can also add a small UI toggle later (e.g., “Show grout (visual only)”) that draws a non-inset hairline overlay purely for presentation; functionally we’ll stay at **0 gap**.

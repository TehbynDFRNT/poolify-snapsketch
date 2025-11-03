import { useRef, useMemo, useState, useEffect } from 'react';
import { Group, Line, Text, Circle, Rect } from 'react-konva';
import type Konva from 'konva';
import type { Vector2d } from 'konva/lib/types';
import { Component } from '@/types';
import { POOL_LIBRARY } from '@/constants/pools';
import { calculatePoolCoping } from '@/utils/copingCalculation';
import { useDesignStore } from '@/store/designStore';
import { snapPoolToPaverGrid } from '@/utils/snap';
import { snapRectPx, roundHalf } from '@/utils/canvasSnap';
import { TILE_COLORS, TILE_GAP } from '@/constants/tileConfig';
import { getAnnotationOffsetPx, normalizeLabelAngle } from '@/utils/annotations';
import { GRID_CONFIG } from '@/constants/grid';

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

interface PoolComponentProps {
  component: Component;
  isSelected: boolean;
  activeTool?: string;
  onSelect: () => void;
  onDragEnd: (pos: { x: number; y: number }) => void;
  onTileContextMenu?: (component: Component, tileKey: string, screenPos: { x: number; y: number }) => void;
}

export const PoolComponent = ({ component, isSelected, activeTool, onSelect, onDragEnd, onTileContextMenu }: PoolComponentProps) => {
  const groupRef = useRef<Konva.Group | null>(null);
  const { components: allComponents, updateComponent, zoom, annotationsVisible } = useDesignStore();
  const [patternImage, setPatternImage] = useState<CanvasImageSource | null>(null);

  // --- Boundary (outer limit) for auto-extensions ---

  // Prefer embedded pool geometry to avoid library mismatches
  type PoolGeometry = { outline: Pt[]; length: number; width: number; deepEnd: Pt; shallowEnd: Pt };
  const props = component.properties as unknown as { pool?: PoolGeometry; poolId?: string };
  const poolData = props.pool ||
    POOL_LIBRARY.find(p => p.id === props.poolId) ||
    POOL_LIBRARY[0];

  // Scale down from mm to canvas units (1 unit = 10mm for better display)
  const scale = 0.1;
  const gridSize = GRID_CONFIG.spacing; // canvas grid spacing in stage units

  const snapToCanvasGrid = (v: number) => Math.round(v / gridSize) * gridSize;
  const scaledOutline = poolData.outline.map(p => ({ x: p.x * scale, y: p.y * scale }));
  const points = scaledOutline.flatMap(p => [p.x, p.y]);

  // Calculate coping if enabled
  const showCoping = component.properties.showCoping ?? false;
  const copingConfig = component.properties.copingConfig;
  const copingCalc = showCoping && poolData
    ? calculatePoolCoping(poolData, copingConfig)
    : null;

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
      return [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ];
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    base.forEach(r => {
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.width);
      maxY = Math.max(maxY, r.y + r.height);
    });
    // No padding - align exactly with outer edges of base coping
    return [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
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

  // Transform helpers for coordinate conversion between absolute and local (Group-relative)
  const toLocalFromAbs = (abs: { x: number; y: number }) => {
    const group = groupRef.current;
    if (!group) return abs;
    const tr = group.getAbsoluteTransform().copy();
    const inv = tr.copy().invert();
    return inv.point(abs);
  };

  const toAbsFromLocal = (local: { x: number; y: number }) => {
    const group = groupRef.current;
    if (!group) return local;
    const tr = group.getAbsoluteTransform().copy();
    return tr.point(local);
  };

  // Node editing state - ghost state in local coordinates (like HouseComponent)
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [ghostLocal, setGhostLocal] = useState<Pt[] | null>(null);

  // copingBoundary is ALREADY in local (Group-relative) coordinates, no conversion needed
  const boundaryLocal = copingBoundary;

  // Use ghost during drag, otherwise use boundary as-is
  const boundaryLive = ghostLocal || boundaryLocal;

  const setBoundary = (localPts: Pt[]) => {
    // Save directly - already in local coordinates
    updateComponent(component.id, {
      properties: { ...component.properties, copingBoundary: localPts }
    });
  };

  // When the store boundary matches our ghost, drop the ghost to avoid stale overlays
  useEffect(() => {
    if (!ghostLocal) return;
    const a = ghostLocal;
    const b = boundaryLocal;
    if (a.length !== b.length) return;
    for (let i = 0; i < a.length; i++) {
      if (Math.abs(a[i].x - b[i].x) > 1e-6 || Math.abs(a[i].y - b[i].y) > 1e-6) return;
    }
    setGhostLocal(null);
  }, [boundaryLocal, ghostLocal]);

  // Build side-indexed tile lists (in mm, pool-local) - all tiles are atomic, no base/extended distinction
  type Side = 'top'|'bottom'|'left'|'right';
  type Tile = { x:number; y:number; width:number; height:number; isPartial:boolean; side: Side; key: string };

  const copingTiles = useMemo(() => (
    (component.properties.copingTiles || []) as Array<{x:number;y:number;width:number;height:number;isPartial:boolean;side:Side}>
  ), [component.properties.copingTiles]);

  const sideTiles = useMemo(() => {
    const result: Record<Side, Tile[]> = { top: [], bottom: [], left: [], right: [] };
    if (copingCalc) {
      // Map calculated tiles to sides
      // top: leftSide (y < 0), bottom: rightSide (y >= pool.width), left: shallowEnd (x < 0), right: deepEnd (x >= pool.length)
      (copingCalc.leftSide?.paverPositions || []).forEach((p, i) => {
        result.top.push({ ...p, side: 'top', key: `top:${i}` });
      });
      (copingCalc.rightSide?.paverPositions || []).forEach((p, i) => {
        result.bottom.push({ ...p, side: 'bottom', key: `bottom:${i}` });
      });
      (copingCalc.shallowEnd?.paverPositions || []).forEach((p, i) => {
        result.left.push({ ...p, side: 'left', key: `left:${i}` });
      });
      (copingCalc.deepEnd?.paverPositions || []).forEach((p, i) => {
        result.right.push({ ...p, side: 'right', key: `right:${i}` });
      });
    }
    // Append user-added tiles (no distinction from calculated tiles)
    copingTiles.forEach((p, i) => {
      const key = `${p.side}:user:${i}`;
      (result[p.side] as Tile[]).push({ ...p, key, side: p.side });
    });
    return result;
  }, [copingCalc, copingTiles]);

  // Tile depths (mm) - different for horizontal vs vertical edges with fixed tile orientation
  const tileDepthMm = useMemo(() => {
    if (!copingCalc) return { horizontal: 400, vertical: 400 };
    // Horizontal edges (top/bottom = leftSide/rightSide in calc)
    const horizontal = copingCalc.leftSide.depth || 400;
    // Vertical edges (left/right = shallowEnd/deepEnd in calc)
    const vertical = copingCalc.shallowEnd.depth || 400;
    return { horizontal, vertical };
  }, [copingCalc]);

  // --- Auto-tile generation helpers ---
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
  const userTilesMM = useMemo(() => (
    (component.properties.copingTiles || []) as MMTile[]
  ), [component.properties.copingTiles]);

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

  // Determine the current outermost row coordinate per side in mm (pool-local)
  // Note: outermostCoord (for manual handle extension) removed; auto boundary uses getOutermostRowTiles

  // Tile row helpers for auto-extend boundary are handled via getOutermostRowTiles

  // --- Auto-tile generation from boundary ---
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
  // Use a stable key from boundary points to ensure recalculation
  const boundaryKey = boundaryLive.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('|');

  const autoTilesMM: MMTile[] = useMemo(() => {
    if (!showCoping || !copingCalc) return [];

    const outer: Pt[] = boundaryLive;

    // Check if boundary has been edited beyond default (compare with tolerance)
    const isDefaultBoundary = outer.length === defaultBoundary.length &&
      outer.every((p, i) => {
        const def = defaultBoundary[i];
        return Math.abs(p.x - def.x) < 0.1 && Math.abs(p.y - def.y) < 0.1;
      });

    // Don't generate auto-tiles if boundary hasn't been edited
    if (isDefaultBoundary) {
      return [];
    }
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
  }, [boundaryKey, defaultBoundary, copingCalc, component.properties.copingTiles, showCoping, scale, tileDepthMm.horizontal, tileDepthMm.vertical]);

  // Pattern is pre-rendered at exact pool size, so use 1:1 scale and (0,0) offset
  const patternConfig = useMemo(() => {
    return {
      scale: { x: 1, y: 1 },
      offset: { x: 0, y: 0 }
    };
  }, []);

  // Calculate bounding box for pool (includes coping and extensions when enabled)
  const clickableBounds = useMemo(() => {
    // If no coping, just use pool dimensions
    if (!showCoping || !copingCalc) {
      const width = Math.max(20, poolData.length * scale + 20);
      const height = Math.max(20, poolData.width * scale + 20);
      return {
        x: -10,
        y: -10,
        width,
        height,
      };
    }

    // Calculate bounds from all coping pavers + any extensions
    let minX = 0;
    let minY = 0;
    let maxX = poolData.length * scale;
    let maxY = poolData.width * scale;

    const allCopingPavers = [
      ...(copingCalc.deepEnd?.paverPositions || []),
      ...(copingCalc.shallowEnd?.paverPositions || []),
      ...(copingCalc.leftSide?.paverPositions || []),
      ...(copingCalc.rightSide?.paverPositions || []),
      ...(copingTiles || []),
      ...(autoTilesMM || []),
    ];

    allCopingPavers.forEach(paver => {
      const paverMinX = paver.x * scale;
      const paverMinY = paver.y * scale;
      const paverMaxX = paverMinX + paver.width * scale;
      const paverMaxY = paverMinY + paver.height * scale;

      minX = Math.min(minX, paverMinX);
      minY = Math.min(minY, paverMinY);
      maxX = Math.max(maxX, paverMaxX);
      maxY = Math.max(maxY, paverMaxY);
    });

    // Add padding for easier clicking
    const width = Math.max(20, maxX - minX + 20);
    const height = Math.max(20, maxY - minY + 20);

    return {
      x: minX - 10,
      y: minY - 10,
      width,
      height,
    };
  }, [showCoping, copingCalc, poolData.length, poolData.width, scale, autoTilesMM, copingTiles]);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const newPos = { x: e.target.x(), y: e.target.y() };
    
    // Snap to paver grid if inside a paving area
    const snappedPos = snapPoolToPaverGrid(
      newPos,
      { length: poolData.length, width: poolData.width },
      allComponents
    );
    
    // Update the position on the Konva node for immediate visual feedback
    e.target.x(snappedPos.x);
    e.target.y(snappedPos.y);
    
    onDragEnd(snappedPos);
  };

  // Tile shift-selection and keyboard delete logic removed; only auto-extend boundary editing remains

  // Insert a node on the edge nearest to point p (local coordinates)
  const insertNodeAt = (localP: Pt) => {
    const pts = [...boundaryLocal];
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const ax = a.x, ay = a.y, bx = b.x, by = b.y;
      const dx = bx - ax, dy = by - ay;
      const L2 = dx*dx + dy*dy || 1;
      const t = Math.max(0, Math.min(1, ((localP.x - ax) * dx + (localP.y - ay) * dy) / L2));
      const px = ax + t * dx, py = ay + t * dy;
      const d2 = (localP.x - px)**2 + (localP.y - py)**2;
      if (d2 < bestDist) { bestDist = d2; bestIdx = i; }
    }
    if (bestIdx >= 0) {
      const s = gridSize;
      const snapped = { x: Math.round(localP.x / s) * s, y: Math.round(localP.y / s) * s };
      const next = [...pts.slice(0, bestIdx + 1), snapped, ...pts.slice(bestIdx + 1)];
      setBoundary(next);
    }
  };

  // Boundary line shift-click handler
  const onBoundaryLineMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!e.evt.shiftKey) return;
    e.cancelBubble = true;
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pr = stage?.getPointerPosition();
    if (!pr) return;
    const local = toLocalFromAbs(pr);
    insertNodeAt(local);
  };

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

    type CopingStats = { full?: number; partial?: number; total?: number; areaM2?: number };
    const prev = (component.properties.copingStatistics as unknown as CopingStats) || {};
    if (prev.full !== full || prev.partial !== partial || Math.abs((prev.areaM2 || 0) - areaM2) > 1e-6) {
      updateComponent(component.id, {
        properties: {
          ...component.properties,
          copingStatistics: { full, partial, total: mmAll.length, areaM2 }
        }
      });
    }
  }, [autoTilesMM, baseTilesMM.top, baseTilesMM.bottom, baseTilesMM.left, baseTilesMM.right, userTilesMM, component.id, component.properties, updateComponent]);

  // Load and pre-render pattern image for pool fill (rotated 180° and sized to pool)
  useEffect(() => {
    const img = new window.Image();
    img.src = '/PoolPatternImage.png';
    img.onload = () => {
      // Create a canvas to pre-render the rotated and sized pattern
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Get pool dimensions in pixels
      const poolWidthPx = poolData.length * scale;
      const poolHeightPx = poolData.width * scale;

      // Calculate cover scale
      const scaleX = poolWidthPx / img.width;
      const scaleY = poolHeightPx / img.height;
      const coverScale = Math.max(scaleX, scaleY);

      // Set canvas size to pool dimensions
      canvas.width = poolWidthPx;
      canvas.height = poolHeightPx;

      // Rotate 180° around center and draw
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI); // 180 degrees
      ctx.drawImage(
        img,
        -img.width * coverScale / 2,
        -img.height * coverScale / 2,
        img.width * coverScale,
        img.height * coverScale
      );

      setPatternImage(canvas);
    };
  }, [poolData.length, poolData.width, scale]);

  // Build the list of tiles for rendering (base + extensions) with selection overlays
  const renderCopingTiles = () => {
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

    // Tile selection removed: no candidate highlight

    // Grout gaps from centralized config
    const gapMm = TILE_GAP.size; // 5mm from config
    const scissorsColor = TILE_COLORS.cutIndicator;
    const scissorsSize = 11;
    const scissorsMargin = 3;
    const tileFill = TILE_COLORS.baseTile; // sandstone color for all tiles

    // --- EDGE-ONLY GROUT (uniform band between pool and the adjacent coping row) ---
    const G = gapMm;
    const groutRects: JSX.Element[] = [];
    if (TILE_GAP.renderGap && G > 0) {
      const seen = new Set<string>();

      const addRectMm = (x: number, y: number, w: number, h: number) => {
        if (w <= 0 || h <= 0 || !isFinite(w) || !isFinite(h)) return;
        const key = [x, y, w, h].map(v => Math.round(v * 10) / 10).join(':');
        if (seen.has(key)) return;
        seen.add(key);
        const r = snapRectPx(x, y, w, h, scale);
        groutRects.push(
          <Rect
            key={`grout-${key}`}
            x={r.x}
            y={r.y}
            width={Math.max(1, r.width)}   // clamp so 5mm @ 0.1 scale doesn't disappear
            height={Math.max(1, r.height)}
            fill={TILE_COLORS.groutColor}
            listening={false}
          />
        );
      };

      // Helper: pick tiles that belong to the coping row NEXT TO the pool for a side
      const firstRowFor = (side: Side): Tile[] => {
        const list = sideTiles[side];
        if (list.length === 0) return [];

        // Correct mapping: 'top' = TOP horizontal edge (y near 0),
        // 'bottom' = BOTTOM horizontal edge (y near pool.width),
        // 'left' = LEFT vertical edge (x near 0),
        // 'right' = RIGHT vertical edge (x near pool.length)

        // We compute a metric that increases towards the pool so "max" is the row adjacent to the pool
        const metric = (t: Tile) => {
          switch (side) {
            case 'top':    return t.y + t.height; // bottom edge toward y=0
            case 'bottom': return -t.y;           // top edge toward y=pool.width
            case 'left':   return t.x + t.width;  // rightmost edge toward x=0
            case 'right':  return -t.x;           // leftmost edge toward x=pool.length
          }
        };
        const best = Math.max(...list.map(metric));
        const EPS = 0.5; // mm tolerance
        return list.filter(t => Math.abs(metric(t) - best) <= EPS);
      };

      // Draw the single band along the pool edge for each side, only for tiles in that first row
      (['top','bottom','left','right'] as Side[]).forEach(side => {
        const row = firstRowFor(side);
        row.forEach(t => {
          switch (side) {
            case 'top':
              // top horizontal pool edge → band immediately BELOW tile
              addRectMm(t.x, t.y + t.height, t.width, G);
              break;
            case 'bottom':
              // bottom horizontal pool edge → band immediately ABOVE tile
              addRectMm(t.x, t.y - G, t.width, G);
              break;
            case 'left':
              // left vertical pool edge → band immediately to the RIGHT of tile
              addRectMm(t.x + t.width, t.y, G, t.height);
              break;
            case 'right':
              // right vertical pool edge → band immediately to the LEFT of tile
              addRectMm(t.x - G, t.y, G, t.height);
              break;
          }
        });
      });

      // Draw grout between all adjacent tiles (dimension-based, no classification needed)
      // For each pair of tiles, check if they're adjacent and draw grout between them
      const allCopingTiles = ([] as Array<{x:number;y:number;width:number;height:number}>)
        .concat(sideTiles.top, sideTiles.bottom, sideTiles.left, sideTiles.right)
        .concat(autoTiles.map(a => ({ x: a.x, y: a.y, width: a.width, height: a.height }))); // include auto
      const EPS = 0.01; // mm tolerance for floating-point comparison

      for (let i = 0; i < allCopingTiles.length; i++) {
        const t1 = allCopingTiles[i];
        for (let j = i + 1; j < allCopingTiles.length; j++) {
          const t2 = allCopingTiles[j];

          const t1x1 = t1.x;
          const t1x2 = t1.x + t1.width;
          const t1y1 = t1.y;
          const t1y2 = t1.y + t1.height;

          const t2x1 = t2.x;
          const t2x2 = t2.x + t2.width;
          const t2y1 = t2.y;
          const t2y2 = t2.y + t2.height;

          // Check for horizontal adjacency (tiles side-by-side in X direction)
          // t1 on left, t2 on right: gap between t1's right edge and t2's left edge
          const gapX1 = t2x1 - t1x2;
          if (gapX1 > -EPS && gapX1 <= G + 1 + EPS) {
            // Check Y overlap
            const overlapY1 = Math.max(t1y1, t2y1);
            const overlapY2 = Math.min(t1y2, t2y2);
            if (overlapY2 > overlapY1) {
              addRectMm(t1x2, overlapY1, gapX1, overlapY2 - overlapY1);
            }
          }

          // t2 on left, t1 on right
          const gapX2 = t1x1 - t2x2;
          if (gapX2 > -EPS && gapX2 <= G + 1 + EPS) {
            const overlapY1 = Math.max(t1y1, t2y1);
            const overlapY2 = Math.min(t1y2, t2y2);
            if (overlapY2 > overlapY1) {
              addRectMm(t2x2, overlapY1, gapX2, overlapY2 - overlapY1);
            }
          }

          // Check for vertical adjacency (tiles stacked in Y direction)
          // t1 on top, t2 on bottom: gap between t1's bottom edge and t2's top edge
          const gapY1 = t2y1 - t1y2;
          if (gapY1 > -EPS && gapY1 <= G + 1 + EPS) {
            // Check X overlap
            const overlapX1 = Math.max(t1x1, t2x1);
            const overlapX2 = Math.min(t1x2, t2x2);
            if (overlapX2 > overlapX1) {
              addRectMm(overlapX1, t1y2, overlapX2 - overlapX1, gapY1);
            }
          }

          // t2 on top, t1 on bottom
          const gapY2 = t1y1 - t2y2;
          if (gapY2 > -EPS && gapY2 <= G + 1 + EPS) {
            const overlapX1 = Math.max(t1x1, t2x1);
            const overlapX2 = Math.min(t1x2, t2x2);
            if (overlapX2 > overlapX1) {
              addRectMm(overlapX1, t2y2, overlapX2 - overlapX1, gapY2);
            }
          }
        }
      }
    }

    // Build tile fill
    const fills: JSX.Element[] = [];
    tiles
      .filter((t) => {
        const w = t.width * scale;
        const h = t.height * scale;
        return w > 0 && h > 0 && isFinite(w) && isFinite(h);
      })
      .forEach((t) => {
        // Use snapRectPx to ensure both edges are snapped to 0.5px
        const r = snapRectPx(t.x, t.y, t.width, t.height, scale);
        const isPartial = t.isPartial;

        fills.push(
          <Group key={`coping-${t.key}`}>
            <Rect
              x={r.x}
              y={r.y}
              width={Math.max(0, r.width)}
              height={Math.max(0, r.height)}
              fill={isPartial ? TILE_COLORS.cutTile : tileFill}
              onContextMenu={(e: Konva.KonvaEventObject<MouseEvent>) => {
                if (!t.key.includes(':user:')) return; // only show context menu for user-added tiles
                e.cancelBubble = true; e.evt.preventDefault();
                onTileContextMenu?.(component, t.key, { x: e.evt.clientX, y: e.evt.clientY });
              }}
            />
            {/* Cut indicator at bottom-right for partial tiles */}
            {isPartial && (
              <Text
                x={r.x + r.width - scissorsSize - scissorsMargin}
                y={r.y + r.height - scissorsSize - scissorsMargin}
                text="✂"
                fontSize={scissorsSize}
                fill={scissorsColor}
                listening={false}
              />
            )}
          </Group>
        );
      });

    // Return clipped grout, pool, and clipped tiles (boundary polygon mask)
    const clip = (ctx: CanvasRenderingContext2D) => {
      if (!boundaryLive || boundaryLive.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(boundaryLive[0].x, boundaryLive[0].y);
      for (let i = 1; i < boundaryLive.length; i++) {
        ctx.lineTo(boundaryLive[i].x, boundaryLive[i].y);
      }
      ctx.closePath();
    };

    return (
      <>
        {/* Grout clipped to boundary */}
        <Group listening={false} clipFunc={clip}>
          {groutRects}
        </Group>
        {/* Pool above grout, under tiles (not clipped by outer boundary) */}
        <Line
          points={points}
          fill={patternImage ? undefined : "rgba(59, 130, 246, 0.3)"}
          fillPatternImage={patternImage || undefined}
          fillPatternScale={patternConfig.scale}
          fillPatternOffset={patternConfig.offset}
          stroke="#3B82F6"
          strokeWidth={2}
          strokeScaleEnabled={false}
          closed
          listening={false}
        />
        {/* Tiles clipped to boundary */}
        <Group clipFunc={clip}>
          {fills}
        </Group>
      </>
    );
  };

  // Extension handles removed; only boundary polygon editing remains for auto-extend

  // Tile selection bounding box removed

  // Render measurements around the exterior edge of the coping
  const renderCopingMeasurements = () => {
    if (!(annotationsVisible || isSelected) || !showCoping || !copingCalc) return null;

    const allTiles: Tile[] = ([] as Tile[])
      .concat(sideTiles.top, sideTiles.bottom, sideTiles.left, sideTiles.right);

    if (allTiles.length === 0) return null;

    // Calculate bounding box of all tiles (in mm)
    const minX = Math.min(...allTiles.map(t => t.x));
    const maxX = Math.max(...allTiles.map(t => t.x + t.width));
    const minY = Math.min(...allTiles.map(t => t.y));
    const maxY = Math.max(...allTiles.map(t => t.y + t.height));

    const measurements: JSX.Element[] = [];
    // Increase offset for coping labels to sit further from edge
    const extra = 12;
    const offset = getAnnotationOffsetPx(component.id, component.position) + extra;

    // Top edge (direction -> +X, perp -> -Y)
    {
      const topWidthMm = Math.round(maxX - minX);
      const midX = ((minX + maxX) / 2) * scale;
      const y = minY * scale;
      const angle = 0;
      const perpX = 0, perpY = -1;
      measurements.push(
        <Text
          key="measure-top"
          x={midX + perpX * offset}
          y={y + perpY * offset}
          text={`Coping: ${topWidthMm}mm`}
          fontSize={11}
          fill="#3B82F6"
          align="center"
          rotation={normalizeLabelAngle(angle)}
          offsetX={20}
          listening={false}
        />
      );
    }

    // Bottom edge (direction -> +X, perp -> +Y)
    {
      const bottomWidthMm = Math.round(maxX - minX);
      const midX = ((minX + maxX) / 2) * scale;
      const y = maxY * scale;
      const angle = 0;
      const perpX = 0, perpY = 1;
      measurements.push(
        <Text
          key="measure-bottom"
          x={midX + perpX * offset}
          y={y + perpY * offset}
          text={`Coping: ${bottomWidthMm}mm`}
          fontSize={11}
          fill="#3B82F6"
          align="center"
          rotation={normalizeLabelAngle(angle)}
          offsetX={20}
          listening={false}
        />
      );
    }

    // Left edge (direction -> +Y, perp -> -X)
    {
      const leftHeightMm = Math.round(maxY - minY);
      const x = minX * scale;
      const midY = ((minY + maxY) / 2) * scale;
      const angle = 90;
      const perpX = -1, perpY = 0;
      measurements.push(
        <Text
          key="measure-left"
          x={x + perpX * offset}
          y={midY + perpY * offset}
          text={`Coping: ${leftHeightMm}mm`}
          fontSize={11}
          fill="#3B82F6"
          align="center"
          rotation={normalizeLabelAngle(angle)}
          offsetX={20}
          listening={false}
        />
      );
    }

    // Right edge (direction -> +Y, perp -> +X)
    {
      const rightHeightMm = Math.round(maxY - minY);
      const x = maxX * scale;
      const midY = ((minY + maxY) / 2) * scale;
      const angle = 90;
      const perpX = 1, perpY = 0;
      measurements.push(
        <Text
          key="measure-right"
          x={x + perpX * offset}
          y={midY + perpY * offset}
          text={`Coping: ${rightHeightMm}mm`}
          fontSize={11}
          fill="#3B82F6"
          align="center"
          rotation={normalizeLabelAngle(angle)}
          offsetX={20}
          listening={false}
        />
      );
    }

    return <>{measurements}</>;
  };


  return (
    <Group
        ref={groupRef}
        x={component.position.x}
        y={component.position.y}
        rotation={component.rotation}
        draggable={activeTool !== 'hand'}
        // Match PaverComponent: clicking the object simply selects it.
        // Tile clearing is handled when the component becomes deselected.
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={handleDragEnd}
      >
        {/* Pool outline - render here only when coping is disabled; otherwise pool is drawn inside coping render between grout and tiles */}
        {!showCoping || !copingCalc ? (
          <Line
            points={points}
            fill={patternImage ? undefined : "rgba(59, 130, 246, 0.3)"}
            fillPatternImage={patternImage || undefined}
            fillPatternScale={patternConfig.scale}
            fillPatternOffset={patternConfig.offset}
            stroke="#3B82F6"
            strokeWidth={2}
            strokeScaleEnabled={false}
            closed
            listening={false}
          />
        ) : null}

        {/* Invisible hit area covering pool + coping - enables clicking pool water */}
      <Rect
        x={clickableBounds.x}
        y={clickableBounds.y}
        width={clickableBounds.width}
        height={clickableBounds.height}
        fill="transparent"
      />

        {/* Render coping pavers (interactive for selection) - AFTER pool outline so they're clickable */}
        {showCoping && copingCalc && (
          <Group>
            {renderCopingTiles()}
          </Group>
        )}


        {/* Deep End label (150mm inset) */}
        <Text
          x={poolData.deepEnd.x * scale}
          y={poolData.deepEnd.y * scale}
          text="DE"
          fontSize={10}
          fontStyle="bold"
          fill="#ffffff"
          align="center"
          offsetX={10}
          offsetY={5}
          rotation={-component.rotation}
        />

        {/* Shallow End label (150mm inset) */}
        <Text
          x={poolData.shallowEnd.x * scale}
          y={poolData.shallowEnd.y * scale}
          text="SE"
          fontSize={10}
          fontStyle="bold"
          fill="#ffffff"
          align="center"
          offsetX={10}
          offsetY={5}
          rotation={-component.rotation}
        />

        {/* Coping measurements when selected */}
        {renderCopingMeasurements()}


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
                dragBoundFunc={(pos: Vector2d) => {
                  const s = gridSize;
                  const local = toLocalFromAbs(pos);
                  const snapped = { x: Math.round(local.x / s) * s, y: Math.round(local.y / s) * s };
                  const abs = toAbsFromLocal(snapped);
                  return { x: abs.x, y: abs.y };
                }}
                onDragStart={(e: Konva.KonvaEventObject<DragEvent>) => {
                  e.cancelBubble = true;
                  setDragIndex(i);
                  setGhostLocal(boundaryLive.slice());
                }}
                onDragMove={(e: Konva.KonvaEventObject<DragEvent>) => {
                  e.cancelBubble = true;
                  if (dragIndex == null) return;
                  const s = gridSize;
                  const abs = e.target.getAbsolutePosition();
                  const local = toLocalFromAbs(abs);
                  const x = Math.round(local.x / s) * s;
                  const y = Math.round(local.y / s) * s;
                  const copy = boundaryLive.slice();
                  copy[dragIndex] = { x, y };
                  setGhostLocal(copy);
                }}
                onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
                  e.cancelBubble = true;
                  if (dragIndex == null) return;
                  const s = gridSize;
                  const abs = e.target.getAbsolutePosition();
                  const local = toLocalFromAbs(abs);
                  const x = Math.round(local.x / s) * s;
                  const y = Math.round(local.y / s) * s;
                  const updated = boundaryLive.slice();
                  updated[dragIndex] = { x, y };
                  // Optimistically keep the ghost to avoid snap-back until store updates
                  setDragIndex(null);
                  setGhostLocal(updated);
                  // Persist the updated boundary - store change will reconcile and then we clear ghost
                  setBoundary(updated);
                }}
              />
            ))}
          </>
        )}
      </Group>
  );
};

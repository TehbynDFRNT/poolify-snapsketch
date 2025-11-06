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
import { useClipMask } from '@/hooks/useClipMask';

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

// Closest point on segment AB to point P
function closestPointOnSegment(p: Pt, a: Pt, b: Pt): Pt {
  const abx = b.x - a.x, aby = b.y - a.y;
  const apx = p.x - a.x, apy = p.y - a.y;
  const ab2 = abx * abx + aby * aby || 1;
  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * abx, y: a.y + t * aby };
}

// If point is outside polygon, clamp to nearest point on polygon boundary
function clampPointToPolygon(p: Pt, poly: Pt[]): Pt {
  if (!poly || poly.length < 3) return p;
  if (pointInPolygon(p, poly) || isPointNearPolygonBoundary(p, poly, 0.01)) return p;
  let best: Pt | null = null;
  let bestD2 = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const q = closestPointOnSegment(p, a, b);
    const dx = p.x - q.x, dy = p.y - q.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) { bestD2 = d2; best = q; }
  }
  return best || p;
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
  const { polygon: projectClipStage } = useClipMask();

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

  // Deterministic stage->local transform using component position/rotation (avoids ref timing issues)
  const stageToLocalSimple = (p: Pt): Pt => {
    const dx = p.x - component.position.x;
    const dy = p.y - component.position.y;
    const rad = (component.rotation * Math.PI) / 180;
    const cos = Math.floor(Math.cos(rad) * 1e12) / 1e12; // minor stabilize
    const sin = Math.floor(Math.sin(rad) * 1e12) / 1e12;
    return {
      x: dx * cos + dy * sin,
      y: -dx * sin + dy * cos,
    };
  };

  // Transform using an arbitrary position (used for group-drag preview commit)
  const stageToLocalAt = (p: Pt, pos: { x: number; y: number }): Pt => {
    const dx = p.x - pos.x;
    const dy = p.y - pos.y;
    const rad = (component.rotation * Math.PI) / 180;
    const cos = Math.floor(Math.cos(rad) * 1e12) / 1e12;
    const sin = Math.floor(Math.sin(rad) * 1e12) / 1e12;
    return {
      x: dx * cos + dy * sin,
      y: -dx * sin + dy * cos,
    };
  };

  // Project boundary (stage-space) converted to pool-local once per render
  const projectClipLocal: Pt[] | null = useMemo(() => {
    return projectClipStage ? projectClipStage.map(stageToLocalSimple) : null;
  }, [projectClipStage, component.position.x, component.position.y, component.rotation]);

  

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

  // --- Polygon clipping (Sutherland–Hodgman) to fit coping boundary within project boundary ---
  const polygonArea2 = (poly: Pt[]) => poly.reduce((a, p, i) => {
    const q = poly[(i + 1) % poly.length];
    return a + (p.x * q.y - q.x * p.y);
  }, 0);

  const intersectionPoint = (s: Pt, e: Pt, a: Pt, b: Pt): Pt => {
    const A1 = e.y - s.y;
    const B1 = s.x - e.x;
    const C1 = A1 * s.x + B1 * s.y;
    const A2 = b.y - a.y;
    const B2 = a.x - b.x;
    const C2 = A2 * a.x + B2 * a.y;
    const det = A1 * B2 - A2 * B1 || 1e-12;
    return { x: (B2 * C1 - B1 * C2) / det, y: (A1 * C2 - A2 * C1) / det };
  };

  const clipPolygon = (subject: Pt[], clip: Pt[]): Pt[] => {
    if (!clip || clip.length < 3 || !subject || subject.length < 3) return subject;
    // Determine clip orientation; inside is to the left if CCW, to the right if CW
    const clipCCW = polygonArea2(clip) > 0; // positive area => CCW
    let output = subject.slice();
    for (let i = 0; i < clip.length; i++) {
      const A = clip[i];
      const B = clip[(i + 1) % clip.length];
      const edge = (p: Pt) => (B.x - A.x) * (p.y - A.y) - (B.y - A.y) * (p.x - A.x);
      const inside = (p: Pt) => clipCCW ? edge(p) >= 0 : edge(p) <= 0;
      const input = output.slice();
      output = [];
      if (input.length === 0) break;
      for (let j = 0; j < input.length; j++) {
        const S = input[j];
        const E = input[(j + 1) % input.length];
        const Ein = inside(E);
        const Sin = inside(S);
        if (Ein) {
          if (!Sin) output.push(intersectionPoint(S, E, A, B));
          output.push(E);
        } else if (Sin) {
          output.push(intersectionPoint(S, E, A, B));
        }
      }
    }
    // Remove near-duplicate points
    const dedup: Pt[] = [];
    const eps = 1e-6;
    for (const p of output) {
      const last = dedup[dedup.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) > eps) dedup.push(p);
    }
    return dedup;
  };

  // Remove redundant vertices: near-duplicates and collinear points within tolerance
  const simplifyPolygon = (poly: Pt[], eps = 1e-6): Pt[] => {
    if (!poly || poly.length < 3) return poly || [];
    // Remove consecutive duplicates first
    const uniq: Pt[] = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const last = uniq[uniq.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) > eps) uniq.push(p);
    }
    // If closes back to start, drop the last
    if (uniq.length >= 2) {
      const first = uniq[0], last = uniq[uniq.length - 1];
      if (Math.hypot(first.x - last.x, first.y - last.y) <= eps) uniq.pop();
    }
    if (uniq.length < 3) return uniq;
    // Remove collinear points
    const out: Pt[] = [];
    const n = uniq.length;
    const isCollinear = (a: Pt, b: Pt, c: Pt): boolean => {
      const abx = b.x - a.x, aby = b.y - a.y;
      const bcx = c.x - b.x, bcy = c.y - b.y;
      const cross = Math.abs(abx * bcy - aby * bcx);
      const abLen = Math.hypot(abx, aby) || 1;
      const bcLen = Math.hypot(bcx, bcy) || 1;
      // scale-invariant collinearity tolerance
      return cross <= eps * (abLen + bcLen);
    };
    for (let i = 0; i < n; i++) {
      const a = uniq[(i - 1 + n) % n];
      const b = uniq[i];
      const c = uniq[(i + 1) % n];
      if (!isCollinear(a, b, c)) out.push(b);
    }
    // Edge case: if everything became collinear, fall back to uniq
    return out.length >= 3 ? out : uniq;
  };

  const setBoundaryClipped = (localPts: Pt[]) => {
    if (projectClipLocal && projectClipLocal.length >= 3) {
      const clipped = simplifyPolygon(clipPolygon(localPts, projectClipLocal));
      if (clipped && clipped.length >= 3) {
        // keep UI in sync immediately while store updates
        setGhostLocal(clipped);
        setBoundary(clipped);
        return;
      }
      // fallback: clamp last vertex to boundary if clip fully eliminates polygon
      const last = localPts[localPts.length - 1];
      const clamped = clampPointToPolygon(last, projectClipLocal);
      const copy = localPts.slice();
      copy[copy.length - 1] = clamped;
      const simple = simplifyPolygon(copy);
      setGhostLocal(simple);
      setBoundary(simple);
      return;
    }
    const simple = simplifyPolygon(localPts);
    setGhostLocal(simple);
    setBoundary(simple);
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

  // (moved tile-edge snapping definitions below autoTilesMM to avoid TDZ)

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

    // Use precomputed projectClipLocal (pool-local)

    const rectIntersectsBoth = (sr: StageRect) => {
      const hitOuter = rectIntersectsPolygon(sr, outer);
      const hitGlobal = projectClipLocal ? rectIntersectsPolygon(sr, projectClipLocal) : true;
      return hitOuter && hitGlobal;
    };
    const rectInsideBoth = (sr: StageRect) => {
      const inOuter = rectFullyInsidePolygon(sr, outer);
      const inGlobal = projectClipLocal ? rectFullyInsidePolygon(sr, projectClipLocal) : true;
      return inOuter && inGlobal;
    };

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
    // Pool interior (non-tilable) in stage units
    const poolStageRect: StageRect = {
      x: 0,
      y: 0,
      w: poolData.length * scale,
      h: poolData.width * scale,
    };

    (['top','bottom','left','right'] as Side[]).forEach(side => {
      const seeds = getOutermostRowTiles(side);
      if (seeds.length === 0) return;

      const { axis, sign, stepMm } = sideAxis[side];

      // For each tile in the outermost row, step outward until it no longer intersects the boundary
      seeds.forEach(seed => {
        // First check if this seed tile is near the extended boundary area
        // Only generate auto-tiles for seeds that are actually affected by the boundary extension
        const seedStageRect: StageRect = {
          x: roundHalf(seed.x * scale),
          y: roundHalf(seed.y * scale),
          w: Math.max(1, roundHalf(seed.width * scale)),
          h: Math.max(1, roundHalf(seed.height * scale)),
        };

        // Check if the next potential tile position would be within the extended boundary
        // This prevents generating tiles for the entire perimeter when only a small area is extended
        const firstStepMm = stepMm * sign;
        const testXMm = axis === 'x' ? (seed.x + firstStepMm) : seed.x;
        const testYMm = axis === 'y' ? (seed.y + firstStepMm) : seed.y;
        const testRect: StageRect = {
          x: roundHalf(testXMm * scale),
          y: roundHalf(testYMm * scale),
          w: Math.max(1, roundHalf(seed.width * scale)),
          h: Math.max(1, roundHalf(seed.height * scale)),
        };

        // Skip this seed if the first extension doesn't intersect the boundary
        // This means the boundary wasn't extended in this area
        if (!rectIntersectsPolygon(testRect, outer)) return;

        let s = 1;
        // conservative max steps bound using bbox of (outer ∩ projectClip), approximated by bbox intersection if available
        const bx = outer.map(p => p.x), by = outer.map(p => p.y);
        let minX = Math.min(...bx), maxX = Math.max(...bx);
        let minY = Math.min(...by), maxY = Math.max(...by);
        if (projectClipLocal && projectClipLocal.length >= 3) {
          const gx = projectClipLocal.map(p => p.x), gy = projectClipLocal.map(p => p.y);
          const gminX = Math.min(...gx), gmaxX = Math.max(...gx);
          const gminY = Math.min(...gy), gmaxY = Math.max(...gy);
          // bbox intersection
          minX = Math.max(minX, gminX);
          maxX = Math.min(maxX, gmaxX);
          minY = Math.max(minY, gminY);
          maxY = Math.min(maxY, gmaxY);
        }
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

          // Outside either polygon? stop for this column
          if (!rectIntersectsBoth(stageRect)) break;
          // Never place tiles inside pool interior
          if (stageOverlaps(stageRect, poolStageRect)) { s++; continue; }

          // Skip overlaps with base/user or already-added
          if (!overlapsExistingOrAdded(stageRect)) {
            addedStage.push(stageRect);

            const isPartialOuter = !rectInsideBoth(stageRect);
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

    // Corner infill: scan aligned grids in both orientations to catch triangular gaps near corners
    const bx = outer.map(p => p.x), by = outer.map(p => p.y);
    const minXpx = Math.min(...bx), maxXpx = Math.max(...bx);
    const minYpx = Math.min(...by), maxYpx = Math.max(...by);
    const minXmm = minXpx / scale, maxXmm = maxXpx / scale;
    const minYmm = minYpx / scale, maxYmm = maxYpx / scale;

    const sampleH = baseTilesMM.top[0] || baseTilesMM.bottom[0] || userTilesMM.find(t => t.side === 'top' || t.side === 'bottom');
    const sampleV = baseTilesMM.left[0] || baseTilesMM.right[0] || userTilesMM.find(t => t.side === 'left' || t.side === 'right');
    const hW = sampleH?.width || 600; // fallback reasonable length
    const hH = sampleH?.height || depthMm.horizontal;
    const vW = sampleV?.width || depthMm.vertical;
    const vH = sampleV?.height || 600; // fallback reasonable length
    const hRefX = sampleH?.x || 0;
    const hRefY = sampleH?.y || 0;
    const vRefX = sampleV?.x || 0;
    const vRefY = sampleV?.y || 0;

    const alignStart = (min: number, ref: number, step: number) => {
      if (step <= 0) return min;
      const k = Math.floor((min - ref) / step) - 1;
      return ref + k * step;
    };

    const tryAdd = (xmm: number, ymm: number, w: number, h: number, side: Side) => {
      const sr: StageRect = {
        x: roundHalf(xmm * scale),
        y: roundHalf(ymm * scale),
        w: Math.max(1, roundHalf(w * scale)),
        h: Math.max(1, roundHalf(h * scale)),
      };
      if (!rectIntersectsBoth(sr)) return;
      // Exclude pool interior
      if (stageOverlaps(sr, poolStageRect)) return;
      if (overlapsExistingOrAdded(sr)) return;
      addedStage.push(sr);
      produced.push({
        x: xmm,
        y: ymm,
        width: w,
        height: h,
        isPartial: !rectInsideBoth(sr),
        side,
      });
    };

    // Corner-anchored infill using rectangular step (tileWidth x tileHeight) to align grout
    const grout = TILE_GAP.size || 0;
    const tileW = (sampleH?.width || sampleV?.width || hW || vW || 400);
    const tileH = (sampleH?.height || sampleV?.height || hH || vH || 400);
    const stepX = tileW + grout;       // spacing along X
    const stepY = tileH + grout;       // spacing along Y

    const firstAtLeast = (th: number, ref: number, step: number) => ref + Math.ceil((th - ref) / step) * step;
    const lastAtMost   = (th: number, ref: number, step: number) => ref + Math.floor((th - ref) / step) * step;

    if (stepX > 0 && stepY > 0) {
      // Anchor to pool edges + grout so the first outboard gridline touches the grout band
      const rightAnchorX = poolData.length + grout;  // first gridline to the right of pool
      const leftAnchorX  = -stepX;                   // first gridline to the left of pool
      const topAnchorY   = -stepY;                   // first gridline above pool
      const botAnchorY   = poolData.width + grout;   // first gridline below pool

      // Top-Right corner: x → +, y → -
      for (let y = topAnchorY; y >= minYmm - stepY; y -= stepY) {
        for (let x = rightAnchorX; x <= maxXmm + stepX; x += stepX) {
          tryAdd(x, y, tileW, tileH, 'top');
        }
      }

      // Top-Left corner: x → -, y → -
      for (let y = topAnchorY; y >= minYmm - stepY; y -= stepY) {
        for (let x = leftAnchorX; x >= minXmm - stepX; x -= stepX) {
          tryAdd(x, y, tileW, tileH, 'top');
        }
      }

      // Bottom-Right corner: x → +, y → +
      for (let y = botAnchorY; y <= maxYmm + stepY; y += stepY) {
        for (let x = rightAnchorX; x <= maxXmm + stepX; x += stepX) {
          tryAdd(x, y, tileW, tileH, 'top');
        }
      }

      // Bottom-Left corner: x → -, y → +
      for (let y = botAnchorY; y <= maxYmm + stepY; y += stepY) {
        for (let x = leftAnchorX; x >= minXmm - stepX; x -= stepX) {
          tryAdd(x, y, tileW, tileH, 'top');
        }
      }
    }

    return produced;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundaryKey, defaultBoundary, copingCalc, component.properties.copingTiles, showCoping, scale, tileDepthMm.horizontal, tileDepthMm.vertical, projectClipStage, component.position.x, component.position.y, component.rotation]);

  // Secondary snap-to-tile edges (in pool-local/stage units)
  const tileEdgeLines = useMemo(() => {
    const xs = new Set<number>();
    const ys = new Set<number>();
    const addRectMm = (xmm: number, ymm: number, wmm: number, hmm: number) => {
      const lx = roundHalf(xmm * scale);
      const rx = roundHalf((xmm + wmm) * scale);
      const ty = roundHalf(ymm * scale);
      const by = roundHalf((ymm + hmm) * scale);
      xs.add(lx); xs.add(rx);
      ys.add(ty); ys.add(by);
    };
    // Base ring
    (copingCalc?.leftSide?.paverPositions || []).forEach(p => addRectMm(p.x, p.y, p.width, p.height));
    (copingCalc?.rightSide?.paverPositions || []).forEach(p => addRectMm(p.x, p.y, p.width, p.height));
    (copingCalc?.shallowEnd?.paverPositions || []).forEach(p => addRectMm(p.x, p.y, p.width, p.height));
    (copingCalc?.deepEnd?.paverPositions || []).forEach(p => addRectMm(p.x, p.y, p.width, p.height));
    // User tiles
    (component.properties.copingTiles || []).forEach((t: any) => addRectMm(t.x, t.y, t.width, t.height));
    // Auto tiles
    (autoTilesMM || []).forEach(t => addRectMm(t.x, t.y, t.width, t.height));
    const xArr = Array.from(xs.values()).sort((a, b) => a - b);
    const yArr = Array.from(ys.values()).sort((a, b) => a - b);
    return { xArr, yArr };
  }, [copingCalc, component.properties.copingTiles, autoTilesMM, scale]);

  const snapWithSecondaryTileEdges = (local: Pt, gridPt: Pt): Pt => {
    const tol = Math.min(8, GRID_CONFIG.spacing * 0.35); // px tolerance
    let bestTilePt: Pt | null = null;
    let bestTileDist = Infinity;
    // Nearest vertical edge
    for (const x of tileEdgeLines.xArr) {
      const dx = Math.abs(local.x - x);
      if (dx <= tol && dx < bestTileDist) {
        bestTileDist = dx;
        bestTilePt = { x, y: local.y };
      } else if (dx > tol && x > local.x + tol) break;
    }
    // Nearest horizontal edge
    for (const y of tileEdgeLines.yArr) {
      const dy = Math.abs(local.y - y);
      if (dy <= tol && dy < bestTileDist) {
        bestTileDist = dy;
        bestTilePt = { x: local.x, y };
      } else if (dy > tol && y > local.y + tol) break;
    }
    const gridDist = Math.hypot(local.x - gridPt.x, local.y - gridPt.y);
    if (bestTilePt) {
      const tileDist = Math.hypot(local.x - bestTilePt.x, local.y - bestTilePt.y);
      // Only use tile snap if clearly intended (closer than grid and within tol)
      if (tileDist + 1e-6 < gridDist && bestTileDist <= tol) return bestTilePt;
    }
    return gridPt;
  };

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
    // Recompute clipped boundary at the new position and persist
    if (projectClipStage && projectClipStage.length >= 3) {
      const projLocalAt = projectClipStage.map((p) => stageToLocalAt(p, snappedPos));
      const clipped = clipPolygon(boundaryLocal, projLocalAt);
      if (clipped && clipped.length >= 3) {
        updateComponent(component.id, {
          position: snappedPos,
          properties: { ...component.properties, copingBoundary: clipped }
        });
      } else {
        updateComponent(component.id, { position: snappedPos });
      }
    } else {
      updateComponent(component.id, { position: snappedPos });
    }
    // Also notify parent if needed (safe redundancy)
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
      setBoundaryClipped(next);
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
    let local = toLocalFromAbs(pr);
    if (projectClipLocal && projectClipLocal.length >= 3) {
      local = clampPointToPolygon(local, projectClipLocal);
    }
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
    // Use precomputed projectClipLocal (pool-local) for grout checks
    if (TILE_GAP.renderGap && G > 0) {
      const seen = new Set<string>();

      const addRectMm = (x: number, y: number, w: number, h: number) => {
        if (w <= 0 || h <= 0 || !isFinite(w) || !isFinite(h)) return;
        const key = [x, y, w, h].map(v => Math.round(v * 10) / 10).join(':');
        if (seen.has(key)) return;
        // Skip grout outside the project clip (if present)
        if (projectClipLocal) {
          const rr = { x: roundHalf(x * scale), y: roundHalf(y * scale), w: Math.max(1, roundHalf(w * scale)), h: Math.max(1, roundHalf(h * scale)) };
          if (!rectIntersectsPolygon(rr, projectClipLocal)) return;
        }
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

    // Optional outer clip for project boundary to visually cut tiles when pool moves beyond it
    const projectClip = (ctx: CanvasRenderingContext2D) => {
      if (!projectClipLocal || projectClipLocal.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(projectClipLocal[0].x, projectClipLocal[0].y);
      for (let i = 1; i < projectClipLocal.length; i++) ctx.lineTo(projectClipLocal[i].x, projectClipLocal[i].y);
      ctx.closePath();
    };

    const tilesAndGrout = (
      <>
        {/* Grout clipped to coping boundary */}
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
        {/* Tiles clipped to coping boundary */}
        <Group clipFunc={clip}>
          {fills}
        </Group>
      </>
    );

    return projectClipLocal && projectClipLocal.length >= 3
      ? (<Group listening={false} clipFunc={projectClip}>{tilesAndGrout}</Group>)
      : tilesAndGrout;
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
          (() => {
            const overlay = (
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
                  // Allow preview to pass beyond boundary; snap to grid with secondary tile-edge snap
                  const s = gridSize;
                  const local = toLocalFromAbs(pos);
                  const grid = { x: Math.round(local.x / s) * s, y: Math.round(local.y / s) * s };
                  const snapped = snapWithSecondaryTileEdges(local, grid);
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
                  const grid = { x: Math.round(local.x / s) * s, y: Math.round(local.y / s) * s };
                  const { x, y } = snapWithSecondaryTileEdges(local, grid);
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
                  const grid = { x: Math.round(local.x / s) * s, y: Math.round(local.y / s) * s };
                  const { x, y } = snapWithSecondaryTileEdges(local, grid);
                  const updated = boundaryLive.slice();
                  updated[dragIndex] = { x, y };
                  setDragIndex(null);
                  // Keep ghost to show immediate result; cleared once store matches
                  setBoundaryClipped(updated);
                }}
                  />
                ))}
              </>
            );
            if (projectClipLocal && projectClipLocal.length >= 3) {
              const clipOverlay = (ctx: CanvasRenderingContext2D) => {
                ctx.beginPath();
                ctx.moveTo(projectClipLocal![0].x, projectClipLocal![0].y);
                for (let i = 1; i < projectClipLocal!.length; i++) ctx.lineTo(projectClipLocal![i].x, projectClipLocal![i].y);
                ctx.closePath();
              };
              return <Group clipFunc={clipOverlay}>{overlay}</Group>;
            }
            return overlay;
          })()
        )}
      </Group>
  );
};

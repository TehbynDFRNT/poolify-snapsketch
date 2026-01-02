import { useRef, useMemo, useState, useEffect } from 'react';
import { Group, Line, Text, Circle, Rect } from 'react-konva';
import type Konva from 'konva';
import type { Vector2d } from 'konva/lib/types';
import { Component, SimpleCopingConfig } from '@/types';
import { POOL_LIBRARY } from '@/constants/pools';
import {
  calculateCopingStats,
  expandPolygon,
  expandPolygonPerEdge,
  getTileDepthFromConfig,
} from '@/utils/copingCalculation';
import { useDesignStore } from '@/store/designStore';
import { snapPoolToPaverGrid } from '@/utils/snap';
import { TILE_COLORS, TILE_GAP } from '@/constants/tileConfig';
import { getAnnotationOffsetPx } from '@/utils/annotations';
import { GRID_CONFIG } from '@/constants/grid';
import { BLUEPRINT_COLORS } from '@/constants/blueprintColors';

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
  const { components: allComponents, updateComponent, updateComponentSilent, zoom, annotationsVisible, blueprintMode } = useDesignStore();
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

  // Calculate coping if enabled (simplified - no tile arrays)
  const showCoping = component.properties.showCoping ?? false;
  const copingConfig = component.properties.copingConfig as SimpleCopingConfig | undefined;

  // Get tile depth for band width calculation
  const tileDepthMm = useMemo(() => {
    if (!copingConfig) return 400;
    return getTileDepthFromConfig(copingConfig);
  }, [copingConfig]);

  // Coping band width in stage units (for sides and shallow end)
  const copingBandWidth = useMemo(() => {
    if (!showCoping || !copingConfig) return 0;
    const rows = copingConfig.rowsPerSide || 1;
    return (tileDepthMm * rows + TILE_GAP.size) * scale;
  }, [showCoping, copingConfig, tileDepthMm, scale]);

  // Deep end gets extra rows (default 2 rows vs 1 for sides)
  const deepEndBandWidth = useMemo(() => {
    if (!showCoping || !copingConfig) return 0;
    const deepRows = copingConfig.rowsDeepEnd ?? 2;
    return (tileDepthMm * deepRows + TILE_GAP.size) * scale;
  }, [showCoping, copingConfig, tileDepthMm, scale]);

  // Identify which edge is the deep end based on deepEnd position
  // Deep end is the edge closest to the deepEnd label position
  // Works with any polygon shape (rectangles, T-shapes, etc.)
  const deepEndEdgeIndex = useMemo(() => {
    if (!poolData.deepEnd || !scaledOutline || scaledOutline.length < 3) return -1;
    const de = { x: poolData.deepEnd.x * scale, y: poolData.deepEnd.y * scale };

    // Helper: calculate distance from point to line segment
    const pointToSegmentDist = (p: Pt, a: Pt, b: Pt): number => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y); // a === b

      // Project point onto line, clamped to segment
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
      const proj = { x: a.x + t * dx, y: a.y + t * dy };
      return Math.hypot(p.x - proj.x, p.y - proj.y);
    };

    // Find the edge closest to the deep end position
    const n = scaledOutline.length;
    let bestEdge = -1;
    let bestDist = Infinity;

    for (let i = 0; i < n; i++) {
      const a = scaledOutline[i];
      const b = scaledOutline[(i + 1) % n];
      const dist = pointToSegmentDist(de, a, b);
      if (dist < bestDist) {
        bestDist = dist;
        bestEdge = i;
      }
    }

    return bestEdge;
  }, [poolData.deepEnd, scaledOutline, scale]);

  // Default boundary: use the unified copingOuterEdge (includes deep end width)
  // This is computed AFTER copingOuterEdge to avoid circular dependency
  const defaultBoundary: Pt[] = useMemo(() => {
    if (!showCoping || copingBandWidth <= 0) {
      // No coping - use pool rectangle
      const minX = 0, minY = 0, maxX = poolData.length * scale, maxY = poolData.width * scale;
      return [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ];
    }

    // Use unified outer edge (includes deep end extra width)
    // Note: copingOuterEdge is defined after this, so we need to compute it here
    if (deepEndEdgeIndex < 0 || deepEndBandWidth <= copingBandWidth) {
      return expandPolygon(scaledOutline, copingBandWidth);
    }

    let cleanOutline = scaledOutline;
    if (scaledOutline.length > 3) {
      const first = scaledOutline[0];
      const last = scaledOutline[scaledOutline.length - 1];
      if (Math.abs(first.x - last.x) < 0.1 && Math.abs(first.y - last.y) < 0.1) {
        cleanOutline = scaledOutline.slice(0, -1);
      }
    }

    const n = cleanOutline.length;
    const edgeDistances: number[] = [];
    for (let i = 0; i < n; i++) {
      edgeDistances.push(i === deepEndEdgeIndex ? deepEndBandWidth : copingBandWidth);
    }

    return expandPolygonPerEdge(scaledOutline, edgeDistances);
  }, [showCoping, copingBandWidth, deepEndBandWidth, deepEndEdgeIndex, scaledOutline, poolData.length, poolData.width, scale]);

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

  // Sutherland-Hodgman polygon clipping algorithm
  // IMPORTANT: This algorithm requires the CLIP polygon (2nd argument) to be CONVEX.
  // Subject polygon (1st argument) can be concave. If clip is concave, results are incorrect.
  // For rect-poly intersections, ensure the rectangle is the clip (see intersectAreaRectPoly).
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

  // --- Visible-area helpers (stage-space) ---
  const rectToPoly = (sr: { x: number; y: number; w: number; h: number }): Pt[] => {
    return [
      { x: sr.x,         y: sr.y },
      { x: sr.x + sr.w,  y: sr.y },
      { x: sr.x + sr.w,  y: sr.y + sr.h },
      { x: sr.x,         y: sr.y + sr.h },
    ];
  };
  const polyAreaAbs = (poly: Pt[]): number => {
    // polygonArea2 is defined above; returns "twice area" (signed)
    return Math.abs(polygonArea2(poly)) / 2;
  };
  // Compute area(rect ∩ poly) safely by clipping the (possibly concave) polygon
  // with the rectangle (convex). Sutherland-Hodgman requires the CLIP polygon to be convex.
  const intersectAreaRectPoly = (sr: { x: number; y: number; w: number; h: number }, poly: Pt[] | null): number => {
    if (!poly || poly.length < 3) return 0;
    const rect = rectToPoly(sr);
    const clipped = clipPolygon(poly, rect); // clip = rectangle (convex) -> correct for concave boundaries
    return clipped.length >= 3 ? polyAreaAbs(clipped) : 0;
  };

  const setBoundaryClipped = (localPts: Pt[]) => {
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

  // ============================================================================
  // SIMPLIFIED COPING - Solid band rendering, no tile arrays
  // ============================================================================

  // Coping outer edge (base coping ring expanded from pool)
  // Uses per-edge expansion to give deep end edge more width (no seam)
  const copingOuterEdge: Pt[] = useMemo(() => {
    if (!showCoping || copingBandWidth <= 0) return scaledOutline;

    // If deep end has same width as sides, use uniform expansion
    if (deepEndEdgeIndex < 0 || deepEndBandWidth <= copingBandWidth) {
      return expandPolygon(scaledOutline, copingBandWidth);
    }

    // Build per-edge distances array with deep end getting extra width
    // Clean the outline first to get correct edge count
    let cleanOutline = scaledOutline;
    if (scaledOutline.length > 3) {
      const first = scaledOutline[0];
      const last = scaledOutline[scaledOutline.length - 1];
      if (Math.abs(first.x - last.x) < 0.1 && Math.abs(first.y - last.y) < 0.1) {
        cleanOutline = scaledOutline.slice(0, -1);
      }
    }

    const n = cleanOutline.length;
    const edgeDistances: number[] = [];
    for (let i = 0; i < n; i++) {
      edgeDistances.push(i === deepEndEdgeIndex ? deepEndBandWidth : copingBandWidth);
    }

    return expandPolygonPerEdge(scaledOutline, edgeDistances);
  }, [showCoping, copingBandWidth, deepEndBandWidth, deepEndEdgeIndex, scaledOutline]);

  // Check if boundary has been extended beyond default
  const hasExtension = useMemo(() => {
    if (!showCoping) return false;
    const boundary = boundaryLive;
    const outer = copingOuterEdge;
    if (boundary.length !== outer.length) return true;
    const EPS = 1; // 1 pixel tolerance
    return boundary.some((p, i) =>
      Math.abs(p.x - outer[i].x) > EPS || Math.abs(p.y - outer[i].y) > EPS
    );
  }, [showCoping, boundaryLive, copingOuterEdge]);

  // Calculate coping statistics
  const copingStats = useMemo(() => {
    if (!showCoping || !copingConfig) return null;
    return calculateCopingStats(
      poolData.outline,
      copingConfig,
      boundaryLive,
      scale
    );
  }, [showCoping, copingConfig, poolData.outline, boundaryLive, scale]);

  // Update component properties when stats change
  // Use silent update to avoid polluting undo/redo history with derived data
  useEffect(() => {
    if (!copingStats) return;
    const prev = component.properties.copingStatistics as SimpleCopingStats | undefined;
    if (!prev ||
        Math.abs((prev.areaM2 || 0) - copingStats.areaM2) > 0.001 ||
        Math.abs((prev.baseCopingAreaM2 || 0) - copingStats.baseCopingAreaM2) > 0.001 ||
        Math.abs((prev.extensionAreaM2 || 0) - copingStats.extensionAreaM2) > 0.001) {
      updateComponentSilent(component.id, {
        properties: { copingStatistics: copingStats }
      });
    }
  }, [copingStats, component.id, component.properties.copingStatistics, updateComponentSilent]);


  // Pattern is pre-rendered at exact pool size, so use 1:1 scale and (0,0) offset
  const patternConfig = useMemo(() => {
    return {
      scale: { x: 1, y: 1 },
      offset: { x: 0, y: 0 }
    };
  }, []);

  // Calculate clickable bounds based on coping boundary AND copingOuterEdge
  // copingOuterEdge includes deep end extra width, boundary may extend beyond that
  const clickableBounds = useMemo(() => {
    if (!showCoping || copingBandWidth <= 0) {
      // No coping - use pool dimensions with padding
      const width = Math.max(20, poolData.length * scale + 20);
      const height = Math.max(20, poolData.width * scale + 20);
      return { x: -10, y: -10, width, height };
    }

    // Combine boundary and coping outer edge to get full extent
    const allPoints = [...boundaryLive, ...copingOuterEdge];
    const xs = allPoints.map(p => p.x);
    const ys = allPoints.map(p => p.y);
    const minX = Math.min(...xs, 0);
    const maxX = Math.max(...xs, poolData.length * scale);
    const minY = Math.min(...ys, 0);
    const maxY = Math.max(...ys, poolData.width * scale);

    return {
      x: minX - 10,
      y: minY - 10,
      width: Math.max(20, maxX - minX + 20),
      height: Math.max(20, maxY - minY + 20),
    };
  }, [showCoping, copingBandWidth, boundaryLive, copingOuterEdge, poolData.length, poolData.width, scale]);

  // Simplified snap function (no tile-edge snapping)
  const snapWithSecondaryTileEdges = (local: Pt, gridPt: Pt): Pt => {
    // Just return grid point - no tile edge snapping in simplified system
    return gridPt;
  };

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
    updateComponent(component.id, { position: snappedPos });
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
    const local = toLocalFromAbs(pr);
    insertNodeAt(local);
  };


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
  // ============================================================================
  // SIMPLIFIED COPING RENDERER - Solid band instead of individual tiles
  // ============================================================================
  const renderCoping = () => {
    if (!showCoping || copingBandWidth <= 0) return null;

    const tileFill = blueprintMode ? BLUEPRINT_COLORS.fillMedium : TILE_COLORS.baseTile; // sandstone color
    const extensionFill = blueprintMode ? BLUEPRINT_COLORS.fillLight : '#F3EBD9'; // lighter shade for extensions
    const groutColor = blueprintMode ? BLUEPRINT_COLORS.tertiary : TILE_COLORS.groutColor;
    const groutWidth = Math.max(1, TILE_GAP.size * scale); // grout band width in pixels

    // Clip to coping boundary (donut shape: boundary minus pool)
    const clipDonut = (ctx: CanvasRenderingContext2D) => {
      const boundary = boundaryLive;
      const inner = scaledOutline;
      if (!boundary || boundary.length < 3 || !inner || inner.length < 3) return;

      // Draw outer boundary clockwise
      ctx.beginPath();
      ctx.moveTo(boundary[0].x, boundary[0].y);
      for (let i = 1; i < boundary.length; i++) {
        ctx.lineTo(boundary[i].x, boundary[i].y);
      }
      ctx.closePath();

      // Draw inner pool counter-clockwise (creates hole)
      ctx.moveTo(inner[inner.length - 1].x, inner[inner.length - 1].y);
      for (let i = inner.length - 2; i >= 0; i--) {
        ctx.lineTo(inner[i].x, inner[i].y);
      }
      ctx.closePath();
    };

    // Clip for base coping only (outer edge of base ring minus pool)
    const clipBaseCoping = (ctx: CanvasRenderingContext2D) => {
      const outer = copingOuterEdge;
      const inner = scaledOutline;
      if (!outer || outer.length < 3 || !inner || inner.length < 3) return;

      ctx.beginPath();
      ctx.moveTo(outer[0].x, outer[0].y);
      for (let i = 1; i < outer.length; i++) {
        ctx.lineTo(outer[i].x, outer[i].y);
      }
      ctx.closePath();

      ctx.moveTo(inner[inner.length - 1].x, inner[inner.length - 1].y);
      for (let i = inner.length - 2; i >= 0; i--) {
        ctx.lineTo(inner[i].x, inner[i].y);
      }
      ctx.closePath();
    };

    // Clip for extension only (boundary minus outer edge of base ring)
    const clipExtension = (ctx: CanvasRenderingContext2D) => {
      const boundary = boundaryLive;
      const inner = copingOuterEdge;
      if (!boundary || boundary.length < 3 || !inner || inner.length < 3) return;

      ctx.beginPath();
      ctx.moveTo(boundary[0].x, boundary[0].y);
      for (let i = 1; i < boundary.length; i++) {
        ctx.lineTo(boundary[i].x, boundary[i].y);
      }
      ctx.closePath();

      ctx.moveTo(inner[inner.length - 1].x, inner[inner.length - 1].y);
      for (let i = inner.length - 2; i >= 0; i--) {
        ctx.lineTo(inner[i].x, inner[i].y);
      }
      ctx.closePath();
    };

    // Calculate bounds for fill rectangles
    const allPoints = [...boundaryLive, ...scaledOutline];
    const xs = allPoints.map(p => p.x);
    const ys = allPoints.map(p => p.y);
    const minX = Math.min(...xs) - 10;
    const maxX = Math.max(...xs) + 10;
    const minY = Math.min(...ys) - 10;
    const maxY = Math.max(...ys) + 10;

    const content = (
      <>
        {/* Grout band around pool edge */}
        <Line
          points={scaledOutline.flatMap(p => [p.x, p.y])}
          stroke={groutColor}
          strokeWidth={groutWidth}
          closed
          listening={false}
        />

        {/* Base coping band (sandstone color) - includes deep end extra width */}
        <Group clipFunc={clipBaseCoping}>
          <Rect
            x={minX}
            y={minY}
            width={maxX - minX}
            height={maxY - minY}
            fill={tileFill}
            listening={false}
          />
        </Group>

        {/* Extension area (lighter shade) - only if boundary extends beyond base */}
        {hasExtension && (
          <Group clipFunc={clipExtension}>
            <Rect
              x={minX}
              y={minY}
              width={maxX - minX}
              height={maxY - minY}
              fill={extensionFill}
              listening={false}
            />
          </Group>
        )}

        {/* Pool on top */}
        <Line
          points={points}
          fill={blueprintMode ? BLUEPRINT_COLORS.fillLight : (patternImage ? undefined : "rgba(59, 130, 246, 0.3)")}
          fillPatternImage={blueprintMode ? undefined : patternImage || undefined}
          fillPatternScale={patternConfig.scale}
          fillPatternOffset={patternConfig.offset}
          stroke={blueprintMode ? BLUEPRINT_COLORS.primary : "#3B82F6"}
          strokeWidth={2}
          strokeScaleEnabled={false}
          closed
          listening={false}
        />
      </>
    );

    return content;
  };

  // Extension handles removed; only boundary polygon editing remains for auto-extend

  // Tile selection bounding box removed

  // Render pool edge measurements and coping edge measurements when selected
  const renderPoolMeasurements = () => {
    if (!(annotationsVisible || isSelected)) return null;

    const measurements: JSX.Element[] = [];

    // Helper to render edge measurements for a polygon
    const renderEdgeMeasurements = (
      pts: Pt[],
      keyPrefix: string,
      textColor: string,
      strokeColor: string,
      offsetDirection: 'inward' | 'outward',
      offsetAmount: number
    ) => {
      const n = pts.length;

      // Calculate centroid for inward/outward direction
      const centroid = { x: 0, y: 0 };
      for (const p of pts) {
        centroid.x += p.x;
        centroid.y += p.y;
      }
      centroid.x /= n;
      centroid.y /= n;

      for (let i = 0; i < n; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % n];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const edgeLengthPx = Math.sqrt(dx * dx + dy * dy);

        // Skip very short edges
        if (edgeLengthPx < 10) continue;

        // Convert to mm (scale is 0.1, so 1px = 10mm)
        const lengthMm = Math.round(edgeLengthPx * 10);

        // Midpoint of edge
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;

        // Perpendicular direction
        let perpX = -dy / edgeLengthPx;
        let perpY = dx / edgeLengthPx;

        // Check if perpendicular points toward or away from centroid
        const towardCentroidX = centroid.x - midX;
        const towardCentroidY = centroid.y - midY;
        const dot = perpX * towardCentroidX + perpY * towardCentroidY;

        // If dot > 0, perp points toward centroid (inward)
        // Flip if we want opposite direction
        if ((offsetDirection === 'outward' && dot > 0) || (offsetDirection === 'inward' && dot < 0)) {
          perpX = -perpX;
          perpY = -perpY;
        }

        // Format: show meters if >= 1m, otherwise mm
        const text = lengthMm >= 1000
          ? `${(lengthMm / 1000).toFixed(2)}m`
          : `${lengthMm}mm`;

        // Angle for text rotation (keep text readable)
        let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (angleDeg > 90) angleDeg -= 180;
        if (angleDeg < -90) angleDeg += 180;

        measurements.push(
          <Text
            key={`${keyPrefix}-${i}`}
            x={midX + perpX * offsetAmount}
            y={midY + perpY * offsetAmount}
            text={text}
            fontSize={9}
            fill={textColor}
            stroke={strokeColor}
            strokeWidth={0.2}
            align="center"
            offsetX={18}
            offsetY={4}
            rotation={angleDeg}
            listening={false}
          />
        );
      }
    };

    // 1. Pool edge measurements (inside the pool - white text, or black in blueprint mode)
    renderEdgeMeasurements(
      scaledOutline,
      'pool-edge',
      blueprintMode ? BLUEPRINT_COLORS.text : '#ffffff',
      blueprintMode ? BLUEPRINT_COLORS.secondary : '#3B82F6',
      'inward',
      15
    );

    // 2. Coping outer edge measurements (if coping enabled)
    if (showCoping && copingBandWidth > 0) {
      const outer = copingOuterEdge;

      // Render measurements on the coping outer edge (outward from coping)
      renderEdgeMeasurements(
        outer,
        'coping-edge',
        blueprintMode ? BLUEPRINT_COLORS.text : '#D4A574', // sandstone/tan color
        blueprintMode ? BLUEPRINT_COLORS.secondary : '#8B7355',
        'outward',
        12
      );

      // 3. Extension boundary measurements (only if boundary actually differs from outer edge)
      const boundary = boundaryLive;

      // Check if boundary actually extends beyond coping outer edge
      const hasRealExtension = (() => {
        if (!boundary || boundary.length < 3 || !outer || outer.length < 3) return false;
        if (boundary.length !== outer.length) return true;

        const EPS = 2; // 2px tolerance
        for (let i = 0; i < boundary.length; i++) {
          const bPt = boundary[i];
          // Check if this boundary point is significantly outside the outer edge
          let minDist = Infinity;
          for (const oPt of outer) {
            const d = Math.sqrt((bPt.x - oPt.x) ** 2 + (bPt.y - oPt.y) ** 2);
            minDist = Math.min(minDist, d);
          }
          if (minDist > EPS) return true;
        }
        return false;
      })();

      if (hasRealExtension) {
        // Render measurements on the extension boundary (outward)
        renderEdgeMeasurements(
          boundary,
          'extension-edge',
          blueprintMode ? BLUEPRINT_COLORS.text : '#10B981', // green to match boundary color
          blueprintMode ? BLUEPRINT_COLORS.secondary : '#047857',
          'outward',
          12
        );
      }
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
        {/* Pool outline - render here only when coping is disabled; otherwise pool is drawn inside coping render */}
        {(!showCoping || copingBandWidth <= 0) && (
          <Line
            points={points}
            fill={blueprintMode ? BLUEPRINT_COLORS.fillLight : (patternImage ? undefined : "rgba(59, 130, 246, 0.3)")}
            fillPatternImage={blueprintMode ? undefined : patternImage || undefined}
            fillPatternScale={patternConfig.scale}
            fillPatternOffset={patternConfig.offset}
            stroke={blueprintMode ? BLUEPRINT_COLORS.primary : "#3B82F6"}
            strokeWidth={2}
            strokeScaleEnabled={false}
            closed
            listening={false}
          />
        )}

        {/* Invisible hit area covering pool + coping - enables clicking pool water */}
        <Rect
          x={clickableBounds.x}
          y={clickableBounds.y}
          width={clickableBounds.width}
          height={clickableBounds.height}
          fill="transparent"
        />

        {/* Render coping (solid band) - includes pool on top */}
        {showCoping && copingBandWidth > 0 && renderCoping()}


        {/* Deep End / Shallow End labels (only when annotations visible or selected) */}
        {(annotationsVisible || isSelected) && (
          <>
            <Text
              x={poolData.deepEnd.x * scale}
              y={poolData.deepEnd.y * scale}
              text="DE"
              fontSize={10}
              fontStyle="bold"
              fill={blueprintMode ? BLUEPRINT_COLORS.text : "#ffffff"}
              align="center"
              offsetX={10}
              offsetY={5}
              rotation={-component.rotation}
            />
            <Text
              x={poolData.shallowEnd.x * scale}
              y={poolData.shallowEnd.y * scale}
              text="SE"
              fontSize={10}
              fontStyle="bold"
              fill={blueprintMode ? BLUEPRINT_COLORS.text : "#ffffff"}
              align="center"
              offsetX={10}
              offsetY={5}
              rotation={-component.rotation}
            />
          </>
        )}

        {/* Pool edge measurements and coping area when selected */}
        {renderPoolMeasurements()}


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
            return overlay;
          })()
        )}
      </Group>
  );
};

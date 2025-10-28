import { Group, Line, Rect, Text, Circle } from 'react-konva';
import { Component } from '@/types';
import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { useDesignStore } from '@/store/designStore';
import { GRID_CONFIG, SNAP_CONFIG } from '@/constants/grid';
import { fillAreaWithPavers, calculateStatistics } from '@/utils/pavingFill';
import { roundHalf } from '@/utils/canvasSnap';
import { TILE_COLORS, TILE_GAP } from '@/constants/tileConfig';

interface PavingAreaComponentProps {
  component: Component;
  isSelected: boolean;
  activeTool?: string;
  onSelect: () => void;
  onContextMenu?: (component: Component, screenPos: { x: number; y: number }) => void;
}

type Pt = { x: number; y: number };
type Frame = { x: number; y: number; side: number };
type PaverRect = {
  id: string;
  position: { x: number; y: number }; // local to frame
  width: number;
  height: number;
  isEdgePaver: boolean; // true = cut
};

/** ---------- Geometry helpers ---------- */

// standard ray casting
function pointInPolygon(point: Pt, polygon: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 0.0000001) + xi;
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

function rectCornersLocal(r: { x: number; y: number; w: number; h: number }): Pt[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}

// Check if a point is on or very close to a polygon edge
function isPointOnPolygonBoundary(pt: Pt, poly: Pt[], tolerance = 3): boolean {
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];

    // Check if point is on the line segment p1-p2
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared < 0.001) continue; // Skip zero-length segments

    // Project point onto the line
    const t = Math.max(0, Math.min(1, ((pt.x - p1.x) * dx + (pt.y - p1.y) * dy) / lengthSquared));
    const projX = p1.x + t * dx;
    const projY = p1.y + t * dy;

    // Check distance from point to projection
    const distSquared = (pt.x - projX) * (pt.x - projX) + (pt.y - projY) * (pt.y - projY);
    if (distSquared < tolerance * tolerance) {
      return true;
    }
  }
  return false;
}

function rectFullyInsidePolygon(rect: { x: number; y: number; w: number; h: number }, poly: Pt[]) {
  // Shrink the rectangle slightly inward (1px on each side) to account for grout gaps and floating point errors
  const inset = 1;
  const shrunkRect = {
    x: rect.x + inset,
    y: rect.y + inset,
    w: Math.max(1, rect.w - inset * 2),
    h: Math.max(1, rect.h - inset * 2)
  };

  // Check if all corners of the shrunk rectangle are inside (or very close to boundary)
  const corners = rectCornersLocal(shrunkRect);
  return corners.every((c) => pointInPolygon(c, poly) || isPointOnPolygonBoundary(c, poly));
}
function rectIntersectsPolygon(rect: { x: number; y: number; w: number; h: number }, poly: Pt[]) {
  const corners = rectCornersLocal(rect);

  // Count how many corners are inside or on boundary
  let cornersInOrOn = 0;
  for (const c of corners) {
    if (pointInPolygon(c, poly) || isPointOnPolygonBoundary(c, poly, 2)) {
      cornersInOrOn++;
    }
  }

  // If at least 2 corners are in/on the polygon, it's a meaningful intersection
  if (cornersInOrOn >= 2) return true;

  // Check if polygon vertex is inside rect
  const inRect = (p: Pt) => p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
  if (poly.some(inRect)) return true;

  // Check edge intersections
  const rectEdges: [Pt, Pt][] = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    for (const [r1, r2] of rectEdges) {
      if (segmentsIntersect(a, b, r1, r2)) return true;
    }
  }

  return false;
}

/** ---------- Main Component ---------- */

export const PavingAreaComponent = ({
  component,
  isSelected,
  activeTool,
  onSelect,
  onContextMenu,
}: PavingAreaComponentProps) => {
  const updateComponent = useDesignStore((s) => s.updateComponent);
  const allComponents = useDesignStore((s) => s.components);

  // config
  const groutMm = TILE_GAP.size;
  const pxPerMm = GRID_CONFIG.spacing / 100;
  const groutPx = TILE_GAP.renderGap ? groutMm * pxPerMm : 0;
  const groutStrokePx = groutMm * pxPerMm;

  const boundaryStage: Pt[] = component.properties.boundary || [];
  const areaSurface = (component.properties as any).areaSurface || 'pavers';

  const sizeStr: string = component.properties.paverSize || '400x400';
  const orient: 'horizontal' | 'vertical' = component.properties.paverOrientation || 'vertical';
  const tilePlacementOrigin: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' =
    component.properties.tilePlacementOrigin || 'top-left';
  const snapResolution: 'edge' | 'half' = (component.properties as any).tileSnapResolution || 'half';

  const groupRef = useRef<any>(null);
  // Keep the outer group anchored while vertex dragging to avoid visual scatter
  const dragAnchorFrameRef = useRef<Frame | null>(null);
  const [previewFrame, setPreviewFrame] = useState<Frame | null>(null);

  // ---------- tiling frame (invisible square) ----------
  // Persist a square that encloses the initial polygon bbox. This does NOT change when nodes are moved.
  const existingFrame: Frame | undefined = (component.properties as any).tilingFrame;
  const initialFrame: Frame = useMemo(() => {
    if (!boundaryStage.length) return { x: 0, y: 0, side: 0 };
    const xs = boundaryStage.map((p) => p.x);
    const ys = boundaryStage.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = maxX - minX, h = maxY - minY;
    const baseSize = Math.max(w, h);

    // Add buffer space (50% extra on each side) to ensure tiles extend beyond vertex drag limits
    const bufferMultiplier = 1.5;
    const side = baseSize * bufferMultiplier;
    const bufferOffset = (side - baseSize) / 2;

    return { x: minX - bufferOffset, y: minY - bufferOffset, side };
  }, [boundaryStage]);

  // Use a preview frame while editing so the tiling area can expand in real-time.
  const frame: Frame = previewFrame ?? (existingFrame && existingFrame.side > 0 ? existingFrame : initialFrame);
  const anchorFrame: Frame = dragAnchorFrameRef.current ?? frame;

  // On first mount (or if legacy objects lack frame), persist it.
  useEffect(() => {
    if (!existingFrame || existingFrame.side <= 0) {
      updateComponent(component.id, {
        properties: {
          ...component.properties,
          tilingFrame: initialFrame,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingFrame?.side, initialFrame.side]);

  // boundary in frame-local coords
  const boundaryLocal = useMemo(
    () => boundaryStage.map((p) => ({ x: p.x - frame.x, y: p.y - frame.y })),
    [boundaryStage, frame.x, frame.y]
  );

  // ---------- tile size in px ----------
  const { tileW, tileH } = useMemo(() => {
    // parse "400x600"
    const [aStr, bStr] = (sizeStr || '400x400').split('x');
    const a = parseFloat(aStr) || 400;
    const b = parseFloat(bStr) || 400;
    let wmm = a, hmm = b;
    if (orient === 'horizontal') {
      // width is the longer side
      if (a < b) { wmm = b; hmm = a; }
    } else {
      // vertical: height is the longer side
      if (a > b) { wmm = b; hmm = a; }
    }
    return { tileW: wmm * pxPerMm, tileH: hmm * pxPerMm };
  }, [sizeStr, orient, pxPerMm]);

  const stepX = useMemo(() => roundHalf(tileW + groutPx), [tileW, groutPx]);
  const stepY = useMemo(() => roundHalf(tileH + groutPx), [tileH, groutPx]);
  const snapStepX = useMemo(() => (snapResolution === 'half' ? stepX / 2 : stepX), [stepX, snapResolution]);
  const snapStepY = useMemo(() => (snapResolution === 'half' ? stepY / 2 : stepY), [stepY, snapResolution]);

  // ---------- generate full grid in frame-local coords (covers frame + one extra ring to allow partials) ----------
  const gridLocalAll: PaverRect[] = useMemo(() => {
    if (areaSurface !== 'pavers' || frame.side <= 0) return [];
    const cols: number[] = [];
    const rows: number[] = [];

    // columns anchored to frame + placement origin
    if (tilePlacementOrigin.includes('right')) {
      for (let x = frame.side - tileW; x > -tileW - 1; x -= stepX) cols.push(roundHalf(x));
    } else {
      for (let x = 0; x < frame.side + tileW + 1; x += stepX) cols.push(roundHalf(x));
    }
    // rows anchored to frame + placement origin
    if (tilePlacementOrigin.includes('bottom')) {
      for (let y = frame.side - tileH; y > -tileH - 1; y -= stepY) rows.push(roundHalf(y));
    } else {
      for (let y = 0; y < frame.side + tileH + 1; y += stepY) rows.push(roundHalf(y));
    }

    const w = Math.max(1, roundHalf(tileW));
    const h = Math.max(1, roundHalf(tileH));

    const tiles: PaverRect[] = [];
    let id = 0;
    for (const y of rows) {
      for (const x of cols) {
        tiles.push({
          id: `paver-${id++}`,
          position: { x, y },
          width: w,
          height: h,
          isEdgePaver: false,
        });
      }
    }
    return tiles;
  }, [areaSurface, frame.side, tilePlacementOrigin, tileW, tileH, stepX, stepY]);

  // ---------- filter grid to only tiles intersecting the polygon (mask), also mark cut tiles ----------
  const paversLocalVisible: PaverRect[] = useMemo(() => {
    if (areaSurface !== 'pavers' || boundaryLocal.length < 3) return [];
    const poly = boundaryLocal;
    const vis: PaverRect[] = [];
    for (const t of gridLocalAll) {
      const rect = { x: t.position.x, y: t.position.y, w: t.width, h: t.height };
      if (!rectIntersectsPolygon(rect, poly)) continue;
      const isFull = rectFullyInsidePolygon(rect, poly);
      vis.push({ ...t, isEdgePaver: !isFull });
    }
    return vis;
  }, [areaSurface, boundaryLocal, gridLocalAll]);

  // stage-coord pavers (for statistics / ghost)
  const paversStageVisible = useMemo(
    () =>
      paversLocalVisible.map((p) => ({
        ...p,
        position: { x: p.position.x + frame.x, y: p.position.y + frame.y },
      })),
    [paversLocalVisible, frame.x, frame.y]
  );

  // ---------- statistics (using standard fillAreaWithPavers logic) ----------
  const statistics = useMemo(() => {
    if (areaSurface !== 'pavers' || boundaryStage.length < 3) {
      return { fullPavers: 0, edgePavers: 0, totalPavers: 0, totalArea: 0, orderQuantity: 0, wastage: 0 };
    }

    // Use the standard fillAreaWithPavers function for consistent statistics
    const pavers = fillAreaWithPavers(
      boundaryStage,
      sizeStr as any,
      orient,
      component.properties.showEdgePavers ?? true
    );

    return calculateStatistics(pavers, component.properties.wastagePercentage || 0);
  }, [areaSurface, boundaryStage, sizeStr, orient, component.properties.showEdgePavers, component.properties.wastagePercentage]);
  useEffect(() => {
    const current = component.properties.statistics;
    if (
      !current ||
      current.fullPavers !== statistics.fullPavers ||
      current.edgePavers !== statistics.edgePavers ||
      current.totalArea !== statistics.totalArea
    ) {
      updateComponent(component.id, { properties: { ...component.properties, statistics } });
    }
  }, [statistics, component.id, component.properties, updateComponent]);

  // ---------- selection / nodes ----------
  const [selectedNodes, setSelectedNodes] = useState<number[]>([]);
  const isNodeSelected = (i: number) => selectedNodes.includes(i);
  useEffect(() => {
    if (!isSelected) setSelectedNodes([]);
  }, [isSelected]);
  const toggleNode = (i: number, multi: boolean) => {
    setSelectedNodes((prev) => {
      if (!multi) return [i];
      return prev.includes(i) ? prev.filter((n) => n !== i) : [...prev, i];
    });
  };

  // ---------- ghost & edit preview ----------
  const [ghost, setGhost] = useState<null | { boundary: Pt[]; pavers: PaverRect[] }>(null);
  const [localPreview, setLocalPreview] = useState<Pt[] | null>(null);
  const rafRef = useRef<number | null>(null);
  const showLive = !ghost && !localPreview;
  const [poolSnapPreview, setPoolSnapPreview] = useState<null | {
    edgeX?: number;
    edgeY?: number;
    rect: { minX: number; maxX: number; minY: number; maxY: number };
  }>(null);

  const toStage = (local: Pt[]) => local.map((p) => ({ x: p.x + frame.x, y: p.y + frame.y }));
  const snapWorldToTile = useCallback((wx: number, wy: number) => {
    // Convert world to frame-local
    const lx = wx - frame.x;
    const ly = wy - frame.y;

    let snappedLx = lx;
    let snappedLy = ly;
    // X snapping based on placement origin
    if (tilePlacementOrigin.includes('right')) {
      const fromRight = frame.side - lx;
      snappedLx = frame.side - Math.round(fromRight / snapStepX) * snapStepX;
    } else {
      snappedLx = Math.round(lx / snapStepX) * snapStepX;
    }
    // Y snapping based on placement origin
    if (tilePlacementOrigin.includes('bottom')) {
      const fromBottom = frame.side - ly;
      snappedLy = frame.side - Math.round(fromBottom / snapStepY) * snapStepY;
    } else {
      snappedLy = Math.round(ly / snapStepY) * snapStepY;
    }

    // Back to world
    return { x: roundHalf(frame.x + snappedLx), y: roundHalf(frame.y + snappedLy) };
  }, [frame.x, frame.y, frame.side, tilePlacementOrigin, snapStepX, snapStepY]);
  
  // Compute tiles for a given frame and polygon (all in frame-local coords)
  const computeTilesForFrame = useCallback((polyLocal: Pt[], fr: Frame): PaverRect[] => {
    if (areaSurface !== 'pavers' || fr.side <= 0 || polyLocal.length < 3) return [];

    // Build grid in local coords for the provided frame
    const cols: number[] = [];
    const rows: number[] = [];
    if (tilePlacementOrigin.includes('right')) {
      for (let x = fr.side - tileW; x > -tileW - 1; x -= stepX) cols.push(roundHalf(x));
    } else {
      for (let x = 0; x < fr.side + tileW + 1; x += stepX) cols.push(roundHalf(x));
    }
    if (tilePlacementOrigin.includes('bottom')) {
      for (let y = fr.side - tileH; y > -tileH - 1; y -= stepY) rows.push(roundHalf(y));
    } else {
      for (let y = 0; y < fr.side + tileH + 1; y += stepY) rows.push(roundHalf(y));
    }

    const w = Math.max(1, roundHalf(tileW));
    const h = Math.max(1, roundHalf(tileH));

    const out: PaverRect[] = [];
    let id = 0;
    for (const y of rows) {
      for (const x of cols) {
        const rect = { x, y, w, h };
        if (!rectIntersectsPolygon(rect, polyLocal)) continue;
        const isFull = rectFullyInsidePolygon(rect, polyLocal);
        out.push({ id: `paver-${id++}` , position: { x, y }, width: w, height: h, isEdgePaver: !isFull });
      }
    }
    return out;
  }, [areaSurface, tilePlacementOrigin, tileW, tileH, stepX, stepY]);

  // ---------- context menu ----------
  const handleRightClick = (e: any) => {
    e.evt.preventDefault();
    if (!onContextMenu) return;
    const stage = e.target.getStage();
    const pt = stage.getPointerPosition();
    onContextMenu(component, { x: pt.x, y: pt.y });
  };

  // ---------- drag whole object (moves the frame + boundary together) ----------
  const handleDragEnd = () => {
    const node = groupRef.current;
    if (!node) return;
    const nextX = node.x();
    const nextY = node.y();
    let dx = nextX - frame.x;
    let dy = nextY - frame.y;

    if (dx === 0 && dy === 0) return;

    const movedBoundary = boundaryStage.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    const nextFrame: Frame = { x: frame.x + dx, y: frame.y + dy, side: frame.side };
    // Compute snap offsets to align the AREA (external shape) edges to nearby pool edges.
    const pxPerMm = GRID_CONFIG.spacing / 100;
    const xsRect = movedBoundary.map(p => p.x);
    const ysRect = movedBoundary.map(p => p.y);
    const areaRect = { minX: Math.min(...xsRect), maxX: Math.max(...xsRect), minY: Math.min(...ysRect), maxY: Math.max(...ysRect) };
    let snapOffset = { dx: 0, dy: 0 };
    const TOL = 10 * pxPerMm; // 10mm gentle snap

    const applyPreview = !!poolSnapPreview;
    const considerEdgeX = applyPreview ? [poolSnapPreview!.edgeX] : [];
    const considerEdgeY = applyPreview ? [poolSnapPreview!.edgeY] : [];

    const candidateEdgesX: number[] = [];
    const candidateEdgesY: number[] = [];
    if (considerEdgeX[0] != null) candidateEdgesX.push(considerEdgeX[0]!);
    if (considerEdgeY[0] != null) candidateEdgesY.push(considerEdgeY[0]!);

    if (!applyPreview) {
      // Gather from pools if no preview
      allComponents.forEach(c => {
        if (c.type !== 'pool') return;
        const poolLen = (c.dimensions?.width || 0) * pxPerMm;
        const poolWid = (c.dimensions?.height || 0) * pxPerMm;
        candidateEdgesX.push(c.position.x, c.position.x + poolLen);
        candidateEdgesY.push(c.position.y, c.position.y + poolWid);
      });
    }

    const nearEdge = (val: number, edges: number[]) => {
      let best: { edge: number; d: number } | null = null;
      edges.forEach(e => {
        const d = Math.abs(val - e);
        if (best == null || d < best.d) best = { edge: e, d };
      });
      return best;
    };

    if (candidateEdgesX.length > 0) {
      // choose which area edge (minX or maxX) is closer to any pool edge
      const bestMin = nearEdge(areaRect.minX, candidateEdgesX);
      const bestMax = nearEdge(areaRect.maxX, candidateEdgesX);
      const pick = (!bestMin || (bestMax && bestMax.d < bestMin.d)) ? { edge: bestMax!.edge, d: bestMax!.d, side: 'maxX' } : { edge: bestMin!.edge, d: bestMin!.d, side: 'minX' };
      if (pick.d <= TOL) {
        snapOffset.dx = (pick.side === 'minX' ? pick.edge - areaRect.minX : pick.edge - areaRect.maxX);
      }
    }
    if (candidateEdgesY.length > 0) {
      const bestMin = nearEdge(areaRect.minY, candidateEdgesY);
      const bestMax = nearEdge(areaRect.maxY, candidateEdgesY);
      const pick = (!bestMin || (bestMax && bestMax.d < bestMin.d)) ? { edge: bestMax!.edge, d: bestMax!.d, side: 'maxY' } : { edge: bestMin!.edge, d: bestMin!.d, side: 'minY' };
      if (pick.d <= TOL) {
        snapOffset.dy = (pick.side === 'minY' ? pick.edge - areaRect.minY : pick.edge - areaRect.maxY);
      }
    }

    if (snapOffset.dx !== 0 || snapOffset.dy !== 0) {
      // Apply external shape snap by translating boundary/frame and origin together
      movedBoundary.forEach(p => { p.x += snapOffset.dx; p.y += snapOffset.dy; });
      nextFrame.x += snapOffset.dx; nextFrame.y += snapOffset.dy;
      dx += snapOffset.dx; dy += snapOffset.dy;
    } else {
      // No pool snap: fall back to grid snap for the frame origin
      const grid = SNAP_CONFIG.gridSnap || 10;
      const snappedX = Math.round(nextFrame.x / grid) * grid;
      const snappedY = Math.round(nextFrame.y / grid) * grid;
      const gdx = snappedX - nextFrame.x;
      const gdy = snappedY - nextFrame.y;
      if (gdx !== 0 || gdy !== 0) {
        movedBoundary.forEach(p => { p.x += gdx; p.y += gdy; });
        nextFrame.x = snappedX; nextFrame.y = snappedY;
        dx += gdx; dy += gdy;
      }
    }

    updateComponent(component.id, { properties: { ...component.properties, boundary: movedBoundary, tilingFrame: nextFrame } });

    setPoolSnapPreview(null);
  };

  // ---------- vertex drag (clamped to frame) ----------
  // Store original vertices in STAGE coordinates so we can safely
  // expand or shift the frame during an edit without losing the drag delta.
  const vertexOriginalStageRef = useRef<Pt[] | null>(null);
  const vertexDragAnchorRef = useRef<number | null>(null);
  const dragStartPointerRef = useRef<{ x: number; y: number } | null>(null);

  // NOTE: Do not hard-clamp vertices to the frame while editing.
  // Allow vertices to move beyond the current tiling frame; we will
  // expand the frame on commit if needed. Hard clamping causes the
  // "stuck near edge" behavior the user observed.
  const clampLocal = (pts: Pt[]): Pt[] => pts;

  // Snap a point (in frame-local coords) to the nearest tile grid intersection
  const snapToTileGrid = (pt: Pt): Pt => {
    if (areaSurface !== 'pavers') return pt;
    let snappedX = pt.x;
    let snappedY = pt.y;
    if (tilePlacementOrigin.includes('right')) {
      const fromRight = frame.side - pt.x;
      snappedX = frame.side - Math.round(fromRight / snapStepX) * snapStepX;
    } else {
      snappedX = Math.round(pt.x / snapStepX) * snapStepX;
    }
    if (tilePlacementOrigin.includes('bottom')) {
      const fromBottom = frame.side - pt.y;
      snappedY = frame.side - Math.round(fromBottom / snapStepY) * snapStepY;
    } else {
      snappedY = Math.round(pt.y / snapStepY) * snapStepY;
    }
    return { x: snappedX, y: snappedY };
  };

  const onVertexMouseDown = (i: number, evt: any) => {
    evt.cancelBubble = true;
    toggleNode(i, evt.evt.shiftKey);
  };

  const onVertexDragStart = (i: number, evt: any) => {
    evt.cancelBubble = true;
    if (!isNodeSelected(i)) setSelectedNodes([i]);
    // Capture originals in stage space
    vertexOriginalStageRef.current = boundaryStage.map((p) => ({ ...p }));
    vertexDragAnchorRef.current = i;
    // Freeze outer group position during this edit
    dragAnchorFrameRef.current = { x: frame.x, y: frame.y, side: frame.side };
    // Record pointer at drag start in canvas coords (accounts for pan/zoom)
    const stage = evt.target.getStage();
    const pr = stage?.getPointerPosition();
    if (pr) {
      const scaleX = stage.scaleX() || 1;
      const scaleY = stage.scaleY() || 1;
      const offsetX = stage.x() || 0;
      const offsetY = stage.y() || 0;
      dragStartPointerRef.current = {
        x: (pr.x - offsetX) / scaleX,
        y: (pr.y - offsetY) / scaleY,
      };
    } else {
      dragStartPointerRef.current = null;
    }
    setLocalPreview(boundaryLocal);
  };

  const onVertexDragMove = (i: number, evt: any) => {
    evt.cancelBubble = true;
    const origStage = vertexOriginalStageRef.current;
    if (!origStage) return;

    const handleIdx = vertexDragAnchorRef.current ?? i;
    // Compute deltas in stage coordinates to be resilient to frame shifts
    const stage = evt.target.getStage();
    const pointerRaw = stage?.getPointerPosition();
    if (!pointerRaw) return;
    // Convert screen pointer to canvas-content coords (account for pan/zoom)
    const scaleX = stage.scaleX() || 1;
    const scaleY = stage.scaleY() || 1;
    const offsetX = stage.x() || 0;
    const offsetY = stage.y() || 0;
    const pointer = {
      x: (pointerRaw.x - offsetX) / scaleX,
      y: (pointerRaw.y - offsetY) / scaleY,
    };
    const start = origStage[handleIdx];

    // Compute raw delta from drag start pointer to current pointer in canvas coords
    const ps = dragStartPointerRef.current || { x: start.x, y: start.y };
    const rawDx = pointer.x - ps.x;
    const rawDy = pointer.y - ps.y;
    // Desired target for the anchor vertex
    const target = { x: start.x + rawDx, y: start.y + rawDy };
    // Snap target to tile grid to avoid initial jump
    const snappedP = snapWorldToTile(target.x, target.y);
    const dx = snappedP.x - start.x;
    const dy = snappedP.y - start.y;

    // New vertices in stage space
    const nextStage = origStage.map((p, idx) => (isNodeSelected(idx) ? { x: p.x + dx, y: p.y + dy } : p));

    // Do not expand frame during drag; keep it stable to avoid jumps.
    const nextFrame = frame;

    // Convert nextStage to preview-local coords, then snap LIVE to tile grid using the
    // same nextFrame so the cursor follows tile intersections rather than the base grid.
    const nextLocalSnapped = nextStage.map((p) => ({ x: p.x - nextFrame.x, y: p.y - nextFrame.y }));
    const snappedLocal = nextLocalSnapped.map((pt) => {
      const worldX = nextFrame.x + pt.x;
      const worldY = nextFrame.y + pt.y;
      const s = snapWorldToTile(worldX, worldY);
      return { x: s.x - nextFrame.x, y: s.y - nextFrame.y };
    });

    // Show snapped preview (handles/line stay on tile intersections)
    setLocalPreview(snappedLocal);

    // Build a ghost using the snapped boundary so tiles preview the final placement
    const stageBoundary = snappedLocal.map((p) => ({ x: p.x + nextFrame.x, y: p.y + nextFrame.y }));
    const tilesLocal = computeTilesForFrame(snappedLocal, nextFrame);
    const tilesStage = tilesLocal.map((t) => ({
      ...t,
      position: { x: t.position.x + nextFrame.x, y: t.position.y + nextFrame.y },
    }));

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setGhost({ boundary: stageBoundary, pavers: tilesStage });
    });
  };

  const commitLocal = (local: Pt[]) => {
    // Snap to tile grid in local coords, then convert to stage coords
    const snappedLocal = local.map(snapToTileGrid);
    const stagePts = toStage(snappedLocal);

    // Ensure the tiling frame encloses the new boundary with a safe margin.
    // Expand the frame if needed to prevent future drags from hitting the frame edge.
    const xs = stagePts.map((p) => p.x);
    const ys = stagePts.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Safety margin: at least two tile steps (accounts for grout) so we don't
    // immediately hit the frame after a commit. Use the larger step.
    const margin = Math.max(stepX, stepY) * 2;

    // Compute an expanded square that contains both the previous persisted
    // frame (if any) and the new bbox + margin. Use the preview frame if
    // present during this commit.
    const baseFrame = previewFrame ?? existingFrame ?? frame;
    const left = Math.min(baseFrame.x, minX - margin);
    const top = Math.min(baseFrame.y, minY - margin);
    const right = Math.max(baseFrame.x + baseFrame.side, maxX + margin);
    const bottom = Math.max(baseFrame.y + baseFrame.side, maxY + margin);
    const nextSide = Math.max(right - left, bottom - top);

    // Persist the updated frame unconditionally so the invisible square
    // matches the polygon after the drag completes.
    updateComponent(component.id, {
      properties: {
        ...component.properties,
        boundary: stagePts,
        tilingFrame: { x: left, y: top, side: nextSide },
      },
    });

    setGhost(null);
    setLocalPreview(null);
    setPreviewFrame(null);
    vertexOriginalStageRef.current = null;
    vertexDragAnchorRef.current = null;
    // Release outer group anchor after commit
    dragAnchorFrameRef.current = null;
  };

  const onVertexDragEnd = (_i: number, evt: any) => {
    evt.cancelBubble = true;
    const local = localPreview || boundaryLocal;
    commitLocal(local);
  };

  // ---------- subtle textures for concrete/grass (unchanged) ----------
  const createConcretePattern = useCallback((): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = 12; c.height = 12;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = 'rgba(100, 116, 139, 0.15)';
    for (let i = 0; i < 6; i++) {
      const x = (i * 2 + 3) % c.width;
      const y = (i * 3 + 5) % c.height;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.beginPath(); ctx.moveTo(0, c.height); ctx.lineTo(c.width, 0); ctx.stroke();
    return c;
  }, []);

  const createGrassPattern = useCallback((): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = 12; c.height = 12;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#bbf7d0';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = 'rgba(22, 163, 74, 0.18)';
    for (let i = 0; i < 3; i++) {
      const x = (i * 4 + 2) % c.width;
      ctx.beginPath(); ctx.moveTo(x, c.height); ctx.lineTo(x + 1, c.height - 3); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.14)';
    ctx.beginPath(); ctx.moveTo(0, c.height - 4); ctx.lineTo(3, c.height - 1); ctx.stroke();
    return c;
  }, []);

  const areaPattern = useMemo(() => {
    if (areaSurface === 'concrete') return createConcretePattern();
    if (areaSurface === 'grass') return createGrassPattern();
    return null;
  }, [areaSurface, createConcretePattern, createGrassPattern]);

  // ---------- render ----------
  return (
    <>
      <Group
        ref={groupRef}
        x={anchorFrame.x}
        y={anchorFrame.y}
        onClick={onSelect}
        onTap={onSelect}
        onContextMenu={handleRightClick}
        draggable={activeTool !== 'hand' && isSelected && !localPreview}
        onDragMove={(e) => {
          // Live preview of snapping to nearby pool coping edges (non-aggressive)
          const nextX = e.target.x();
          const nextY = e.target.y();
          const dx = nextX - frame.x;
          const dy = nextY - frame.y;

          const movedBoundary = boundaryStage.map((p) => ({ x: p.x + dx, y: p.y + dy }));
          const xs = movedBoundary.map((p) => p.x);
          const ys = movedBoundary.map((p) => p.y);
          const rect = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
          const areaCenter = { x: (rect.minX + rect.maxX) / 2, y: (rect.minY + rect.maxY) / 2 };

          const pxPerMm = GRID_CONFIG.spacing / 100;
          const TOL = 10 * pxPerMm; // 10mm visual proximity

          let best: { edgeX?: number; edgeY?: number; score: number } | null = null;
          allComponents.forEach((c) => {
            if (c.type !== 'pool') return;
            const poolLen = (c.dimensions?.width || 0) * pxPerMm;
            const poolWid = (c.dimensions?.height || 0) * pxPerMm;
            const poolRect = { minX: c.position.x, minY: c.position.y, maxX: c.position.x + poolLen, maxY: c.position.y + poolWid };

            const edgesX = [poolRect.minX, poolRect.maxX];
            const edgesY = [poolRect.minY, poolRect.maxY];

            const nearXEdge = edgesX
              .map((ex) => ({ ex, d: Math.abs(areaCenter.x - ex) }))
              .reduce((a, b) => (a.d < b.d ? a : b), { ex: edgesX[0], d: Math.abs(areaCenter.x - edgesX[0]) });
            const nearYEdge = edgesY
              .map((ey) => ({ ey, d: Math.abs(areaCenter.y - ey) }))
              .reduce((a, b) => (a.d < b.d ? a : b), { ey: edgesY[0], d: Math.abs(areaCenter.y - edgesY[0]) });

            const cand: { edgeX?: number; edgeY?: number; score: number } = { score: Infinity } as any;
            if (nearXEdge.d <= TOL) cand.edgeX = nearXEdge.ex;
            if (nearYEdge.d <= TOL) cand.edgeY = nearYEdge.ey;
            if (cand.edgeX === undefined && cand.edgeY === undefined) return;
            cand.score = (cand.edgeX ? nearXEdge.d : 0) + (cand.edgeY ? nearYEdge.d : 0);
            if (!best || cand.score < best.score) best = cand;
          });

          if (best) setPoolSnapPreview({ edgeX: best.edgeX, edgeY: best.edgeY, rect });
          else if (poolSnapPreview) setPoolSnapPreview(null);
        }}
        onDragEnd={handleDragEnd}
      >
        {/* Content offset so outer group remains stable during vertex drags */}
        <Group x={frame.x - anchorFrame.x} y={frame.y - anchorFrame.y}>
        {/* hit area for selection/move: the invisible tiling square (with a little bleed) */}
        {(() => {
          const BLEED = groutStrokePx / 2;
          return (
            <Rect
              x={-BLEED}
              y={-BLEED}
              width={frame.side + BLEED * 2}
              height={frame.side + BLEED * 2}
              fill="transparent"
              listening
            />
          );
        })()}

        {/* content (hidden during ghost) */}
        {showLive && (
          <>
            {/* Everything is clipped to the polygon boundary */}
            <Group
              clipFunc={(ctx) => {
                ctx.beginPath();
                boundaryLocal.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
                ctx.closePath();
              }}
            >
              {areaSurface === 'pavers' ? (
                <>
                  {/* Grout underlay - fills polygon with grout color */}
                  {TILE_GAP.renderGap && TILE_GAP.size > 0 && (
                    <Line
                      points={boundaryLocal.flatMap((p) => [p.x, p.y])}
                      fill={TILE_COLORS.groutColor}
                      closed
                      listening={false}
                    />
                  )}

                  {/* Tile fills - generated over the frame; polygon only clips them */}
                  {paversLocalVisible.map((p) => {
                    const x1 = roundHalf(p.position.x);
                    const y1 = roundHalf(p.position.y);
                    const w = Math.max(0, roundHalf(p.width));
                    const h = Math.max(0, roundHalf(p.height));
                    const x2 = x1 + w;
                    const y2 = y1 + h;
                    return (
                      <Group key={p.id} listening={false}>
                        <Rect
                          x={x1}
                          y={y1}
                          width={w}
                          height={h}
                          fill={TILE_COLORS.extendedTile}
                          opacity={p.isEdgePaver ? 0.85 : 1}
                        />
                        {p.isEdgePaver && (
                          <Text
                            x={x2 - 12 - 3}
                            y={y2 - 12 - 3}
                            text="✂"
                            fontSize={11}
                            fill={TILE_COLORS.cutIndicator}
                            listening={false}
                          />
                        )}
                      </Group>
                    );
                  })}
                </>
              ) : (
                // Non-paver surfaces: texture fill + toned border
                <>
                  {areaPattern && (
                    <Rect
                      x={0}
                      y={0}
                      width={frame.side}
                      height={frame.side}
                      listening={false}
                      fillPatternImage={areaPattern as any}
                      fillPatternRepeat="repeat"
                    />
                  )}
                  <Line
                    points={boundaryLocal.flatMap((p) => [p.x, p.y])}
                    closed
                    listening={false}
                    stroke="rgba(0,0,0,0.12)"
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                  />
                </>
              )}
            </Group>

            {/* boundary (show only when selected) */}
            {isSelected && (
              <Line
                points={boundaryLocal.flatMap((p) => [p.x, p.y])}
                stroke="#3B82F6"
                strokeWidth={3}
                strokeScaleEnabled={false}
                dash={[10, 5]}
                closed
              />
            )}
          </>
        )}

        {/* edit preview boundary (local) */}
        {localPreview && (
          <Line
            points={localPreview.flatMap((p) => [p.x, p.y])}
            stroke="#3B82F6"
            strokeWidth={3}
            strokeScaleEnabled={false}
            dash={[10, 5]}
            closed
          />
        )}

        {/* handles (only when selected) */}
        {isSelected && (
          <>
            {/* vertex handles */}
            {boundaryLocal.map((pt, i) => (
              <Circle
                key={`v-${i}`}
                name={`vertex-${i}`}
                x={localPreview ? localPreview[i]?.x ?? pt.x : pt.x}
                y={localPreview ? localPreview[i]?.y ?? pt.y : pt.y}
                radius={6}
                fill={isNodeSelected(i) ? '#3B82F6' : 'white'}
                stroke="#3B82F6"
                strokeWidth={2}
                onMouseDown={(e) => onVertexMouseDown(i, e)}
                draggable
                dragBoundFunc={(pos) => {
                  const s = snapWorldToTile(frame.x + pos.x, frame.y + pos.y);
                  return { x: s.x - frame.x, y: s.y - frame.y };
                }}
                onDragStart={(e) => onVertexDragStart(i, e)}
                onDragMove={(e) => onVertexDragMove(i, e)}
                onDragEnd={(e) => onVertexDragEnd(i, e)}
              />
            ))}
          </>
        )}
        </Group>
      </Group>

      {/* Pool snap preview guides (green), non-aggressive */}
      {poolSnapPreview && (
        <Group listening={false} opacity={0.9}>
          {typeof poolSnapPreview.edgeX === 'number' && (
            <Line
              points={[
                poolSnapPreview.edgeX, poolSnapPreview.rect.minY - 1000,
                poolSnapPreview.edgeX, poolSnapPreview.rect.maxY + 1000,
              ]}
              stroke="#22c55e"
              strokeWidth={2}
              dash={[6, 6]}
              strokeScaleEnabled={false}
            />
          )}
          {typeof poolSnapPreview.edgeY === 'number' && (
            <Line
              points={[
                poolSnapPreview.rect.minX - 1000, poolSnapPreview.edgeY,
                poolSnapPreview.rect.maxX + 1000, poolSnapPreview.edgeY,
              ]}
              stroke="#22c55e"
              strokeWidth={2}
              dash={[6, 6]}
              strokeScaleEnabled={false}
            />
          )}
        </Group>
      )}

      {/* Ghost (stage coords) while editing - tiles fixed, only mask changes */}
      {ghost && (
        <Group listening={false} opacity={0.75}>
          <Group
            clipFunc={(ctx) => {
              ctx.beginPath();
              ghost.boundary.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
              ctx.closePath();
            }}
          >
            {areaSurface === 'pavers' ? (
              <>
                <Line
                  points={ghost.boundary.flatMap((p) => [p.x, p.y])}
                  fill={TILE_COLORS.extendedTile}
                  closed
                  listening={false}
                  opacity={0.75}
                />
                {ghost.pavers.map((p) => (
                  <Rect
                    key={`ghost-${p.id}`}
                    x={p.position.x}
                    y={p.position.y}
                    width={Math.max(0, p.width)}
                    height={Math.max(0, p.height)}
                    fill={TILE_COLORS.extendedTile}
                    opacity={p.isEdgePaver ? 0.5 : 0.6}
                  />
                ))}
              </>
            ) : (
              <Line
                points={ghost.boundary.flatMap((p) => [p.x, p.y])}
                fill={areaSurface === 'concrete' ? '#d1d5db' : '#86efac'}
                closed
                listening={false}
                opacity={0.6}
              />
            )}
          </Group>

          <Line
            points={ghost.boundary.flatMap((p) => [p.x, p.y])}
            stroke="#93C5FD"
            strokeWidth={3}
            dash={[10, 5]}
            closed
            listening={false}
            strokeScaleEnabled={false}
          />
        </Group>
      )}
    </>
  );
};

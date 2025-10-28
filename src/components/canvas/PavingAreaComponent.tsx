import { Group, Line, Rect, Text, Circle } from 'react-konva';
import { Component } from '@/types';
import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { useDesignStore } from '@/store/designStore';
import { calculateStatistics } from '@/utils/pavingFill';
import { GRID_CONFIG } from '@/constants/grid';
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

  const groupRef = useRef<any>(null);

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

  const frame: Frame = existingFrame && existingFrame.side > 0 ? existingFrame : initialFrame;

  // On first mount (or if legacy objects lack frame), persist it.
  useEffect(() => {
    if (!existingFrame || existingFrame.side <= 0) {
      updateComponent(component.id, {
        properties: { ...component.properties, tilingFrame: initialFrame },
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

  const stepX = useMemo(() => tileW + groutPx, [tileW, groutPx]);
  const stepY = useMemo(() => tileH + groutPx, [tileH, groutPx]);

  // ---------- generate full grid in frame-local coords (covers frame + one extra ring to allow partials) ----------
  const gridLocalAll: PaverRect[] = useMemo(() => {
    if (areaSurface !== 'pavers' || frame.side <= 0) return [];
    const cols: number[] = [];
    const rows: number[] = [];

    // columns
    if (tilePlacementOrigin.includes('right')) {
      for (let x = frame.side - tileW; x > -tileW - 1; x -= stepX) cols.push(roundHalf(x));
    } else {
      for (let x = 0; x < frame.side + tileW + 1; x += stepX) cols.push(roundHalf(x));
    }
    // rows
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

  // ---------- statistics ----------
  const statistics = useMemo(
    () => calculateStatistics(paversStageVisible, component.properties.wastagePercentage || 0),
    [paversStageVisible, component.properties.wastagePercentage]
  );
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

  const toStage = (local: Pt[]) => local.map((p) => ({ x: p.x + frame.x, y: p.y + frame.y }));

  const scheduleGhostFromLocal = (local: Pt[]) => {
    const stagePts = toStage(local);
    const ghostTiles = paversStageVisible; // tiles don't move during node drags
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setGhost({ boundary: stagePts, pavers: ghostTiles });
    });
  };

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
    const dx = nextX - frame.x;
    const dy = nextY - frame.y;

    if (dx === 0 && dy === 0) return;

    const movedBoundary = boundaryStage.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    const nextFrame: Frame = { x: frame.x + dx, y: frame.y + dy, side: frame.side };

    updateComponent(component.id, {
      properties: { ...component.properties, boundary: movedBoundary, tilingFrame: nextFrame },
    });
  };

  // ---------- vertex drag (clamped to frame) ----------
  const vertexOriginalRef = useRef<Pt[] | null>(null);
  const vertexDragAnchorRef = useRef<number | null>(null);

  const clampLocal = (pts: Pt[]): Pt[] =>
    pts.map((p) => ({
      x: Math.min(frame.side, Math.max(0, p.x)),
      y: Math.min(frame.side, Math.max(0, p.y)),
    }));

  // Snap a point (in frame-local coords) to the nearest tile grid intersection
  const snapToTileGrid = (pt: Pt): Pt => {
    if (areaSurface !== 'pavers') return pt;

    let snappedX = pt.x;
    let snappedY = pt.y;

    // Snap X based on tile placement origin
    if (tilePlacementOrigin.includes('right')) {
      // Grid goes from right to left: frame.side, frame.side - stepX, frame.side - 2*stepX, ...
      const offsetFromRight = frame.side - pt.x;
      snappedX = frame.side - Math.round(offsetFromRight / stepX) * stepX;
    } else {
      // Grid goes from left to right: 0, stepX, 2*stepX, ...
      snappedX = Math.round(pt.x / stepX) * stepX;
    }

    // Snap Y based on tile placement origin
    if (tilePlacementOrigin.includes('bottom')) {
      // Grid goes from bottom to top: frame.side, frame.side - stepY, frame.side - 2*stepY, ...
      const offsetFromBottom = frame.side - pt.y;
      snappedY = frame.side - Math.round(offsetFromBottom / stepY) * stepY;
    } else {
      // Grid goes from top to bottom: 0, stepY, 2*stepY, ...
      snappedY = Math.round(pt.y / stepY) * stepY;
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
    vertexOriginalRef.current = boundaryLocal.map((p) => ({ ...p }));
    vertexDragAnchorRef.current = i;
    setLocalPreview(boundaryLocal);
  };

  const onVertexDragMove = (i: number, evt: any) => {
    evt.cancelBubble = true;
    const orig = vertexOriginalRef.current;
    if (!orig) return;

    const handleIdx = vertexDragAnchorRef.current ?? i;
    const start = orig[handleIdx];
    const now = { x: evt.target.x(), y: evt.target.y() };
    const dx = now.x - start.x;
    const dy = now.y - start.y;

    const nextLocalRaw = orig.map((p, idx) => (isNodeSelected(idx) ? { x: p.x + dx, y: p.y + dy } : p));
    const nextLocal = clampLocal(nextLocalRaw);

    setLocalPreview(nextLocal);
    scheduleGhostFromLocal(nextLocal);
  };

  const commitLocal = (local: Pt[]) => {
    // Snap to tile grid in local coords, then convert to stage coords
    const snappedLocal = local.map(snapToTileGrid);
    const stagePts = toStage(snappedLocal);
    updateComponent(component.id, { properties: { ...component.properties, boundary: stagePts } });
    setGhost(null);
    setLocalPreview(null);
    vertexOriginalRef.current = null;
    vertexDragAnchorRef.current = null;
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
        x={frame.x}
        y={frame.y}
        onClick={onSelect}
        onTap={onSelect}
        onContextMenu={handleRightClick}
        draggable={activeTool !== 'hand' && isSelected && !localPreview}
        onDragEnd={handleDragEnd}
      >
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
                x={localPreview ? localPreview[i]?.x ?? pt.x : pt.x}
                y={localPreview ? localPreview[i]?.y ?? pt.y : pt.y}
                radius={6}
                fill={isNodeSelected(i) ? '#3B82F6' : 'white'}
                stroke="#3B82F6"
                strokeWidth={2}
                onMouseDown={(e) => onVertexMouseDown(i, e)}
                draggable
                onDragStart={(e) => onVertexDragStart(i, e)}
                onDragMove={(e) => onVertexDragMove(i, e)}
                onDragEnd={(e) => onVertexDragEnd(i, e)}
              />
            ))}
          </>
        )}
      </Group>

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

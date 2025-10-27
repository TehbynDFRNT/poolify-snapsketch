import { Group, Line, Rect, Text, Circle } from 'react-konva';
import { Component } from '@/types';
import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { useDesignStore } from '@/store/designStore';
import { getPoolExcludeZone } from '@/utils/poolExcludeZone';
import { fillAreaWithPavers, fillAreaWithPaversFromOrigin, calculateStatistics, getPaverDimensions } from '@/utils/pavingFill';
import { GRID_CONFIG } from '@/constants/grid';
import { calculatePoolCoping } from '@/utils/copingCalculation';
import { snapToGrid } from '@/utils/snap';
import { snapRectPx, roundHalf } from '@/utils/canvasSnap';
import { TILE_COLORS, TILE_GAP, TileSize } from '@/constants/tileConfig';

interface PavingAreaComponentProps {
  component: Component;
  isSelected: boolean;
  activeTool?: string;
  onSelect: () => void;
  onDelete?: () => void;
  onContextMenu?: (component: Component, screenPos: { x: number; y: number }) => void;
}

type Pt = { x: number; y: number };

// Build unique grout segments from pavers
function buildGroutSegments(
  paverList: Array<{ position: { x: number; y: number }; width: number; height: number; isEdgePaver?: boolean }>,
  showEdgePavers: boolean
) {
  const roundHalf = (px: number) => Math.round(px * 2) / 2;
  const floorHalf = (px: number) => Math.floor(px * 2) / 2;

  const edgeMap = new Map<string, { x1: number; y1: number; x2: number; y2: number }>();
  const add = (x1: number, y1: number, x2: number, y2: number) => {
    const rx1 = roundHalf(x1), ry1 = roundHalf(y1);
    const rx2 = roundHalf(x2), ry2 = roundHalf(y2);
    const key = `${Math.min(rx1, rx2)},${Math.min(ry1, ry2)},${Math.max(rx1, rx2)},${Math.max(ry1, ry2)}`;
    if (!edgeMap.has(key)) edgeMap.set(key, { x1: rx1, y1: ry1, x2: rx2, y2: ry2 });
  };

  paverList.forEach((p) => {
    if (!showEdgePavers && p.isEdgePaver) return;
    const x = floorHalf(p.position.x);
    const y = floorHalf(p.position.y);
    const w = Math.round(p.width);
    const h = Math.round(p.height);
    add(x, y, x + w, y); // top
    add(x, y + h, x + w, y + h); // bottom
    add(x, y, x, y + h); // left
    add(x + w, y, x + w, y + h); // right
  });

  return Array.from(edgeMap.values());
}

export const PavingAreaComponent = ({
  component,
  isSelected,
  activeTool,
  onSelect,
  onDelete,
  onContextMenu,
}: PavingAreaComponentProps) => {
  const allComponents = useDesignStore((s) => s.components);
  const updateComponent = useDesignStore((s) => s.updateComponent);
  // Use centralized tile gap configuration
  const groutMm = TILE_GAP.size;
  const pxPerMm = GRID_CONFIG.spacing / 100;
  const groutStrokePx = TILE_GAP.size * pxPerMm;

  const boundary = component.properties.boundary || [];
  const areaSurface = (component.properties as any).areaSurface || 'pavers';
  const showEdgePavers = component.properties.showEdgePavers !== false;

  const groupRef = useRef<any>(null);

  // ---------------- pools/exclusions ----------------
  const pools = useMemo(
    () => allComponents.filter((c) => c.type === 'pool' && c.id !== component.id),
    [allComponents, component.id]
  );

  const poolExcludeZones = useMemo(
    () =>
      pools
        .map((pool) => getPoolExcludeZone(pool))
        .filter((z): z is NonNullable<typeof z> => z !== null),
    [pools, pools.map((p) => `${p.position.x},${p.position.y},${p.rotation},${p.properties.showCoping}`).join('|')]
  );

  // ---------------- paver generator (reused for ghost) ----------------
  const computePaversForBoundary = useCallback(
    (bnd: Pt[]) => {
      if (!bnd || bnd.length < 3) return [];
      const size = component.properties.paverSize || '400x400';
      const orient = component.properties.paverOrientation || 'vertical';
      const alignPoolId = component.properties.alignToPoolId;
      const origin = component.properties.tileOrigin || { x: 0, y: 0 }; // stable array origin (px)

      if (alignPoolId) {
        const pool = allComponents.find((c) => c.id === alignPoolId);
        if (pool) {
          const pxPerMm = GRID_CONFIG.spacing / 100;
          const poolData = (pool.properties as any).pool;
          const copingConfig = pool.properties.copingConfig;
          const showCoping = pool.properties.showCoping;
          const coping = showCoping && poolData ? calculatePoolCoping(poolData, copingConfig) : null;
          if (coping) {
            const tile = getPaverDimensions(size, orient);
            const tileWpx = tile.width * pxPerMm;
            const tileHpx = tile.height * pxPerMm;

            const poolLeft = pool.position.x;
            const poolTop = pool.position.y;
            const poolRight = poolLeft + poolData.length * pxPerMm;
            const poolBottom = poolTop + poolData.width * pxPerMm;

            const leftOuterX = poolLeft - tileWpx;
            const rightOuterX = poolRight + tileWpx;
            const topOuterY = poolTop - tileHpx;
            const bottomOuterY = poolBottom + tileHpx;

            const xs = bnd.map((p) => p.x);
            const ys = bnd.map((p) => p.y);
            const minX = Math.min(...xs),
              maxX = Math.max(...xs);
            const minY = Math.min(...ys),
              maxY = Math.max(...ys);

            const stripePavers: any[] = [];
            const allCoping = [
              ...(coping.leftSide?.paverPositions || []),
              ...(coping.rightSide?.paverPositions || []),
              ...(coping.shallowEnd?.paverPositions || []),
              ...(coping.deepEnd?.paverPositions || []),
            ];
            const eps = 0.5;
            allCoping.forEach((p, i) => {
              const rx = pool.position.x + p.x * pxPerMm;
              const ry = pool.position.y + p.y * pxPerMm;
              const rw = p.width * pxPerMm;
              const rh = p.height * pxPerMm;
              const rectRight = rx + rw;
              const rectBottom = ry + rh;

              if (rectBottom <= poolTop + eps) {
                stripePavers.push({
                  id: `s-top-${i}`,
                  position: { x: rx, y: ry - tileHpx },
                  width: rw,
                  height: tileHpx,
                  isEdgePaver: false,
                });
              } else if (ry >= poolBottom - eps) {
                stripePavers.push({
                  id: `s-bottom-${i}`,
                  position: { x: rx, y: ry + rh },
                  width: rw,
                  height: tileHpx,
                  isEdgePaver: false,
                });
              } else if (rectRight <= poolLeft + eps) {
                stripePavers.push({
                  id: `s-left-${i}`,
                  position: { x: rx - tileWpx, y: ry },
                  width: tileWpx,
                  height: rh,
                  isEdgePaver: false,
                });
              } else if (rx >= poolRight - eps) {
                stripePavers.push({
                  id: `s-right-${i}`,
                  position: { x: rx + rw, y: ry },
                  width: tileWpx,
                  height: rh,
                  isEdgePaver: false,
                });
              }
            });

            const poly = (x1: number, y1: number, x2: number, y2: number) => [
              { x: x1, y: y1 },
              { x: x2, y: y1 },
              { x: x2, y: y2 },
              { x: x1, y: y2 },
            ];

            const leftBand =
              leftOuterX > minX
                ? fillAreaWithPaversFromOrigin(
                    poly(minX, minY, leftOuterX, maxY),
                    size,
                    orient,
                    showEdgePavers,
                    poolExcludeZones,
                    { x: leftOuterX },
                    groutMm
                  )
                : [];
            const rightBand =
              rightOuterX < maxX
                ? fillAreaWithPaversFromOrigin(
                    poly(rightOuterX, minY, maxX, maxY),
                    size,
                    orient,
                    showEdgePavers,
                    poolExcludeZones,
                    { x: rightOuterX },
                    groutMm
                  )
                : [];
            const topBand =
              topOuterY > minY
                ? fillAreaWithPaversFromOrigin(
                    poly(minX, minY, maxX, topOuterY),
                    size,
                    orient,
                    showEdgePavers,
                    poolExcludeZones,
                    { y: topOuterY },
                    groutMm
                  )
                : [];
            const bottomBand =
              bottomOuterY < maxY
                ? fillAreaWithPaversFromOrigin(
                    poly(minX, bottomOuterY, maxX, maxY),
                    size,
                    orient,
                    showEdgePavers,
                    poolExcludeZones,
                    { y: bottomOuterY },
                    groutMm
                  )
                : [];

            const map = new Map<string, any>();
            const addAll = (arr: any[]) =>
              arr.forEach((p) => {
                const k = `${Math.round(p.position.x * 1000)}|${Math.round(p.position.y * 1000)}|${Math.round(
                  p.width * 1000
                )}|${Math.round(p.height * 1000)}`;
                if (!map.has(k)) map.set(k, p);
              });
            addAll(stripePavers);
            addAll(leftBand);
            addAll(rightBand);
            addAll(topBand);
            addAll(bottomBand);
            return Array.from(map.values());
          }
        }
      }

      // Default: atomic array masked by boundary with stable origin (no gaps)
      return fillAreaWithPaversFromOrigin(
        bnd,
        size,
        orient,
        showEdgePavers,
        poolExcludeZones,
        origin,
        groutMm
      );
    },
    [
      allComponents,
      component.properties.alignToPoolId,
      component.properties.paverOrientation,
      component.properties.paverSize,
      showEdgePavers,
      poolExcludeZones,
      groutMm,
      component.properties.tileOrigin,
    ]
  );

  // ---------------- main pavers/statistics ----------------
  const pavers = useMemo(() => {
    if (areaSurface !== 'pavers') return [] as any[];
    return computePaversForBoundary(boundary);
  }, [computePaversForBoundary, boundary, areaSurface]);

  const statistics = useMemo(
    () => calculateStatistics(pavers, component.properties.wastagePercentage || 0),
    [pavers, component.properties.wastagePercentage]
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

  // ---------------- bbox (stage coords) and LOCAL rebased geometry ----------------
  const bbox = useMemo(() => {
    if (boundary.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    const xs = boundary.map((p) => p.x);
    const ys = boundary.map((p) => p.y);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs);
    const minY = Math.min(...ys),
      maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [boundary]);

  const boundaryLocal = useMemo(
    () => boundary.map((p) => ({ x: p.x - bbox.x, y: p.y - bbox.y })),
    [boundary, bbox.x, bbox.y]
  );

  const paversLocal = useMemo(
    () =>
      pavers.map((p) => ({
        ...p,
        position: { x: p.position.x - bbox.x, y: p.position.y - bbox.y },
      })),
    [pavers, bbox.x, bbox.y]
  );

  // Compute grout segments in LOCAL coords (unclipped rendering)
  const groutSegsLocal = useMemo(
    () => buildGroutSegments(paversLocal, showEdgePavers),
    [paversLocal, showEdgePavers]
  );

  // ---------------- node/edge selection ----------------
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

  // ---------------- ghost & edit preview ----------------
  const [ghost, setGhost] = useState<null | { boundary: Pt[]; pavers: any[] }>(null);
  const [localPreview, setLocalPreview] = useState<Pt[] | null>(null); // boundary in local coords while dragging
  const rafRef = useRef<number | null>(null);

  const showLive = !ghost && !localPreview;

  // ---------------- subtle textures for concrete/grass ----------------
  const createConcretePattern = useCallback((): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = 12; c.height = 12;
    const ctx = c.getContext('2d')!;
    // base
    ctx.fillStyle = '#e5e7eb'; // neutral-200
    ctx.fillRect(0, 0, c.width, c.height);
    // speckles
    ctx.fillStyle = 'rgba(100, 116, 139, 0.15)'; // slate-500 @ 0.15
    for (let i = 0; i < 6; i++) {
      const x = (i * 2 + 3) % c.width;
      const y = (i * 3 + 5) % c.height;
      ctx.fillRect(x, y, 1, 1);
    }
    // subtle diagonal
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.beginPath();
    ctx.moveTo(0, c.height);
    ctx.lineTo(c.width, 0);
    ctx.stroke();
    return c;
  }, []);

  const createGrassPattern = useCallback((): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = 12; c.height = 12;
    const ctx = c.getContext('2d')!;
    // base
    ctx.fillStyle = '#bbf7d0'; // green-200
    ctx.fillRect(0, 0, c.width, c.height);
    // blades (short strokes)
    ctx.strokeStyle = 'rgba(22, 163, 74, 0.18)'; // green-600 @ 0.18
    for (let i = 0; i < 3; i++) {
      const x = (i * 4 + 2) % c.width;
      ctx.beginPath();
      ctx.moveTo(x, c.height);
      ctx.lineTo(x + 1, c.height - 3);
      ctx.stroke();
    }
    // cross hue
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.14)'; // emerald-500 @ 0.14
    ctx.beginPath();
    ctx.moveTo(0, c.height - 4);
    ctx.lineTo(3, c.height - 1);
    ctx.stroke();
    return c;
  }, []);

  const areaPattern = useMemo(() => {
    if (areaSurface === 'concrete') return createConcretePattern();
    if (areaSurface === 'grass') return createGrassPattern();
    return null;
  }, [areaSurface, createConcretePattern, createGrassPattern]);

  // ---------------- drag whole polygon ----------------
  const handleRightClick = (e: any) => {
    e.evt.preventDefault();
    if (!onContextMenu) return;
    const stage = e.target.getStage();
    const pt = stage.getPointerPosition();
    onContextMenu(component, { x: pt.x, y: pt.y });
  };

  const handleDragEnd = () => {
    const node = groupRef.current;
    if (!node) return;
    const nextX = snapToGrid(node.x());
    const nextY = snapToGrid(node.y());

    const dx = nextX - bbox.x;
    const dy = nextY - bbox.y;
    if (dx === 0 && dy === 0) {
      node.position({ x: nextX, y: nextY });
      return;
    }
    const moved = boundary.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    node.position({ x: nextX, y: nextY });
    updateComponent(component.id, { properties: { ...component.properties, boundary: moved } });
  };

  // ---------------- helpers ----------------
  const toStage = (local: Pt[]) => local.map((p) => ({ x: p.x + bbox.x, y: p.y + bbox.y }));

  const scheduleGhostFromLocal = (local: Pt[]) => {
    const stagePts = toStage(local);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setGhost({ boundary: stagePts, pavers: computePaversForBoundary(stagePts) });
    });
  };

  // ---------------- vertex drag ----------------
  const vertexOriginalRef = useRef<Pt[] | null>(null);
  const vertexDragAnchorRef = useRef<number | null>(null);

  const onVertexMouseDown = (i: number, evt: any) => {
    evt.cancelBubble = true;
    toggleNode(i, evt.evt.shiftKey);
  };

  const onVertexDragStart = (i: number, evt: any) => {
    evt.cancelBubble = true;
    if (!isNodeSelected(i)) setSelectedNodes([i]);
    vertexOriginalRef.current = boundaryLocal.map((p) => ({ ...p }));
    vertexDragAnchorRef.current = i;
    setLocalPreview(boundaryLocal); // seed
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

    const nextLocal = orig.map((p, idx) => (isNodeSelected(idx) ? { x: p.x + dx, y: p.y + dy } : p));
    setLocalPreview(nextLocal);
    scheduleGhostFromLocal(nextLocal);
  };

  const commitLocal = (local: Pt[]) => {
    const stagePts = toStage(local).map((pt) => ({ x: snapToGrid(pt.x), y: snapToGrid(pt.y) }));
    const xs = stagePts.map((p) => p.x);
    const ys = stagePts.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    // Move group to new top-left (keeps handles stable)
    groupRef.current.position({ x: minX, y: minY });
    updateComponent(component.id, { properties: { ...component.properties, boundary: stagePts } });
    setGhost(null);
    setLocalPreview(null);
    vertexOriginalRef.current = null;
    vertexDragAnchorRef.current = null;
  };

  const onVertexDragEnd = (i: number, evt: any) => {
    evt.cancelBubble = true;
    const local = localPreview || boundaryLocal;
    commitLocal(local);
  };

  

  // Node-only editing: removed edge drag/scale handles

  // ---------------- render ----------------
  return (
    <>
      <Group
        ref={groupRef}
        x={bbox.x}
        y={bbox.y}
        onClick={onSelect}
        onTap={onSelect}
        onContextMenu={handleRightClick}
        draggable={activeTool !== 'hand' && isSelected && !localPreview}
        onDragEnd={handleDragEnd}
      >
        {/* hit area for selection/move (include grout bleed) */}
        {(() => {
          const BLEED = groutStrokePx / 2;
          return (
            <Rect
              x={-BLEED}
              y={-BLEED}
              width={bbox.width + BLEED * 2}
              height={bbox.height + BLEED * 2}
              fill="transparent"
              listening
            />
          );
        })()}

        {/* content (hidden during ghost) */}
        {showLive && (
          <>
            {/* Everything is clipped to the boundary polygon */}
            <Group
              clipFunc={(ctx) => {
                ctx.beginPath();
                boundaryLocal.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
                ctx.closePath();
              }}
            >
              {areaSurface === 'pavers' ? (
                <>
                  {/* Grout underlay - fills entire area with grout color */}
                  {TILE_GAP.renderGap && TILE_GAP.size > 0 && (
                    <Line
                      points={boundaryLocal.flatMap((p) => [p.x, p.y])}
                      fill={TILE_COLORS.groutColor}
                      closed
                      listening={false}
                    />
                  )}

                  {/* Tile fills - full sized, gaps handled by positioning */}
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
                          x={x1}
                          y={y1}
                          width={Math.max(0, w)}
                          height={Math.max(0, h)}
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
                // Non-paver surfaces (concrete/grass): subtle texture fill + toned border
                <>
                  {areaPattern && (
                    <Rect
                      x={0}
                      y={0}
                      width={bbox.width}
                      height={bbox.height}
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
          <Line points={localPreview.flatMap((p) => [p.x, p.y])} stroke="#3B82F6" strokeWidth={3} strokeScaleEnabled={false} dash={[10, 5]} closed />
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

            {/* edge handles removed to enforce node-only editing */}
          </>
        )}
      </Group>

      {/* Ghost (stage coords) while editing */}
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
                {/* Ghost background fill (same tone as tiles) */}
                <Line
                  points={ghost.boundary.flatMap((p) => [p.x, p.y])}
                  fill={TILE_COLORS.extendedTile}
                  closed
                  listening={false}
                  opacity={0.75}
                />

                {/* Ghost tiles - full sized */}
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

          {/* No stroke grout in ghost; background fill already shows grout color */}

          <Line points={ghost.boundary.flatMap((p) => [p.x, p.y])} stroke="#93C5FD" strokeWidth={3} dash={[10, 5]} closed listening={false} strokeScaleEnabled={false} />
        </Group>
      )}
    </>
  );
};

import { useRef, useMemo, useState, useEffect } from 'react';
import { Group, Line, Text, Circle, Rect } from 'react-konva';
import { Component } from '@/types';
import { POOL_LIBRARY } from '@/constants/pools';
import { calculatePoolCoping, GROUT_MM } from '@/utils/copingCalculation';
import { useDesignStore } from '@/store/designStore';
import { snapPoolToPaverGrid } from '@/utils/snap';

interface PoolComponentProps {
  component: Component;
  isSelected: boolean;
  activeTool?: string;
  onSelect: () => void;
  onDragEnd: (pos: { x: number; y: number }) => void;
  onContextMenu?: (component: Component, screenPos: { x: number; y: number }) => void;
}

export const PoolComponent = ({ component, isSelected, onSelect, onDragEnd, onContextMenu }: PoolComponentProps) => {
  const groupRef = useRef<any>(null);
  const { components: allComponents, updateComponent } = useDesignStore();
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
  // Shift-selectable coping tiles (keys encoded as `${side}:${index}` for base and `${side}:ext:${index}` for extensions)
  const [selectedTiles, setSelectedTiles] = useState<Set<string>>(new Set());
  const [selectionSide, setSelectionSide] = useState<Side | null>(null);
  // Preview for extension ghost rectangles
  const [preview, setPreview] = useState<
    | null
    | {
        side: 'top' | 'bottom' | 'left' | 'right'; // handle side used
        targetSide: 'top' | 'bottom' | 'left' | 'right'; // side we are extending from (selection side if any)
        steps: number;
        sign: 1 | -1; // direction of travel
        axis: 'x' | 'y';
        rects: Array<{ x: number; y: number; width: number; height: number; isPartial: boolean }>;
      }
  >(null);


  // Prefer embedded pool geometry to avoid library mismatches
  const poolData = (component.properties as any).pool ||
    POOL_LIBRARY.find(p => p.id === component.properties.poolId) ||
    POOL_LIBRARY[0];
  
  // Scale down from mm to canvas units (1 unit = 10mm for better display)
  const scale = 0.1;
  const scaledOutline = poolData.outline.map(p => ({ x: p.x * scale, y: p.y * scale }));
  const points = scaledOutline.flatMap(p => [p.x, p.y]);

  // Calculate coping if enabled
  const showCoping = component.properties.showCoping ?? false;
  const copingConfig = component.properties.copingConfig;
  const copingCalc = showCoping && poolData
    ? calculatePoolCoping(poolData, copingConfig)
    : null;

  // Build side-indexed paver lists (in mm, pool-local)
  type Side = 'top'|'bottom'|'left'|'right';
  type Tile = { x:number; y:number; width:number; height:number; isPartial:boolean; side: Side; key: string; source: 'base'|'ext' };

  const copingExtensions = (component.properties.copingExtensions || []) as Array<{x:number;y:number;width:number;height:number;isPartial:boolean;side:Side}>;

  const sideTiles = useMemo(() => {
    const result: Record<Side, Tile[]> = { top: [], bottom: [], left: [], right: [] };
    if (copingCalc) {
      // Map base tiles to sides using generation logic in calculatePoolCoping
      // top: leftSide (y < 0), bottom: rightSide (y >= pool.width), left: shallowEnd (x < 0), right: deepEnd (x >= pool.length)
      (copingCalc.leftSide?.paverPositions || []).forEach((p, i) => {
        result.top.push({ ...p, side: 'top', key: `top:${i}`, source: 'base' });
      });
      (copingCalc.rightSide?.paverPositions || []).forEach((p, i) => {
        result.bottom.push({ ...p, side: 'bottom', key: `bottom:${i}`, source: 'base' });
      });
      (copingCalc.shallowEnd?.paverPositions || []).forEach((p, i) => {
        result.left.push({ ...p, side: 'left', key: `left:${i}`, source: 'base' });
      });
      (copingCalc.deepEnd?.paverPositions || []).forEach((p, i) => {
        result.right.push({ ...p, side: 'right', key: `right:${i}`, source: 'base' });
      });
    }
    // Append extensions
    copingExtensions.forEach((p, i) => {
      const key = `${p.side}:ext:${i}`;
      (result[p.side] as Tile[]).push({ ...p, key, side: p.side, source: 'ext' });
    });
    return result;
  }, [copingCalc, copingExtensions]);

  // Row depth per side (mm). For sides we can derive from CopingSide.width/rows
  const sideRowDepthMm = useMemo(() => {
    const depths: Record<Side, number> = { top: 400, bottom: 400, left: 400, right: 400 };
    if (copingCalc) {
      depths.top = copingCalc.leftSide.rows > 0 ? Math.max(1, Math.round(copingCalc.leftSide.width / copingCalc.leftSide.rows)) : 400;
      depths.bottom = copingCalc.rightSide.rows > 0 ? Math.max(1, Math.round(copingCalc.rightSide.width / copingCalc.rightSide.rows)) : 400;
      depths.left = copingCalc.shallowEnd.rows > 0 ? Math.max(1, Math.round(copingCalc.shallowEnd.width / copingCalc.shallowEnd.rows)) : 400;
      depths.right = copingCalc.deepEnd.rows > 0 ? Math.max(1, Math.round(copingCalc.deepEnd.width / copingCalc.deepEnd.rows)) : 400;
    }
    return depths;
  }, [copingCalc]);

  // Determine the current outermost row coordinate per side in mm (pool-local)
  const outermostCoord = useMemo(() => {
    const out: Record<Side, number> = { top: 0, bottom: 0, left: 0, right: 0 };
    // Defaults based on base pool rect when no tiles exist
    out.top = Math.min(0, ...(sideTiles.top.map(t => t.y)));
    out.bottom = Math.max(poolData.width, ...(sideTiles.bottom.map(t => t.y)));
    out.left = Math.min(0, ...(sideTiles.left.map(t => t.x)));
    out.right = Math.max(poolData.length, ...(sideTiles.right.map(t => t.x)));
    // Now normalize to actual edges: for bottom/right, rows start at pool edge, outermost row is farthest (max); for top/left, farthest is min
    return out;
  }, [sideTiles, poolData.length, poolData.width]);

  // Helpers to check if a tile is on the current outermost row of its side (used for object-level extend preview)
  const isTileOnOutermostRow = (tile: Tile): boolean => {
    const eps = 1e-6;
    switch (tile.side) {
      case 'top':
        return Math.abs(tile.y - outermostCoord.top) < eps;
      case 'bottom':
        return Math.abs(tile.y - outermostCoord.bottom) < eps;
      case 'left':
        return Math.abs(tile.x - outermostCoord.left) < eps;
      case 'right':
        return Math.abs(tile.x - outermostCoord.right) < eps;
    }
  };

  // Allow selecting tiles on ANY coping row (not just outermost)
  const isTileSelectable = (_tile: Tile): boolean => {
    return true;
  };

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
      ...(copingExtensions || []),
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
  }, [showCoping, copingCalc, poolData.length, poolData.width, scale]);

  const handleDragEnd = (e: any) => {
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

  // Selection behavior for coping tiles (shift-click) - simplified like paver component
  const toggleTileSelection = (tile: Tile, evt?: any) => {
    // Only allow shift-click toggling and only on outermost row tiles for that side
    if (!evt?.evt?.shiftKey) return;

    // Only allow selection of outermost row tiles
    if (!isTileSelectable(tile)) return;

    // Prevent bubbling to group so pool selection doesn't toggle
    evt.cancelBubble = true;

    // Always ensure object is selected so handles show
    if (!isSelected) onSelect();

    setSelectedTiles((prev) => {
      let next = new Set(prev);

      // If switching sides, reset selection to this tile only
      if (selectionSide && selectionSide !== tile.side) {
        next = new Set([tile.key]);
        setSelectionSide(tile.side);
        return next;
      }

      // Toggle this tile on/off
      if (next.has(tile.key)) {
        next.delete(tile.key);
        // If no tiles left, clear side
        if (next.size === 0) {
          setSelectionSide(null);
        }
      } else {
        // Add tile - allow any outermost tile on same side
        next.add(tile.key);
        setSelectionSide(tile.side);
      }

      return next;
    });
  };

  // Clear tile selections when pool becomes deselected
  useEffect(() => {
    if (!isSelected && selectedTiles.size > 0) {
      setSelectedTiles(new Set());
      setSelectionSide(null);
    }
  }, [isSelected, selectedTiles.size]);

  // Build the list of tiles for rendering (base + extensions) with selection overlays
  const renderCopingTiles = () => {
    const tiles: Tile[] = ([] as Tile[])
      .concat(sideTiles.top)
      .concat(sideTiles.bottom)
      .concat(sideTiles.left)
      .concat(sideTiles.right);

    // Compute candidate selectable tiles for highlight - simpler like paver component
    const candidateKeys = new Set<string>();
    if (selectionSide) {
      // Show all unselected tiles on the active side as candidates
      sideTiles[selectionSide].forEach(t => {
        if (!selectedTiles.has(t.key)) candidateKeys.add(t.key);
      });
    }

    const roundHalf = (px: number) => Math.round(px * 2) / 2;
    const floorHalf = (px: number) => Math.floor(px * 2) / 2;
    const groutStrokePx = 2; // unify joins and edges
    const scissorsColor = '#B8AE94';
    const scissorsSize = 11;
    const scissorsMargin = 3;
    const baseFill = '#E8DBC4'; // slightly darker sandstone for original coping
    const extFill = '#F3EBD9';  // lighter sandstone for extensions

    // Build tile fill + overlays
    const fills: JSX.Element[] = [];
    tiles
      .filter((t) => {
        const w = t.width * scale;
        const h = t.height * scale;
        return w > 0 && h > 0 && isFinite(w) && isFinite(h);
      })
      .forEach((t) => {
        const width = Math.max(1, Math.round(t.width * scale));
        const height = Math.max(1, Math.round(t.height * scale));
        const isSel = selectedTiles.has(t.key);
        const isCandidate = candidateKeys.has(t.key) && !isSel;
        const isPartial = t.isPartial;
        const pxX = floorHalf(t.x * scale);
        const pxY = floorHalf(t.y * scale);
        fills.push(
          <Group key={`coping-${t.key}`}>
            <Rect
              x={pxX}
              y={pxY}
              width={width}
              height={height}
              fill={t.source === 'base' ? baseFill : extFill}
              dash={isPartial ? [5,5] : undefined}
              opacity={isPartial ? 0.85 : 1}
              onClick={(e:any) => toggleTileSelection(t, e)}
              onTap={(e:any) => toggleTileSelection(t, e)}
            />
            {isCandidate && (
              <Rect
                x={pxX + groutStrokePx/2}
                y={pxY + groutStrokePx/2}
                width={Math.max(0, width - groutStrokePx)}
                height={Math.max(0, height - groutStrokePx)}
                fill="rgba(16,185,129,0.12)"
                stroke="#10B981"
                strokeWidth={2}
                dash={[4,2]}
                listening={false}
              />
            )}
            {isSel && (
              <Rect
                x={pxX + groutStrokePx/2}
                y={pxY + groutStrokePx/2}
                width={Math.max(0, width - groutStrokePx)}
                height={Math.max(0, height - groutStrokePx)}
                fill="rgba(59,130,246,0.15)"
                stroke="#3B82F6"
                strokeWidth={2}
                dash={[6,3]}
                listening={false}
              />
            )}
            {/* Cut indicator at bottom-right for partial tiles */}
            {isPartial && (
              <Text
                x={pxX + width - scissorsSize - scissorsMargin}
                y={pxY + height - scissorsSize - scissorsMargin}
                text="✂"
                fontSize={scissorsSize}
                fill={scissorsColor}
                listening={false}
              />
            )}
          </Group>
        );
      });

    // Build unique edge segments for grout lines
    type Seg = { x1:number; y1:number; x2:number; y2:number; };
    const edgeMap = new Map<string, Seg & { count: number }>();

    const addEdge = (x1:number,y1:number,x2:number,y2:number) => {
      // normalize orientation and snap to half-pixel
      const rx1 = roundHalf(x1), ry1 = roundHalf(y1);
      const rx2 = roundHalf(x2), ry2 = roundHalf(y2);
      const key = `${Math.min(rx1,rx2)},${Math.min(ry1,ry2)},${Math.max(rx1,rx2)},${Math.max(ry1,ry2)}`;
      const cur = edgeMap.get(key);
      if (cur) cur.count += 1; else edgeMap.set(key, { x1: rx1, y1: ry1, x2: rx2, y2: ry2, count: 1 });
    };

    tiles.forEach((t) => {
      const pxX = floorHalf(t.x * scale);
      const pxY = floorHalf(t.y * scale);
      const width = Math.max(1, Math.round(t.width * scale));
      const height = Math.max(1, Math.round(t.height * scale));
      // edges in px
      addEdge(pxX, pxY, pxX + width, pxY); // top
      addEdge(pxX, pxY + height, pxX + width, pxY + height); // bottom
      addEdge(pxX, pxY, pxX, pxY + height); // left
      addEdge(pxX + width, pxY, pxX + width, pxY + height); // right
    });

    const groutLines: JSX.Element[] = [];
    edgeMap.forEach((seg, key) => {
      groutLines.push(
        <Line
          key={`grout-${key}`}
          points={[floorHalf(seg.x1), floorHalf(seg.y1), floorHalf(seg.x2), floorHalf(seg.y2)]}
          stroke="#D4C5A9"
          strokeWidth={groutStrokePx}
          listening={false}
        />
      );
    });

    return (
      <>
        {fills}
        {/* Draw grout lines once to ensure joins == edges */}
        {groutLines}
      </>
    );
  };

  // Extension handles for each side; anchor to selection bounds if present, else object coping bounds
  const renderExtendHandles = () => {
    if (!isSelected) return null;

    // Selection bounds across selected tiles (mm)
    const getSelectionBounds = () => {
      if (selectedTiles.size === 0) return null as null | { minX:number; maxX:number; minY:number; maxY:number };
      const keys = new Set(selectedTiles);
      const selected: Tile[] = ([] as Tile[])
        .concat(sideTiles.top, sideTiles.bottom, sideTiles.left, sideTiles.right)
        .filter(t => keys.has(t.key));
      if (selected.length === 0) return null;
      const minX = Math.min(...selected.map(t => t.x));
      const maxX = Math.max(...selected.map(t => t.x + t.width));
      const minY = Math.min(...selected.map(t => t.y));
      const maxY = Math.max(...selected.map(t => t.y + t.height));
      return { minX, maxX, minY, maxY };
    };

    // Overall coping bounds (base + extensions) (mm)
    const getOverallCopingBounds = () => {
      const all: Tile[] = ([] as Tile[])
        .concat(sideTiles.top, sideTiles.bottom, sideTiles.left, sideTiles.right);
      if (all.length === 0) return null as null | { minX:number; maxX:number; minY:number; maxY:number };
      const minX = Math.min(...all.map(t => t.x));
      const maxX = Math.max(...all.map(t => t.x + t.width));
      const minY = Math.min(...all.map(t => t.y));
      const maxY = Math.max(...all.map(t => t.y + t.height));
      return { minX, maxX, minY, maxY };
    };

    const handles: JSX.Element[] = [];

    const addHandle = (side: Side) => {
      const b = getSelectionBounds() || getOverallCopingBounds();
      if (!b) return null;
      // Pick target side: prefer selection side if any selection is active, else the handle's own side
      const targetSide: Side = selectionSide || side;
      const depthMm = sideRowDepthMm[targetSide];
      const depthPx = depthMm * scale;

      let hx = 0, hy = 0; // local coords (mm scaled)
      let dragAxis: 'x'|'y' = 'y';
      let minPos = 0, maxPos = 0, basePos = 0; // in mm, then scaled
      // We allow in/out in both directions; sign is computed live from drag delta

      if (side === 'top') {
        hx = (b.minX + b.maxX) / 2 * scale;
        hy = b.minY * scale; // at outer edge
        dragAxis = 'y';
        basePos = hy;
        // allow moving both up and down around base
        minPos = hy - 20 * depthPx;
        maxPos = hy + 20 * depthPx;
      } else if (side === 'bottom') {
        hx = (b.minX + b.maxX) / 2 * scale;
        hy = b.maxY * scale; // at outer edge
        dragAxis = 'y';
        basePos = hy;
        minPos = hy - 20 * depthPx;
        maxPos = hy + 20 * depthPx;
      } else if (side === 'left') {
        hx = b.minX * scale;
        hy = (b.minY + b.maxY) / 2 * scale;
        dragAxis = 'x';
        basePos = hx;
        minPos = hx - 20 * depthPx;
        maxPos = hx + 20 * depthPx;
      } else if (side === 'right') {
        hx = b.maxX * scale;
        hy = (b.minY + b.maxY) / 2 * scale;
        dragAxis = 'x';
        basePos = hx;
        minPos = hx - 20 * depthPx;
        maxPos = hx + 20 * depthPx;
      }

      const color = (side === 'top' || side === 'left') ? '#10B981' : '#3B82F6';

      handles.push(
        <Circle
          key={`handle-${side}`}
          x={hx}
          y={hy}
          radius={8}
          fill={color}
          stroke="white"
          strokeWidth={2}
          draggable
          dragBoundFunc={(pos) => {
            const group = groupRef.current;
            if (!group) return pos;
            const tr = group.getAbsoluteTransform().copy();
            const inv = tr.copy().invert();
            const local = inv.point(pos);
            if (dragAxis === 'y') {
              local.x = hx; // keep x fixed (already scaled)
              local.y = Math.max(minPos, Math.min(maxPos, local.y));
            } else {
              local.y = hy; // keep y fixed
              local.x = Math.max(minPos, Math.min(maxPos, local.x));
            }
            return tr.point(local);
          }}
          onDragStart={(e) => {
            e.cancelBubble = true;
            setIsDraggingHandle(true);
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            // Handle position is already in local coordinates (relative to Group)
            const handleX = e.target.x();
            const handleY = e.target.y();

            const axis: 'x' | 'y' = dragAxis;
            const normalAxis: 'x' | 'y' = (targetSide === 'left' || targetSide === 'right') ? 'x' : 'y';
            const isNormal = axis === normalAxis;

            // Determine which tiles to extend: prefer selection on target side; otherwise outermost row of that side
            const sideSelKeys = Array.from(selectedTiles).filter(k => k.startsWith(`${targetSide}:`));
            const hasSelection = sideSelKeys.length > 0;
            const candidateTiles = (hasSelection
              ? sideTiles[targetSide].filter(t => sideSelKeys.includes(t.key))
              : sideTiles[targetSide].filter(t => isTileOnOutermostRow(t))
            );

            const anyPartial = candidateTiles.some(t => t.isPartial);

            // Signed delta and sign on dragged axis
            const posOnAxis = axis === 'y' ? handleY : handleX;
            let sign: 1 | -1 = (posOnAxis - basePos) >= 0 ? 1 : -1;

            // Compute unit distance on axis
            let unitMm = depthMm; // default for normal (row depth per step)
            let anchorPx = basePos; // default anchor = object handle base
            if (!isNormal) {
              if (!hasSelection || anyPartial) {
                // No selection or cut pavers → tangent extension disabled
                setPreview({ side, targetSide, steps: 0, sign, axis, rects: [] });
                return;
              }
              // Tangent replicate – use selection block span + grout for step and anchor to selection edge
              const minCoord = axis === 'x'
                ? Math.min(...candidateTiles.map(t => t.x))
                : Math.min(...candidateTiles.map(t => t.y));
              const maxCoord = axis === 'x'
                ? Math.max(...candidateTiles.map(t => t.x + t.width))
                : Math.max(...candidateTiles.map(t => t.y + t.height));
              const blockSpanMm = Math.max(0, maxCoord - minCoord);
              unitMm = blockSpanMm + GROUT_MM;
              anchorPx = (sign >= 0 ? maxCoord : minCoord) * scale;
            } else {
              // Normal replicate – anchor to selection edge if any
              if (candidateTiles.length > 0) {
                const minCoord = normalAxis === 'x'
                  ? Math.min(...candidateTiles.map(t => t.x))
                  : Math.min(...candidateTiles.map(t => t.y));
                const maxCoord = normalAxis === 'x'
                  ? Math.max(...candidateTiles.map(t => t.x + t.width))
                  : Math.max(...candidateTiles.map(t => t.y + t.height));
                anchorPx = (sign >= 0 ? maxCoord : minCoord) * scale;
              }
            }

            const posOnAxisMm = posOnAxis / scale;
            const anchorMm = anchorPx / scale;
            const steps = unitMm > 0 ? Math.max(0, Math.round(Math.abs(posOnAxisMm - anchorMm) / unitMm)) : 0;

            // Build ghost rects for preview - show ALL rows/blocks from 1 to steps
            const rects: Array<{x:number;y:number;width:number;height:number;isPartial:boolean}> = [];
            // Build overlap checker in pixel space so preview skips blocked positions (e.g., cut pavers)
            const existingAllPx = ([] as Tile[])
              .concat(sideTiles.top, sideTiles.bottom, sideTiles.left, sideTiles.right)
              .map(t => ({ x: Math.floor(t.x * scale * 2) / 2, y: Math.floor(t.y * scale * 2) / 2, w: Math.round(t.width * scale), h: Math.round(t.height * scale) }));
            const overlapsPx = (rx:number, ry:number, rw:number, rh:number) => {
              const eps = 0.01;
              const bx1 = rx, by1 = ry, bx2 = rx + rw, by2 = ry + rh;
              return existingAllPx.some(a => {
                const ax1 = a.x, ay1 = a.y, ax2 = a.x + a.w, ay2 = a.y + a.h;
                return ax1 < bx2 - eps && ax2 > bx1 + eps && ay1 < by2 - eps && ay2 > by1 + eps;
              });
            };
            if (steps > 0 && candidateTiles.length > 0) {
              for (let s = 1; s <= steps; s++) {
                const offPx = (s * unitMm * sign) * scale;
                candidateTiles.forEach((t) => {
                  const baseX = Math.floor(t.x * scale * 2) / 2;
                  const baseY = Math.floor(t.y * scale * 2) / 2;
                  const w = Math.round(t.width * scale);
                  const h = Math.round(t.height * scale);
                  const rx = axis === 'x' ? baseX + offPx : baseX;
                  const ry = axis === 'y' ? baseY + offPx : baseY;
                  const rrX = Math.floor(rx * 2) / 2;
                  const rrY = Math.floor(ry * 2) / 2;
                  if (!overlapsPx(rrX, rrY, w, h)) {
                    rects.push({ x: rrX, y: rrY, width: w, height: h, isPartial: t.isPartial });
                  }
                });
              }
            }
            setPreview({ side, targetSide, steps, sign, axis, rects });
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            const steps = preview?.steps || 0;
            if (steps > 0 && preview?.side === side) {
              const tSide = preview?.targetSide || targetSide;
              const sign = preview?.sign || 1;
              const axis = preview?.axis || ((tSide === 'left' || tSide === 'right') ? 'x' : 'y');
              const normalAxis: 'x' | 'y' = (tSide === 'left' || tSide === 'right') ? 'x' : 'y';
              const isNormal = axis === normalAxis;
              // Recompute candidate tiles (same as onDragMove) to build all rows/blocks up to 'steps'
              const sideSelKeys = Array.from(selectedTiles).filter(k => k.startsWith(`${tSide}:`));
              const hasSelection = sideSelKeys.length > 0;
              const candidateTiles = (hasSelection
                ? sideTiles[tSide].filter(t => sideSelKeys.includes(t.key))
                : sideTiles[tSide].filter(t => isTileOnOutermostRow(t))
              );
              if (candidateTiles.length > 0) {
                const existingAll = ([] as Tile[])
                  .concat(sideTiles.top, sideTiles.bottom, sideTiles.left, sideTiles.right);
                const added: Array<{x:number;y:number;width:number;height:number}> = [];
                const overlaps = (rx:number, ry:number, rw:number, rh:number) => {
                  const eps = 0.01;
                  const bx1 = rx, by1 = ry, bx2 = rx + rw, by2 = ry + rh;
                  // Check against existing
                  const hitExisting = existingAll.some((t) => {
                    const ax1 = t.x, ay1 = t.y, ax2 = t.x + t.width, ay2 = t.y + t.height;
                    return ax1 < bx2 - eps && ax2 > bx1 + eps && ay1 < by2 - eps && ay2 > by1 + eps;
                  });
                  if (hitExisting) return true;
                  // Check against already-added in this commit
                  return added.some((a) => {
                    const ax1 = a.x, ay1 = a.y, ax2 = a.x + a.width, ay2 = a.y + a.height;
                    return ax1 < bx2 - eps && ax2 > bx1 + eps && ay1 < by2 - eps && ay2 > by1 + eps;
                  });
                };

                const rowsToAdd: Array<{x:number;y:number;width:number;height:number;isPartial:boolean;side:Side}> = [];
                // Determine unit distance per step
                let unitMm = depthMm;
                if (!isNormal) {
                  const minCoord = axis === 'x'
                    ? Math.min(...candidateTiles.map(t => t.x))
                    : Math.min(...candidateTiles.map(t => t.y));
                  const maxCoord = axis === 'x'
                    ? Math.max(...candidateTiles.map(t => t.x + t.width))
                    : Math.max(...candidateTiles.map(t => t.y + t.height));
                  const blockSpanMm = Math.max(0, maxCoord - minCoord);
                  unitMm = blockSpanMm + GROUT_MM;
                }
                const snapMm = (mm:number) => Math.floor(mm / GROUT_MM) * GROUT_MM; // snap mm to 5mm grid
                for (let s = 1; s <= steps; s++) {
                  const off = s * unitMm * sign; // mm
                  candidateTiles.forEach((t) => {
                    const rx = axis === 'x' ? snapMm(t.x + off) : snapMm(t.x);
                    const ry = axis === 'y' ? snapMm(t.y + off) : snapMm(t.y);
                    const rw = t.width;
                    const rh = t.height;
                    if (!overlaps(rx, ry, rw, rh)) {
                      added.push({ x: rx, y: ry, width: rw, height: rh });
                      rowsToAdd.push({ x: rx, y: ry, width: rw, height: rh, isPartial: t.isPartial, side: tSide });
                    }
                  });
                }

                if (rowsToAdd.length > 0) {
                  const oldExt = (component.properties.copingExtensions || []) as any[];
                  updateComponent(component.id, {
                    properties: {
                      ...component.properties,
                      copingExtensions: [...oldExt, ...rowsToAdd],
                    }
                  });
                }
              }
            }
            // Reset preview and handle
            const circle = e.target;
            circle.x(hx);
            circle.y(hy);
            setIsDraggingHandle(false);
            setPreview(null);
          }}
        />
      );
    };

    addHandle('top');
    addHandle('bottom');
    addHandle('left');
    addHandle('right');
    return <>{handles}</>;
  };

  // Draw a selection bounding box when tiles are shift-selected
  const renderTileSelectionBounds = () => {
    if (selectedTiles.size === 0) return null;
    // Gather selected tile objects
    const selected: Tile[] = [];
    const allTiles: Tile[] = ([] as Tile[])
      .concat(sideTiles.top, sideTiles.bottom, sideTiles.left, sideTiles.right);
    const keys = new Set(selectedTiles);
    allTiles.forEach(t => { if (keys.has(t.key)) selected.push(t); });
    if (selected.length === 0) return null;
    const minX = Math.min(...selected.map(t => t.x)) * scale;
    const minY = Math.min(...selected.map(t => t.y)) * scale;
    const maxX = Math.max(...selected.map(t => t.x + t.width)) * scale;
    const maxY = Math.max(...selected.map(t => t.y + t.height)) * scale;
    return (
      <Rect
        x={minX - 2}
        y={minY - 2}
        width={Math.max(0, (maxX - minX) + 4)}
        height={Math.max(0, (maxY - minY) + 4)}
        stroke="#3B82F6"
        strokeWidth={2}
        dash={[10, 5]}
        listening={false}
      />
    );
  };

  const handleRightClick = (e: any) => {
    e.evt.preventDefault();
    if (onContextMenu) {
      const stage = e.target.getStage();
      const pointerPos = stage.getPointerPosition();
      onContextMenu(component, { x: pointerPos.x, y: pointerPos.y });
    }
  };

  return (
    <Group
        ref={groupRef}
        x={component.position.x}
        y={component.position.y}
        rotation={component.rotation}
        draggable={!isDraggingHandle}
        // Match PaverComponent: clicking the object simply selects it.
        // Tile clearing is handled when the component becomes deselected.
        onClick={onSelect}
        onTap={onSelect}
        onContextMenu={handleRightClick}
        onDragEnd={handleDragEnd}
      >
        {/* Pool outline - filled (render FIRST so it's in background) */}
        <Line
          points={points}
          fill="rgba(59, 130, 246, 0.3)"
          stroke="#3B82F6"
          strokeWidth={2}
          closed
          listening={false}
        />

        {/* Invisible hit area covering pool + coping */}
        <Rect
          x={clickableBounds.x}
          y={clickableBounds.y}
          width={clickableBounds.width}
          height={clickableBounds.height}
          fill="transparent"
          listening={false}
        />

        {/* Render coping pavers (interactive for selection) - AFTER pool outline so they're clickable */}
        {showCoping && copingCalc && (
          <Group>
            {renderCopingTiles()}
            {renderTileSelectionBounds()}
            {/* Ghost preview layer for extension */}
            {preview && preview.rects.length > 0 && (
              <Group listening={false}>
                {preview.rects.map((r, i) => (
                  <Rect
                    key={`ghost-${i}`}
                    x={r.x}
                    y={r.y}
                    width={Math.max(1, r.width)}
                    height={Math.max(1, r.height)}
                    fill="#F3EBD9"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dash={[5,5]}
                    opacity={0.5}
                  />
                ))}
              </Group>
            )}
          </Group>
        )}

        {/* Deep End label (150mm inset) */}
        <Text
          x={poolData.deepEnd.x * scale}
          y={poolData.deepEnd.y * scale}
          text="DE"
          fontSize={10}
          fontStyle="bold"
          fill="#1e40af"
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
          fill="#1e40af"
          align="center"
          offsetX={10}
          offsetY={5}
          rotation={-component.rotation}
        />

        {/* Selection border - object level only when no tile selection */}
        {isSelected && selectedTiles.size === 0 && (
          <Rect
            x={clickableBounds.x}
            y={clickableBounds.y}
            width={clickableBounds.width}
            height={clickableBounds.height}
            stroke="#3B82F6"
            strokeWidth={2}
            dash={[10, 5]}
            listening={false}
          />
        )}

        {/* Extend handles (outward-only) when selected */}
        {renderExtendHandles()}

        {/* Snap anchor indicator - green dot at origin (snap point) */}
        <Circle
          x={0}
          y={0}
          radius={6}
          fill="#22c55e"
          stroke="#166534"
          strokeWidth={2}
        />
      </Group>
  );
};

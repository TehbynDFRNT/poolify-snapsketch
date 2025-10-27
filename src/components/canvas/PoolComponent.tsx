import { useRef, useMemo, useState, useEffect } from 'react';
import { Group, Line, Text, Circle, Rect } from 'react-konva';
import { Component } from '@/types';
import { POOL_LIBRARY } from '@/constants/pools';
import { calculatePoolCoping } from '@/utils/copingCalculation';
import { getContextMenuItems } from '@/types/contextMenu';
import { useDesignStore } from '@/store/designStore';
import { snapPoolToPaverGrid } from '@/utils/snap';
import { snapRectPx } from '@/utils/canvasSnap';
import { TILE_COLORS, TILE_GAP } from '@/constants/tileConfig';

interface PoolComponentProps {
  component: Component;
  isSelected: boolean;
  activeTool?: string;
  onSelect: () => void;
  onDragEnd: (pos: { x: number; y: number }) => void;
  onTileContextMenu?: (component: Component, tileKey: string, screenPos: { x: number; y: number }) => void;
}

export const PoolComponent = ({ component, isSelected, activeTool, onSelect, onDragEnd, onTileContextMenu }: PoolComponentProps) => {
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

  // Publish coping tile selection to footer (same format as paver selection)
  useEffect(() => {
    const setTileSelection = useDesignStore.getState().setTileSelection;
    if (!isSelected || selectedTiles.size === 0) {
      setTileSelection(null);
      return;
    }
    // Build a map of all tiles by key
    const all: Tile[] = ([] as Tile[])
      .concat(sideTiles.top, sideTiles.bottom, sideTiles.left, sideTiles.right);
    const selKeys = new Set(Array.from(selectedTiles));
    const selTiles = all.filter(t => selKeys.has(t.key));
    if (selTiles.length === 0) {
      setTileSelection(null);
      return;
    }
    const tileW = Math.round(selTiles[0].width);
    const tileH = Math.round(selTiles[0].height);
    if (selTiles.length === 1) {
      setTileSelection({
        scope: 'paver',
        componentId: component.id,
        count: 1,
        widthMm: tileW,
        heightMm: tileH,
        tileWidthMm: tileW,
        tileHeightMm: tileH,
      });
      return;
    }
    // Multi-tile selection: use selection bounding rectangle (mm)
    const minX = Math.min(...selTiles.map(t => t.x));
    const maxX = Math.max(...selTiles.map(t => t.x + t.width));
    const minY = Math.min(...selTiles.map(t => t.y));
    const maxY = Math.max(...selTiles.map(t => t.y + t.height));
    const selW = Math.round(maxX - minX);
    const selH = Math.round(maxY - minY);
    setTileSelection({
      scope: 'paver',
      componentId: component.id,
      count: selTiles.length,
      widthMm: selW,
      heightMm: selH,
      tileWidthMm: tileW,
      tileHeightMm: tileH,
    });
  }, [isSelected, selectedTiles, sideTiles, component.id]);

  // Expose a document-wide flag so global Delete key doesn't delete the whole pool when coping tiles are selected
  useEffect(() => {
    if (isSelected && selectedTiles.size > 0) {
      document.body.dataset.copingTileSelected = '1';
    } else {
      if (document.body.dataset.copingTileSelected) delete document.body.dataset.copingTileSelected;
    }
    return () => {
      if (document.body.dataset.copingTileSelected) delete document.body.dataset.copingTileSelected;
    };
  }, [isSelected, selectedTiles.size]);

  // Delete selected extension tiles on Delete/Backspace
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isSelected) return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (selectedTiles.size === 0) return;
      const keysToDelete = Array.from(selectedTiles).filter(k => /:ext:\d+$/.test(k));
      if (keysToDelete.length === 0) return; // only delete extensions
      e.preventDefault();
      // Compute indices to remove from copingExtensions
      const idxs = new Set<number>();
      keysToDelete.forEach(k => { const m = k.match(/:ext:(\d+)$/); if (m) idxs.add(parseInt(m[1], 10)); });
      const oldExt = (component.properties.copingExtensions || []) as any[];
      if (idxs.size === 0 || oldExt.length === 0) return;
      const newExt = oldExt.filter((_, i) => !idxs.has(i));
      updateComponent(component.id, { properties: { ...component.properties, copingExtensions: newExt } });
      setSelectedTiles(new Set());
      setSelectionSide(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSelected, selectedTiles, component.id, component.properties, updateComponent]);

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

    // Grout gaps from centralized config
    const gapMm = TILE_GAP.size; // 5mm from config
    const scissorsColor = TILE_COLORS.cutIndicator;
    const scissorsSize = 11;
    const scissorsMargin = 3;
    const baseFill = TILE_COLORS.baseTile; // slightly darker sandstone for original coping
    const extFill = TILE_COLORS.extendedTile;  // lighter sandstone for extensions

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

      // Draw grout between rows AND between tiles within rows
      (['top','bottom','left','right'] as Side[]).forEach(side => {
        const allTiles = sideTiles[side];
        if (allTiles.length === 0) return;

        // For vertical sides (left/right): rows extend in X (away from pool), tiles in rows are in Y (along pool)
        // For horizontal sides (top/bottom): rows extend in Y (away from pool), tiles in rows are in X (along pool)
        const isVerticalSide = side === 'left' || side === 'right';

        if (isVerticalSide) {
          // Group by X position (each X position is a row)
          const xPositions = new Map<number, Tile[]>();
          allTiles.forEach(t => {
            const xKey = Math.round(t.x); // mm, rounded for grouping
            const group = xPositions.get(xKey) || [];
            group.push(t);
            xPositions.set(xKey, group);
          });

          // 1) Grout BETWEEN ROWS (X direction gaps)
          const sortedX = Array.from(xPositions.keys()).sort((a, b) => a - b);
          for (let i = 0; i < sortedX.length - 1; i++) {
            const x1 = sortedX[i];
            const x2 = sortedX[i + 1];
            const gap = x2 - x1;

            const row1 = xPositions.get(x1)!;
            const row2 = xPositions.get(x2)!;
            const tileWidth = row1[0]?.width || 0;

            // Expected gap should be close to tile width + grout
            if (gap > tileWidth && gap <= tileWidth + G + 1) {
              // Find Y overlap between rows
              const minY = Math.max(Math.min(...row1.map(t => t.y)), Math.min(...row2.map(t => t.y)));
              const maxY = Math.min(Math.max(...row1.map(t => t.y + t.height)), Math.max(...row2.map(t => t.y + t.height)));

              if (maxY > minY) {
                addRectMm(x1 + tileWidth, minY, G, maxY - minY);
              }
            }
          }

          // 2) Grout WITHIN ROWS (Y direction gaps between adjacent tiles)
          xPositions.forEach((rowTiles) => {
            const sorted = rowTiles.sort((a, b) => a.y - b.y);
            for (let i = 0; i < sorted.length - 1; i++) {
              const t1 = sorted[i];
              const t2 = sorted[i + 1];
              const gap = t2.y - (t1.y + t1.height);

              // Check if there's a grout-sized gap
              if (gap > 0 && gap <= G + 1) {
                addRectMm(t1.x, t1.y + t1.height, t1.width, gap);
              }
            }
          });

        } else {
          // Horizontal sides: group by Y position (each Y position is a row)
          const yPositions = new Map<number, Tile[]>();
          allTiles.forEach(t => {
            const yKey = Math.round(t.y); // mm, rounded for grouping
            const group = yPositions.get(yKey) || [];
            group.push(t);
            yPositions.set(yKey, group);
          });

          // 1) Grout BETWEEN ROWS (Y direction gaps)
          const sortedY = Array.from(yPositions.keys()).sort((a, b) => a - b);
          for (let i = 0; i < sortedY.length - 1; i++) {
            const y1 = sortedY[i];
            const y2 = sortedY[i + 1];
            const gap = y2 - y1;

            const row1 = yPositions.get(y1)!;
            const row2 = yPositions.get(y2)!;
            const tileHeight = row1[0]?.height || 0;

            // Expected gap should be close to tile height + grout
            if (gap > tileHeight && gap <= tileHeight + G + 1) {
              // Find X overlap between rows
              const minX = Math.max(Math.min(...row1.map(t => t.x)), Math.min(...row2.map(t => t.x)));
              const maxX = Math.min(Math.max(...row1.map(t => t.x + t.width)), Math.max(...row2.map(t => t.x + t.width)));

              if (maxX > minX) {
                addRectMm(minX, y1 + tileHeight, maxX - minX, G);
              }
            }
          }

          // 2) Grout WITHIN ROWS (X direction gaps between adjacent tiles)
          yPositions.forEach((rowTiles) => {
            const sorted = rowTiles.sort((a, b) => a.x - b.x);
            for (let i = 0; i < sorted.length - 1; i++) {
              const t1 = sorted[i];
              const t2 = sorted[i + 1];
              const gap = t2.x - (t1.x + t1.width);

              // Check if there's a grout-sized gap
              if (gap > 0 && gap <= G + 1) {
                addRectMm(t1.x + t1.width, t1.y, gap, t1.height);
              }
            }
          });
        }
      });
    }

    // Build tile fill + overlays
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
        const isSel = selectedTiles.has(t.key);
        const isCandidate = candidateKeys.has(t.key) && !isSel;
        const isPartial = t.isPartial;

        fills.push(
          <Group key={`coping-${t.key}`}>
            <Rect
              x={r.x}
              y={r.y}
              width={Math.max(0, r.width)}
              height={Math.max(0, r.height)}
              fill={t.source === 'base' ? baseFill : extFill}
              dash={isPartial ? [5,5] : undefined}
              opacity={isPartial ? 0.85 : 1}
              onClick={(e:any) => toggleTileSelection(t, e)}
              onTap={(e:any) => toggleTileSelection(t, e)}
              onContextMenu={(e:any) => {
                if (t.source !== 'ext') return;
                e.cancelBubble = true; e.evt.preventDefault();
                onTileContextMenu?.(component, t.key, { x: e.evt.clientX, y: e.evt.clientY });
              }}
            />
            {isCandidate && (
              <Rect
                x={r.x}
                y={r.y}
                width={Math.max(0, r.width)}
                height={Math.max(0, r.height)}
                fill="rgba(16,185,129,0.12)"
                stroke="#10B981"
                strokeWidth={2}
                dash={[4,2]}
                listening={false}
              />
            )}
            {isSel && (
              <Rect
                x={r.x}
                y={r.y}
                width={Math.max(0, r.width)}
                height={Math.max(0, r.height)}
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

    // Return grout layer, then pool, then tiles
    return (
      <>
        <Group listening={false}>{groutRects}</Group>
        {/* Pool above grout, under tiles */}
        <Line
          points={points}
          fill="rgba(59, 130, 246, 0.3)"
          stroke="#3B82F6"
          strokeWidth={2}
          closed
          listening={false}
        />
        {fills}
      </>
    );
  };

  // Extension handles for each side; anchor to selection bounds if present, else object coping bounds
  const renderExtendHandles = () => {
    if (!isSelected) return null;
    const SNAP_MM = 5; // keep mm snapping granularity for extensions (visual grid stability)

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

            // Determine unit distance on axis
            let unitMm = depthMm; // default for normal (row step = tile depth only)
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
              // Add standard grout gap between repeated blocks so blocks don't butt up
              unitMm = blockSpanMm + TILE_GAP.size;
              anchorPx = (sign >= 0 ? maxCoord : minCoord) * scale;
            } else {
              // Normal replicate – include grout gap between rows
              unitMm = depthMm + TILE_GAP.size;
              // Anchor to selection edge if any
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
                  // Add standard grout gap between repeated blocks so blocks don't butt up
                  unitMm = blockSpanMm + TILE_GAP.size;
                } else {
                  // Normal replicate – include grout gap between rows
                  unitMm = depthMm + TILE_GAP.size;
                }
                const snapMm = (mm:number) => Math.round(mm / SNAP_MM) * SNAP_MM; // keep stable mm snapping
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


  return (
    <Group
        ref={groupRef}
        x={component.position.x}
        y={component.position.y}
        rotation={component.rotation}
        draggable={activeTool !== 'hand' && !isDraggingHandle}
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
            fill="rgba(59, 130, 246, 0.3)"
            stroke="#3B82F6"
            strokeWidth={2}
            closed
            listening={false}
          />
        ) : null}

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
                    fill={TILE_COLORS.extendedTile}
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
      </Group>
  );
};

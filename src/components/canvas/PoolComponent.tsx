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
  const { components: allComponents, updateComponent, zoom, annotationsVisible } = useDesignStore();
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
  const [patternImage, setPatternImage] = useState<HTMLImageElement | null>(null);
  // Shift-selectable coping tiles (keys encoded as `${side}:${index}` for base and `${side}:user:${index}` for user-added)
  // All tiles are atomic - selection can span multiple sides
  const [selectedTiles, setSelectedTiles] = useState<Set<string>>(new Set());
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

  // Build side-indexed tile lists (in mm, pool-local) - all tiles are atomic, no base/extended distinction
  type Side = 'top'|'bottom'|'left'|'right';
  type Tile = { x:number; y:number; width:number; height:number; isPartial:boolean; side: Side; key: string };

  const copingTiles = (component.properties.copingTiles || []) as Array<{x:number;y:number;width:number;height:number;isPartial:boolean;side:Side}>;

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

  // Selection behavior for coping tiles (shift-click) - all tiles are selectable across all sides
  const toggleTileSelection = (tile: Tile, evt?: any) => {
    // Only allow shift-click toggling
    if (!evt?.evt?.shiftKey) return;

    // All tiles are selectable
    if (!isTileSelectable(tile)) return;

    // Prevent bubbling to group so pool selection doesn't toggle
    evt.cancelBubble = true;

    // Always ensure object is selected so handles show
    if (!isSelected) onSelect();

    setSelectedTiles((prev) => {
      const next = new Set(prev);
      // Toggle this tile on/off
      if (next.has(tile.key)) {
        next.delete(tile.key);
      } else {
        next.add(tile.key);
      }
      return next;
    });
  };

  // Clear tile selections when pool becomes deselected
  useEffect(() => {
    if (!isSelected && selectedTiles.size > 0) {
      setSelectedTiles(new Set());
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
      const keysToDelete = Array.from(selectedTiles).filter(k => /:user:\d+$/.test(k));
      if (keysToDelete.length === 0) return; // only delete user-added tiles
      e.preventDefault();
      // Compute indices to remove from copingTiles
      const idxs = new Set<number>();
      keysToDelete.forEach(k => { const m = k.match(/:user:(\d+)$/); if (m) idxs.add(parseInt(m[1], 10)); });
      const oldTiles = (component.properties.copingTiles || []) as any[];
      if (idxs.size === 0 || oldTiles.length === 0) return;
      const newTiles = oldTiles.filter((_, i) => !idxs.has(i));
      updateComponent(component.id, { properties: { ...component.properties, copingTiles: newTiles } });
      setSelectedTiles(new Set());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSelected, selectedTiles, component.id, component.properties, updateComponent]);

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
    const tiles: Tile[] = ([] as Tile[])
      .concat(sideTiles.top)
      .concat(sideTiles.bottom)
      .concat(sideTiles.left)
      .concat(sideTiles.right);

    // Compute candidate selectable tiles for highlight - show all unselected tiles
    const candidateKeys = new Set<string>();
    if (selectedTiles.size > 0) {
      // Show all unselected tiles as candidates
      tiles.forEach(t => {
        if (!selectedTiles.has(t.key)) candidateKeys.add(t.key);
      });
    }

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
      const allCopingTiles = tiles;
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
        const isCandidate = false; // disable non-selected green highlight
        const isPartial = t.isPartial;

        fills.push(
          <Group key={`coping-${t.key}`}>
            <Rect
              x={r.x}
              y={r.y}
              width={Math.max(0, r.width)}
              height={Math.max(0, r.height)}
              fill={isPartial ? TILE_COLORS.cutTile : tileFill}
              onClick={(e:any) => toggleTileSelection(t, e)}
              onTap={(e:any) => toggleTileSelection(t, e)}
              onContextMenu={(e:any) => {
                if (!t.key.includes(':user:')) return; // only show context menu for user-added tiles
                e.cancelBubble = true; e.evt.preventDefault();
                onTileContextMenu?.(component, t.key, { x: e.evt.clientX, y: e.evt.clientY });
              }}
            />
            {/* Removed non-selected candidate highlight to avoid dual outlines */}
            {isSel && (
              <Rect
                x={r.x}
                y={r.y}
                width={Math.max(0, r.width)}
                height={Math.max(0, r.height)}
                fill="rgba(59,130,246,0.15)"
                stroke="#3B82F6"
                strokeWidth={2}
                strokeScaleEnabled={false}
                dash={[6, 3]}
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
        {fills}
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
      // Determine target side from selection: if all selected tiles are from same side, use that; else use handle's side
      let targetSide: Side = side;
      if (selectedTiles.size > 0) {
        const allTiles: Tile[] = ([] as Tile[]).concat(sideTiles.top, sideTiles.bottom, sideTiles.left, sideTiles.right);
        const selKeys = Array.from(selectedTiles);
        const selTiles = allTiles.filter(t => selKeys.includes(t.key));
        const sides = new Set(selTiles.map(t => t.side));
        if (sides.size === 1) {
          targetSide = selTiles[0].side; // All selected tiles from same side
        }
      }
      // Pick correct depth based on edge orientation
      const isHorizontalEdge = targetSide === 'top' || targetSide === 'bottom';
      const depthMm = isHorizontalEdge ? tileDepthMm.horizontal : tileDepthMm.vertical;
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
          radius={Math.max(2, 4.2 / (zoom || 1))}
          fill={color}
          stroke="white"
          strokeWidth={2}
          strokeScaleEnabled={false}
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
                // No snapping - preserve exact decimal positions (e.g., cut tiles at 492.5mm)
                for (let s = 1; s <= steps; s++) {
                  const off = s * unitMm * sign; // mm
                  candidateTiles.forEach((t) => {
                    const rx = axis === 'x' ? (t.x + off) : t.x;
                    const ry = axis === 'y' ? (t.y + off) : t.y;
                    const rw = t.width;
                    const rh = t.height;
                    if (!overlaps(rx, ry, rw, rh)) {
                      added.push({ x: rx, y: ry, width: rw, height: rh });
                      rowsToAdd.push({ x: rx, y: ry, width: rw, height: rh, isPartial: t.isPartial, side: tSide });
                    }
                  });
                }

                if (rowsToAdd.length > 0) {
                  const oldTiles = (component.properties.copingTiles || []) as any[];
                  updateComponent(component.id, {
                    properties: {
                      ...component.properties,
                      copingTiles: [...oldTiles, ...rowsToAdd],
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
        strokeScaleEnabled={false}
        dash={[10, 5]}
        listening={false}
      />
    );
  };

  // Render measurements around the exterior edge of the coping
  const renderCopingMeasurements = () => {
    if (!annotationsVisible || !isSelected || !showCoping || !copingCalc) return null;

    const allTiles: Tile[] = ([] as Tile[])
      .concat(sideTiles.top, sideTiles.bottom, sideTiles.left, sideTiles.right);

    if (allTiles.length === 0) return null;

    // Calculate bounding box of all tiles (in mm)
    const minX = Math.min(...allTiles.map(t => t.x));
    const maxX = Math.max(...allTiles.map(t => t.x + t.width));
    const minY = Math.min(...allTiles.map(t => t.y));
    const maxY = Math.max(...allTiles.map(t => t.y + t.height));

    const measurements: JSX.Element[] = [];
    const offset = 30; // px offset from edge for measurement text

    // Top edge measurement
    const topWidthMm = Math.round(maxX - minX);
    const topMidX = ((minX + maxX) / 2) * scale;
    const topY = minY * scale;
    measurements.push(
      <Text
        key="measure-top"
        x={topMidX}
        y={topY - offset}
        text={`${topWidthMm}`}
        fontSize={11}
        fill="#6B7280"
        align="center"
        offsetX={20}
        listening={false}
      />
    );

    // Bottom edge measurement
    const bottomWidthMm = Math.round(maxX - minX);
    const bottomMidX = ((minX + maxX) / 2) * scale;
    const bottomY = maxY * scale;
    measurements.push(
      <Text
        key="measure-bottom"
        x={bottomMidX}
        y={bottomY + offset}
        text={`${bottomWidthMm}`}
        fontSize={11}
        fill="#6B7280"
        align="center"
        offsetX={20}
        listening={false}
      />
    );

    // Left edge measurement
    const leftHeightMm = Math.round(maxY - minY);
    const leftX = minX * scale;
    const leftMidY = ((minY + maxY) / 2) * scale;
    measurements.push(
      <Text
        key="measure-left"
        x={leftX - offset}
        y={leftMidY}
        text={`${leftHeightMm}`}
        fontSize={11}
        fill="#6B7280"
        align="center"
        offsetX={20}
        listening={false}
      />
    );

    // Right edge measurement
    const rightHeightMm = Math.round(maxY - minY);
    const rightX = maxX * scale;
    const rightMidY = ((minY + maxY) / 2) * scale;
    measurements.push(
      <Text
        key="measure-right"
        x={rightX + offset}
        y={rightMidY}
        text={`${rightHeightMm}`}
        fontSize={11}
        fill="#6B7280"
        align="center"
        offsetX={20}
        listening={false}
      />
    );

    return <>{measurements}</>;
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
                    strokeScaleEnabled={false}
                    dash={[5, 5]}
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

        {/* Selection border - object level only when no tile selection */}
        {isSelected && selectedTiles.size === 0 && (
          <Rect
            x={clickableBounds.x}
            y={clickableBounds.y}
            width={clickableBounds.width}
            height={clickableBounds.height}
            stroke="#3B82F6"
            strokeWidth={2}
            strokeScaleEnabled={false}
        dash={[10, 5]}
            listening={false}
          />
        )}

        {/* Extend handles (outward-only) when selected */}
        {renderExtendHandles()}

        {/* Coping measurements when selected */}
        {renderCopingMeasurements()}

        {/* Tile selection bounds */}
        {renderTileSelectionBounds()}
      </Group>
  );
};

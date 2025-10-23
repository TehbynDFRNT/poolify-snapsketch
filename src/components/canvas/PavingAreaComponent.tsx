import { Group, Line, Rect, Text } from 'react-konva';
import { Component } from '@/types';
import { useMemo, useEffect } from 'react';
import { useDesignStore } from '@/store/designStore';
import { getPoolExcludeZone } from '@/utils/poolExcludeZone';
import { fillAreaWithPavers, fillAreaWithPaversFromOrigin, calculateStatistics, getPaverDimensions } from '@/utils/pavingFill';
import { GROUT_MM } from '@/utils/copingCalculation';
import { GRID_CONFIG } from '@/constants/grid';
import { calculatePoolCoping } from '@/utils/copingCalculation';

interface PavingAreaComponentProps {
  component: Component;
  isSelected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  onContextMenu?: (component: Component, screenPos: { x: number; y: number }) => void;
}

export const PavingAreaComponent = ({ component, isSelected, onSelect, onDelete, onContextMenu }: PavingAreaComponentProps) => {
  const allComponents = useDesignStore(state => state.components);
  const updateComponent = useDesignStore(state => state.updateComponent);
  const boundary = component.properties.boundary || [];
  const showEdgePavers = component.properties.showEdgePavers !== false; // Default to true

  // Find all pools
  const pools = useMemo(() => {
    return allComponents.filter(c => c.type === 'pool' && c.id !== component.id);
  }, [allComponents, component.id]);

  // Get exclude zones from all pools
  const poolExcludeZones = useMemo(() => {
    return pools
      .map(pool => getPoolExcludeZone(pool))
      .filter((zone): zone is NonNullable<typeof zone> => zone !== null);
  }, [
    pools,
    // Re-calculate when pool positions/rotations/coping changes
    pools.map(p => `${p.position.x},${p.position.y},${p.rotation},${p.properties.showCoping}`).join('|')
  ]);

  // Regenerate pavers with pool exclusions
  const pavers = useMemo(() => {
    if (!boundary || boundary.length < 3) return [];
    const size = component.properties.paverSize || '400x400';
    const orient = component.properties.paverOrientation || 'vertical';
    const alignPoolId = component.properties.alignToPoolId;
    if (alignPoolId) {
      const pool = allComponents.find(c => c.id === alignPoolId);
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

          // Pool rect in canvas px
          const poolLeft = pool.position.x;
          const poolTop = pool.position.y;
          const poolRight = poolLeft + poolData.length * pxPerMm;
          const poolBottom = poolTop + poolData.width * pxPerMm;

          // Outer offsets for the stripe ring
          const leftOuterX = poolLeft - tileWpx;
          const rightOuterX = poolRight + tileWpx;
          const topOuterY = poolTop - tileHpx;
          const bottomOuterY = poolBottom + tileHpx;

          // Boundary bbox (assumes rectangular boundary)
          const xs = boundary.map(p => p.x);
          const ys = boundary.map(p => p.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);

          // Build stripes by copying coping pavers outward
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

            // Determine side by comparing to pool rect
            if (rectBottom <= poolTop + eps) {
              // Top stripe
              stripePavers.push({ id: `s-top-${i}`, position: { x: rx, y: ry - tileHpx }, width: rw, height: tileHpx, isEdgePaver: false, mmWidth: rw / pxPerMm, mmHeight: tile.height });
            } else if (ry >= poolBottom - eps) {
              // Bottom stripe
              stripePavers.push({ id: `s-bottom-${i}`, position: { x: rx, y: ry + rh }, width: rw, height: tileHpx, isEdgePaver: false, mmWidth: rw / pxPerMm, mmHeight: tile.height });
            } else if (rectRight <= poolLeft + eps) {
              // Left stripe
              stripePavers.push({ id: `s-left-${i}`, position: { x: rx - tileWpx, y: ry }, width: tileWpx, height: rh, isEdgePaver: false, mmWidth: tile.width, mmHeight: rh / pxPerMm });
            } else if (rx >= poolRight - eps) {
              // Right stripe
              stripePavers.push({ id: `s-right-${i}`, position: { x: rx + rw, y: ry }, width: tileWpx, height: rh, isEdgePaver: false, mmWidth: tile.width, mmHeight: rh / pxPerMm });
            }
          });

          // Build four band rectangles (may overlap at corners; dedupe after)
          const poly = (x1: number, y1: number, x2: number, y2: number) => ([
            { x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }
          ]);

          const leftBand = leftOuterX > minX ? fillAreaWithPaversFromOrigin(
            poly(minX, minY, leftOuterX, maxY), size, orient, showEdgePavers, poolExcludeZones, { x: leftOuterX }, GROUT_MM
          ) : [];
          const rightBand = rightOuterX < maxX ? fillAreaWithPaversFromOrigin(
            poly(rightOuterX, minY, maxX, maxY), size, orient, showEdgePavers, poolExcludeZones, { x: rightOuterX }, GROUT_MM
          ) : [];
          const topBand = topOuterY > minY ? fillAreaWithPaversFromOrigin(
            poly(minX, minY, maxX, topOuterY), size, orient, showEdgePavers, poolExcludeZones, { y: topOuterY }, GROUT_MM
          ) : [];
          const bottomBand = bottomOuterY < maxY ? fillAreaWithPaversFromOrigin(
            poly(minX, bottomOuterY, maxX, maxY), size, orient, showEdgePavers, poolExcludeZones, { y: bottomOuterY }, GROUT_MM
          ) : [];

          // Merge and dedupe by position+size
          const map = new Map<string, any>();
          const addAll = (arr: any[]) => arr.forEach(p => {
            const k = `${Math.round(p.position.x*1000)}|${Math.round(p.position.y*1000)}|${Math.round(p.width*1000)}|${Math.round(p.height*1000)}`;
            if (!map.has(k)) map.set(k, p);
          });
          addAll(stripePavers); addAll(leftBand); addAll(rightBand); addAll(topBand); addAll(bottomBand);
          return Array.from(map.values());
        }
      }
    }
    // Default behavior
    return fillAreaWithPavers(boundary, size, orient, showEdgePavers, poolExcludeZones);
  }, [
    boundary,
    component.properties.paverSize,
    component.properties.paverOrientation,
    component.properties.alignToPoolId,
    showEdgePavers,
    poolExcludeZones,
    allComponents
  ]);

  // Calculate statistics whenever pavers change
  const statistics = useMemo(() => {
    return calculateStatistics(pavers, component.properties.wastagePercentage || 0);
  }, [pavers, component.properties.wastagePercentage]);

  // Update component statistics when they change
  useEffect(() => {
    const currentStats = component.properties.statistics;
    if (!currentStats || 
        currentStats.fullPavers !== statistics.fullPavers || 
        currentStats.edgePavers !== statistics.edgePavers ||
        currentStats.totalArea !== statistics.totalArea) {
      updateComponent(component.id, {
        properties: {
          ...component.properties,
          statistics
        }
      });
    }
  }, [statistics, component.id, component.properties, updateComponent]);

  // Calculate bounding box for invisible hit area
  const boundingBox = useMemo(() => {
    if (boundary.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

    const xCoords = boundary.map(p => p.x);
    const yCoords = boundary.map(p => p.y);
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [boundary]);

  const handleRightClick = (e: any) => {
    e.evt.preventDefault();
    if (onContextMenu) {
      const stage = e.target.getStage();
      const pointerPos = stage.getPointerPosition();
      onContextMenu(component, { x: pointerPos.x, y: pointerPos.y });
    }
  };

  return (
    <Group onClick={onSelect} onTap={onSelect} onContextMenu={handleRightClick}>
      {/* Invisible hit area covering full polygon bounds */}
      <Rect
        x={boundingBox.x}
        y={boundingBox.y}
        width={boundingBox.width}
        height={boundingBox.height}
        fill="transparent"
      />

      {/* Pavers with clipping - render first */}
      <Group
        clipFunc={(ctx) => {
          // Create clipping path from boundary
          ctx.beginPath();
          boundary.forEach((point, i) => {
            if (i === 0) {
              ctx.moveTo(point.x, point.y);
            } else {
              ctx.lineTo(point.x, point.y);
            }
          });
          ctx.closePath();
        }}
      >
        {pavers.map(paver => {
          // Only render if showEdgePavers is true OR paver is not an edge paver
          if (!showEdgePavers && paver.isEdgePaver) {
            return null;
          }
          
          return (
            <Group key={paver.id}>
              <Rect
                x={paver.position.x}
                y={paver.position.y}
                width={paver.width}
                height={paver.height}
                // More distinct colors: full pavers are cream, edge pavers are light yellow/orange
                fill={paver.isEdgePaver ? '#FEF3C7' : '#F5F1E8'}
                // Visible stroke for all pavers
                stroke={paver.isEdgePaver ? '#F59E0B' : '#A8A29E'}
                strokeWidth={2}
                dash={paver.isEdgePaver ? [8, 4] : []}
                opacity={paver.isEdgePaver ? 0.8 : 1}
                listening={false}
              />

              {/* Cut indicator for edge pavers: small scissors at bottom-right */}
              {paver.isEdgePaver && (
                <Text
                  x={paver.position.x + Math.max(0, paver.width - 12) - 3}
                  y={paver.position.y + Math.max(0, paver.height - 12) - 3}
                  text="✂"
                  fontSize={11}
                  fill="#B8AE94"
                  listening={false}
                />
              )}
            </Group>
          );
        })}
      </Group>

      {/* Boundary outline - render last so it's on top */}
      <Line
        points={boundary.flatMap(p => [p.x, p.y])}
        stroke={isSelected ? '#3B82F6' : '#60A5FA'}
        strokeWidth={3}
        dash={[10, 5]}
        closed={true}
        hitStrokeWidth={15}
      />

      {/* Delete button when selected */}
      {isSelected && onDelete && boundary.length > 0 && (
        <Group
          x={boundary[0].x}
          y={boundary[0].y - 30}
          onClick={(e) => {
            e.cancelBubble = true;
            onDelete();
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onDelete();
          }}
        >
          <Rect
            x={-15}
            y={-15}
            width={30}
            height={30}
            fill="white"
            stroke="#dc2626"
            strokeWidth={2}
            cornerRadius={4}
            shadowColor="black"
            shadowBlur={5}
            shadowOpacity={0.3}
          />
          <Text
            x={-8}
            y={-8}
            text="🗑"
            fontSize={16}
            listening={false}
          />
        </Group>
      )}
    </Group>
  );
};

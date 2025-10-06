import { useMemo } from 'react';
import { Group, Line, Rect, Text } from 'react-konva';
import { Component } from '@/types';
import { useDesignStore } from '@/store/designStore';
import { fillAreaWithPavers, calculateStatistics } from '@/utils/pavingFill';
import { ExcludeZone, transformPoolOutline, boundingBoxesOverlap, getPoolBoundingBox } from '@/utils/geometry';
import { POOL_LIBRARY } from '@/constants/pools';

interface PavingAreaComponentProps {
  component: Component;
  isSelected: boolean;
  onSelect: () => void;
}

export const PavingAreaComponent = ({ component, isSelected, onSelect }: PavingAreaComponentProps) => {
  const boundary = component.properties.boundary || [];
  const showEdgePavers = component.properties.showEdgePavers !== false;
  const allComponents = useDesignStore(state => state.components);
  
  // Find all pools that overlap this paving area
  const overlappingPools = useMemo(() => {
    return allComponents.filter(c => 
      c.type === 'pool' && 
      c.id !== component.id &&
      boundingBoxesOverlap(boundary, getPoolBoundingBox(c))
    );
  }, [allComponents, component.id, boundary]);

  // Convert pool outlines to exclude zones
  const excludeZones: ExcludeZone[] = useMemo(() => {
    return overlappingPools.map(pool => {
      const poolData = POOL_LIBRARY.find(p => p.id === pool.properties.poolId);
      if (!poolData) return null;
      
      const transformedOutline = transformPoolOutline(
        poolData.outline,
        pool.position,
        pool.rotation
      );
      
      return {
        outline: transformedOutline,
        componentId: pool.id
      };
    }).filter(Boolean) as ExcludeZone[];
  }, [overlappingPools]);

  // Regenerate pavers excluding pool areas
  const filteredPavers = useMemo(() => {
    if (!boundary.length || !component.properties.paverSize) {
      return [];
    }
    
    return fillAreaWithPavers(
      boundary,
      component.properties.paverSize,
      component.properties.paverOrientation || 'vertical',
      showEdgePavers,
      excludeZones.length > 0 ? excludeZones : undefined
    );
  }, [
    boundary,
    component.properties.paverSize,
    component.properties.paverOrientation,
    showEdgePavers,
    excludeZones
  ]);

  return (
    <Group onClick={onSelect}>
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
        {filteredPavers.map(paver => {
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

              {/* Cut indicator for edge pavers */}
              {paver.isEdgePaver && (paver.cutPercentage || 0) >= 50 && (
                <Text
                  x={paver.position.x + paver.width / 4}
                  y={paver.position.y + paver.height / 2 - 6}
                  text="✂"
                  fontSize={14}
                  fill="#DC2626"
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
        listening={false}
      />
    </Group>
  );
};

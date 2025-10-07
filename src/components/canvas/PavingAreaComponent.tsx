import { Group, Line, Rect, Text } from 'react-konva';
import { Component } from '@/types';
import { useMemo, useEffect } from 'react';
import { useDesignStore } from '@/store/designStore';
import { getPoolExcludeZone } from '@/utils/poolExcludeZone';
import { fillAreaWithPavers, calculateStatistics } from '@/utils/pavingFill';

interface PavingAreaComponentProps {
  component: Component;
  isSelected: boolean;
  onSelect: () => void;
}

export const PavingAreaComponent = ({ component, isSelected, onSelect }: PavingAreaComponentProps) => {
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
    
    return fillAreaWithPavers(
      boundary,
      component.properties.paverSize || '400x400',
      component.properties.paverOrientation || 'vertical',
      showEdgePavers,
      poolExcludeZones
    );
  }, [
    boundary,
    component.properties.paverSize,
    component.properties.paverOrientation,
    showEdgePavers,
    poolExcludeZones
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

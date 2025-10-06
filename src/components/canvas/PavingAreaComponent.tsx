import { Group, Line, Rect, Text } from 'react-konva';
import { Component } from '@/types';

interface PavingAreaComponentProps {
  component: Component;
  isSelected: boolean;
  onSelect: () => void;
}

export const PavingAreaComponent = ({ component, isSelected, onSelect }: PavingAreaComponentProps) => {
  const boundary = component.properties.boundary || [];
  const pavers = component.properties.pavers || [];
  const showEdgePavers = component.properties.showEdgePavers !== false; // Default to true

  return (
    <Group onClick={onSelect}>
      {/* Pavers - render first so boundary is on top */}
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

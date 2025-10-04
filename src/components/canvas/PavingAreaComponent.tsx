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

  return (
    <Group onClick={onSelect}>
      {/* Boundary outline */}
      <Line
        points={boundary.flatMap(p => [p.x, p.y])}
        stroke={isSelected ? '#3B82F6' : '#60A5FA'}
        strokeWidth={2}
        dash={[10, 5]}
        closed={true}
        listening={false}
      />

      {/* Pavers */}
      {pavers.map(paver => (
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
      ))}
    </Group>
  );
};

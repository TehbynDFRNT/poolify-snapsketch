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
            fill={paver.isEdgePaver ? '#FAF7F0' : '#F5F1E8'}
            stroke={paver.isEdgePaver ? '#E5D9C6' : '#D4C5B0'}
            strokeWidth={1}
            dash={paver.isEdgePaver ? [4, 4] : []}
            opacity={paver.isEdgePaver ? 0.7 : 1}
            listening={false}
          />

          {/* Cut indicator for edge pavers */}
          {paver.isEdgePaver && (paver.cutPercentage || 0) >= 50 && (
            <Text
              x={paver.position.x + paver.width / 4}
              y={paver.position.y + paver.height / 2 - 6}
              text="✂"
              fontSize={12}
              fill="#EF4444"
              listening={false}
            />
          )}
        </Group>
      ))}
    </Group>
  );
};

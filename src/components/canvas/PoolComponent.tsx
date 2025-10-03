import { useEffect, useRef } from 'react';
import { Group, Line, Text, Circle, Rect } from 'react-konva';
import { Component } from '@/types';
import { POOL_LIBRARY } from '@/constants/pools';

interface PoolComponentProps {
  component: Component;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (pos: { x: number; y: number }) => void;
}

export const PoolComponent = ({ component, isSelected, onSelect, onDragEnd }: PoolComponentProps) => {
  const groupRef = useRef<any>(null);

  // Find the pool from the library
  const poolData = POOL_LIBRARY.find(p => p.id === component.properties.poolId) || POOL_LIBRARY[0];
  
  // Scale down from mm to canvas units (1 unit = 10mm for better display)
  const scale = 0.1;
  const scaledOutline = poolData.outline.map(p => ({ x: p.x * scale, y: p.y * scale }));
  const points = scaledOutline.flatMap(p => [p.x, p.y]);

  const showCoping = component.properties.showCoping;
  const copingWidth = (component.properties.copingWidth || 400) * scale;

  return (
    <Group
      ref={groupRef}
      x={component.position.x}
      y={component.position.y}
      rotation={component.rotation}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        onDragEnd({ x: e.target.x(), y: e.target.y() });
      }}
    >
      {/* Pool outline - filled */}
      <Line
        points={points}
        fill="rgba(59, 130, 246, 0.3)"
        stroke="#3B82F6"
        strokeWidth={2}
        closed
      />

      {/* Coping outline (dashed) */}
      {showCoping && (
        <Line
          points={points.map((p, i) => {
            // Offset outward by copingWidth
            const isX = i % 2 === 0;
            return isX ? p - copingWidth : p - copingWidth;
          })}
          stroke="#3B82F6"
          strokeWidth={1}
          dash={[5, 5]}
          closed
        />
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
      />

      {/* Selection border */}
      {isSelected && (
        <Rect
          x={-10}
          y={-10}
          width={poolData.length * scale + 20}
          height={poolData.width * scale + 20}
          stroke="#3B82F6"
          strokeWidth={2}
          dash={[10, 5]}
        />
      )}
    </Group>
  );
};

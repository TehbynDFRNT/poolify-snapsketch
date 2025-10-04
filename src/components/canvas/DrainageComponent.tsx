import { Group, Rect, Circle } from 'react-konva';
import { Component } from '@/types';
import { DRAINAGE_TYPES } from '@/constants/components';
import { useState } from 'react';

interface DrainageComponentProps {
  component: Component;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (pos: { x: number; y: number }) => void;
  onExtend?: (length: number) => void;
}

export const DrainageComponent = ({
  component,
  isSelected,
  onSelect,
  onDragEnd,
  onExtend,
}: DrainageComponentProps) => {
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);

  const scale = 0.1;
  const drainageType = component.properties.drainageType || 'rock';
  const drainageData = DRAINAGE_TYPES[drainageType];
  const length = (component.properties.length || 1000) * scale;
  const width = drainageData.width * scale;

  const color = drainageData.color;
  const pattern = drainageType === 'rock' ? 'dots' : 'solid';

  return (
    <Group
      x={component.position.x}
      y={component.position.y}
      rotation={component.rotation}
      draggable={!isDraggingHandle}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        onDragEnd({ x: e.target.x(), y: e.target.y() });
      }}
    >
      {/* Drainage line */}
      <Rect
        x={0}
        y={0}
        width={length}
        height={width}
        fill={pattern === 'dots' ? color : color}
        stroke={color}
        strokeWidth={2}
        opacity={0.7}
      />

      {/* Selection border and handle */}
      {isSelected && (
        <>
          <Rect
            x={-5}
            y={-5}
            width={length + 10}
            height={width + 10}
            stroke="#3B82F6"
            strokeWidth={2}
            dash={[10, 5]}
          />

          {/* Right handle for extending */}
          <Circle
            x={length}
            y={width / 2}
            radius={8}
            fill="#3B82F6"
            stroke="white"
            strokeWidth={2}
            draggable
            dragBoundFunc={(pos) => ({ x: pos.x, y: width / 2 })}
            onDragStart={(e) => {
              e.cancelBubble = true;
              setIsDraggingHandle(true);
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              const newLength = Math.max(width, e.target.x());
              e.target.x(newLength);
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              const newLength = Math.max(width, e.target.x());
              onExtend?.(newLength / scale);
              setIsDraggingHandle(false);
            }}
          />
        </>
      )}
    </Group>
  );
};

import { Group, Line, Rect, Circle } from 'react-konva';
import { Component } from '@/types';
import { WALL_MATERIALS } from '@/constants/components';
import { useState } from 'react';

interface WallComponentProps {
  component: Component;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (pos: { x: number; y: number }) => void;
  onExtend?: (length: number) => void;
}

export const WallComponent = ({
  component,
  isSelected,
  onSelect,
  onDragEnd,
  onExtend,
}: WallComponentProps) => {
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);

  const wallType = component.properties.wallMaterial || 'timber';
  const wallData = WALL_MATERIALS[wallType as keyof typeof WALL_MATERIALS];
  const length = component.dimensions.width || 1000;
  const height = 15; // Wall height in pixels

  const color = wallData?.color || WALL_MATERIALS.timber.color;

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
      {/* Wall body */}
      <Rect
        x={0}
        y={0}
        width={length}
        height={height}
        fill={color}
        stroke={color}
        strokeWidth={1}
        opacity={0.8}
      />

      {/* Selection border and handle */}
      {isSelected && (
        <>
          <Rect
            x={-5}
            y={-5}
            width={length + 10}
            height={height + 10}
            stroke="#3B82F6"
            strokeWidth={2}
            dash={[10, 5]}
          />

          {/* Right handle for extending */}
          <Circle
            x={length}
            y={height / 2}
            radius={8}
            fill="#3B82F6"
            stroke="white"
            strokeWidth={2}
            draggable
            dragBoundFunc={(pos) => ({ x: pos.x, y: height / 2 })}
            onDragStart={(e) => {
              e.cancelBubble = true;
              setIsDraggingHandle(true);
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              const newLength = Math.max(20, e.target.x());
              e.target.x(newLength);
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              const newLength = Math.max(20, e.target.x());
              onExtend?.(newLength);
              setIsDraggingHandle(false);
            }}
          />
        </>
      )}
    </Group>
  );
};

import { Group, Line, Rect, Circle } from 'react-konva';
import { Component } from '@/types';
import { FENCE_TYPES } from '@/constants/components';
import { useState, useRef } from 'react';

interface FenceComponentProps {
  component: Component;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (pos: { x: number; y: number }) => void;
  onExtend?: (length: number) => void;
}

export const FenceComponent = ({
  component,
  isSelected,
  onSelect,
  onDragEnd,
  onExtend,
}: FenceComponentProps) => {
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);

  const groupRef = useRef<any>(null);

  const scale = 0.1;
  const fenceType = component.properties.fenceType || 'glass';
  const fenceData = FENCE_TYPES[fenceType];
  const length = (component.dimensions.width || 2400);

  const color = fenceData.color;
  const strokeWidth = fenceType === 'glass' ? 2 : 4;

  // Draw vertical lines for fence pickets
  const pickets = [];
  const picketSpacing = 10;
  for (let i = 0; i <= length; i += picketSpacing) {
    pickets.push(
      <Line
        key={i}
        points={[i, 0, i, 12]}
        stroke={color}
        strokeWidth={strokeWidth === 2 ? 1 : 2}
        opacity={fenceType === 'glass' ? 0.5 : 1}
      />
    );
  }

  return (
      <Group
        ref={groupRef}
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
      {/* Base line */}
      <Line
        points={[0, 0, length, 0]}
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Line
        points={[0, 12, length, 12]}
        stroke={color}
        strokeWidth={strokeWidth}
      />

      {/* Pickets */}
      {pickets}

      {/* Selection border and handle */}
      {isSelected && (
        <>
          <Rect
            x={-5}
            y={-5}
            width={length + 10}
            height={22}
            stroke="#3B82F6"
            strokeWidth={2}
            dash={[10, 5]}
          />

          {/* Right handle for extending */}
          <Circle
            x={length}
            y={6}
            radius={8}
            fill="#3B82F6"
            stroke="white"
            strokeWidth={2}
            draggable
            dragBoundFunc={(pos) => {
              const group = groupRef.current;
              if (!group) return pos;
              const tr = group.getAbsoluteTransform().copy();
              const inv = tr.copy().invert();
              const local = inv.point(pos);
              local.y = 6;
              local.x = Math.max(20, local.x);
              return tr.point(local);
            }}
            onDragStart={(e) => {
              e.cancelBubble = true;
              setIsDraggingHandle(true);
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              const group = groupRef.current;
              if (group) {
                const tr = group.getAbsoluteTransform().copy();
                const inv = tr.copy().invert();
                const abs = e.target.getAbsolutePosition();
                const local = inv.point(abs);
                const newLength = Math.max(20, local.x);
                onExtend?.(newLength);
              }
              setIsDraggingHandle(false);
            }}
          />
        </>
      )}
    </Group>
  );
};

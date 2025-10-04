import { Group, Rect, Line, Circle } from 'react-konva';
import { Component } from '@/types';
import { PAVER_SIZES } from '@/constants/components';
import { useState } from 'react';

interface PaverComponentProps {
  component: Component;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (pos: { x: number; y: number }) => void;
  onReplicateRight?: (count: number) => void;
  onReplicateBottom?: (count: number) => void;
}

export const PaverComponent = ({
  component,
  isSelected,
  onSelect,
  onDragEnd,
  onReplicateRight,
  onReplicateBottom,
}: PaverComponentProps) => {
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
  const [dragCount, setDragCount] = useState({ rows: 0, cols: 0 });

  const scale = 0.1; // 1 unit = 10mm
  const paverSize = component.properties.paverSize || '400x400';
  const { width, height } = PAVER_SIZES[paverSize];
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  const count = component.properties.paverCount || { rows: 1, cols: 1 };

  // Draw grid of pavers
  const pavers = [];
  for (let row = 0; row < count.rows; row++) {
    for (let col = 0; col < count.cols; col++) {
      pavers.push(
        <Rect
          key={`${row}-${col}`}
          x={col * scaledWidth}
          y={row * scaledHeight}
          width={scaledWidth}
          height={scaledHeight}
          fill="#F3EBD9"
          stroke="#D4C5A9"
          strokeWidth={1}
        />
      );
    }
  }

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
      {pavers}

      {/* Selection border and handles */}
      {isSelected && (
        <>
          <Rect
            x={-5}
            y={-5}
            width={count.cols * scaledWidth + 10}
            height={count.rows * scaledHeight + 10}
            stroke="#3B82F6"
            strokeWidth={2}
            dash={[10, 5]}
          />

          {/* Right handle for horizontal replication */}
          <Circle
            x={count.cols * scaledWidth}
            y={(count.rows * scaledHeight) / 2}
            radius={8}
            fill="#3B82F6"
            stroke="white"
            strokeWidth={2}
            draggable
            dragBoundFunc={(pos) => ({ x: pos.x, y: (count.rows * scaledHeight) / 2 })}
            onDragStart={(e) => {
              e.cancelBubble = true;
              setIsDraggingHandle(true);
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              const dx = e.target.x() - count.cols * scaledWidth;
              const newCols = Math.max(1, Math.round(dx / scaledWidth) + count.cols);
              setDragCount({ ...dragCount, cols: newCols });
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              const dx = e.target.x() - count.cols * scaledWidth;
              const newCols = Math.max(1, Math.round(dx / scaledWidth) + count.cols);
              onReplicateRight?.(newCols);
              e.target.x(count.cols * scaledWidth);
              e.target.y((count.rows * scaledHeight) / 2);
              setIsDraggingHandle(false);
            }}
          />

          {/* Bottom handle for vertical replication */}
          <Circle
            x={(count.cols * scaledWidth) / 2}
            y={count.rows * scaledHeight}
            radius={8}
            fill="#3B82F6"
            stroke="white"
            strokeWidth={2}
            draggable
            dragBoundFunc={(pos) => ({ x: (count.cols * scaledWidth) / 2, y: pos.y })}
            onDragStart={(e) => {
              e.cancelBubble = true;
              setIsDraggingHandle(true);
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              const dy = e.target.y() - count.rows * scaledHeight;
              const newRows = Math.max(1, Math.round(dy / scaledHeight) + count.rows);
              setDragCount({ ...dragCount, rows: newRows });
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              const dy = e.target.y() - count.rows * scaledHeight;
              const newRows = Math.max(1, Math.round(dy / scaledHeight) + count.rows);
              onReplicateBottom?.(newRows);
              e.target.x((count.cols * scaledWidth) / 2);
              e.target.y(count.rows * scaledHeight);
              setIsDraggingHandle(false);
            }}
          />
        </>
      )}
    </Group>
  );
};

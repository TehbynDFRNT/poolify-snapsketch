import { Group, Rect, Line, Circle } from 'react-konva';
import { Component } from '@/types';
import { PAVER_SIZES } from '@/constants/components';
import { useState, useRef } from 'react';

interface PaverComponentProps {
  component: Component;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (pos: { x: number; y: number }) => void;
  onReplicateRight?: (count: number) => void;
  onReplicateBottom?: (count: number) => void;
  onReplicateLeft?: (count: number) => void;
  onReplicateTop?: (count: number) => void;
}

export const PaverComponent = ({
  component,
  isSelected,
  onSelect,
  onDragEnd,
  onReplicateRight,
  onReplicateBottom,
  onReplicateLeft,
  onReplicateTop,
}: PaverComponentProps) => {
  const groupRef = useRef<any>(null);
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
  const [previewCount, setPreviewCount] = useState<{ rows: number; cols: number; offsetX: number; offsetY: number } | null>(null);

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
      {/* Invisible hit area covering full paver grid */}
      <Rect
        x={-5}
        y={-5}
        width={count.cols * scaledWidth + 10}
        height={count.rows * scaledHeight + 10}
        fill="transparent"
      />

      {pavers}

      {/* Ghost preview pavers during drag */}
      {previewCount && (() => {
        const ghostPavers = [];

        // Determine which area to render ghosts for
        const extendingLeft = previewCount.offsetX < 0;
        const extendingRight = previewCount.cols > count.cols && !extendingLeft;
        const extendingTop = previewCount.offsetY < 0;
        const extendingBottom = previewCount.rows > count.rows && !extendingTop;

        // Render ghost pavers in the extended area only
        for (let row = 0; row < previewCount.rows; row++) {
          for (let col = 0; col < previewCount.cols; col++) {
            // Calculate actual position accounting for offsets
            const actualRow = row + previewCount.offsetY;
            const actualCol = col + previewCount.offsetX;

            // Skip existing pavers (only show ghosts in new area)
            if (actualRow >= 0 && actualRow < count.rows && actualCol >= 0 && actualCol < count.cols) {
              continue;
            }

            ghostPavers.push(
              <Rect
                key={`ghost-${row}-${col}`}
                x={actualCol * scaledWidth}
                y={actualRow * scaledHeight}
                width={scaledWidth}
                height={scaledHeight}
                fill="#F3EBD9"
                stroke="#3B82F6"
                strokeWidth={2}
                dash={[5, 5]}
                opacity={0.5}
                listening={false}
              />
            );
          }
        }
        return ghostPavers;
      })()}

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
            dragBoundFunc={(pos) => {
              const group = groupRef.current;
              if (!group) return pos;
              const tr = group.getAbsoluteTransform().copy();
              const inv = tr.copy().invert();
              const local = inv.point(pos);
              local.y = (count.rows * scaledHeight) / 2;
              local.x = Math.max(scaledWidth, Math.min(20 * scaledWidth, local.x));
              return tr.point(local);
            }}
            onDragStart={(e) => {
              e.cancelBubble = true;
              setIsDraggingHandle(true);
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              const dx = e.target.x() - count.cols * scaledWidth;
              const newCols = Math.max(1, Math.round(dx / scaledWidth) + count.cols);
              setPreviewCount({ rows: count.rows, cols: newCols, offsetX: 0, offsetY: 0 });
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              const dx = e.target.x() - count.cols * scaledWidth;
              const newCols = Math.max(1, Math.round(dx / scaledWidth) + count.cols);
              onReplicateRight?.(newCols);
              e.target.x(count.cols * scaledWidth);
              e.target.y((count.rows * scaledHeight) / 2);
              setIsDraggingHandle(false);
              setPreviewCount(null);
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
            dragBoundFunc={(pos) => {
              const group = groupRef.current;
              if (!group) return pos;
              const tr = group.getAbsoluteTransform().copy();
              const inv = tr.copy().invert();
              const local = inv.point(pos);
              local.x = (count.cols * scaledWidth) / 2;
              local.y = Math.max(scaledHeight, Math.min(20 * scaledHeight, local.y));
              return tr.point(local);
            }}
            onDragStart={(e) => {
              e.cancelBubble = true;
              setIsDraggingHandle(true);
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              const dy = e.target.y() - count.rows * scaledHeight;
              const newRows = Math.max(1, Math.round(dy / scaledHeight) + count.rows);
              setPreviewCount({ rows: newRows, cols: count.cols, offsetX: 0, offsetY: 0 });
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              const dy = e.target.y() - count.rows * scaledHeight;
              const newRows = Math.max(1, Math.round(dy / scaledHeight) + count.rows);
              onReplicateBottom?.(newRows);
              e.target.x((count.cols * scaledWidth) / 2);
              e.target.y(count.rows * scaledHeight);
              setIsDraggingHandle(false);
              setPreviewCount(null);
            }}
          />

          {/* Left handle for horizontal replication (negative direction) */}
          <Circle
            x={0}
            y={(count.rows * scaledHeight) / 2}
            radius={8}
            fill="#10B981"
            stroke="white"
            strokeWidth={2}
            draggable
            dragBoundFunc={(pos) => {
              const group = groupRef.current;
              if (!group) return pos;
              const tr = group.getAbsoluteTransform().copy();
              const inv = tr.copy().invert();
              const local = inv.point(pos);
              local.y = (count.rows * scaledHeight) / 2;
              local.x = Math.max(-20 * scaledWidth, Math.min(0, local.x));
              return tr.point(local);
            }}
            onDragStart={(e) => {
              e.cancelBubble = true;
              setIsDraggingHandle(true);
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              const dx = e.target.x();
              const additionalCols = Math.max(0, Math.round(-dx / scaledWidth));
              const newCols = count.cols + additionalCols;
              setPreviewCount({ rows: count.rows, cols: newCols, offsetX: -additionalCols, offsetY: 0 });
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              const dx = e.target.x();
              const additionalCols = Math.max(0, Math.round(-dx / scaledWidth));
              const newCols = count.cols + additionalCols;
              onReplicateLeft?.(newCols);
              e.target.x(0);
              e.target.y((count.rows * scaledHeight) / 2);
              setIsDraggingHandle(false);
              setPreviewCount(null);
            }}
          />

          {/* Top handle for vertical replication (negative direction) */}
          <Circle
            x={(count.cols * scaledWidth) / 2}
            y={0}
            radius={8}
            fill="#10B981"
            stroke="white"
            strokeWidth={2}
            draggable
            dragBoundFunc={(pos) => {
              const group = groupRef.current;
              if (!group) return pos;
              const tr = group.getAbsoluteTransform().copy();
              const inv = tr.copy().invert();
              const local = inv.point(pos);
              local.x = (count.cols * scaledWidth) / 2;
              local.y = Math.max(-20 * scaledHeight, Math.min(0, local.y));
              return tr.point(local);
            }}
            onDragStart={(e) => {
              e.cancelBubble = true;
              setIsDraggingHandle(true);
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              const dy = e.target.y();
              const additionalRows = Math.max(0, Math.round(-dy / scaledHeight));
              const newRows = count.rows + additionalRows;
              setPreviewCount({ rows: newRows, cols: count.cols, offsetX: 0, offsetY: -additionalRows });
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              const dy = e.target.y();
              const additionalRows = Math.max(0, Math.round(-dy / scaledHeight));
              const newRows = count.rows + additionalRows;
              onReplicateTop?.(newRows);
              e.target.x((count.cols * scaledWidth) / 2);
              e.target.y(0);
              setIsDraggingHandle(false);
              setPreviewCount(null);
            }}
          />
        </>
      )}
    </Group>
  );
};

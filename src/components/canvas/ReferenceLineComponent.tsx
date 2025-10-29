import React, { useState } from 'react';
import { Group, Line, Circle, Label, Tag, Text } from 'react-konva';
import { Component } from '@/types';
import { useDesignStore } from '@/store/designStore';
import { smartSnap } from '@/utils/snap';

interface Props {
  component: Component;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onContextMenu?: (component: Component, screenPos: { x: number; y: number }) => void;
}

export const ReferenceLineComponent: React.FC<Props> = ({
  component,
  selected,
  onSelect,
  onDelete,
  onContextMenu,
}) => {
  const updateComponent = useDesignStore((s) => s.updateComponent);
  const components = useDesignStore((s) => s.components);
  const annotationsVisible = useDesignStore((s) => s.annotationsVisible);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const points = component.properties.points || [];
  if (points.length < 2) return null;

  const [start, end] = points;
  const midPoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };

  // Calculate distance
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const measurementMm = Math.round(distance * 10); // Convert to mm (1px = 10mm)

  const style = component.properties.style || {
    color: component.type === 'quick_measure' ? '#eab308' : '#dc2626',
    dashed: component.type === 'reference_line',
    lineWidth: 2,
    arrowEnds: true,
  };

  const showMeasurement = component.properties.showMeasurement !== false;
  const label = component.properties.label;
  const annotation = component.properties.annotation;

  // Calculate line angle for annotation rotation
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  // Calculate perpendicular offset (15px above the line)
  const perpAngle = Math.atan2(dy, dx) + Math.PI / 2; // 90 degrees perpendicular
  const annotationOffset = 15;
  const annotationX = midPoint.x + Math.cos(perpAngle) * annotationOffset;
  const annotationY = midPoint.y + Math.sin(perpAngle) * annotationOffset;

  // Handle right-click context menu
  const handleRightClick = (e: any) => {
    e.evt.preventDefault();
    if (onContextMenu) {
      const stage = e.target.getStage();
      const pointerPos = stage.getPointerPosition();
      onContextMenu(component, { x: pointerPos.x, y: pointerPos.y });
    }
  };

  return (
    <Group onClick={onSelect} onTap={onSelect} onContextMenu={handleRightClick}>
      {/* Main line */}
      <Line
        points={[start.x, start.y, end.x, end.y]}
        stroke={style.color}
        strokeWidth={selected ? style.lineWidth + 1 : style.lineWidth}
        dash={style.dashed ? [10, 5] : []}
        opacity={component.properties.temporary ? 0.8 : 1}
        listening={!component.properties.temporary}
        hitStrokeWidth={8}
      />

      {/* Arrow caps */}
      {style.arrowEnds && (
        <>
          <Circle
            x={start.x}
            y={start.y}
            radius={4}
            fill={style.color}
            listening={false}
          />
          <Circle
            x={end.x}
            y={end.y}
            radius={4}
            fill={style.color}
            listening={false}
          />
        </>
      )}

      {/* Measurement with annotation */}
      {annotationsVisible && showMeasurement && (
        <Text
          x={midPoint.x}
          y={midPoint.y - 20}
          text={annotation ? `${annotation}: ${measurementMm}` : `${measurementMm}`}
          fontSize={11}
          fill={component.type === 'quick_measure' ? '#dc2626' : '#6B7280'}
          align="center"
          offsetX={annotation ? (annotation.length * 3 + 15) : 15}
          listening={false}
        />
      )}

      {/* User label (if exists) */}
      {label && (
        <Label x={midPoint.x} y={midPoint.y + 10}>
          <Tag fill={style.color} opacity={0.9} cornerRadius={3} />
          <Text
            text={label}
            fontSize={12}
            fill="white"
            padding={4}
            align="center"
          />
        </Label>
      )}

      {/* Draggable endpoint handles (only when selected) */}
      {selected && (
        <>
          {/* Start point handle */}
          <Circle
            x={start.x}
            y={start.y}
            radius={6}
            fill={dragIndex === 0 ? '#3B82F6' : '#ffffff'}
            stroke="#3B82F6"
            strokeWidth={2}
            draggable
            onDragStart={(e) => {
              e.cancelBubble = true;
              setDragIndex(0);
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              const pos = e.target.position();
              const snapped = smartSnap({ x: pos.x, y: pos.y }, components);

              // Update the start point
              const newPoints = [...points];
              newPoints[0] = { x: snapped.x, y: snapped.y };

              updateComponent(component.id, {
                properties: {
                  ...component.properties,
                  points: newPoints,
                }
              });
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              setDragIndex(null);
            }}
          />

          {/* End point handle */}
          <Circle
            x={end.x}
            y={end.y}
            radius={6}
            fill={dragIndex === 1 ? '#3B82F6' : '#ffffff'}
            stroke="#3B82F6"
            strokeWidth={2}
            draggable
            onDragStart={(e) => {
              e.cancelBubble = true;
              setDragIndex(1);
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              const pos = e.target.position();
              const snapped = smartSnap({ x: pos.x, y: pos.y }, components);

              // Update the end point
              const newPoints = [...points];
              newPoints[1] = { x: snapped.x, y: snapped.y };

              updateComponent(component.id, {
                properties: {
                  ...component.properties,
                  points: newPoints,
                }
              });
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              setDragIndex(null);
            }}
          />
        </>
      )}
    </Group>
  );
};

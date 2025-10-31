import React, { useState } from 'react';
import { Group, Line, Circle, Label, Tag, Text } from 'react-konva';
import { Component } from '@/types';
import { useDesignStore } from '@/store/designStore';
import { getAnnotationOffsetPx, normalizeLabelAngle } from '@/utils/annotations';

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
  const [isDraggingNode, setIsDraggingNode] = useState(false);
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

  // Calculate perpendicular offset for annotation (varies per object)
  const perpAngle = Math.atan2(dy, dx) + Math.PI / 2; // 90 degrees perpendicular
  const annotationOffset = getAnnotationOffsetPx(component.id, component.position);
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

  // Handle dragging the entire reference line node
  const handleNodeDragEnd = (e: any) => {
    setIsDraggingNode(false);
    const pos = e.target.position();

    // Calculate the offset from the drag (no snapping - free movement)
    const dx = pos.x;
    const dy = pos.y;

    // Translate all points by the exact drag offset
    const newPoints = points.map(p => ({
      x: p.x + dx,
      y: p.y + dy
    }));

    updateComponent(component.id, {
      properties: {
        ...component.properties,
        points: newPoints,
      }
    });

    // Reset Group position to 0,0
    e.target.position({ x: 0, y: 0 });
  };

  return (
    <Group
      draggable={!dragIndex}
      onClick={onSelect}
      onTap={onSelect}
      onContextMenu={handleRightClick}
      onDragStart={() => setIsDraggingNode(true)}
      onDragEnd={handleNodeDragEnd}
    >
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
      {showMeasurement && (
        <Text
          x={annotationX}
          y={annotationY}
          text={annotation ? `${annotation}: ${measurementMm}mm` : `Measure: ${measurementMm}mm`}
          fontSize={11}
          fill={style.color}
          align="center"
          rotation={normalizeLabelAngle(angle)}
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
              // Free movement - no snapping

              // Update the start point
              const newPoints = [...points];
              newPoints[0] = { x: pos.x, y: pos.y };

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
              // Free movement - no snapping

              // Update the end point
              const newPoints = [...points];
              newPoints[1] = { x: pos.x, y: pos.y };

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

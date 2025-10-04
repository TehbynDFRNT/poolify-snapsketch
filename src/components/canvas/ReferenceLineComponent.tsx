import React from 'react';
import { Group, Line, Circle, Label, Tag, Text } from 'react-konva';
import { Component } from '@/types';

interface Props {
  component: Component;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export const ReferenceLineComponent: React.FC<Props> = ({
  component,
  selected,
  onSelect,
  onDelete,
}) => {
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
  const measurementMeters = (distance / 100).toFixed(1); // Convert to meters

  const style = component.properties.style || {
    color: component.type === 'quick_measure' ? '#eab308' : '#dc2626',
    dashed: component.type === 'reference_line',
    lineWidth: 2,
    arrowEnds: true,
  };

  const showMeasurement = component.properties.showMeasurement !== false;
  const label = component.properties.label;

  return (
    <Group onClick={onSelect} onTap={onSelect}>
      {/* Main line */}
      <Line
        points={[start.x, start.y, end.x, end.y]}
        stroke={style.color}
        strokeWidth={selected ? style.lineWidth + 1 : style.lineWidth}
        dash={style.dashed ? [10, 5] : []}
        opacity={component.properties.temporary ? 0.8 : 1}
        listening={!component.properties.temporary}
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

      {/* Measurement label */}
      {showMeasurement && (
        <Label x={midPoint.x} y={midPoint.y - 20}>
          <Tag
            fill="white"
            stroke={style.color}
            strokeWidth={1}
            cornerRadius={3}
            pointerDirection="down"
            pointerWidth={6}
            pointerHeight={6}
          />
          <Text
            text={`${measurementMeters}m`}
            fontSize={14}
            fontStyle="bold"
            fill={style.color}
            padding={4}
            align="center"
          />
        </Label>
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

      {/* Delete handle when selected */}
      {selected && !component.properties.temporary && (
        <Group
          x={end.x + 10}
          y={end.y - 10}
          onClick={(e) => {
            e.cancelBubble = true;
            onDelete();
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onDelete();
          }}
        >
          <Circle radius={12} fill="white" stroke="#ef4444" strokeWidth={2} />
          <Text
            text="×"
            fontSize={18}
            fill="#ef4444"
            offsetX={5}
            offsetY={8}
            fontStyle="bold"
          />
        </Group>
      )}
    </Group>
  );
};

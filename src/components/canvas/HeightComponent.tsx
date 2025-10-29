import { Group, Line, Text, Rect } from 'react-konva';
import { Component } from '@/types';
import { useDesignStore } from '@/store/designStore';

interface HeightComponentProps {
  component: Component;
  isSelected: boolean;
  activeTool?: string;
  onSelect: () => void;
  onDragEnd: (pos: { x: number; y: number }) => void;
}

export const HeightComponent = ({
  component,
  isSelected,
  activeTool,
  onSelect,
  onDragEnd,
}: HeightComponentProps) => {
  const annotationsVisible = useDesignStore((s) => s.annotationsVisible);
  const heightValue = component.properties.heightValue || 1000; // Default 1000mm (1m)
  const annotation = component.properties.heightAnnotation || '';

  // Convert height from mm to canvas pixels (1 unit = 10mm, same as grid normalization)
  const heightPx = heightValue / 10;

  // Height marker dimensions
  const topCapWidth = 14; // Width of top horizontal cap (70% of original 20)
  const bottomCapWidth = 7; // Width of bottom horizontal cap (half of top)
  const lineColor = '#EF4444'; // Red color
  const lineWidth = 2;

  // Display height in millimeters (mm implied)
  const heightDisplay = `${heightValue}`;

  // Calculate text width for clickbox (approximate) - "annotation:heightmm" or just "heightmm" format
  const fullText = annotation ? `${annotation}:${heightDisplay}` : heightDisplay;
  const textWidth = fullText.length * 7;
  const textHeight = 20;

  return (
    <Group
      x={component.position.x}
      y={component.position.y}
      draggable={activeTool !== 'hand'}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        onDragEnd({ x: e.target.x(), y: e.target.y() });
      }}
    >
      {/* Invisible hit area covering the entire height marker including text */}
      <Rect
        x={-5}
        y={-heightPx - textHeight - 5}
        width={Math.max(topCapWidth + 10, textWidth + 10)}
        height={heightPx + textHeight + 10}
        fill="transparent"
      />

      {/* Bottom horizontal cap - center aligned, half length */}
      <Line
        points={[-bottomCapWidth / 2, 0, bottomCapWidth / 2, 0]}
        stroke={lineColor}
        strokeWidth={lineWidth}
        lineCap="round"
      />

      {/* Vertical line - left aligned */}
      <Line
        points={[0, 0, 0, -heightPx]}
        stroke={lineColor}
        strokeWidth={lineWidth}
        lineCap="round"
      />

      {/* Top horizontal cap - left aligned */}
      <Line
        points={[0, -heightPx, topCapWidth, -heightPx]}
        stroke={lineColor}
        strokeWidth={lineWidth}
        lineCap="round"
      />

      {/* Height measurement text above top cap - left aligned */}
      {annotationsVisible && (
        <Text
          x={0}
          y={-heightPx - 18}
          text={fullText}
          fontSize={12}
          fill={lineColor}
        />
      )}

      {/* Selection indicator */}
      {isSelected && (
        <>
          {/* Bounding rectangle */}
          <Rect
            x={-5}
            y={-heightPx - textHeight - 5}
            width={Math.max(topCapWidth + 10, textWidth + 10)}
            height={heightPx + textHeight + 10}
            stroke="#3B82F6"
            strokeWidth={2}
            dash={[10, 5]}
            listening={false}
          />
          {/* Circle at base */}
          <Line
            points={[0, 0]}
            stroke="#3B82F6"
            strokeWidth={8}
            lineCap="round"
          />
          {/* Circle at top */}
          <Line
            points={[0, -heightPx]}
            stroke="#3B82F6"
            strokeWidth={8}
            lineCap="round"
          />
        </>
      )}
    </Group>
  );
};

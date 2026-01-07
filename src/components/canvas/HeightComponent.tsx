import { Group, Line, Text, Rect } from 'react-konva';
import { Component } from '@/types';
import { useDesignStore } from '@/store/designStore';
import { BLUEPRINT_COLORS } from '@/constants/blueprintColors';

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
  const blueprintMode = useDesignStore((s) => s.blueprintMode);
  // Use stored value if present; otherwise render default 100mm
  const rawValue = component.properties.heightValue;
  const heightValue = typeof rawValue === 'number' && !isNaN(rawValue) ? rawValue : 100; // Default 100mm
  const annotation = component.properties.heightAnnotation || '';

  // Convert height from mm to canvas pixels (1 unit = 10mm, same as grid normalization)
  const heightPx = heightValue / 10;

  // Height marker dimensions
  const topCapWidth = 14; // Width of top horizontal cap (70% of original 20)
  const slashLength = 12; // Length of diagonal slash at bottom
  const lineExtension = 10; // Visual extension past slash (in pixels)
  const lineColor = blueprintMode ? BLUEPRINT_COLORS.secondary : '#EF4444'; // Red normally, blue in blueprint
  const lineWidth = 2;

  // Display height in millimeters (mm implied)
  const heightDisplay = `${heightValue}mm`;

  // Calculate text width for clickbox (approximate) - "annotation:heightmm" or just "heightmm" format
  const fullText = annotation ? `${annotation}:${heightDisplay}` : heightDisplay;
  const textWidth = fullText.length * 7;
  const textHeight = 20;

  return (
    <Group
      x={component.position.x}
      y={component.position.y}
      draggable={activeTool !== 'hand' && isSelected}
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

      {/* Bottom diagonal slash - 45 degree angle through measurement point */}
      <Line
        points={[-slashLength / 2, -slashLength / 2, slashLength / 2, slashLength / 2]}
        stroke={lineColor}
        strokeWidth={lineWidth}
        lineCap="round"
      />

      {/* Vertical line - extends 5mm past bottom slash, measurement point at y=0 */}
      <Line
        points={[0, lineExtension, 0, -heightPx]}
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

      {/* Height measurement text - always visible (measure tool) */}
      {true && (
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

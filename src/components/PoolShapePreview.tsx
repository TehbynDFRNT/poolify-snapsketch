/**
 * Visual preview component for pool shapes in the editor
 * Shows a scaled view of the pool outline with dimension labels
 */

import { useMemo } from 'react';
import { Stage, Layer, Line, Text, Rect } from 'react-konva';
import { Point } from '@/constants/poolShapeTemplates';

interface PoolShapePreviewProps {
  outline: Point[];
  width?: number;
  height?: number;
  showDimensions?: boolean;
  shallowEnd?: Point | null;
  deepEnd?: Point | null;
}

export const PoolShapePreview = ({
  outline,
  width = 400,
  height = 250,
  showDimensions = true,
  shallowEnd,
  deepEnd,
}: PoolShapePreviewProps) => {
  // Calculate bounds and scale
  const { scaledOutline, scale, offsetX, offsetY, bounds } = useMemo(() => {
    if (!outline || outline.length < 3) {
      return { scaledOutline: [], scale: 1, offsetX: 0, offsetY: 0, bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } };
    }

    const xs = outline.map(p => p.x);
    const ys = outline.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const shapeWidth = maxX - minX;
    const shapeHeight = maxY - minY;

    // Calculate scale to fit with padding
    const padding = 40;
    const availableWidth = width - padding * 2;
    const availableHeight = height - padding * 2;
    const scaleX = availableWidth / shapeWidth;
    const scaleY = availableHeight / shapeHeight;
    const scale = Math.min(scaleX, scaleY);

    // Center the shape
    const scaledWidth = shapeWidth * scale;
    const scaledHeight = shapeHeight * scale;
    const offsetX = (width - scaledWidth) / 2 - minX * scale;
    const offsetY = (height - scaledHeight) / 2 - minY * scale;

    // Scale the outline
    const scaledOutline = outline.map(p => ({
      x: p.x * scale + offsetX,
      y: p.y * scale + offsetY,
    }));

    return {
      scaledOutline,
      scale,
      offsetX,
      offsetY,
      bounds: { minX, maxX, minY, maxY }
    };
  }, [outline, width, height]);

  // Generate dimension labels for each edge
  const dimensionLabels = useMemo(() => {
    if (!showDimensions || scaledOutline.length < 3) return [];

    const labels: Array<{ x: number; y: number; text: string; rotation: number }> = [];
    const n = scaledOutline.length - 1; // exclude closing point if present

    for (let i = 0; i < n; i++) {
      const a = scaledOutline[i];
      const b = scaledOutline[(i + 1) % scaledOutline.length];

      // Original points for actual dimension
      const origA = outline[i];
      const origB = outline[(i + 1) % outline.length];
      const dx = origB.x - origA.x;
      const dy = origB.y - origA.y;
      const lengthMm = Math.round(Math.sqrt(dx * dx + dy * dy));

      if (lengthMm < 100) continue; // Skip very short edges

      // Midpoint of scaled edge
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;

      // Determine if horizontal or vertical
      const isHorizontal = Math.abs(dy) < Math.abs(dx);

      // Format dimension
      const meters = lengthMm / 1000;
      const text = meters >= 1 ? `${meters.toFixed(1)}m` : `${lengthMm}mm`;

      // Offset label perpendicular to edge
      const offset = 12;
      let labelX = midX;
      let labelY = midY;

      if (isHorizontal) {
        labelY += dy >= 0 ? offset : -offset;
      } else {
        labelX += dx >= 0 ? -offset : offset;
      }

      labels.push({
        x: labelX,
        y: labelY,
        text,
        rotation: 0,
      });
    }

    return labels;
  }, [scaledOutline, outline, showDimensions]);

  // Scale end positions
  const scaledShallowEnd = shallowEnd ? {
    x: shallowEnd.x * scale + offsetX,
    y: shallowEnd.y * scale + offsetY,
  } : null;

  const scaledDeepEnd = deepEnd ? {
    x: deepEnd.x * scale + offsetX,
    y: deepEnd.y * scale + offsetY,
  } : null;

  if (!outline || outline.length < 3) {
    return (
      <div
        className="flex items-center justify-center bg-muted rounded-lg"
        style={{ width, height }}
      >
        <span className="text-muted-foreground text-sm">No shape defined</span>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-slate-50">
      <Stage width={width} height={height}>
        <Layer>
          {/* Background grid pattern */}
          <Rect x={0} y={0} width={width} height={height} fill="#f8fafc" />

          {/* Pool shape fill */}
          <Line
            points={scaledOutline.flatMap(p => [p.x, p.y])}
            closed
            fill="#3B82F6"
            opacity={0.2}
            stroke="#3B82F6"
            strokeWidth={2}
          />

          {/* Dimension labels */}
          {dimensionLabels.map((label, i) => (
            <Text
              key={`dim-${i}`}
              x={label.x}
              y={label.y}
              text={label.text}
              fontSize={10}
              fill="#64748b"
              align="center"
              offsetX={15}
              offsetY={5}
            />
          ))}

          {/* Shallow end marker */}
          {scaledShallowEnd && (
            <>
              <Rect
                x={scaledShallowEnd.x - 12}
                y={scaledShallowEnd.y - 8}
                width={24}
                height={16}
                fill="#10B981"
                cornerRadius={3}
              />
              <Text
                x={scaledShallowEnd.x}
                y={scaledShallowEnd.y}
                text="SE"
                fontSize={9}
                fontStyle="bold"
                fill="white"
                align="center"
                offsetX={6}
                offsetY={5}
              />
            </>
          )}

          {/* Deep end marker */}
          {scaledDeepEnd && (
            <>
              <Rect
                x={scaledDeepEnd.x - 12}
                y={scaledDeepEnd.y - 8}
                width={24}
                height={16}
                fill="#EF4444"
                cornerRadius={3}
              />
              <Text
                x={scaledDeepEnd.x}
                y={scaledDeepEnd.y}
                text="DE"
                fontSize={9}
                fontStyle="bold"
                fill="white"
                align="center"
                offsetX={6}
                offsetY={5}
              />
            </>
          )}
        </Layer>
      </Stage>
    </div>
  );
};

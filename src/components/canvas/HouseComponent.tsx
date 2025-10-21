import { Group, Line, Circle, Text } from 'react-konva';
import { Component } from '@/types';

interface HouseComponentProps {
  component: Component;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd?: (pos: { x: number; y: number }) => void;
}

export const HouseComponent = ({
  component,
  isSelected,
  onSelect,
  onDragEnd,
}: HouseComponentProps) => {
  const points = component.properties.points || [];
  const closed = component.properties.closed || false;

  if (points.length < 2) return null;

  // Convert points array to flat array for Konva Line
  const flatPoints: number[] = [];
  points.forEach((p) => {
    flatPoints.push(p.x, p.y);
  });

  // If closed, add first point again
  if (closed && points.length > 0) {
    flatPoints.push(points[0].x, points[0].y);
  }

  // Calculate segment measurements
  const renderMeasurements = () => {
    const measurements: JSX.Element[] = [];
    
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      
      // Calculate length in meters (grid scale: 10 pixels = 100mm = 0.1m)
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const lengthInMM = Math.sqrt(dx * dx + dy * dy) * 10;
      const lengthInMeters = (lengthInMM / 1000).toFixed(1);
      
      measurements.push(
        <Text
          key={`measurement-${i}`}
          x={midX}
          y={midY - 15}
          text={`${lengthInMeters}m`}
          fontSize={14}
          fill="#1F2937"
          align="center"
          offsetX={20}
          listening={false}
        />
      );
    }
    
    // Add measurement for closing segment if closed
    if (closed && points.length > 2) {
      const p1 = points[points.length - 1];
      const p2 = points[0];
      
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const lengthInMM = Math.sqrt(dx * dx + dy * dy) * 10;
      const lengthInMeters = (lengthInMM / 1000).toFixed(1);
      
      measurements.push(
        <Text
          key={`measurement-close`}
          x={midX}
          y={midY - 15}
          text={`${lengthInMeters}m`}
          fontSize={14}
          fill="#1F2937"
          align="center"
          offsetX={20}
          listening={false}
        />
      );
    }
    
    return measurements;
  };

  return (
    <Group
      x={component.position.x}
      y={component.position.y}
      rotation={component.rotation}
      draggable={isSelected}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        if (onDragEnd) {
          onDragEnd({
            x: e.target.x(),
            y: e.target.y(),
          });
        }
      }}
    >
      {/* Fill */}
      {closed && (
        <Line
          points={flatPoints}
          fill="#E5E5E5"
          opacity={0.3}
          closed={true}
        />
      )}

      {/* Outline */}
      <Line
        points={flatPoints}
        stroke="#000000"
        strokeWidth={3}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={10}
      />

      {/* Selection indicators - show points */}
      {isSelected && points.map((point, index) => (
        <Circle
          key={`point-${index}`}
          x={point.x}
          y={point.y}
          radius={5}
          fill="#000000"
          stroke="#3B82F6"
          strokeWidth={2}
        />
      ))}

      {/* Measurements */}
      {renderMeasurements()}
      
      {/* Area label if closed */}
      {closed && component.properties.area && (
        <Text
          x={flatPoints[0]}
          y={flatPoints[1]}
          text={`${component.properties.area.toFixed(1)} m²`}
          fontSize={16}
          fontStyle="bold"
          fill="#000000"
          offsetY={-20}
          listening={false}
        />
      )}
    </Group>
  );
};

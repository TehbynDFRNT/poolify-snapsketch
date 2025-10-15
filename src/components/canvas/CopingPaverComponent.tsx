import { useState } from 'react';
import { Rect, Circle } from 'react-konva';
import { CopingPaverData } from '@/types/copingSelection';

interface CopingPaverProps {
  paver: CopingPaverData;
  isSelected: boolean;
  scale: number;
  onSelect: (paverId: string, isMultiSelect: boolean) => void;
  isPreview?: boolean;
  isHovered?: boolean;
  onHandleDragStart?: (paverId: string) => void;
  onHandleDragMove?: (paverId: string, dragDistance: number) => void;
  onHandleDragEnd?: (paverId: string) => void;
  cornerDirection?: 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd';
}

export const CopingPaverComponent = ({
  paver,
  isSelected,
  scale,
  onSelect,
  isPreview = false,
  isHovered = false,
  onHandleDragStart,
  onHandleDragMove,
  onHandleDragEnd,
  cornerDirection,
}: CopingPaverProps) => {
  const [handleDragStart, setHandleDragStart] = useState<{ x: number; y: number } | null>(null);

  const handleClick = (e: any) => {
    const isMultiSelect = e.evt.ctrlKey || e.evt.metaKey;
    onSelect(paver.id, isMultiSelect);
  };

  // Determine extension direction (use cornerDirection for corner pavers)
  const extensionEdge = paver.isCorner && cornerDirection ? cornerDirection : paver.edge;

  // Calculate handle position based on extension edge
  const getHandlePosition = () => {
    switch (extensionEdge) {
      case 'shallowEnd':
        return { x: 0, y: paver.height / 2 }; // left middle (extends leftward)
      case 'deepEnd':
        return { x: paver.width, y: paver.height / 2 }; // right middle (extends rightward)
      case 'leftSide':
        return { x: paver.width / 2, y: 0 }; // top middle (extends upward)
      case 'rightSide':
        return { x: paver.width / 2, y: paver.height }; // bottom middle (extends downward)
    }
  };

  const handlePos = getHandlePosition();

  // Calculate drag distance from handle start position
  const calculateDragDistance = (currentPos: { x: number; y: number }) => {
    if (!handleDragStart) return 0;

    switch (extensionEdge) {
      case 'shallowEnd':
        return (handleDragStart.x - currentPos.x); // leftward = positive
      case 'deepEnd':
        return (currentPos.x - handleDragStart.x); // rightward = positive
      case 'leftSide':
        return (handleDragStart.y - currentPos.y); // upward = positive
      case 'rightSide':
        return (currentPos.y - handleDragStart.y); // downward = positive
      default:
        return 0;
    }
  };
  
  // Color logic
  let fill = "#9CA3AF"; // gray normal
  let stroke = "#374151";
  let strokeWidth = 2;
  let opacity = 1;
  
  if (isPreview) {
    fill = "#93C5FD"; // blue preview
    stroke = "#3B82F6";
    strokeWidth = 2;
    opacity = 0.7;
  } else if (isSelected) {
    fill = "#FCD34D"; // yellow selected
    stroke = "#F59E0B"; // orange border
    strokeWidth = 3;
    opacity = 1;
  } else if (isHovered) {
    fill = "#D1D5DB"; // lighter gray on hover
    opacity = 0.9;
  } else if (paver.isPartial) {
    fill = "#FCD34D"; // yellow partial
    opacity = 0.8;
  }
  
  return (
    <>
      <Rect
        x={paver.x * scale}
        y={paver.y * scale}
        width={paver.width * scale}
        height={paver.height * scale}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={paver.isPartial || isPreview ? [5, 5] : undefined}
        opacity={opacity}
        onClick={handleClick}
        onTap={handleClick}
        onMouseEnter={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'pointer';
        }}
        onMouseLeave={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'default';
        }}
        listening={!isPreview}
      />

      {/* Draggable extension handle - only show when selected and not preview */}
      {isSelected && !isPreview && onHandleDragStart && onHandleDragMove && onHandleDragEnd && (
        <Circle
          x={(paver.x + handlePos.x) * scale}
          y={(paver.y + handlePos.y) * scale}
          radius={8}
          fill="#3B82F6"
          stroke="white"
          strokeWidth={2}
          draggable
          dragBoundFunc={(pos) => {
            // Constrain drag to the extension direction
            const paverScreenX = paver.x * scale;
            const paverScreenY = paver.y * scale;
            const handleScreenX = (paver.x + handlePos.x) * scale;
            const handleScreenY = (paver.y + handlePos.y) * scale;

            switch (extensionEdge) {
              case 'shallowEnd':
                return { x: Math.min(pos.x, handleScreenX), y: handleScreenY }; // only left
              case 'deepEnd':
                return { x: Math.max(pos.x, handleScreenX), y: handleScreenY }; // only right
              case 'leftSide':
                return { x: handleScreenX, y: Math.min(pos.y, handleScreenY) }; // only up
              case 'rightSide':
                return { x: handleScreenX, y: Math.max(pos.y, handleScreenY) }; // only down
              default:
                return pos;
            }
          }}
          onDragStart={(e) => {
            e.cancelBubble = true;
            const pos = { x: e.target.x(), y: e.target.y() };
            setHandleDragStart(pos);
            onHandleDragStart(paver.id);
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            const currentPos = { x: e.target.x(), y: e.target.y() };
            const distance = calculateDragDistance(currentPos);
            onHandleDragMove(paver.id, Math.max(0, distance)); // Only positive distances
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            onHandleDragEnd(paver.id);
            // Reset handle position
            e.target.position({ x: (paver.x + handlePos.x) * scale, y: (paver.y + handlePos.y) * scale });
            setHandleDragStart(null);
          }}
          onMouseEnter={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'move';
          }}
          onMouseLeave={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'default';
          }}
        />
      )}
    </>
  );
};

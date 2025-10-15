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
  onHandleDragStart?: (paverId: string, direction?: 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd') => void;
  onHandleDragMove?: (paverId: string, dragDistance: number, direction?: 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd') => void;
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

  // For corner pavers, render two handles (horizontal and vertical)
  const handles: Array<{
    position: { x: number; y: number };
    direction: 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd';
    axis: 'horizontal' | 'vertical';
  }> = [];
  
  if (paver.isCorner) {
    // Place handles on the EXTERIOR-facing sides (away from pool) for outward extension
    const isHorizontalEdge = paver.edge === 'shallowEnd' || paver.edge === 'deepEnd';
    const isVerticalEdge = paver.edge === 'leftSide' || paver.edge === 'rightSide';

    // Determine base directions for each axis based on which edges meet at this corner
    const horizontalBase: 'shallowEnd' | 'deepEnd' =
      isHorizontalEdge ? (paver.edge as 'shallowEnd' | 'deepEnd') : (paver.rowIndex === 0 ? 'shallowEnd' : 'deepEnd');

    const verticalBase: 'leftSide' | 'rightSide' =
      isVerticalEdge ? (paver.edge as 'leftSide' | 'rightSide') : (paver.columnIndex === 0 ? 'leftSide' : 'rightSide');

    // Position handles on the exterior-facing sides (away from pool)
    // leftSide/shallowEnd corners: place at left edge (x=0)
    // rightSide/deepEnd corners: place at right edge (x=width)
    const horizontalX = 
      (paver.edge === 'leftSide' || paver.edge === 'shallowEnd') ? 0 : paver.width;

    // leftSide/shallowEnd corners: place at top edge (y=0)
    // rightSide/deepEnd corners: place at bottom edge (y=height)
    const verticalY = 
      (paver.edge === 'shallowEnd' || paver.edge === 'leftSide') ? 0 : paver.height;

    handles.push({
      position: { x: horizontalX, y: paver.height / 2 },
      direction: horizontalBase,
      axis: 'horizontal'
    });

    handles.push({
      position: { x: paver.width / 2, y: verticalY },
      direction: verticalBase,
      axis: 'vertical'
    });
  } else {
    // Regular paver with single handle
    let handlePos = { x: 0, y: 0 };
    switch (extensionEdge) {
      case 'shallowEnd': // extends left
        handlePos = { x: 0, y: paver.height / 2 };
        break;
      case 'deepEnd': // extends right
        handlePos = { x: paver.width, y: paver.height / 2 };
        break;
      case 'leftSide': // extends up
        handlePos = { x: paver.width / 2, y: 0 };
        break;
      case 'rightSide': // extends down
        handlePos = { x: paver.width / 2, y: paver.height };
        break;
    }
    handles.push({
      position: handlePos,
      direction: extensionEdge,
      axis: extensionEdge === 'leftSide' || extensionEdge === 'rightSide' ? 'vertical' : 'horizontal'
    });
  }
  
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

      {/* Extension handles - one or two based on corner status */}
      {isSelected && !isPreview && onHandleDragStart && onHandleDragMove && onHandleDragEnd && handles.map((handle, idx) => (
        <Circle
          key={`handle-${idx}`}
          x={(paver.x + handle.position.x) * scale}
          y={(paver.y + handle.position.y) * scale}
          radius={8}
          fill="#10b981"
          stroke="#059669"
          strokeWidth={2}
          draggable
          dragBoundFunc={(pos) => {
            // Allow bidirectional drag along the handle's axis
            const handleScreenX = (paver.x + handle.position.x) * scale;
            const handleScreenY = (paver.y + handle.position.y) * scale;

            if (handle.axis === 'horizontal') {
              return { x: pos.x, y: handleScreenY }; // left/right
            } else {
              return { x: handleScreenX, y: pos.y }; // up/down
            }
          }}
          onDragStart={(e) => {
            e.cancelBubble = true;
            const startPos = { x: e.target.x(), y: e.target.y() };
            setHandleDragStart(startPos);
            onHandleDragStart(paver.id, handle.direction);
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            const currentPos = { x: e.target.x(), y: e.target.y() };
            
            // Calculate distance along the handle's axis
            let distance = 0;
            if (handle.axis === 'horizontal') {
              distance = currentPos.x - handleDragStart!.x;
            } else {
              distance = currentPos.y - handleDragStart!.y;
            }
            
            // Infer direction from drag sign for corners
            let inferredDirection = handle.direction;
            if (paver.isCorner) {
              if (handle.axis === 'horizontal') {
                inferredDirection = distance > 0 ? 'deepEnd' : 'shallowEnd';
              } else {
                inferredDirection = distance > 0 ? 'rightSide' : 'leftSide';
              }
            }
            
            // Convert screen distance back to unscaled units (mm) - allow negative for inward extension
            const unscaledDistance = Math.abs(distance) / scale * (distance < 0 ? -1 : 1);
            console.log('Handle drag:', { distance, unscaledDistance, scale, currentPos, handleDragStart, inferredDirection });
            onHandleDragMove(paver.id, unscaledDistance, inferredDirection);
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            onHandleDragEnd(paver.id);
            // Reset handle position
            e.target.position({ x: (paver.x + handle.position.x) * scale, y: (paver.y + handle.position.y) * scale });
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
      ))}
    </>
  );
};

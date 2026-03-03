import React, { useState, useRef, useEffect } from 'react';
import { Group, Line, Circle, Label, Tag, Text, Transformer } from 'react-konva';
import { Component } from '@/types';
import { useDesignStore } from '@/store/designStore';
import { getAnnotationOffsetPx, normalizeLabelAngle } from '@/utils/annotations';
import { BLUEPRINT_COLORS } from '@/constants/blueprintColors';
import { findNearestPinTarget } from '@/utils/pinSnap';

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
  const blueprintMode = useDesignStore((s) => s.blueprintMode);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [pendingPinSnap, setPendingPinSnap] = useState<{ index: number; worldPoint: { x: number; y: number } } | null>(null);
  const groupRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  // Attach/detach transformer when selection changes
  useEffect(() => {
    if (!trRef.current) return;
    if (selected && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    } else {
      trRef.current.nodes([]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selected]);
  // shiftPressed from store (supports touch toggle button for hinge mode)
  const shiftPressed = useDesignStore((s) => s.shiftPressed);
  const points = component.properties.points || [];
  if (points.length < 2) return null;

  const [start, end] = points;
  const computedMidPoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };

  // When rotated, use stored pivot to prevent visual jumping during endpoint edits
  const rotation = component.rotation || 0;
  const midPoint = (rotation !== 0 && component.properties.rotationPivot)
    ? component.properties.rotationPivot
    : computedMidPoint;

  // Calculate distance
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const measurementMm = Math.round(distance * 10); // Convert to mm (1px = 10mm)

  // Pin state
  const pinStart = component.properties.pinStart;
  const pinEnd = component.properties.pinEnd;
  const hasPinStart = !!pinStart;
  const hasPinEnd = !!pinEnd;
  const bothPinned = hasPinStart && hasPinEnd;

  // Default colors based on component type
  const defaultColor = component.type === 'quick_measure' ? '#eab308' : '#dc2626';

  const style = component.properties.style || {
    color: blueprintMode ? BLUEPRINT_COLORS.secondary : defaultColor,
    dashed: component.type === 'reference_line',
    lineWidth: 2,
    arrowEnds: true,
  };

  // Override color in blueprint mode even if style exists
  const effectiveColor = blueprintMode ? BLUEPRINT_COLORS.secondary : style.color;

  const slashLength = 12; // Length of diagonal slash at endpoints
  const lineExtension = 10; // Visual extension past slash (in pixels)

  const showMeasurement = component.properties.showMeasurement !== false;
  const label = component.properties.label;
  const annotation = component.properties.annotation;

  // Calculate line angle for annotation rotation
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  // Calculate extended line endpoints (extends 5mm past each slash)
  const lineAngle = Math.atan2(dy, dx);
  const extendedStart = {
    x: start.x - Math.cos(lineAngle) * lineExtension,
    y: start.y - Math.sin(lineAngle) * lineExtension,
  };
  const extendedEnd = {
    x: end.x + Math.cos(lineAngle) * lineExtension,
    y: end.y + Math.sin(lineAngle) * lineExtension,
  };

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

    // Clear pins when whole line is dragged (pins no longer valid)
    updateComponent(component.id, {
      properties: {
        ...component.properties,
        points: newPoints,
        pinStart: null,
        pinEnd: null,
      }
    });

    // Reset Group position to 0,0
    e.target.position({ x: 0, y: 0 });
  };

  // Double-click handler to unpin an endpoint
  const handleEndpointDoubleClick = (index: number) => {
    const pinKey = index === 0 ? 'pinStart' : 'pinEnd';
    if (component.properties[pinKey]) {
      updateComponent(component.id, {
        properties: {
          ...component.properties,
          [pinKey]: null,
        }
      });
    }
  };

  // Endpoint drag handlers with pin snap detection
  const handleEndpointDragMove = (e: any, index: number) => {
    e.cancelBubble = true;
    const pos = e.target.position();
    const otherPoint = index === 0 ? end : start;

    if (shiftPressed) {
      // Hinge mode: rotate around other point, maintain length
      const angleToMouse = Math.atan2(pos.y - otherPoint.y, pos.x - otherPoint.x);
      const constrained = {
        x: otherPoint.x + Math.cos(angleToMouse) * distance,
        y: otherPoint.y + Math.sin(angleToMouse) * distance,
      };
      e.target.position({ x: constrained.x, y: constrained.y });

      const newPoints = index === 0 ? [constrained, end] : [start, constrained];
      updateComponent(component.id, {
        properties: {
          ...component.properties,
          points: newPoints,
        }
      });
      setPendingPinSnap(null);
    } else {
      // Free movement - check for pin snap
      const pinResult = findNearestPinTarget(
        { x: pos.x, y: pos.y },
        components,
        [component.id],
        15
      );

      if (pinResult) {
        setPendingPinSnap({ index, worldPoint: pinResult.worldPoint });
        e.target.position({ x: pinResult.worldPoint.x, y: pinResult.worldPoint.y });

        const newPoints = [...points];
        newPoints[index] = pinResult.worldPoint;
        updateComponent(component.id, {
          properties: {
            ...component.properties,
            points: newPoints,
          }
        });
      } else {
        setPendingPinSnap(null);
        const newPoints = [...points];
        newPoints[index] = { x: pos.x, y: pos.y };
        updateComponent(component.id, {
          properties: {
            ...component.properties,
            points: newPoints,
          }
        });
      }
    }
  };

  const handleEndpointDragEnd = (e: any, index: number) => {
    e.cancelBubble = true;
    const pos = e.target.position();

    // Check for pin snap on release
    const pinResult = findNearestPinTarget(
      { x: pos.x, y: pos.y },
      components,
      [component.id],
      15
    );

    const pinKey = index === 0 ? 'pinStart' : 'pinEnd';

    if (pinResult) {
      // Snap to pin and save attachment
      const newPoints = [...points];
      newPoints[index] = pinResult.worldPoint;
      updateComponent(component.id, {
        properties: {
          ...component.properties,
          points: newPoints,
          [pinKey]: pinResult.attachment,
        }
      });
    } else {
      // Clear pin if endpoint was dragged away
      if (component.properties[pinKey]) {
        updateComponent(component.id, {
          properties: {
            ...component.properties,
            [pinKey]: null,
          }
        });
      }
    }

    setDragIndex(null);
    setPendingPinSnap(null);
  };

  // Endpoint visual style based on pin state
  const getEndpointStyle = (index: number) => {
    const isPinned = index === 0 ? hasPinStart : hasPinEnd;
    const isSnapPreview = pendingPinSnap?.index === index;
    const isDragging = dragIndex === index;

    if (isPinned || isSnapPreview) {
      return {
        fill: '#F59E0B',
        stroke: '#D97706',
        strokeWidth: 2,
        radius: 7,
      };
    }
    return {
      fill: isDragging ? '#3B82F6' : '#ffffff',
      stroke: '#3B82F6',
      strokeWidth: 2,
      radius: 6,
    };
  };

  const startStyle = getEndpointStyle(0);
  const endStyle = getEndpointStyle(1);

  return (
    <>
    <Group
      ref={groupRef}
      x={midPoint.x}
      y={midPoint.y}
      offsetX={midPoint.x}
      offsetY={midPoint.y}
      rotation={component.rotation}
      draggable={selected && !dragIndex && !bothPinned}
      onClick={onSelect}
      onTap={onSelect}
      onContextMenu={handleRightClick}
      onDragStart={() => setIsDraggingNode(true)}
      onDragEnd={handleNodeDragEnd}
      onTransformEnd={() => {
        const node = groupRef.current;
        if (!node) return;
        const newRotation = node.rotation();
        node.scaleX(1);
        node.scaleY(1);
        updateComponent(component.id, {
          rotation: newRotation,
          position: { x: node.x() - midPoint.x, y: node.y() - midPoint.y },
          properties: {
            ...component.properties,
            rotationPivot: newRotation !== 0 ? { x: midPoint.x, y: midPoint.y } : undefined,
          },
        });
      }}
    >
      {/* Main line - extends 5mm past slashes, measurement points remain at start/end */}
      <Line
        points={[extendedStart.x, extendedStart.y, extendedEnd.x, extendedEnd.y]}
        stroke={effectiveColor}
        strokeWidth={selected ? style.lineWidth + 1 : style.lineWidth}
        dash={style.dashed ? [10, 5] : []}
        opacity={component.properties.temporary ? 0.8 : 1}
        listening={!component.properties.temporary}
        hitStrokeWidth={8}
      />

      {/* Diagonal slash caps perpendicular to line */}
      {style.arrowEnds && (
        <>
          {/* Start point slash - perpendicular to line direction */}
          <Line
            points={[
              start.x - Math.cos(angle * Math.PI / 180 + Math.PI / 4) * slashLength / 2,
              start.y - Math.sin(angle * Math.PI / 180 + Math.PI / 4) * slashLength / 2,
              start.x + Math.cos(angle * Math.PI / 180 + Math.PI / 4) * slashLength / 2,
              start.y + Math.sin(angle * Math.PI / 180 + Math.PI / 4) * slashLength / 2,
            ]}
            stroke={effectiveColor}
            strokeWidth={style.lineWidth}
            lineCap="round"
            listening={false}
          />
          {/* End point slash - perpendicular to line direction */}
          <Line
            points={[
              end.x - Math.cos(angle * Math.PI / 180 + Math.PI / 4) * slashLength / 2,
              end.y - Math.sin(angle * Math.PI / 180 + Math.PI / 4) * slashLength / 2,
              end.x + Math.cos(angle * Math.PI / 180 + Math.PI / 4) * slashLength / 2,
              end.y + Math.sin(angle * Math.PI / 180 + Math.PI / 4) * slashLength / 2,
            ]}
            stroke={effectiveColor}
            strokeWidth={style.lineWidth}
            lineCap="round"
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
          fill={effectiveColor}
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
            radius={startStyle.radius}
            fill={startStyle.fill}
            stroke={startStyle.stroke}
            strokeWidth={startStyle.strokeWidth}
            draggable
            onDragStart={(e) => {
              e.cancelBubble = true;
              setDragIndex(0);
            }}
            onDragMove={(e) => handleEndpointDragMove(e, 0)}
            onDragEnd={(e) => handleEndpointDragEnd(e, 0)}
            onDblClick={() => handleEndpointDoubleClick(0)}
            onDblTap={() => handleEndpointDoubleClick(0)}
          />

          {/* End point handle */}
          <Circle
            x={end.x}
            y={end.y}
            radius={endStyle.radius}
            fill={endStyle.fill}
            stroke={endStyle.stroke}
            strokeWidth={endStyle.strokeWidth}
            draggable
            onDragStart={(e) => {
              e.cancelBubble = true;
              setDragIndex(1);
            }}
            onDragMove={(e) => handleEndpointDragMove(e, 1)}
            onDragEnd={(e) => handleEndpointDragEnd(e, 1)}
            onDblClick={() => handleEndpointDoubleClick(1)}
            onDblTap={() => handleEndpointDoubleClick(1)}
          />
        </>
      )}
    </Group>
    {selected && (
      <Transformer
        ref={trRef}
        rotateEnabled={true}
        enabledAnchors={[]}
        borderEnabled={false}

        anchorFill="#22c55e"
        anchorStroke="#16a34a"
        anchorCornerRadius={50}
        anchorSize={10}
        rotateAnchorOffset={20}
        rotateLineEnabled={true}
        rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
        boundBoxFunc={(oldBox, newBox) => {
          return { ...newBox, width: oldBox.width, height: oldBox.height };
        }}
      />
    )}
    </>
  );
};

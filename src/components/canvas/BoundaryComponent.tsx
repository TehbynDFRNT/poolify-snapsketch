import { Group, Line, Circle, Text } from 'react-konva';
import { Component } from '@/types';
import { useEffect, useRef, useState } from 'react';
import { useDesignStore } from '@/store/designStore';
import { GRID_CONFIG } from '@/constants/grid';
import { getAnnotationOffsetPx, normalizeLabelAngle } from '@/utils/annotations';
import { BLUEPRINT_COLORS } from '@/constants/blueprintColors';

interface BoundaryComponentProps {
  component: Component;
  isSelected: boolean;
  activeTool?: string;
  onSelect: () => void;
  onDragEnd?: (pos: { x: number; y: number }) => void;
  onContextMenu?: (component: Component, screenPos: { x: number; y: number }) => void;
}

export const BoundaryComponent = ({
  component,
  isSelected,
  activeTool,
  onSelect,
  onDragEnd,
  onContextMenu,
}: BoundaryComponentProps) => {
  const points = component.properties.points || [];
  const closed = component.properties.closed || false;

  const groupRef = useRef<any>(null);
  const updateComponent = useDesignStore((s) => s.updateComponent);
  const updateComponentSilent = useDesignStore((s) => s.updateComponentSilent);
  const annotationsVisible = useDesignStore((s) => s.annotationsVisible);
  const blueprintMode = useDesignStore((s) => s.blueprintMode);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Color based on blueprint mode
  const lineColor = blueprintMode ? BLUEPRINT_COLORS.primary : '#1e3a8a';
  const textColor = blueprintMode ? BLUEPRINT_COLORS.text : '#1e3a8a';
  const [ghostLocal, setGhostLocal] = useState<Array<{ x: number; y: number }> | null>(null);

  // Calculate and persist the center of mass (centroid) of the boundary
  // Use silent update to avoid polluting undo/redo history with derived data
  useEffect(() => {
    if (!closed || points.length < 3) {
      // Only calculate for closed boundaries
      if (component.properties.centerOfMass) {
        updateComponentSilent(component.id, {
          properties: { centerOfMass: undefined }
        });
      }
      return;
    }

    // Calculate centroid using the shoelace formula
    let cx = 0;
    let cy = 0;
    let area = 0;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const cross = points[i].x * points[j].y - points[j].x * points[i].y;
      area += cross;
      cx += (points[i].x + points[j].x) * cross;
      cy += (points[i].y + points[j].y) * cross;
    }

    area /= 2;
    cx /= (6 * area);
    cy /= (6 * area);

    // Snap to grid
    const spacing = GRID_CONFIG.spacing;
    const snappedCx = Math.round(cx / spacing) * spacing;
    const snappedCy = Math.round(cy / spacing) * spacing;

    // Only update if changed
    const current = component.properties.centerOfMass;
    if (!current || current.x !== snappedCx || current.y !== snappedCy) {
      updateComponentSilent(component.id, {
        properties: {
          centerOfMass: { x: snappedCx, y: snappedCy }
        }
      });
    }
  }, [points, closed, component.id, component.properties.centerOfMass, updateComponentSilent]);

  // shiftPressed from store (supports touch toggle button)
  const shiftPressed = useDesignStore((s) => s.shiftPressed);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleRightClick = (e: any) => {
    e.evt.preventDefault();
    if (onContextMenu) {
      const stage = e.target.getStage();
      const pointerPos = stage.getPointerPosition();
      onContextMenu(component, { x: pointerPos.x, y: pointerPos.y });
    }
  };

  if (points.length < 2) return null;

  // Compute local points (relative to group position)
  const localPts = ghostLocal
    ? ghostLocal
    : points.map((p) => ({ x: p.x - component.position.x, y: p.y - component.position.y }));

  // Convert local points to flat array for Konva Line
  const flatLocalPoints: number[] = [];
  localPts.forEach((p) => {
    flatLocalPoints.push(p.x, p.y);
  });
  // If closed, add first local point again to close the loop visually
  if (closed && localPts.length > 0) {
    flatLocalPoints.push(localPts[0].x, localPts[0].y);
  }

  const toLocalFromAbs = (abs: { x: number; y: number }) => {
    const group = groupRef.current;
    if (!group) return abs;
    const tr = group.getAbsoluteTransform().copy();
    const inv = tr.copy().invert();
    return inv.point(abs);
  };
  const toAbsFromLocal = (local: { x: number; y: number }) => {
    const group = groupRef.current;
    if (!group) return local;
    const tr = group.getAbsoluteTransform().copy();
    return tr.point(local);
  };

  // Calculate segment measurements using local coordinates (only when selected)
  const renderMeasurements = () => {
    if (!(annotationsVisible || isSelected)) return null;
    const measurements: JSX.Element[] = [];
    const n = localPts.length;

    const addMeasure = (a: { x: number; y: number }, b: { x: number; y: number }, key: string) => {
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lengthInMM = Math.round(Math.sqrt(dx * dx + dy * dy) * 10); // 1px = 10mm

      // Calculate perpendicular offset to position text away from the line
      const lineLength = Math.sqrt(dx * dx + dy * dy);
      if (lineLength === 0) return; // avoid NaN/Infinity when points coincide
      const perpX = -dy / lineLength; // Perpendicular direction
      const perpY = dx / lineLength;
      const offset = getAnnotationOffsetPx(component.id, component.position);

      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      measurements.push(
        <Text
          key={`measurement-${key}`}
          x={midX + perpX * offset}
          y={midY + perpY * offset}
          text={`Boundary: ${lengthInMM}mm`}
          fontSize={11}
          fill={textColor}
          align="center"
          rotation={normalizeLabelAngle(angleDeg)}
          offsetX={20}
          listening={false}
        />
      );
    };

    // Helper to check if a segment is affected by the currently dragged node
    const isSegmentBeingDragged = (startIdx: number, endIdx: number): boolean => {
      if (dragIndex == null) return false;
      return startIdx === dragIndex || endIdx === dragIndex;
    };

    for (let i = 0; i < n - 1; i++) {
      // Skip measurements for segments adjacent to the dragged node
      if (!isSegmentBeingDragged(i, i + 1)) {
        addMeasure(localPts[i], localPts[i + 1], `${i}`);
      }
    }
    if (closed && n > 2) {
      // Skip the closing segment if it's affected by the dragged node
      if (!isSegmentBeingDragged(n - 1, 0)) {
        addMeasure(localPts[n - 1], localPts[0], 'close');
      }
    }
    return measurements;
  };

  // Ghost overlay for adjacent segments while dragging a node
  const renderGhostOverlay = () => {
    if (dragIndex == null || !ghostLocal) return null;
    const n = localPts.length;

    const segs: Array<[number, number]> = [];
    if (n >= 2) {
      const prev = dragIndex - 1 >= 0 ? dragIndex - 1 : (closed ? n - 1 : -1);
      const next = dragIndex + 1 < n ? dragIndex + 1 : (closed ? 0 : -1);
      if (prev >= 0) segs.push([prev, dragIndex]);
      if (next >= 0) segs.push([dragIndex, next]);
    }

    return (
      <>
        {segs.map(([ai, bi], k) => {
          const a = localPts[ai];
          const b = localPts[bi];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          const mm = Math.round(Math.sqrt(dx * dx + dy * dy) * 10);

          // Calculate perpendicular offset for dynamic measurements
          const lineLength = Math.sqrt(dx * dx + dy * dy);
          const hasLength = lineLength !== 0;
          const perpX = hasLength ? -dy / lineLength : 0;
          const perpY = hasLength ? dx / lineLength : 0;
          const offset = getAnnotationOffsetPx(component.id, component.position);

          const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
          return (
            <Group key={`ghost-${k}`}>
              <Line points={[a.x, a.y, b.x, b.y]} stroke={lineColor} strokeWidth={3} dash={[8, 6]} opacity={0.8} />
              {hasLength && (
                <Text
                  x={midX + perpX * offset}
                  y={midY + perpY * offset}
                  text={`Boundary: ${mm}mm`}
                  fontSize={11}
                  fill={textColor}
                  align="center"
                  rotation={normalizeLabelAngle(angleDeg)}
                  offsetX={20}
                  listening={false}
                />
              )}
            </Group>
          );
        })}
      </>
    );
  };

  return (
    <Group
      ref={groupRef}
      x={component.position.x}
      y={component.position.y}
      rotation={component.rotation}
      draggable={activeTool !== 'hand' && isSelected && !shiftPressed}
      onContextMenu={handleRightClick}
      onDragStart={() => {
        dragStartPos.current = { x: component.position.x, y: component.position.y };
      }}
      onDragEnd={(e) => {
        const spacing = GRID_CONFIG.spacing;
        const newX = Math.round(e.target.x() / spacing) * spacing;
        const newY = Math.round(e.target.y() / spacing) * spacing;
        const start = dragStartPos.current || { x: component.position.x, y: component.position.y };
        const dx = newX - start.x;
        const dy = newY - start.y;
        const translated = points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        updateComponent(component.id, { position: { x: newX, y: newY }, properties: { ...component.properties, points: translated } });
        dragStartPos.current = null;
        onDragEnd?.({ x: newX, y: newY });
      }}
    >
      {/* Main boundary line (local coords) - click detection only on the line, not interior */}
      <Line
        points={flatLocalPoints}
        stroke={lineColor}
        strokeWidth={3}
        dash={[10, 5]}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={10}
        onClick={onSelect}
        onTap={onSelect}
      />

      {/* Ghost dashed overlay + length label while dragging a node */}
      {renderGhostOverlay()}

      {/* Selection indicators + draggable anchors (Shift to edit) */}
      {isSelected && localPts.map((point, index) => (
        <Circle
          key={`point-${index}`}
          x={point.x}
          y={point.y}
          radius={5}
          fill={lineColor}
          stroke="#3b82f6"
          strokeWidth={2}
          draggable={shiftPressed || dragIndex === index}
          onDragStart={(e) => {
            e.cancelBubble = true;
            setDragIndex(index);
            setGhostLocal(localPts);
          }}
          dragBoundFunc={(pos) => {
            const s = GRID_CONFIG.spacing;
            const local = toLocalFromAbs(pos);
            const snappedLocal = { x: Math.round(local.x / s) * s, y: Math.round(local.y / s) * s };
            return toAbsFromLocal(snappedLocal) as any;
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            if (dragIndex == null) return;
            const s = GRID_CONFIG.spacing;
            const abs = e.target.getAbsolutePosition();
            const local = toLocalFromAbs(abs);
            const x = Math.round(local.x / s) * s;
            const y = Math.round(local.y / s) * s;
            const copy = localPts.slice();
            copy[dragIndex] = { x, y };
            setGhostLocal(copy);
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            const s = GRID_CONFIG.spacing;
            const abs = e.target.getAbsolutePosition();
            const local = toLocalFromAbs(abs);
            const x = Math.round(local.x / s) * s;
            const y = Math.round(local.y / s) * s;
            const updated = localPts.slice();
            if (dragIndex != null) updated[dragIndex] = { x, y };
            const absPts = updated.map((p) => ({ x: p.x + component.position.x, y: p.y + component.position.y }));
            updateComponent(component.id, { properties: { ...component.properties, points: absPts } });
            setDragIndex(null);
            setGhostLocal(null);
          }}
        />
      ))}

      {/* Measurements */}
      {renderMeasurements()}
    </Group>
  );
};

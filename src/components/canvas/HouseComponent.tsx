import { Group, Line, Circle, Text } from 'react-konva';
import { Component } from '@/types';
import { useRef, useState } from 'react';
import { useDesignStore } from '@/store/designStore';
import { GRID_CONFIG } from '@/constants/grid';
import { getAnnotationOffsetPx, normalizeLabelAngle } from '@/utils/annotations';
import { BLUEPRINT_COLORS } from '@/constants/blueprintColors';

interface HouseComponentProps {
  component: Component;
  isSelected: boolean;
  activeTool?: string;
  onSelect: () => void;
  onDragEnd?: (pos: { x: number; y: number }) => void;
  onContextMenu?: (component: Component, screenPos: { x: number; y: number }) => void;
}

export const HouseComponent = ({
  component,
  isSelected,
  activeTool,
  onSelect,
  onDragEnd,
  onContextMenu,
}: HouseComponentProps) => {
  const updateComponent = useDesignStore((s) => s.updateComponent);
  const annotationsVisible = useDesignStore((s) => s.annotationsVisible);
  const blueprintMode = useDesignStore((s) => s.blueprintMode);
  const pointsAbs = component.properties.points || [];

  // Colors - house already uses black, but fill changes in blueprint mode
  const fillColor = blueprintMode ? BLUEPRINT_COLORS.fillMedium : '#D1D5DB';
  const closed = component.properties.closed || false;

  const groupRef = useRef<any>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [ghostLocal, setGhostLocal] = useState<Array<{ x: number; y: number }> | null>(null);
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

  if (pointsAbs.length < 2) return null;

  // helpers to convert abs<->local
  const toLocalFromAbs = (abs: { x: number; y: number }) => {
    const group = groupRef.current; if (!group) return abs;
    const tr = group.getAbsoluteTransform().copy();
    const inv = tr.copy().invert();
    return inv.point(abs);
  };
  const toAbsFromLocal = (local: { x: number; y: number }) => {
    const group = groupRef.current; if (!group) return local;
    const tr = group.getAbsoluteTransform().copy();
    return tr.point(local);
  };

  // local points relative to group
  const localPts = ghostLocal
    ? ghostLocal
    : pointsAbs.map(p => ({ x: p.x - component.position.x, y: p.y - component.position.y }));

  // Flat local points for Konva
  const flatLocalPoints: number[] = [];
  localPts.forEach(p => { flatLocalPoints.push(p.x, p.y); });
  if (closed && localPts.length > 0) flatLocalPoints.push(localPts[0].x, localPts[0].y);

  // Measurements (local, only when selected)
  const renderMeasurements = () => {
    if (!(annotationsVisible || isSelected)) return null;
    const measurements: JSX.Element[] = [];
    const n = localPts.length;
    const add = (a: {x:number;y:number}, b:{x:number;y:number}, key:string) => {
      const midX = (a.x + b.x)/2; const midY = (a.y + b.y)/2;
      const dx = b.x - a.x; const dy = b.y - a.y;
      const mm = Math.round(Math.sqrt(dx*dx + dy*dy) * 10); // 1px = 10mm

      // Calculate perpendicular offset to position text away from the line
      const lineLength = Math.sqrt(dx * dx + dy * dy);
      const perpX = -dy / lineLength;
      const perpY = dx / lineLength;
      const offset = getAnnotationOffsetPx(component.id, component.position);

      // Skip measurement if this segment is being dragged
      const isBeingDragged = dragIndex != null && (
        (key === String(dragIndex) || key === String(dragIndex - 1)) ||
        (key === 'close' && (dragIndex === n - 1 || dragIndex === 0))
      );
      if (isBeingDragged) return;

      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      measurements.push(
        <Text
          key={`m-${key}`}
          x={midX + perpX * offset}
          y={midY + perpY * offset}
          text={`House: ${mm}mm`}
          fontSize={11}
          fill="#000000"
          align="center"
          rotation={normalizeLabelAngle(angleDeg)}
          offsetX={20}
          listening={false}
        />
      );
    };
    for (let i=0;i<n-1;i++) add(localPts[i], localPts[i+1], String(i));
    if (closed && n>2) add(localPts[n-1], localPts[0], 'close');
    return measurements;
  };

  // Ghost overlay for adjacent segments while dragging a node
  const renderGhostOverlay = () => {
    if (dragIndex == null || !ghostLocal) return null;
    const n = localPts.length;
    const color = '#000000';

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
          const perpX = -dy / lineLength;
          const perpY = dx / lineLength;
          const offset = getAnnotationOffsetPx(component.id, component.position);

          const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
          return (
            <Group key={`ghost-${k}`}>
              <Line points={[a.x, a.y, b.x, b.y]} stroke={color} strokeWidth={3} dash={[8, 6]} opacity={0.8} />
              <Text
                x={midX + perpX * offset}
                y={midY + perpY * offset}
                text={`House: ${mm}mm`}
                fontSize={11}
                fill="#000000"
                align="center"
                rotation={normalizeLabelAngle(angleDeg)}
                offsetX={20}
                listening={false}
              />
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
      onClick={onSelect}
      onTap={onSelect}
      onContextMenu={handleRightClick}
      onDragStart={() => { dragStartPos.current = { x: component.position.x, y: component.position.y }; }}
      onDragEnd={(e) => {
        if (onDragEnd) {
          const s = GRID_CONFIG.spacing;
          const nx = Math.round(e.target.x() / s) * s;
          const ny = Math.round(e.target.y() / s) * s;
          const start = dragStartPos.current || { x: component.position.x, y: component.position.y };
          const dx = nx - start.x; const dy = ny - start.y;
          const translated = pointsAbs.map(p => ({ x: p.x + dx, y: p.y + dy }));
          updateComponent(component.id, { position: { x: nx, y: ny }, properties: { ...component.properties, points: translated } });
          onDragEnd({ x: nx, y: ny });
        }
        dragStartPos.current = null;
      }}
    >
      {/* Fill */}
      {closed && (
        <Line
          points={flatLocalPoints}
          fill={fillColor}
          opacity={1}
          closed={true}
        />
      )}

      {/* Outline */}
      <Line
        points={flatLocalPoints}
        stroke="#000000"
        strokeWidth={3}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={10}
      />

      {/* Ghost overlay while dragging nodes */}
      {renderGhostOverlay()}

      {/* Selection indicators + draggable anchors (Shift to edit) */}
      {isSelected && localPts.map((pt, index) => (
        <Circle
          key={`point-${index}`}
          x={pt.x}
          y={pt.y}
          radius={5}
          fill="#000000"
          stroke="#3B82F6"
          strokeWidth={2}
          draggable={shiftPressed || dragIndex === index}
          onDragStart={(e) => {
            e.cancelBubble = true;
            setDragIndex(index);
            setGhostLocal(localPts);
          }}
          dragBoundFunc={(pos) => {
            const s = GRID_CONFIG.spacing; const local = toLocalFromAbs(pos);
            const snapped = { x: Math.round(local.x / s) * s, y: Math.round(local.y / s) * s };
            return toAbsFromLocal(snapped) as any;
          }}
          onDragMove={(e) => {
            e.cancelBubble = true; if (dragIndex == null) return;
            const s = GRID_CONFIG.spacing; const abs = e.target.getAbsolutePosition();
            const local = toLocalFromAbs(abs);
            const x = Math.round(local.x / s) * s; const y = Math.round(local.y / s) * s;
            const copy = localPts.slice(); copy[dragIndex] = { x, y }; setGhostLocal(copy);
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true; const s = GRID_CONFIG.spacing; const abs = e.target.getAbsolutePosition();
            const local = toLocalFromAbs(abs); const x = Math.round(local.x / s) * s; const y = Math.round(local.y / s) * s;
            const updated = localPts.slice(); if (dragIndex != null) updated[dragIndex] = { x, y };
            const absPts = updated.map(p => ({ x: p.x + component.position.x, y: p.y + component.position.y }));
            updateComponent(component.id, { properties: { ...component.properties, points: absPts } });
            setDragIndex(null); setGhostLocal(null);
          }}
        />
      ))}

      {/* Measurements */}
      {renderMeasurements()}
      
      {/* Area label if closed - positioned at centroid */}
      {closed && component.properties.area && (() => {
        // Calculate centroid of polygon
        let cx = 0;
        let cy = 0;
        let area = 0;
        const n = localPts.length;

        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const cross = localPts[i].x * localPts[j].y - localPts[j].x * localPts[i].y;
          area += cross;
          cx += (localPts[i].x + localPts[j].x) * cross;
          cy += (localPts[i].y + localPts[j].y) * cross;
        }

        area /= 2;
        cx /= (6 * area);
        cy /= (6 * area);

        return (
          <Text
            x={cx}
            y={cy}
            text={`${component.properties.area.toFixed(1)} m²`}
            fontSize={16}
            fontStyle="bold"
            fill="#000000"
            align="center"
            verticalAlign="middle"
            offsetX={0}
            offsetY={8}
            listening={false}
          />
        );
      })()}
    </Group>
  );
};

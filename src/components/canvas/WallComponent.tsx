import { Group, Line, Rect, Circle, Text } from 'react-konva';
import { Component } from '@/types';
import { WALL_MATERIALS } from '@/constants/components';
import { useState, useRef, useEffect } from 'react';
import { useDesignStore } from '@/store/designStore';
import { GRID_CONFIG } from '@/constants/grid';

interface WallComponentProps {
  component: Component;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (pos: { x: number; y: number }) => void;
  onExtend?: (length: number) => void;
  onContextMenu?: (component: Component, screenPos: { x: number; y: number }) => void;
}

export const WallComponent = ({
  component,
  isSelected,
  onSelect,
  onDragEnd,
  onExtend,
  onContextMenu,
}: WallComponentProps) => {
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);

  const groupRef = useRef<any>(null);

  const wallType = component.properties.wallMaterial || 'timber';
  const wallData = WALL_MATERIALS[wallType as keyof typeof WALL_MATERIALS];
  const height = 15; // Wall height in pixels

  const color = wallData?.color || WALL_MATERIALS.timber.color;

  // Polyline mode: render multiple segments as one element if points exist
  const polyPoints: Array<{ x: number; y: number }> = component.properties.points || [];
  const isPolyline = Array.isArray(polyPoints) && polyPoints.length >= 2;

  const updateComponent = useDesignStore((s) => s.updateComponent);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [ghostLocal, setGhostLocal] = useState<Array<{ x: number; y: number }> | null>(null);
  const [shiftPressed, setShiftPressed] = useState(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const handleRightClick = (e: any) => {
    e.evt.preventDefault();
    if (onContextMenu) {
      const stage = e.target.getStage();
      const pointerPos = stage.getPointerPosition();
      onContextMenu(component, { x: pointerPos.x, y: pointerPos.y });
    }
  };

  if (isPolyline) {
    // Compute local points (relative to group position)
    const localPts = ghostLocal
      ? ghostLocal
      : polyPoints.map((p) => ({ x: p.x - component.position.x, y: p.y - component.position.y }));

    // Compute bbox for selection
    const xs = localPts.map((p) => p.x);
    const ys = localPts.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

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

    return (
      <Group
        ref={groupRef}
        x={component.position.x}
        y={component.position.y}
        rotation={component.rotation}
        draggable={isSelected && !shiftPressed}
        onClick={onSelect}
        onTap={onSelect}
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
          const translated = polyPoints.map((p) => ({ x: p.x + dx, y: p.y + dy }));
          updateComponent(component.id, { position: { x: newX, y: newY }, properties: { ...component.properties, points: translated } });
          dragStartPos.current = null;
        }}
      >
        {/* Render each segment as a rect with proper rotation */}
        {localPts.map((p, i) => {
          if (i === 0) return null;
          const a = localPts[i - 1];
          const b = localPts[i];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          if (length < 1) return null;
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          return (
            <Group key={`seg-${i}`} x={a.x} y={a.y} rotation={angle}>
              <Line
                points={[0, 0, length, 0]}
                stroke={color}
                strokeWidth={height}
                lineCap="square"
                hitStrokeWidth={20}
                opacity={ghostLocal ? 0.6 : 0.9}
              />
            </Group>
          );
        })}

        {/* Ghost dashed overlay + length label on affected segments while dragging */}
        {dragIndex != null && ghostLocal && (
          <>
            {(() => {
              const overlay = [] as JSX.Element[];
              const idxs = [dragIndex - 1, dragIndex + 1];
              idxs.forEach((k, n) => {
                if (k <= 0 || k >= localPts.length) return;
                const a = localPts[k - 1];
                const b = localPts[k];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len < 1) return;
                const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                overlay.push(
                  <>
                    <Line key={`ghost-${k}`} points={[a.x, a.y, b.x, b.y]} stroke={color} strokeWidth={3} dash={[8, 6]} opacity={0.8} />
                    <Text key={`glbl-${k}`} x={mid.x} y={mid.y - 16} text={`${(len / 100).toFixed(1)}m`} fontSize={12} fill={color} offsetX={12} listening={false} />
                  </>
                );
              });
              return overlay;
            })()}
          </>
        )}

        {/* Selection border */}
        {isSelected && (
          <Rect
            x={minX - 5}
            y={minY - 5}
            width={maxX - minX + 10}
            height={maxY - minY + 10}
            stroke="#3B82F6"
            strokeWidth={2}
            dash={[10, 5]}
            listening={false}
          />
        )}

        {/* Node handles for editing */}
        {isSelected && localPts.map((pt, idx) => (
          <Circle
            key={`hdl-${idx}`}
            x={pt.x}
            y={pt.y}
            radius={6}
            fill={dragIndex === idx ? '#3B82F6' : '#ffffff'}
            stroke="#3B82F6"
            strokeWidth={2}
            draggable={shiftPressed}
            onDragStart={(e) => {
              e.cancelBubble = true;
              setDragIndex(idx);
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
      </Group>
    );
  }

  return (
      <Group
        ref={groupRef}
        x={component.position.x}
        y={component.position.y}
        rotation={component.rotation}
        draggable={!isDraggingHandle}
        onClick={onSelect}
        onTap={onSelect}
        onContextMenu={handleRightClick}
        onDragEnd={(e) => {
          onDragEnd({ x: e.target.x(), y: e.target.y() });
        }}
      >
      {/* Invisible hit area for easier clicking */}
      <Rect
        x={0}
        y={-5}
        width={component.dimensions.width || 1000}
        height={height + 10}
        fill="transparent"
      />

      {/* Wall body */}
      <Rect
        x={0}
        y={0}
        width={component.dimensions.width || 1000}
        height={height}
        fill={color}
        stroke={color}
        strokeWidth={1}
        opacity={0.8}
      />

      {/* Selection border and handle */}
      {isSelected && (
        <>
          <Rect
            x={-5}
            y={-5}
            width={(component.dimensions.width || 1000) + 10}
            height={height + 10}
            stroke="#3B82F6"
            strokeWidth={2}
            dash={[10, 5]}
          />

          {/* Right handle for extending */}
          <Circle
            x={component.dimensions.width || 1000}
            y={height / 2}
            radius={8}
            fill="#3B82F6"
            stroke="white"
            strokeWidth={2}
            draggable
            dragBoundFunc={(pos) => {
              const group = groupRef.current;
              if (!group) return pos;
              const tr = group.getAbsoluteTransform().copy();
              const inv = tr.copy().invert();
              const local = inv.point(pos);
              local.y = height / 2;
              local.x = Math.max(20, local.x);
              return tr.point(local);
            }}
            onDragStart={(e) => {
              e.cancelBubble = true;
              setIsDraggingHandle(true);
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              const group = groupRef.current;
              if (group) {
                const tr = group.getAbsoluteTransform().copy();
                const inv = tr.copy().invert();
                const abs = e.target.getAbsolutePosition();
                const local = inv.point(abs);
                const newLength = Math.max(20, local.x);
                onExtend?.(newLength);
              }
              setIsDraggingHandle(false);
            }}
          />
        </>
      )}
    </Group>
  );
};

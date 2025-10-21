import { Group, Line, Rect, Circle, Text } from 'react-konva';
import { Component } from '@/types';
import { FENCE_TYPES } from '@/constants/components';
import { useState, useRef } from 'react';
import { useDesignStore } from '@/store/designStore';
import { GRID_CONFIG } from '@/constants/grid';

interface FenceComponentProps {
  component: Component;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (pos: { x: number; y: number }) => void;
  onExtend?: (length: number) => void;
}

export const FenceComponent = ({
  component,
  isSelected,
  onSelect,
  onDragEnd,
  onExtend,
}: FenceComponentProps) => {
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);

  const groupRef = useRef<any>(null);

  const scale = 0.1;
  const fenceType = component.properties.fenceType || 'glass';
  const fenceData = FENCE_TYPES[fenceType];
  const length = (component.dimensions.width || 2400);

  const color = fenceData.color;
  const strokeWidth = fenceType === 'glass' ? 2 : 4;

  // Polyline mode
  const polyPoints: Array<{ x: number; y: number }> = component.properties.points || [];
  const isPolyline = Array.isArray(polyPoints) && polyPoints.length >= 2;

  const updateComponent = useDesignStore((s) => s.updateComponent);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [ghostLocal, setGhostLocal] = useState<Array<{ x: number; y: number }> | null>(null);

  if (isPolyline) {
    const localPts = (ghostLocal ?? polyPoints).map((p) => ({ x: p.x - component.position.x, y: p.y - component.position.y }));
    const xs = localPts.map((p) => p.x);
    const ys = localPts.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return (
      <Group
        ref={groupRef}
        x={component.position.x}
        y={component.position.y}
        rotation={component.rotation}
        draggable={!isDraggingHandle}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onDragEnd({ x: e.target.x(), y: e.target.y() });
        }}
      >
        {localPts.map((p, i) => {
          if (i === 0) return null;
          const a = localPts[i - 1];
          const b = localPts[i];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const segLen = Math.sqrt(dx * dx + dy * dy);
          if (segLen < 1) return null;
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          const fenceColor = color;
          return (
            <Group key={`seg-${i}`} x={a.x} y={a.y} rotation={angle}>
              <Line points={[0, -6, segLen, -6]} stroke={fenceColor} strokeWidth={strokeWidth} hitStrokeWidth={16} opacity={ghostLocal ? 0.6 : 1} />
              <Line points={[0, 6, segLen, 6]} stroke={fenceColor} strokeWidth={strokeWidth} hitStrokeWidth={16} opacity={ghostLocal ? 0.6 : 1} />
            </Group>
          );
        })}

        {/* Ghost overlay and label on affected segments while dragging */}
        {dragIndex != null && ghostLocal && (
          <>
            {(() => {
              const overlay = [] as JSX.Element[];
              const idxs = [dragIndex - 1, dragIndex + 1];
              idxs.forEach((k) => {
                if (k <= 0 || k >= localPts.length) return;
                const a = localPts[k - 1];
                const b = localPts[k];
                const len = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
                const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                overlay.push(
                  <>
                    <Line key={`fg-${k}`} points={[a.x, a.y, b.x, b.y]} stroke={color} strokeWidth={2} dash={[8, 6]} />
                    <Text key={`fl-${k}`} x={mid.x} y={mid.y - 16} text={`${(len / 100).toFixed(1)}m`} fontSize={12} fill={color} offsetX={12} listening={false} />
                  </>
                );
              });
              return overlay;
            })()}
          </>
        )}

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

        {/* Node handles */}
        {isSelected && localPts.map((pt, idx) => (
          <Circle
            key={`hdl-${idx}`}
            x={pt.x}
            y={pt.y}
            radius={6}
            fill="#ffffff"
            stroke="#3B82F6"
            strokeWidth={2}
            draggable
            onDragStart={(e) => {
              e.cancelBubble = true;
              setDragIndex(idx);
              setGhostLocal(localPts);
            }}
            dragBoundFunc={(pos) => {
              const s = GRID_CONFIG.spacing;
              return { x: Math.round(pos.x / s) * s, y: Math.round(pos.y / s) * s } as any;
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              if (dragIndex == null) return;
              const s = GRID_CONFIG.spacing;
              const x = Math.round(e.target.x() / s) * s;
              const y = Math.round(e.target.y() / s) * s;
              const copy = localPts.slice();
              copy[dragIndex] = { x, y };
              setGhostLocal(copy);
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              const s = GRID_CONFIG.spacing;
              const x = Math.round(e.target.x() / s) * s;
              const y = Math.round(e.target.y() / s) * s;
              const updated = localPts.slice();
              if (dragIndex != null) updated[dragIndex] = { x, y };
              const abs = updated.map((p) => ({ x: p.x + component.position.x, y: p.y + component.position.y }));
              updateComponent(component.id, { properties: { ...component.properties, points: abs } });
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
        onDragEnd={(e) => {
          onDragEnd({ x: e.target.x(), y: e.target.y() });
        }}
      >
      {/* No broad hit area; rely on rails and hitStrokeWidth for interaction */}

      {/* Base line */}
      <Line points={[0, 0, length, 0]} stroke={color} strokeWidth={strokeWidth} hitStrokeWidth={16} />
      <Line points={[0, 12, length, 12]} stroke={color} strokeWidth={strokeWidth} hitStrokeWidth={16} />

      {/* Pickets */}
      {(() => {
        const elems = [] as JSX.Element[];
        const picketSpacing = 10;
        for (let i = 0; i <= length; i += picketSpacing) {
          elems.push(
            <Line
              key={i}
              points={[i, 0, i, 12]}
              stroke={color}
              strokeWidth={strokeWidth === 2 ? 1 : 2}
              opacity={fenceType === 'glass' ? 0.5 : 1}
            />
          );
        }
        return elems;
      })()}

      {/* Selection border and handle */}
      {isSelected && (
        <>
          <Rect
            x={-5}
            y={-5}
            width={length + 10}
            height={22}
            stroke="#3B82F6"
            strokeWidth={2}
            dash={[10, 5]}
          />

          {/* Right handle for extending */}
          <Circle
            x={length}
            y={6}
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
              local.y = 6;
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

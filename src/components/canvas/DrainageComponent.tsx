import { Group, Rect, Circle, Line, Text } from 'react-konva';
import { Component } from '@/types';
import { DRAINAGE_TYPES } from '@/constants/components';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useDesignStore } from '@/store/designStore';
import { GRID_CONFIG } from '@/constants/grid';
import { getAnnotationOffsetPx, normalizeLabelAngle } from '@/utils/annotations';

interface DrainageComponentProps {
  component: Component;
  isSelected: boolean;
  activeTool?: string;
  onSelect: () => void;
  onDragEnd: (pos: { x: number; y: number }) => void;
  onExtend?: (length: number) => void;
  onContextMenu?: (component: Component, screenPos: { x: number; y: number }) => void;
}

export const DrainageComponent = ({
  component,
  isSelected,
  activeTool,
  onSelect,
  onDragEnd,
  onExtend,
  onContextMenu,
}: DrainageComponentProps) => {
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);

  const groupRef = useRef<any>(null);

  const scale = 0.1;
  const drainageType = component.properties.drainageType || 'ultradrain';
  const drainageData = DRAINAGE_TYPES[drainageType];
  const length = (component.properties.length || 1000) * scale;
  const width = drainageData.width * scale;

  // Color scheme based on type
  const isRockDrain = drainageType === 'rock';
  const color = isRockDrain ? '#B8AFA3' : '#C0C0C0'; // Light gray/beige for pea gravel, silver for ultradrain
  const slotColor = '#2C2C2C'; // Dark gray for the slots
  const rockColors = ['#D4CEC6', '#C9C3BB', '#B8AFA3', '#A8A099', '#9B948C']; // Pea gravel tones - light gray/beige

  // Polyline mode
  const polyPoints: Array<{ x: number; y: number }> = component.properties.points || [];
  const isPolyline = Array.isArray(polyPoints) && polyPoints.length >= 2;

  const updateComponent = useDesignStore((s) => s.updateComponent);
  const annotationsVisible = useDesignStore((s) => s.annotationsVisible);
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

  // Calculate live total LM (uses ghostLocal during drag for real-time updates)
  const liveTotalLM = useMemo(() => {
    const pts = ghostLocal
      ? ghostLocal.map((p) => ({ x: p.x + component.position.x, y: p.y + component.position.y }))
      : polyPoints;
    if (pts.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      total += Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2) * 10 / 1000; // px to LM
    }
    return total;
  }, [ghostLocal, polyPoints, component.position.x, component.position.y]);

  // Update component properties with live stats during drag
  useEffect(() => {
    if (!isPolyline) return;
    const current = component.properties.totalLM as number | undefined;
    if (current === undefined || Math.abs(current - liveTotalLM) > 0.001) {
      updateComponent(component.id, {
        properties: { ...component.properties, totalLM: liveTotalLM },
      });
    }
  }, [liveTotalLM, isPolyline, component.id, component.properties, updateComponent]);

  if (isPolyline) {
    const localPts = ghostLocal
      ? ghostLocal
      : polyPoints.map((p) => ({ x: p.x - component.position.x, y: p.y - component.position.y }));
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
        draggable={activeTool !== 'hand' && isSelected && !shiftPressed}
        onClick={onSelect}
        onTap={onSelect}
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
        {localPts.map((p, i) => {
          if (i === 0) return null;
          const a = localPts[i - 1];
          const b = localPts[i];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const segLen = Math.sqrt(dx * dx + dy * dy);
          if (segLen < 1) return null;
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

          // Calculate vertical slats: 2mm wide, 50mm long (in real units)
          // At scale 0.1: 2mm = 0.2px, 50mm = 5px
          const slotWidthPx = 0.2 * scale * 10; // 2mm in pixels
          const slotHeightPx = 5 * scale * 10; // 50mm in pixels
          const slotSpacingPx = 8; // Space between slots (~80mm in real units)
          const numSlots = Math.floor(segLen / slotSpacingPx);

          return (
            <Group key={`seg-${i}`} x={a.x} y={a.y} rotation={angle}>
              {/* Drainage base */}
              <Line
                points={[0, 0, segLen, 0]}
                stroke={color}
                strokeWidth={width}
                lineCap="butt"
                hitStrokeWidth={Math.max(16, width)}
                opacity={ghostLocal ? 0.5 : 0.9}
              />

              {isRockDrain ? (
                /* Rock/gravel pattern - random circles to simulate rocks */
                <>
                  {Array.from({ length: Math.floor(segLen / 3) }).map((_, idx) => {
                    const seed = i * 1000 + idx;
                    const xPos = (idx * 3 + (seed % 3));
                    const yOffset = ((seed * 7) % 5) - 2.5;
                    const rockSize = 1 + ((seed * 13) % 3) * 0.5;
                    const colorIdx = (seed * 17) % rockColors.length;
                    return (
                      <Circle
                        key={`rock-seg${i}-${idx}`}
                        x={xPos}
                        y={yOffset}
                        radius={rockSize}
                        fill={rockColors[colorIdx]}
                        opacity={0.8}
                      />
                    );
                  })}
                </>
              ) : (
                /* Ultra drain - vertical slats (perpendicular to drain length) */
                Array.from({ length: Math.max(1, numSlots) }).map((_, idx) => (
                  <Line
                    key={idx}
                    points={[idx * slotSpacingPx + 4, -slotHeightPx / 2, idx * slotSpacingPx + 4, slotHeightPx / 2]}
                    stroke={slotColor}
                    strokeWidth={slotWidthPx}
                    opacity={0.7}
                  />
                ))
              )}
            </Group>
          );
        })}

        {/* Ghost overlay + measurements on affected segments while dragging */}
        {dragIndex != null && ghostLocal && (
          <>
            {(() => {
              const overlay = [] as JSX.Element[];
              const idxs = [dragIndex - 1, dragIndex + 1];
              idxs.forEach((k) => {
                if (k <= 0 || k >= localPts.length) return;
                const a = localPts[k - 1];
                const b = localPts[k];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const len = Math.sqrt(dx * dx + dy * dy);

                // Calculate perpendicular offset to match permanent measurements
                const lineLength = len;
                const perpX = -dy / lineLength;
                const perpY = dx / lineLength;
                const offset = getAnnotationOffsetPx(component.id, component.position);

                const midX = (a.x + b.x) / 2;
                const midY = (a.y + b.y) / 2;

                overlay.push(
                  <>
                    <Line key={`dg-${k}`} points={[a.x, a.y, b.x, b.y]} stroke={color} strokeWidth={3} dash={[8, 6]} opacity={0.8} />
                    <Text
                      key={`dl-${k}`}
                      x={midX + perpX * offset}
                      y={midY + perpY * offset}
                      text={`Drainage: ${Math.round(len * 10)}mm`}
                      fontSize={11}
                      fill={color}
                      align="center"
                      rotation={normalizeLabelAngle((Math.atan2(dy, dx) * 180) / Math.PI)}
                      offsetX={20}
                      listening={false}
                    />
                  </>
                );
              });
              return overlay;
            })()}
          </>
        )}

        {/* Segment measurements */}
        {(annotationsVisible || isSelected) && localPts.map((pt, idx) => {
          if (idx === 0) return null;
          const a = localPts[idx - 1];
          const b = localPts[idx];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const lengthInMM = Math.round(Math.sqrt(dx * dx + dy * dy) * 10); // 1px = 10mm

          // Calculate perpendicular offset to position text away from the line
          const lineLength = Math.sqrt(dx * dx + dy * dy);
          const perpX = -dy / lineLength;
          const perpY = dx / lineLength;
          const offset = getAnnotationOffsetPx(component.id, component.position);

          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;

          // Skip measurement if this segment is being dragged
          if (dragIndex === idx - 1 || dragIndex === idx) return null;

          const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
          return (
            <Text
              key={`measurement-${idx}`}
              x={midX + perpX * offset}
              y={midY + perpY * offset}
              text={`${lengthInMM}mm`}
              fontSize={11}
              fill={color}
              align="center"
              rotation={normalizeLabelAngle(angleDeg)}
              offsetX={20}
              listening={false}
            />
          );
        })}

        {/* Total LM label - updates live during drag */}
        {(annotationsVisible || isSelected) && (() => {
          let totalLM = 0;
          for (let i = 1; i < localPts.length; i++) {
            const a = localPts[i - 1];
            const b = localPts[i];
            totalLM += Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2) * 10 / 1000; // px to LM
          }
          const labelOffset = getAnnotationOffsetPx(component.id, component.position) + 15;
          const typeLabel = isRockDrain ? 'Rock Drain' : 'Ultra Drain';
          return (
            <Text
              x={(minX + maxX) / 2}
              y={minY - labelOffset}
              text={`${typeLabel}: ${totalLM.toFixed(2)} LM`}
              fontSize={10}
              fill={color}
              align="center"
              offsetX={40}
              listening={false}
            />
          );
        })()}

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

  const handleRightClick = (e: any) => {
    e.evt.preventDefault();
    if (onContextMenu) {
      const stage = e.target.getStage();
      const pointerPos = stage.getPointerPosition();
      onContextMenu(component, { x: pointerPos.x, y: pointerPos.y });
    }
  };

  return (
    <Group
      ref={groupRef}
      x={component.position.x}
      y={component.position.y}
      rotation={component.rotation}
      draggable={activeTool !== 'hand' && !isDraggingHandle}
      onClick={onSelect}
      onTap={onSelect}
      onContextMenu={handleRightClick}
      onDragEnd={(e) => {
        onDragEnd({ x: e.target.x(), y: e.target.y() });
      }}
    >
      {/* No broad hit area; rely on thick stroke and hitStrokeWidth */}

      {/* Drainage base */}
      <Line
        points={[0, 0, length, 0]}
        stroke={color}
        strokeWidth={width}
        lineCap="butt"
        hitStrokeWidth={Math.max(16, width)}
        opacity={0.9}
      />

      {isRockDrain ? (
        /* Rock/gravel pattern - random circles to simulate rocks */
        <>
          {Array.from({ length: Math.floor(length / 3) }).map((_, i) => {
            const seed = i * 31;
            const xPos = (i * 3 + (seed % 3));
            const yOffset = ((seed * 7) % 5) - 2.5;
            const rockSize = 1 + ((seed * 13) % 3) * 0.5;
            const colorIdx = (seed * 17) % rockColors.length;
            return (
              <Circle
                key={`rock-${i}`}
                x={xPos}
                y={yOffset}
                radius={rockSize}
                fill={rockColors[colorIdx]}
                opacity={0.8}
              />
            );
          })}
        </>
      ) : (
        /* Ultra drain - vertical slats (perpendicular to drain length) - 2mm wide, 50mm long */
        (() => {
          const slotWidthPx = 0.2 * scale * 10; // 2mm in pixels
          const slotHeightPx = 5 * scale * 10; // 50mm in pixels
          const slotSpacingPx = 8; // Space between slots (~80mm in real units)
          const numSlots = Math.floor(length / slotSpacingPx);

          return Array.from({ length: Math.max(1, numSlots) }).map((_, i) => (
            <Line
              key={i}
              points={[i * slotSpacingPx + 4, -slotHeightPx / 2, i * slotSpacingPx + 4, slotHeightPx / 2]}
              stroke={slotColor}
              strokeWidth={slotWidthPx}
              opacity={0.7}
            />
          ));
        })()
      )}

      {/* Selection border and handle */}
      {isSelected && (
        <>
          <Rect
            x={-5}
            y={-5}
            width={length + 10}
            height={width + 10}
            stroke="#3B82F6"
            strokeWidth={2}
            dash={[10, 5]}
          />

          {/* Right handle for extending */}
          <Circle
            x={length}
            y={width / 2}
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
              local.y = width / 2;
              local.x = Math.max(width, local.x);
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
                const newLength = Math.max(width, local.x);
                onExtend?.(newLength / scale);
              }
              setIsDraggingHandle(false);
            }}
          />
        </>
      )}
    </Group>
  );
};

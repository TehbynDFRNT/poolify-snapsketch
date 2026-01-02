import { Group, Line, Circle, Rect, Transformer } from 'react-konva';
import { Component } from '@/types';
import { useDesignStore } from '@/store/designStore';
import { FENCE_TYPES } from '@/constants/components';
import { GRID_CONFIG } from '@/constants/grid';
import { useRef, useEffect } from 'react';
import { BLUEPRINT_COLORS } from '@/constants/blueprintColors';

interface GateComponentProps {
  component: Component;
  isSelected: boolean;
  activeTool?: string;
  onSelect: () => void;
  onDragEnd: (pos: { x: number; y: number }) => void;
}

// Simple always-open gate: hinge at origin, leaf as a line with fixed width (mm)
export const GateComponent = ({ component, isSelected, activeTool, onSelect, onDragEnd }: GateComponentProps) => {
  const updateComponent = useDesignStore(s => s.updateComponent);
  const blueprintMode = useDesignStore(s => s.blueprintMode);
  const groupRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const scale = 0.1; // 1px = 10mm
  const mmToPx = (mm: number) => mm * scale;
  const widthMm = component.properties.length || 1000; // mm
  const gateType = (component.properties as any).gateType || 'glass';
  const normalColor = FENCE_TYPES[gateType]?.color || '#9CA3AF';
  const color = blueprintMode ? BLUEPRINT_COLORS.secondary : normalColor;
  const leafThickness = blueprintMode ? 2 : (gateType === 'glass' ? mmToPx(40) : mmToPx(30));
  const leafLen = Math.max(200, Number(widthMm) || 1000) * scale; // px
  const hitPad = 10; // px extra clickable padding

  // Hinge post visual size
  const postSize = blueprintMode ? 6 : 10;

  // Attach/detach transformer when selection changes
  useEffect(() => {
    if (!trRef.current) return;
    if (isSelected && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    } else {
      trRef.current.nodes([]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Group
        ref={groupRef}
        x={component.position.x}
        y={component.position.y}
        rotation={component.rotation}
        draggable={activeTool !== 'hand'}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onDragEnd({ x: e.target.x(), y: e.target.y() })}
        onTransformEnd={() => {
          const node = groupRef.current;
          if (!node) return;
          // Prevent any accidental scale; we only want rotation
          const sx = node.scaleX();
          const sy = node.scaleY();
          if (sx !== 1 || sy !== 1) {
            node.scaleX(1);
            node.scaleY(1);
          }
          updateComponent(component.id, { rotation: node.rotation() });
        }}
      >
      {/* Invisible hit area to make selection easy */}
      <Rect
        x={-hitPad}
        y={-leafThickness - hitPad}
        width={leafLen + hitPad * 2}
        height={leafThickness * 2 + hitPad * 2}
        fill="rgba(0,0,0,0.001)"
        onClick={onSelect}
        onTap={onSelect}
      />

      {/* Hinge post */}
      <Rect x={-postSize/2} y={-postSize/2} width={postSize} height={postSize} fill={blueprintMode ? BLUEPRINT_COLORS.secondary : (gateType === 'metal' ? '#333' : '#374151')} />

      {/* Leaf - always open: drawn along +X */}
      <Line
        points={[0, 0, leafLen, 0]}
        stroke={color}
        strokeWidth={leafThickness}
        lineCap={gateType === 'glass' ? 'round' : 'butt'}
        hitStrokeWidth={Math.max(leafThickness + 12, 20)}
      />

      {/* Paver-style selection overlay (rotates with the group) */}
      {isSelected && (
        <Rect
          x={-8}
          y={-leafThickness - 8}
          width={leafLen + 16}
          height={leafThickness * 2 + 16}
          fill="rgba(59,130,246,0.15)"
          stroke="#3B82F6"
          strokeWidth={2}
          dash={[6, 3]}
          listening={false}
        />
      )}

      </Group>
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled={true}
          enabledAnchors={[]}
          borderStroke="#3B82F6"
          borderStrokeWidth={2}
          borderDash={[6, 3]}
          anchorFill="#ffffff"
          anchorStroke="#3B82F6"
          rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
          boundBoxFunc={(oldBox, newBox) => {
            // Disallow scaling via transformer; keep rotation only
            return { ...newBox, width: oldBox.width, height: oldBox.height };
          }}
        />
      )}
    </>
  );
};

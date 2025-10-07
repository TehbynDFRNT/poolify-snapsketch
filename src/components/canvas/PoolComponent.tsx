import { useEffect, useRef } from 'react';
import { Group, Line, Text, Circle, Rect } from 'react-konva';
import { Component } from '@/types';
import { POOL_LIBRARY } from '@/constants/pools';
import { calculatePoolCoping } from '@/utils/copingCalculation';
import { useDesignStore } from '@/store/designStore';
import { snapPoolToPaverGrid } from '@/utils/snap';

interface PoolComponentProps {
  component: Component;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (pos: { x: number; y: number }) => void;
}

export const PoolComponent = ({ component, isSelected, onSelect, onDragEnd }: PoolComponentProps) => {
  const groupRef = useRef<any>(null);
  const allComponents = useDesignStore(state => state.components);

  // Find the pool from the library
  const poolData = POOL_LIBRARY.find(p => p.id === component.properties.poolId) || POOL_LIBRARY[0];
  
  // Scale down from mm to canvas units (1 unit = 10mm for better display)
  const scale = 0.1;
  const scaledOutline = poolData.outline.map(p => ({ x: p.x * scale, y: p.y * scale }));
  const points = scaledOutline.flatMap(p => [p.x, p.y]);

  // Calculate coping if enabled
  const showCoping = component.properties.showCoping ?? false;
  const copingCalc = showCoping && poolData ? calculatePoolCoping(poolData) : null;

  const handleDragEnd = (e: any) => {
    const newPos = { x: e.target.x(), y: e.target.y() };
    
    // Snap to paver grid if inside a paving area
    const snappedPos = snapPoolToPaverGrid(
      newPos,
      { length: poolData.length, width: poolData.width },
      allComponents
    );
    
    // Update the position on the Konva node for immediate visual feedback
    e.target.x(snappedPos.x);
    e.target.y(snappedPos.y);
    
    onDragEnd(snappedPos);
  };

  return (
    <Group
      ref={groupRef}
      x={component.position.x}
      y={component.position.y}
      rotation={component.rotation}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={handleDragEnd}
    >
      {/* Render coping FIRST (so it's behind the pool) */}
      {showCoping && copingCalc && (
        <Group>
          {/* Render all coping pavers */}
          {[
            ...copingCalc.deepEnd.paverPositions,
            ...copingCalc.shallowEnd.paverPositions,
            ...copingCalc.leftSide.paverPositions,
            ...copingCalc.rightSide.paverPositions,
          ].map((paver, index) => (
            <Rect
              key={`coping-${index}`}
              x={paver.x * scale}
              y={paver.y * scale}
              width={paver.width * scale}
              height={paver.height * scale}
              fill="#9CA3AF"
              stroke="#6B7280"
              strokeWidth={0.5}
              dash={paver.isPartial ? [2, 2] : undefined}
              opacity={paver.isPartial ? 0.8 : 1}
            />
          ))}
        </Group>
      )}

      {/* Pool outline - filled */}
      <Line
        points={points}
        fill="rgba(59, 130, 246, 0.3)"
        stroke="#3B82F6"
        strokeWidth={2}
        closed
      />

      {/* Deep End label (150mm inset) */}
      <Text
        x={poolData.deepEnd.x * scale}
        y={poolData.deepEnd.y * scale}
        text="DE"
        fontSize={10}
        fontStyle="bold"
        fill="#1e40af"
        align="center"
        offsetX={10}
        offsetY={5}
        rotation={-component.rotation}
      />

      {/* Shallow End label (150mm inset) */}
      <Text
        x={poolData.shallowEnd.x * scale}
        y={poolData.shallowEnd.y * scale}
        text="SE"
        fontSize={10}
        fontStyle="bold"
        fill="#1e40af"
        align="center"
        offsetX={10}
        offsetY={5}
        rotation={-component.rotation}
      />

      {/* Selection border */}
      {isSelected && (
        <Rect
          x={-10}
          y={-10}
          width={poolData.length * scale + 20}
          height={poolData.width * scale + 20}
          stroke="#3B82F6"
          strokeWidth={2}
          dash={[10, 5]}
        />
      )}

      {/* Snap anchor indicator - green dot at origin (snap point) */}
      <Circle
        x={0}
        y={0}
        radius={6}
        fill="#22c55e"
        stroke="#166534"
        strokeWidth={2}
      />
    </Group>
  );
};

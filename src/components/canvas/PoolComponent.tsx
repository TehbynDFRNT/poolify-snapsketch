import { useRef, useState } from 'react';
import { Group, Line, Text, Circle, Rect } from 'react-konva';
import { Component } from '@/types';
import { POOL_LIBRARY } from '@/constants/pools';
import { calculatePoolCoping } from '@/utils/copingCalculation';
import { useDesignStore } from '@/store/designStore';
import { snapPoolToPaverGrid } from '@/utils/snap';
import { 
  initialCopingEdgesState,
  onDragStart,
  onDragMove,
  onDragEnd as copingDragEnd,
  type DragSession
} from '@/interaction/CopingExtendController';
import type { CopingEdgeId, PaverRect } from '@/types/copingInteractive';
import { getBaseRowsForEdge } from '@/utils/copingInteractiveExtend';
import Konva from 'konva';

interface PoolComponentProps {
  component: Component;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (pos: { x: number; y: number }) => void;
}

export const PoolComponent = ({ component, isSelected, onSelect, onDragEnd }: PoolComponentProps) => {
  const groupRef = useRef<any>(null);
  const { components: allComponents, updateComponent } = useDesignStore();
  const [dragSession, setDragSession] = useState<DragSession | null>(null);
  const [previewPavers, setPreviewPavers] = useState<PaverRect[]>([]);

  // Prefer embedded pool geometry to avoid library mismatches
  const poolData = (component.properties as any).pool ||
    POOL_LIBRARY.find(p => p.id === component.properties.poolId) ||
    POOL_LIBRARY[0];
  
  // Scale down from mm to canvas units (1 unit = 10mm for better display)
  const scale = 0.1;
  const scaledOutline = poolData.outline.map(p => ({ x: p.x * scale, y: p.y * scale }));
  const points = scaledOutline.flatMap(p => [p.x, p.y]);

  // Calculate coping if enabled
  const showCoping = component.properties.showCoping ?? false;
  const copingConfig = component.properties.copingConfig;
  const copingCalc = showCoping && poolData 
    ? calculatePoolCoping(poolData, copingConfig)
    : null;

  // Interactive coping mode
  const interactiveMode = component.properties.copingMode === 'interactive';
  const copingEdges = component.properties.copingEdges || (copingConfig ? initialCopingEdgesState(copingConfig) : null);

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

  // Interactive edge extension handlers
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);

  const handleEdgeDragStart = (edge: CopingEdgeId, e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!copingEdges || !copingConfig) return;
    e.cancelBubble = true;

    // Disable dragging of the whole pool while resizing via handle
    if (groupRef.current) {
      try { groupRef.current.draggable(false); } catch {}
    }
    
    const stage = e.target.getStage();
    if (!stage) return;
    
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    
    setDragStartPos(pointerPos);
    const session = onDragStart(edge, copingEdges);
    setDragSession(session);
  };

  const handleEdgeDragMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!dragSession || !copingEdges || !copingConfig || !dragStartPos) return;
    
    const stage = e.target.getStage();
    if (!stage) return;
    
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    
    // Calculate drag delta in world space (canvas units)
    const deltaX = pointerPos.x - dragStartPos.x;
    const deltaY = pointerPos.y - dragStartPos.y;
    
    // Project delta onto edge's outward normal in pool space
    const rotation = (component.rotation * Math.PI) / 180;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    
    // Determine edge normal in pool-local space
    let localNormalX = 0, localNormalY = 0;
    if (dragSession.edge === 'leftSide') { localNormalX = -1; localNormalY = 0; }
    else if (dragSession.edge === 'rightSide') { localNormalX = 1; localNormalY = 0; }
    else if (dragSession.edge === 'shallowEnd') { localNormalX = 0; localNormalY = -1; }
    else { localNormalX = 0; localNormalY = 1; }
    
    // Transform normal to world space
    const worldNormalX = localNormalX * cos - localNormalY * sin;
    const worldNormalY = localNormalX * sin + localNormalY * cos;
    
    // Project delta onto normal
    const dragDistance = (deltaX * worldNormalX + deltaY * worldNormalY) / scale; // Convert canvas units to mm
    
    if (dragDistance < 0) return; // Only allow outward dragging
    
    const preview = onDragMove(
      dragSession, 
      dragDistance, 
      poolData, 
      component,
      copingConfig, 
      copingEdges,
      allComponents
    );
    
    // Generate preview pavers for visual feedback
    const { buildExtensionRowsForEdge } = require('@/utils/copingInteractiveExtend');
    const newPreviewPavers = buildExtensionRowsForEdge(
      dragSession.edge,
      poolData,
      copingConfig,
      copingEdges,
      preview.fullRowsToAdd,
      preview.hasCutRow,
      preview.cutRowDepth
    );
    setPreviewPavers(newPreviewPavers);
  };

  const handleEdgeDragEnd = () => {
    // Re-enable dragging of the whole pool after handle interaction
    if (groupRef.current) {
      try { groupRef.current.draggable(true); } catch {}
    }

    if (!dragSession || !copingEdges || !copingConfig) {
      setDragSession(null);
      setPreviewPavers([]);
      setDragStartPos(null);
      return;
    }
    
    const { newEdgesState } = copingDragEnd(dragSession, poolData, copingConfig, copingEdges);
    updateComponent(component.id, {
      properties: {
        ...component.properties,
        copingEdges: newEdgesState,
      }
    });
    setDragSession(null);
    setPreviewPavers([]);
    setDragStartPos(null);
  };

  return (
    <>
      {/* Pool group with local coordinates */}
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

      {/* Render coping (always when enabled) */}
      {showCoping && copingCalc && !interactiveMode && (
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
              fill={paver.isPartial ? "#FCD34D" : "#9CA3AF"}
              stroke="#374151"
              strokeWidth={2}
              dash={paver.isPartial ? [5, 5] : undefined}
              opacity={paver.isPartial ? 0.8 : 1}
            />
          ))}
        </Group>
      )}

      {/* Interactive coping mode */}
      {interactiveMode && copingEdges && copingCalc && (
        <Group>
          {/* Base coping from calculation */}
          {[
            ...copingCalc.deepEnd.paverPositions,
            ...copingCalc.shallowEnd.paverPositions,
            ...copingCalc.leftSide.paverPositions,
            ...copingCalc.rightSide.paverPositions,
          ].map((paver, index) => (
            <Rect
              key={`base-coping-${index}`}
              x={paver.x * scale}
              y={paver.y * scale}
              width={paver.width * scale}
              height={paver.height * scale}
              fill={paver.isPartial ? "#FCD34D" : "#9CA3AF"}
              stroke="#374151"
              strokeWidth={2}
              dash={paver.isPartial ? [5, 5] : undefined}
              opacity={paver.isPartial ? 0.8 : 1}
            />
          ))}
          
          {/* Extension pavers from edges */}
          {Object.entries(copingEdges).map(([edge, state]: [string, any]) => 
            ((state.pavers || []) as PaverRect[]).map((paver, i) => (
              <Rect
                key={`ext-${edge}-${i}`}
                x={paver.x * scale}
                y={paver.y * scale}
                width={paver.width * scale}
                height={paver.height * scale}
                fill={paver.isPartial ? "#FCD34D" : "#D1D5DB"}
                stroke="#374151"
                strokeWidth={2}
                dash={paver.isPartial ? [5, 5] : undefined}
                opacity={0.9}
              />
            ))
          )}

          {/* Preview pavers during drag */}
          {previewPavers.map((paver, i) => (
            <Rect
              key={`preview-${i}`}
              x={paver.x * scale}
              y={paver.y * scale}
              width={paver.width * scale}
              height={paver.height * scale}
              fill={paver.isPartial ? "#FCD34D" : "#93C5FD"}
              stroke="#3B82F6"
              strokeWidth={2}
              dash={[5, 5]}
              opacity={0.7}
            />
          ))}

          {/* Edge drag handles when selected - positioned at outer edge of coping */}
          {isSelected && copingConfig && copingEdges && (
            <>
              {/* Left side handle - at outer edge */}
              <Rect
                x={-(copingEdges.leftSide.currentRows * copingConfig.depth + 20) * scale}
                y={poolData.width * scale / 2 - 20}
                width={20}
                height={40}
                fill="#3B82F6"
                opacity={0.8}
                cornerRadius={4}
                strokeWidth={2}
                stroke="#1D4ED8"
                onMouseEnter={(e) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = 'ew-resize';
                }}
                onMouseLeave={(e) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = 'default';
                }}
                onMouseDown={(e) => {
                  e.cancelBubble = true;
                  handleEdgeDragStart('leftSide', e);
                }}
                listening
              />
              {/* Right side handle - at outer edge */}
              <Rect
                x={(poolData.length + copingEdges.rightSide.currentRows * copingConfig.depth) * scale}
                y={poolData.width * scale / 2 - 20}
                width={20}
                height={40}
                fill="#3B82F6"
                opacity={0.8}
                cornerRadius={4}
                strokeWidth={2}
                stroke="#1D4ED8"
                onMouseEnter={(e) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = 'ew-resize';
                }}
                onMouseLeave={(e) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = 'default';
                }}
                onMouseDown={(e) => {
                  e.cancelBubble = true;
                  handleEdgeDragStart('rightSide', e);
                }}
                listening
              />
              {/* Shallow end handle - at outer edge */}
              <Rect
                x={poolData.length * scale / 2 - 20}
                y={-(copingEdges.shallowEnd.currentRows * copingConfig.depth + 20) * scale}
                width={40}
                height={20}
                fill="#3B82F6"
                opacity={0.8}
                cornerRadius={4}
                strokeWidth={2}
                stroke="#1D4ED8"
                onMouseEnter={(e) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = 'ns-resize';
                }}
                onMouseLeave={(e) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = 'default';
                }}
                onMouseDown={(e) => {
                  e.cancelBubble = true;
                  handleEdgeDragStart('shallowEnd', e);
                }}
                listening
              />
              {/* Deep end handle - at outer edge */}
              <Rect
                x={poolData.length * scale / 2 - 20}
                y={(poolData.width + copingEdges.deepEnd.currentRows * copingConfig.depth) * scale}
                width={40}
                height={20}
                fill="#3B82F6"
                opacity={0.8}
                cornerRadius={4}
                strokeWidth={2}
                stroke="#1D4ED8"
                onMouseEnter={(e) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = 'ns-resize';
                }}
                onMouseLeave={(e) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = 'default';
                }}
                onMouseDown={(e) => {
                  e.cancelBubble = true;
                  handleEdgeDragStart('deepEnd', e);
                }}
                listening
              />
            </>
          )}

          {/* Global mouse move handler when dragging */}
          {dragSession && (
            <Rect
              x={-10000}
              y={-10000}
              width={20000}
              height={20000}
              fill="transparent"
              onMouseMove={handleEdgeDragMove}
              onMouseUp={handleEdgeDragEnd}
              listening
            />
          )}
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
    </>
  );
};

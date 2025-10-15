import { useRef, useState, useMemo } from 'react';
import { Group, Line, Text, Circle, Rect } from 'react-konva';
import { Component } from '@/types';
import { POOL_LIBRARY } from '@/constants/pools';
import { calculatePoolCoping } from '@/utils/copingCalculation';
import { useDesignStore } from '@/store/designStore';
import { snapPoolToPaverGrid } from '@/utils/snap';
import { generateCopingPaverData } from '@/utils/copingPaverData';
import { copingSelectionController } from '@/interaction/CopingPaverSelection';
import { CopingPaverComponent } from './CopingPaverComponent';
import { CornerDirectionPicker } from './CornerDirectionPicker';
import type { CopingPaverData } from '@/types/copingSelection';

interface PoolComponentProps {
  component: Component;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (pos: { x: number; y: number }) => void;
}

export const PoolComponent = ({ component, isSelected, onSelect, onDragEnd }: PoolComponentProps) => {
  const groupRef = useRef<any>(null);
  const { components: allComponents, updateComponent } = useDesignStore();

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

  // Selection state for paver-based extension
  const [copingSelection, setCopingSelection] = useState<{
    selectedIds: Set<string>;
    showCornerPicker: { paverId: string; position: { x: number; y: number } } | null;
    dragState: { 
      startPos: { x: number; y: number }; 
      currentDragDistance: number;
      previewPavers: CopingPaverData[];
    } | null;
  }>({
    selectedIds: new Set(),
    showCornerPicker: null,
    dragState: null,
  });

  // Generate base coping paver data
  const baseCopingPavers = useMemo(() => {
    if (!showCoping || !copingCalc || !poolData || !copingConfig) return [];
    return generateCopingPaverData(poolData, copingConfig);
  }, [showCoping, copingCalc, poolData, copingConfig]);

  // Get extension pavers from component properties
  const extensionPavers: CopingPaverData[] = useMemo(() => {
    const stored = component.properties.copingSelection?.extensionPavers || [];
    return stored.map(p => ({
      ...p,
      edge: p.edge as 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd',
      extensionDirection: p.extensionDirection as 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd' | undefined,
    }));
  }, [component.properties.copingSelection]);

  // Get corner direction overrides
  const cornerOverrides = useMemo(() => {
    const overrides = component.properties.copingSelection?.cornerDirectionOverrides || [];
    return new Map(overrides as Array<[string, 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd']>);
  }, [component.properties.copingSelection]);

  // All pavers (base + extensions)
  const allPavers = useMemo(() => {
    return [...baseCopingPavers, ...extensionPavers];
  }, [baseCopingPavers, extensionPavers]);

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

  // Paver selection handlers
  const handlePaverSelect = (paverId: string, isMultiSelect: boolean) => {
    const paver = allPavers.find(p => p.id === paverId);
    if (!paver) return;
    
    // Handle corner pavers - show direction picker (only for base pavers, not extensions)
    if (paver.isCorner && !isMultiSelect && !paver.extensionDirection) {
      // Calculate screen position for picker
      const stage = groupRef.current?.getStage();
      if (!stage) return;
      
      const transform = groupRef.current.getAbsoluteTransform();
      const paverCenter = transform.point({
        x: (paver.x + paver.width / 2) * scale,
        y: (paver.y + paver.height / 2) * scale,
      });
      
      setCopingSelection(prev => ({
        ...prev,
        showCornerPicker: { paverId, position: paverCenter }
      }));
      return;
    }
    
    // Toggle selection
    const newSelected = copingSelectionController.toggleSelection(
      paverId,
      copingSelection.selectedIds,
      isMultiSelect
    );
    
    setCopingSelection(prev => ({
      ...prev,
      selectedIds: newSelected,
    }));
  };

  // Handle corner direction selection
  const handleCornerDirectionSelect = (direction: 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd') => {
    if (!copingSelection.showCornerPicker) return;
    
    const paverId = copingSelection.showCornerPicker.paverId;
    
    // Update corner overrides
    const newOverrides = new Map(cornerOverrides);
    newOverrides.set(paverId, direction);
    
    // Save to component properties
    updateComponent(component.id, {
      properties: {
        ...component.properties,
        copingSelection: {
          ...component.properties.copingSelection,
          selectedPaverIds: [paverId],
          extensionPavers: extensionPavers,
          cornerDirectionOverrides: Array.from(newOverrides.entries()),
        }
      }
    });
    
    // Select the paver and close picker
    setCopingSelection({
      selectedIds: new Set([paverId]),
      showCornerPicker: null,
      dragState: null,
    });
  };

  // Drag handlers for extension
  const handlePaverDragStart = (e: any) => {
    const stage = e.target.getStage();
    if (!stage) return;
    
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    
    setCopingSelection(prev => ({
      ...prev,
      dragState: { startPos: pointerPos, currentDragDistance: 0, previewPavers: [] }
    }));
  };

  const handlePaverDragMove = (e: any) => {
    if (!copingSelection.dragState || !copingConfig) return;
    
    const stage = e.target.getStage();
    if (!stage) return;
    
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    
    // Calculate drag distance
    const deltaX = pointerPos.x - copingSelection.dragState.startPos.x;
    const deltaY = pointerPos.y - copingSelection.dragState.startPos.y;
    const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / scale; // Convert to mm
    
    // Get selected pavers
    const selectedPavers = copingSelectionController.getSelectedPavers(
      copingSelection.selectedIds,
      allPavers
    );
    
    if (!copingSelectionController.canExtend(selectedPavers)) return;
    
    // Calculate extension
    const { newPavers } = copingSelectionController.calculateExtensionRow(
      selectedPavers,
      dragDistance,
      copingConfig,
      poolData,
      cornerOverrides
    );
    
    setCopingSelection(prev => ({
      ...prev,
      dragState: {
        ...prev.dragState!,
        currentDragDistance: dragDistance,
        previewPavers: newPavers,
      }
    }));
  };

  const handlePaverDragEnd = () => {
    if (!copingSelection.dragState) return;
    
    const { previewPavers } = copingSelection.dragState;
    
    if (previewPavers.length > 0) {
      // Save extension pavers to component properties
      const newExtensionPavers = [...extensionPavers, ...previewPavers];
      
      updateComponent(component.id, {
        properties: {
          ...component.properties,
          copingSelection: {
            ...component.properties.copingSelection,
            selectedPaverIds: [],
            extensionPavers: newExtensionPavers.map(p => ({
              id: p.id,
              x: p.x,
              y: p.y,
              width: p.width,
              height: p.height,
              isPartial: p.isPartial,
              edge: p.edge,
              rowIndex: p.rowIndex,
              columnIndex: p.columnIndex,
              isCorner: p.isCorner,
              extensionDirection: p.extensionDirection,
            })),
            cornerDirectionOverrides: Array.from(cornerOverrides.entries()),
          }
        }
      });
    }
    
    // Clear selection and drag state
    setCopingSelection({
      selectedIds: new Set(),
      showCornerPicker: null,
      dragState: null,
    });
  };

  return (
    <>
      {/* Pool group with local coordinates */}
      <Group
        ref={groupRef}
        x={component.position.x}
        y={component.position.y}
        rotation={component.rotation}
        draggable={!copingSelection.dragState}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={handleDragEnd}
      >
        {/* Render coping pavers with selection capability */}
        {showCoping && isSelected && allPavers.map(paver => (
          <CopingPaverComponent
            key={paver.id}
            paver={paver}
            isSelected={copingSelection.selectedIds.has(paver.id)}
            scale={scale}
            onSelect={handlePaverSelect}
          />
        ))}

        {/* Render coping pavers without selection when not selected */}
        {showCoping && !isSelected && copingCalc && (
          <Group>
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
                listening={false}
              />
            ))}
            
            {/* Render extension pavers */}
            {extensionPavers.map(paver => (
              <Rect
                key={paver.id}
                x={paver.x * scale}
                y={paver.y * scale}
                width={paver.width * scale}
                height={paver.height * scale}
                fill={paver.isPartial ? "#FCD34D" : "#D1D5DB"}
                stroke="#374151"
                strokeWidth={2}
                dash={paver.isPartial ? [5, 5] : undefined}
                opacity={0.9}
                listening={false}
              />
            ))}
          </Group>
        )}

        {/* Preview pavers during drag */}
        {copingSelection.dragState?.previewPavers.map(paver => (
          <CopingPaverComponent
            key={`preview-${paver.id}`}
            paver={paver}
            isSelected={false}
            scale={scale}
            onSelect={() => {}}
            isPreview
          />
        ))}

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
        
        {/* Visible drag area for multi-paver drag with instructions */}
        {copingSelection.selectedIds.size > 0 && isSelected && (
          <>
            <Rect
              x={-10}
              y={-10}
              width={poolData.length * scale + 20}
              height={poolData.width * scale + 20}
              fill="rgba(59, 130, 246, 0.1)"
              stroke="#3B82F6"
              strokeWidth={2}
              dash={[10, 5]}
              draggable
              onDragStart={handlePaverDragStart}
              onDragMove={handlePaverDragMove}
              onDragEnd={handlePaverDragEnd}
              onMouseEnter={(e) => {
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = 'move';
              }}
              onMouseLeave={(e) => {
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = 'default';
              }}
            />
            <Text
              x={poolData.length * scale / 2}
              y={poolData.width * scale / 2}
              text="⬆️ Drag pool to extend selected pavers"
              fontSize={14}
              fontStyle="bold"
              fill="#3B82F6"
              align="center"
              offsetX={100}
              rotation={-component.rotation}
            />
          </>
        )}
      </Group>

      {/* Corner direction picker (outside pool group for proper positioning) */}
      {copingSelection.showCornerPicker && (
        <CornerDirectionPicker
          paver={allPavers.find(p => p.id === copingSelection.showCornerPicker.paverId)!}
          position={copingSelection.showCornerPicker.position}
          onSelectDirection={handleCornerDirectionSelect}
          onCancel={() => setCopingSelection(prev => ({ ...prev, showCornerPicker: null }))}
        />
      )}
    </>
  );
};

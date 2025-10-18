import { useRef, useState, useMemo, useEffect } from 'react';
import { Group, Line, Text, Circle, Rect } from 'react-konva';
import { Component } from '@/types';
import { POOL_LIBRARY } from '@/constants/pools';
import { calculatePoolCoping, type CopingConfig } from '@/utils/copingCalculation';
import { useDesignStore } from '@/store/designStore';
import { snapPoolToPaverGrid } from '@/utils/snap';
import { generateCopingPaverData } from '@/utils/copingPaverData';
import { copingSelectionController } from '@/interaction/CopingPaverSelection';
import { CopingPaverComponent } from './CopingPaverComponent';
import type { CopingPaverData } from '@/types/copingSelection';
import { 
  onDragStart as copingExtendDragStart, 
  onDragMove as copingExtendDragMove, 
  onDragEnd as copingExtendDragEnd, 
  initialCopingEdgesState,
  type DragSession
} from '@/interaction/CopingExtendController';
import type { DragPreview, CopingEdgesState, PaverRect } from '@/types/copingInteractive';

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
  const normalizedCopingConfig = useMemo((): CopingConfig | undefined => {
    const cfg: any = copingConfig;
    if (!cfg) return undefined;
    const tile = cfg.tile || {};
    if ('along' in tile || 'inward' in tile) {
      return {
        id: cfg.id,
        name: cfg.name,
        tile: { x: tile.along ?? 400, y: tile.inward ?? 400 },
        rows: cfg.rows,
      } as CopingConfig;
    }
    return cfg as CopingConfig;
  }, [copingConfig]);
  const copingCalc = showCoping && poolData 
    ? calculatePoolCoping(poolData, copingConfig)
    : null;

  // Selection state for paver-based extension
  const [copingSelection, setCopingSelection] = useState<{
    selectedIds: Set<string>;
    dragState: { 
      session: DragSession;
      preview: DragPreview;
      previewPavers: PaverRect[];
    } | null;
  }>({
    selectedIds: new Set(),
    dragState: null,
  });

  // Initialize or retrieve edge states from component properties
  const getEdgesState = (): CopingEdgesState => {
    const stored = component.properties.copingEdgesState;
    if (stored) return stored as CopingEdgesState;
    if (normalizedCopingConfig) return initialCopingEdgesState(normalizedCopingConfig);
    return {
      leftSide: { currentRows: 1 },
      rightSide: { currentRows: 1 },
      shallowEnd: { currentRows: 1 },
      deepEnd: { currentRows: 2 },
    };
  };

  // Generate base coping paver data
  const baseCopingPavers = useMemo(() => {
    if (!showCoping || !copingCalc || !poolData || !copingConfig) return [];
    return generateCopingPaverData(poolData, copingConfig);
  }, [showCoping, copingCalc, poolData, copingConfig]);

  // Get deletion data
  const deletedPaverIds = useMemo(() => {
    return new Set(component.properties.copingSelection?.deletedPaverIds || []);
  }, [component.properties.copingSelection]);

  const deletedRows = useMemo(() => {
    return component.properties.copingSelection?.deletedRows || [];
  }, [component.properties.copingSelection]);

  // Get extension pavers from component properties (filtered by deletions)
  const extensionPavers: CopingPaverData[] = useMemo(() => {
    const stored = component.properties.copingSelection?.extensionPavers || [];
    // Normalize, filter deletions, then de-duplicate by id to avoid React key collisions
    const filtered = stored
      .map(p => ({
        ...p,
        edge: p.edge as 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd',
        extensionDirection: p.extensionDirection as 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd' | undefined,
      }))
      .filter(p => {
        if (deletedPaverIds.has(p.id)) return false;
        if (deletedRows.some(dr => dr.edge === p.edge && dr.rowIndex === p.rowIndex)) return false;
        return true;
      });

    // De-dupe by id (keep the last occurrence)
    const map = new Map<string, CopingPaverData>();
    filtered.forEach(p => map.set(p.id, p));
    return Array.from(map.values());
  }, [component.properties.copingSelection, deletedPaverIds, deletedRows]);

  // Get corner direction overrides
  const cornerOverrides = useMemo(() => {
    const overrides = component.properties.copingSelection?.cornerDirectionOverrides || [];
    return new Map(overrides as Array<[string, 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd']>);
  }, [component.properties.copingSelection]);

  // All pavers (base + extensions, filtered by deletions)
  const allPavers = useMemo(() => {
    const base = baseCopingPavers.filter(p => {
      // Filter out deleted pavers
      if (deletedPaverIds.has(p.id)) return false;
      // Filter out pavers in deleted rows
      if (deletedRows.some(dr => dr.edge === p.edge && dr.rowIndex === p.rowIndex)) return false;
      return true;
    });
    return [...base, ...extensionPavers];
  }, [baseCopingPavers, extensionPavers, deletedPaverIds, deletedRows]);

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
    
    // Toggle selection immediately (including corner pavers)
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

  // Row selection handler (for double-click)
  const handleRowSelect = (edge: string, rowIndex: number) => {
    // Find all pavers in the same row on the same edge
    const rowPavers = allPavers.filter(p => p.edge === edge && p.rowIndex === rowIndex);
    const rowPaverIds = new Set(rowPavers.map(p => p.id));
    
    console.log('Row selection:', { edge, rowIndex, count: rowPaverIds.size });
    
    setCopingSelection(prev => ({
      ...prev,
      selectedIds: rowPaverIds,
    }));
  };

  // Handle drag handlers for individual paver handles
  const handlePaverHandleDragStart = (paverId: string, direction?: 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd') => {
    if (!direction || !normalizedCopingConfig || !poolData) return;
    
    const edgesState = getEdgesState();
    const session = copingExtendDragStart(direction, edgesState);
    
    setCopingSelection(prev => ({
      ...prev,
      dragState: { 
        session,
        preview: { 
          edge: direction, 
          fullRowsToAdd: 0, 
          hasCutRow: false, 
          reachedBoundary: false,
          dragDistance: 0,
          maxDistance: 0
        },
        previewPavers: []
      }
    }));
  };

  const handlePaverHandleDragMove = (paverId: string, dragDistance: number, direction?: 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd') => {
    if (!copingSelection.dragState || !normalizedCopingConfig || !poolData) return;
    
    const { session } = copingSelection.dragState;
    const edgesState = getEdgesState();
    
    // Convert pool data to Pool type expected by copingExtendDragMove
    const pool = {
      length: poolData.length,
      width: poolData.width,
      outline: poolData.outline,
    };
    
    // Call boundary-aware drag move
    const preview = copingExtendDragMove(
      session,
      dragDistance,
      pool,
      component,
      normalizedCopingConfig,
      edgesState,
      allComponents
    );
    
    console.log('🎯 Boundary-aware drag:', {
      edge: preview.edge,
      dragDistance: preview.dragDistance,
      maxDistance: preview.maxDistance,
      fullRowsToAdd: preview.fullRowsToAdd,
      hasCutRow: preview.hasCutRow,
      cutRowDepth: preview.cutRowDepth,
      reachedBoundary: preview.reachedBoundary,
      boundaryId: preview.boundaryId
    });
    
    // Build preview pavers from the drag preview
    // For now, create simple preview rectangles
    const previewPavers: PaverRect[] = [];
    
    // Add full rows
    const isLengthAxis = preview.edge === 'leftSide' || preview.edge === 'rightSide';
    const along = isLengthAxis ? normalizedCopingConfig!.tile.x : normalizedCopingConfig!.tile.y;
    const rowDepth = isLengthAxis ? normalizedCopingConfig!.tile.y : normalizedCopingConfig!.tile.x;
    for (let i = 0; i < preview.fullRowsToAdd; i++) {
      previewPavers.push({
        x: 0, // Will be calculated properly in final implementation
        y: 0,
        width: along,
        height: rowDepth,
        isPartial: false,
        meta: {
          edge: preview.edge,
          rowIndex: edgesState[preview.edge].currentRows + i,
        }
      });
    }
    
    // Add cut row if present
    if (preview.hasCutRow && preview.cutRowDepth) {
      previewPavers.push({
        x: 0,
        y: 0,
        width: (preview.edge === 'leftSide' || preview.edge === 'rightSide') ? normalizedCopingConfig.tile.x : normalizedCopingConfig.tile.y,
        height: preview.cutRowDepth,
        isPartial: true,
        meta: {
          edge: preview.edge,
          rowIndex: edgesState[preview.edge].currentRows + preview.fullRowsToAdd,
          isBoundaryCutRow: true,
        }
      });
    }
    
    setCopingSelection(prev => ({
      ...prev,
      dragState: {
        ...prev.dragState!,
        preview,
        previewPavers,
      }
    }));
  };

  const handlePaverHandleDragEnd = (paverId: string) => {
    if (!copingSelection.dragState || !normalizedCopingConfig || !poolData) return;
    
    const { session, preview } = copingSelection.dragState;
    const edgesState = getEdgesState();
    
    // Convert pool data to Pool type
    const pool = {
      length: poolData.length,
      width: poolData.width,
      outline: poolData.outline,
    };
    
    // Finalize the extension with boundary detection
    const result = copingExtendDragEnd(
      session,
      pool,
      normalizedCopingConfig,
      edgesState
    );
    
    console.log('🎯 [DRAG-END] Finalized with boundaries:', {
      edge: preview.edge,
      fullRowsAdded: preview.fullRowsToAdd,
      hasCutRow: preview.hasCutRow,
      reachedBoundary: preview.reachedBoundary,
      boundaryId: preview.boundaryId,
      newPaversCount: result.newPavers.length
    });
    
    // Convert PaverRect[] to CopingPaverData[] for storage
    const newExtensionPavers = result.newPavers.map((p, idx) => ({
      id: `ext-${preview.edge}-${Date.now()}-${idx}`,
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
      isPartial: p.isPartial,
      edge: p.meta?.edge || preview.edge,
      rowIndex: p.meta?.rowIndex || 0,
      columnIndex: idx,
      isCorner: false,
      extensionDirection: preview.edge,
    }));
    
    // Update component with new edges state and extension pavers
    updateComponent(component.id, {
      properties: {
        ...component.properties,
        copingEdgesState: result.newEdgesState,
        copingSelection: {
          ...component.properties.copingSelection,
          selectedPaverIds: [],
          extensionPavers: [...extensionPavers, ...newExtensionPavers].map(p => ({
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
          deletedPaverIds: Array.from(deletedPaverIds),
          deletedRows: deletedRows,
        }
      }
    });
    
    // Clear selection and drag state
    setCopingSelection({
      selectedIds: new Set(),
      dragState: null,
    });
  };

  // Keyboard deletion handler
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isSelected || copingSelection.selectedIds.size === 0) return;
    
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      
      const selectedPavers = Array.from(copingSelection.selectedIds)
        .map(id => allPavers.find(p => p.id === id))
        .filter(p => p !== undefined) as CopingPaverData[];
      
      if (e.shiftKey) {
        // Delete entire rows (Shift+Delete)
        const rowsToDelete = new Set<string>();
        selectedPavers.forEach(paver => {
          rowsToDelete.add(`${paver.edge}-${paver.rowIndex}`);
        });
        
        const newDeletedRows = [
          ...deletedRows,
          ...Array.from(rowsToDelete).map(key => {
            const [edge, rowIndex] = key.split('-');
            return { edge: edge as 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd', rowIndex: parseInt(rowIndex) };
          })
        ];
        
        // Also remove extension pavers in those rows
        const newExtensionPavers = extensionPavers.filter(p => 
          !newDeletedRows.some(dr => dr.edge === p.edge && dr.rowIndex === p.rowIndex)
        );
        
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
              deletedPaverIds: Array.from(deletedPaverIds),
              deletedRows: newDeletedRows,
            }
          }
        });
      } else {
        // Delete individual pavers (Delete/Backspace)
        const newDeletedPaverIds = new Set(deletedPaverIds);
        const newExtensionPavers = [...extensionPavers];
        
        selectedPavers.forEach(paver => {
          // Check if it's an extension paver
          const extIndex = newExtensionPavers.findIndex(p => p.id === paver.id);
          if (extIndex >= 0) {
            // Remove from extension pavers
            newExtensionPavers.splice(extIndex, 1);
          } else {
            // Add to deleted base pavers
            newDeletedPaverIds.add(paver.id);
          }
        });
        
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
              deletedPaverIds: Array.from(newDeletedPaverIds),
              deletedRows: deletedRows,
            }
          }
        });
      }
      
      // Clear selection
      setCopingSelection(prev => ({
        ...prev,
        selectedIds: new Set(),
      }));
    }
  };

  // Add keyboard listener
useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true); // capture to intercept before global
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isSelected, copingSelection.selectedIds, allPavers, extensionPavers, deletedPaverIds, deletedRows]);

  return (
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
            onRowSelect={handleRowSelect}
            onHandleDragStart={handlePaverHandleDragStart}
            onHandleDragMove={handlePaverHandleDragMove}
            onHandleDragEnd={handlePaverHandleDragEnd}
            cornerDirection={cornerOverrides.get(paver.id)}
            poolDimensions={{ length: poolData.length, width: poolData.width }}
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
        {copingSelection.dragState?.previewPavers.map((paver, idx) => (
          <Rect
            key={`preview-${idx}`}
            x={paver.x * scale}
            y={paver.y * scale}
            width={paver.width * scale}
            height={paver.height * scale}
            fill={paver.isPartial ? "#FCD34D" : "#A5F3FC"}
            stroke="#0891B2"
            strokeWidth={2}
            dash={paver.isPartial ? [5, 5] : [10, 5]}
            opacity={0.7}
            listening={false}
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
      </Group>
  );
};

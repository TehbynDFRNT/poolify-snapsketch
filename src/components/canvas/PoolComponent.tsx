import { useRef, useState, useMemo, useEffect } from 'react';
import { Group, Line, Text, Circle, Rect } from 'react-konva';
import { Component } from '@/types';
import { POOL_LIBRARY } from '@/constants/pools';
import { calculatePoolCoping } from '@/utils/copingCalculation';
import { useDesignStore } from '@/store/designStore';
import { snapPoolToPaverGrid } from '@/utils/snap';
import { generateCopingPaverData } from '@/utils/copingPaverData';
import { copingSelectionController } from '@/interaction/CopingPaverSelection';
import { CopingPaverComponent } from './CopingPaverComponent';
import type { CopingPaverData } from '@/types/copingSelection';
import { getNearestBoundaryDistanceFromEdgeOuter, validatePreviewPaversWithBoundaries, getAlongAndDepthForEdge } from '@/utils/copingInteractiveExtend';
import type { CopingEdgesState, CopingEdgeId } from '@/types/copingInteractive';

const GROUT_MM = 3;

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
    dragState: { 
      paverId: string;
      currentDragDistance: number;
      previewPavers: CopingPaverData[];
      edge: CopingEdgeId;
      edgesStateAtStart: CopingEdgesState;
      boundaryDistance?: number;
      boundaryId?: string | null;
    } | null;
  }>({
    selectedIds: new Set(),
    dragState: null,
  });

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

  // Derive runtime edges state from current pool configuration
  const deriveEdgesState = (): CopingEdgesState => {
    if (!copingConfig) {
      return {
        leftSide: { currentRows: 0 },
        rightSide: { currentRows: 0 },
        shallowEnd: { currentRows: 0 },
        deepEnd: { currentRows: 0 },
      };
    }

    const baseRows = copingConfig.rows || { sides: 1, shallow: 1, deep: 1 };
    
    // Calculate max row index for each edge from all pavers
    const maxRowByEdge: Record<CopingEdgeId, number> = {
      leftSide: baseRows.sides - 1,
      rightSide: baseRows.sides - 1,
      shallowEnd: baseRows.shallow - 1,
      deepEnd: baseRows.deep - 1,
    };

    allPavers.forEach(p => {
      const edge = p.edge as CopingEdgeId;
      if (p.rowIndex > maxRowByEdge[edge]) {
        maxRowByEdge[edge] = p.rowIndex;
      }
    });

    return {
      leftSide: { currentRows: maxRowByEdge.leftSide + 1, pavers: [] },
      rightSide: { currentRows: maxRowByEdge.rightSide + 1, pavers: [] },
      shallowEnd: { currentRows: maxRowByEdge.shallowEnd + 1, pavers: [] },
      deepEnd: { currentRows: maxRowByEdge.deepEnd + 1, pavers: [] },
    };
  };

  // Helper to validate preview pavers against boundaries
  const validatePreviewPavers = (
    pavers: CopingPaverData[],
    edge: CopingEdgeId
  ) => {
    if (!poolData || !copingConfig) {
      return { validPavers: pavers, maxValidDistance: 0, hitBoundary: false };
    }
    
    return validatePreviewPaversWithBoundaries(
      pavers,
      component,
      poolData,
      copingConfig,
      allComponents,
      edge
    );
  };

  // Helper to generate cut row pavers after boundary detection
  const generateCutRowPavers = (
    selectedPavers: CopingPaverData[],
    fullRowsAdded: number,
    cutRowDepth: number,
    rowDepth: number,
    cornerOverrides: Map<string, CopingEdgeId>
  ): CopingPaverData[] => {
    const cutPavers: CopingPaverData[] = [];
    const rowSpacing = rowDepth + GROUT_MM;
    
    selectedPavers.forEach(paver => {
      const direction = copingSelectionController.getExtensionDirection(paver, cornerOverrides);
      
      let newX = paver.x;
      let newY = paver.y;
      let width = paver.width;
      let height = paver.height;
      
      // Position after full rows + grout
      const offsetDistance = (fullRowsAdded + 1) * rowSpacing;
      
      switch (direction) {
        case 'deepEnd':
          newX = paver.x + (fullRowsAdded * rowSpacing) + GROUT_MM;
          width = cutRowDepth;
          break;
        case 'shallowEnd':
          newX = paver.x - offsetDistance + (rowSpacing - cutRowDepth);
          width = cutRowDepth;
          break;
        case 'rightSide':
          newY = paver.y + (fullRowsAdded * rowSpacing) + GROUT_MM;
          height = cutRowDepth;
          break;
        case 'leftSide':
          newY = paver.y - offsetDistance + (rowSpacing - cutRowDepth);
          height = cutRowDepth;
          break;
      }
      
      cutPavers.push({
        id: `cut-${direction}-c${paver.columnIndex}-r${paver.rowIndex + fullRowsAdded + 1}`,
        x: newX,
        y: newY,
        width,
        height,
        isPartial: true,
        edge: paver.edge,
        rowIndex: paver.rowIndex + fullRowsAdded + 1,
        columnIndex: paver.columnIndex,
        isCorner: false,
        extensionDirection: direction,
      });
    });
    
    return cutPavers;
  };

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
    // Get selected pavers to determine the edge
    const selectedPavers = allPavers.filter(p => copingSelection.selectedIds.has(p.id));
    if (selectedPavers.length === 0) return;

    const edge = (direction || selectedPavers[0].edge) as CopingEdgeId;
    const edgesStateAtStart = deriveEdgesState();

    console.log('🚀 [DRAG-START] Boundary-aware extension', { 
      edge, 
      currentRows: edgesStateAtStart[edge].currentRows 
    });

    setCopingSelection(prev => ({
      ...prev,
      dragState: { 
        paverId, 
        currentDragDistance: 0, 
        previewPavers: [],
        edge,
        edgesStateAtStart,
      }
    }));
  };

  const handlePaverHandleDragMove = (paverId: string, dragDistance: number, direction?: 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd') => {
    if (!copingSelection.dragState || !copingConfig || !poolData) return;
    
    const { edge, edgesStateAtStart } = copingSelection.dragState;
    
    // Get ALL selected pavers
    const selectedPavers = allPavers.filter(p => copingSelection.selectedIds.has(p.id));
    
    if (selectedPavers.length === 0) return;

    // Check if selected pavers can extend together (same edge + row)
    const canExtend = copingSelectionController.canExtend(selectedPavers);
    if (!canExtend) {
      console.warn('Selected pavers cannot extend together - they must be on the same edge and row');
      return;
    }

    // Normalize coping config to handle both {x,y} and {along,inward} tile formats
    const normalizedConfig = {
      ...copingConfig,
      tile: {
        x: (copingConfig.tile as any).x ?? (copingConfig.tile as any).along ?? 600,
        y: (copingConfig.tile as any).y ?? (copingConfig.tile as any).inward ?? 400,
      }
    };

    // Build temporary override map with the drag direction for ALL selected pavers
    const tempOverrides = new Map(cornerOverrides);
    if (direction) {
      selectedPavers.forEach(p => {
        tempOverrides.set(p.id, direction);
      });
    }
    
    // Calculate extension for ALL selected pavers - generate full preview first
    const { newPavers } = copingSelectionController.calculateExtensionRow(
      selectedPavers,
      dragDistance,
      normalizedConfig,
      poolData,
      tempOverrides
    );
    
    // Now validate the preview pavers against boundaries using polygon detection
    // This is the "generate then validate" approach - much more reliable than ray-casting
    const validation = validatePreviewPavers(newPavers, edge);
    
    // Use validated pavers and max valid distance
    const validatedPavers = validation.validPavers;
    const clampedDistance = validation.hitBoundary ? validation.maxValidDistance : dragDistance;
    
    // If we hit boundary, check if we should add a cut row
    let finalPreviewPavers = validatedPavers;
    if (validation.hitBoundary && poolData && copingConfig) {
      const { rowDepth } = getAlongAndDepthForEdge(edge, normalizedConfig);
      const rowUnit = rowDepth + GROUT_MM;
      
      // Calculate how many full rows fit in maxValidDistance
      const fullRows = Math.floor(validation.maxValidDistance / rowUnit);
      const remainingDistance = validation.maxValidDistance - (fullRows * rowUnit);
      
      // If remaining distance is enough for a cut row, generate it
      const MIN_CUT_ROW = 50; // mm
      if (remainingDistance >= MIN_CUT_ROW) {
        const cutRowDepth = remainingDistance - GROUT_MM;
        if (cutRowDepth >= MIN_CUT_ROW) {
          // Generate cut row pavers
          const cutRowPavers = generateCutRowPavers(
            selectedPavers,
            fullRows,
            cutRowDepth,
            rowDepth,
            tempOverrides
          );
          
          // Validate cut row pavers too
          const cutValidation = validatePreviewPavers(cutRowPavers, edge);
          if (cutValidation.validPavers.length > 0) {
            finalPreviewPavers = [...validatedPavers, ...cutValidation.validPavers];
          }
        }
      }
    }
    
    console.log('🔍 [DRAG-MOVE] Polygon-based boundary detection', { 
      edge,
      rawDragDistance: dragDistance,
      clampedDistance,
      hitBoundary: validation.hitBoundary,
      boundaryId: validation.boundaryId,
      totalPaversGenerated: newPavers.length,
      validPaversCount: validatedPavers.length,
      finalPreviewCount: finalPreviewPavers.length,
    });
    
    setCopingSelection(prev => ({
      ...prev,
      dragState: {
        ...prev.dragState!,
        currentDragDistance: clampedDistance,
        previewPavers: finalPreviewPavers,
        boundaryDistance: validation.hitBoundary ? validation.maxValidDistance : undefined,
        boundaryId: validation.boundaryId,
      }
    }));
  };

  const handlePaverHandleDragEnd = (paverId: string) => {
    if (!copingSelection.dragState || !copingConfig) return;
    
    const { previewPavers, edge, boundaryDistance, boundaryId, currentDragDistance } = copingSelection.dragState;
    
    const MIN_BOUNDARY_CUT_ROW_MM = 100;
    const GROUT_MM = copingConfig.grout || 10;
    
    // Determine row depth based on edge
    const rowDepth = (edge === 'shallowEnd' || edge === 'deepEnd')
      ? ((copingConfig.tile as any).x ?? (copingConfig.tile as any).along ?? 600)
      : ((copingConfig.tile as any).y ?? (copingConfig.tile as any).inward ?? 400);
    
    const rowUnit = rowDepth + GROUT_MM;
    
    console.log('🎯 [DRAG-END] Analyzing cut-row commitment', {
      paverId,
      edge,
      currentDragDistance,
      boundaryDistance,
      rowDepth,
      rowUnit,
    });
    
    let toCommit = previewPavers.filter(p => !p.isPartial);
    
    // If we hit a boundary, check if we should commit a cut row
    if (boundaryDistance !== undefined && boundaryDistance < currentDragDistance + 50) {
      const fullRows = Math.floor(currentDragDistance / rowUnit);
      const remaining = currentDragDistance - (fullRows * rowUnit);
      
      console.log('🔍 [CUT-ROW-CHECK]', {
        fullRows,
        remaining,
        minRequired: MIN_BOUNDARY_CUT_ROW_MM,
        shouldCommitCutRow: remaining >= MIN_BOUNDARY_CUT_ROW_MM,
      });
      
      // If remaining space is >= 100mm, commit the cut row (partial pavers)
      if (remaining >= MIN_BOUNDARY_CUT_ROW_MM) {
        toCommit = [...toCommit, ...previewPavers.filter(p => p.isPartial)];
        console.log('✅ [CUT-ROW-COMMITTED]', { cutRowPaversCount: previewPavers.filter(p => p.isPartial).length });
      }
    }
    
    if (toCommit.length > 0) {
      const newExtensionPavers = [...extensionPavers, ...toCommit];

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
            deletedRows: deletedRows,
          }
        }
      });
      
      console.log('💾 [SAVED]', { totalCommitted: toCommit.length, hasPartials: toCommit.some(p => p.isPartial) });
    }
    
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
        {copingSelection.dragState?.previewPavers.map(paver => (
          <CopingPaverComponent
            key={`preview-${paver.id}`}
            paver={paver}
            isSelected={false}
            scale={scale}
            onSelect={() => {}}
            isPreview
            poolDimensions={{ length: poolData.length, width: poolData.width }}
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

import { CopingPaverData } from '@/types/copingSelection';
import { CopingConfig, Pool } from '@/utils/copingCalculation';
import { getNearestBoundaryDistanceFromEdgeOuter, rowsFromDragDistance } from '@/utils/copingInteractiveExtend';
import type { CopingEdgesState } from '@/utils/copingInteractiveExtend';
import type { BoundaryHit } from '@/utils/copingInteractiveExtend';
import type { Component } from '@/types';

export class CopingPaverSelectionController {
  /**
   * Toggle paver selection
   */
  toggleSelection(
    paverId: string,
    currentSelection: Set<string>,
    isMultiSelect: boolean
  ): Set<string> {
    const newSelection = new Set(currentSelection);
    
    if (isMultiSelect) {
      if (newSelection.has(paverId)) {
        newSelection.delete(paverId);
      } else {
        newSelection.add(paverId);
      }
    } else {
      newSelection.clear();
      newSelection.add(paverId);
    }
    
    return newSelection;
  }
  
  /**
   * Get selected pavers data
   */
  getSelectedPavers(
    selectedIds: Set<string>,
    allPavers: CopingPaverData[]
  ): CopingPaverData[] {
    return allPavers.filter(p => selectedIds.has(p.id));
  }
  
  /**
   * Check if selected pavers can be extended
   * All selected pavers must be from the same row of the same edge
   */
  canExtend(selectedPavers: CopingPaverData[]): boolean {
    if (selectedPavers.length === 0) return false;
    
    // Single paver can always be extended
    if (selectedPavers.length === 1) return true;
    
    const firstPaver = selectedPavers[0];
    const edge = firstPaver.edge;
    const rowIndex = firstPaver.rowIndex;
    
    // Check all pavers are from same edge and row
    return selectedPavers.every(p => p.edge === edge && p.rowIndex === rowIndex);
  }
  
  /**
   * Get extension direction for a paver based on its edge and override
   */
  getExtensionDirection(
    paver: CopingPaverData,
    cornerOverrides: Map<string, 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd'>
  ): 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd' {
    // If already an extension paver, use its extension direction
    if (paver.extensionDirection) {
      return paver.extensionDirection;
    }
    
    // If corner paver and override exists, use override
    if (paver.isCorner && cornerOverrides.has(paver.id)) {
      return cornerOverrides.get(paver.id)!;
    }
    
    // Default: extend in the edge's direction
    return paver.edge;
  }
  
  /**
   * Calculate new row pavers for selected pavers with boundary detection
   * Supports bidirectional extension (positive = outward, negative = inward)
   * Creates partial tiles when hitting boundaries
   */
  calculateExtensionRow(
    selectedPavers: CopingPaverData[],
    dragDistance: number,
    copingConfig: CopingConfig,
    pool: Pool,
    cornerOverrides: Map<string, 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd'>,
    poolComponent?: Component,
    allComponents?: Component[]
  ): { fullRowsToAdd: number; newPavers: CopingPaverData[]; boundaryHit?: BoundaryHit | null } {
    if (!this.canExtend(selectedPavers)) {
      return { fullRowsToAdd: 0, newPavers: [], boundaryHit: null };
    }
    
    const firstPaver = selectedPavers[0];
    const edge = firstPaver.edge;
    
    // Determine row depth based on edge - use paver dimensions directly
    // For sides (leftSide/rightSide), rows stack in Y direction (use height)
    // For ends (shallowEnd/deepEnd), rows stack in X direction (use width)
    const rowDepth = (edge === 'leftSide' || edge === 'rightSide') 
      ? firstPaver.height 
      : firstPaver.width;
    
    // Safety check
    if (!Number.isFinite(rowDepth) || rowDepth <= 0) {
      console.warn('Invalid rowDepth:', rowDepth);
      return { fullRowsToAdd: 0, newPavers: [], boundaryHit: null };
    }
    
    // Check for boundary if components are provided
    let boundaryHit: BoundaryHit | null = null;
    let effectiveDragDistance = dragDistance;
    let hasCutRow = false;
    let cutRowDepth: number | undefined = undefined;
    
    if (poolComponent && allComponents && dragDistance > 0) {
      // Need to build edgesState for boundary detection
      const edgesState: CopingEdgesState = {
        leftSide: { currentRows: copingConfig.rows.sides },
        rightSide: { currentRows: copingConfig.rows.sides },
        shallowEnd: { currentRows: copingConfig.rows.shallow },
        deepEnd: { currentRows: copingConfig.rows.deep },
      };
      
      // Get current row count for this edge (base rows + any existing extensions)
      edgesState[edge].currentRows = firstPaver.rowIndex + 1;
      
      // Detect boundary
      boundaryHit = getNearestBoundaryDistanceFromEdgeOuter(
        edge,
        pool,
        poolComponent,
        copingConfig,
        edgesState,
        allComponents
      );
      
      if (boundaryHit && boundaryHit.distance > 0) {
        effectiveDragDistance = Math.min(dragDistance, boundaryHit.distance);
        
        // Use rowsFromDragDistance to handle partial tiles correctly
        const result = rowsFromDragDistance(
          effectiveDragDistance,
          true, // reachedBoundary
          rowDepth,
          200 // MIN_BOUNDARY_CUT_ROW_MM
        );
        
        console.debug('Boundary detection:', {
          edge,
          boundaryDistance: boundaryHit.distance,
          effectiveDragDistance,
          fullRows: result.fullRowsToAdd,
          hasCutRow: result.hasCutRow,
          cutRowDepth: result.cutRowDepth
        });
        
        hasCutRow = result.hasCutRow;
        cutRowDepth = result.cutRowDepth;
      }
    }
    
    // Calculate how many full rows can fit (allow negative for inward extension)
    const fullRowsToAdd = boundaryHit 
      ? Math.floor(effectiveDragDistance / (rowDepth + 5)) // Include grout spacing
      : Math.floor(dragDistance / rowDepth);
    
    console.debug('Extension calculation:', {
      edge,
      baseRowIndex: firstPaver.rowIndex,
      rowDepth,
      dragDistance,
      effectiveDragDistance,
      fullRowsToAdd,
      hasCutRow,
      cutRowDepth
    });
    
    if (fullRowsToAdd === 0 && !hasCutRow) {
      return { fullRowsToAdd: 0, newPavers: [], boundaryHit };
    }
    
    // Generate new pavers for ALL rows
    const newPavers: CopingPaverData[] = [];
    const baseRowIndex = firstPaver.rowIndex;
    const GROUT_MM = 5;
    
    // Handle both outward (positive) and inward (negative) extension
    const startRow = fullRowsToAdd > 0 ? 1 : fullRowsToAdd;
    const endRow = fullRowsToAdd > 0 ? fullRowsToAdd : -1;
    const step = fullRowsToAdd > 0 ? 1 : -1;
    
    // Loop through each row offset to create all intermediate rows
    for (let rowOffset = startRow; fullRowsToAdd > 0 ? rowOffset <= endRow : rowOffset >= endRow; rowOffset += step) {
      selectedPavers.forEach(paver => {
        const direction = this.getExtensionDirection(paver, cornerOverrides);
        
        // Calculate position for this row RELATIVE to existing paver position
        let newX = paver.x;
        let newY = paver.y;
        const offset = rowOffset * (rowDepth + GROUT_MM);
        
        switch (direction) {
          case 'leftSide':
            newY = paver.y - offset;
            break;
          case 'rightSide':
            newY = paver.y + offset;
            break;
          case 'shallowEnd':
            newX = paver.x - offset;
            break;
          case 'deepEnd':
            newX = paver.x + offset;
            break;
        }
        
        const newPaver: CopingPaverData = {
          id: `ext-${paver.id}-row${baseRowIndex + rowOffset}`,
          x: newX,
          y: newY,
          width: paver.width,
          height: paver.height,
          isPartial: false,
          edge: paver.edge,
          rowIndex: baseRowIndex + rowOffset,
          columnIndex: paver.columnIndex,
          isCorner: false,
          extensionDirection: direction,
        };
        
        newPavers.push(newPaver);
      });
    }
    
    // Add partial row if we hit a boundary
    if (hasCutRow && cutRowDepth && cutRowDepth > 0) {
      selectedPavers.forEach(paver => {
        const direction = this.getExtensionDirection(paver, cornerOverrides);
        
        let newX = paver.x;
        let newY = paver.y;
        const offset = (fullRowsToAdd + 1) * (rowDepth + GROUT_MM);
        
        switch (direction) {
          case 'leftSide':
            newY = paver.y - offset;
            break;
          case 'rightSide':
            newY = paver.y + offset;
            break;
          case 'shallowEnd':
            newX = paver.x - offset;
            break;
          case 'deepEnd':
            newX = paver.x + offset;
            break;
        }
        
        // Partial paver dimensions
        const paverWidth = (direction === 'shallowEnd' || direction === 'deepEnd') 
          ? cutRowDepth 
          : paver.width;
        const paverHeight = (direction === 'leftSide' || direction === 'rightSide')
          ? cutRowDepth
          : paver.height;
        
        const partialPaver: CopingPaverData = {
          id: `ext-${paver.id}-row${baseRowIndex + fullRowsToAdd + 1}-partial`,
          x: newX,
          y: newY,
          width: paverWidth,
          height: paverHeight,
          isPartial: true, // Mark as partial
          edge: paver.edge,
          rowIndex: baseRowIndex + fullRowsToAdd + 1,
          columnIndex: paver.columnIndex,
          isCorner: false,
          extensionDirection: direction,
        };
        
        newPavers.push(partialPaver);
      });
    }
    
    return { fullRowsToAdd, newPavers, boundaryHit };
  }
}

export const copingSelectionController = new CopingPaverSelectionController();

import { CopingPaverData } from '@/types/copingSelection';
import { CopingConfig, Pool } from '@/utils/copingCalculation';

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
   * Calculate new row pavers for selected pavers
   * Supports bidirectional extension (positive = outward, negative = inward)
   */
  calculateExtensionRow(
    selectedPavers: CopingPaverData[],
    dragDistance: number,
    copingConfig: CopingConfig,
    pool: Pool,
    cornerOverrides: Map<string, 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd'>
  ): { fullRowsToAdd: number; newPavers: CopingPaverData[] } {
    if (!this.canExtend(selectedPavers)) {
      return { fullRowsToAdd: 0, newPavers: [] };
    }
    
    const firstPaver = selectedPavers[0];
    const edge = firstPaver.edge;
    
    console.log('🧩 [CALC-EXT] Starting calculation', {
      edge,
      dragDistance,
      paverCount: selectedPavers.length,
      firstPaver: { id: firstPaver.id, x: firstPaver.x, y: firstPaver.y, width: firstPaver.width, height: firstPaver.height }
    });
    
    // Determine row depth based on edge - use paver dimensions directly
    // For sides (leftSide/rightSide), rows stack in Y direction (use height)
    // For ends (shallowEnd/deepEnd), rows stack in X direction (use width)
    const rowDepth = (edge === 'leftSide' || edge === 'rightSide') 
      ? firstPaver.height 
      : firstPaver.width;
    
    console.log('🧩 [ROW-DEPTH]', { edge, rowDepth, paverWidth: firstPaver.width, paverHeight: firstPaver.height });
    
    // Safety check
    if (!Number.isFinite(rowDepth) || rowDepth <= 0) {
      console.warn('Invalid rowDepth:', rowDepth);
      return { fullRowsToAdd: 0, newPavers: [] };
    }
    
    // Calculate how many full rows can fit (allow negative for inward extension)
    const fullRowsToAdd = Math.floor(dragDistance / rowDepth);
    
    console.log('🧩 [ROWS-CALC]', {
      edge,
      baseRowIndex: firstPaver.rowIndex,
      rowDepth,
      dragDistance,
      fullRowsToAdd
    });
    
    if (fullRowsToAdd === 0) {
      return { fullRowsToAdd: 0, newPavers: [] };
    }
    
    // Generate new pavers for ALL rows
    const newPavers: CopingPaverData[] = [];
    const baseRowIndex = firstPaver.rowIndex;
    
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
        
        switch (direction) {
          case 'leftSide':
            newY = paver.y - rowOffset * rowDepth;
            break;
          case 'rightSide':
            newY = paver.y + rowOffset * rowDepth;
            break;
          case 'shallowEnd':
            newX = paver.x - rowOffset * rowDepth;
            break;
          case 'deepEnd':
            newX = paver.x + rowOffset * rowDepth;
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
        
        console.log('🧩 [NEW-PAVER]', {
          edge: paver.edge,
          direction,
          rowOffset,
          basePos: { x: paver.x, y: paver.y },
          newPos: { x: newX, y: newY },
          dimensions: { width: paver.width, height: paver.height }
        });
        
        newPavers.push(newPaver);
      });
    }
    
    console.log('🧩 [CALC-EXT] Complete', { edge, totalNewPavers: newPavers.length, fullRowsToAdd });
    
    return { fullRowsToAdd, newPavers };
  }
}

export const copingSelectionController = new CopingPaverSelectionController();

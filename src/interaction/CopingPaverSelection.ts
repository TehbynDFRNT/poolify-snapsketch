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
    // If corner paver and override exists, use override
    if (paver.isCorner && cornerOverrides.has(paver.id)) {
      return cornerOverrides.get(paver.id)!;
    }
    
    // Default: extend in the edge's direction
    return paver.edge;
  }
  
  /**
   * Calculate new row pavers for selected pavers
   * Returns one new row extending outward from the selected pavers
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
    
    // Determine row depth based on edge - use paver dimensions directly
    // For sides (leftSide/rightSide), rows stack in Y direction (use height)
    // For ends (shallowEnd/deepEnd), rows stack in X direction (use width)
    const rowDepth = (edge === 'leftSide' || edge === 'rightSide') 
      ? firstPaver.height 
      : firstPaver.width;
    
    // Safety check
    if (!Number.isFinite(rowDepth) || rowDepth <= 0) {
      console.warn('Invalid rowDepth:', rowDepth);
      return { fullRowsToAdd: 0, newPavers: [] };
    }
    
    // Calculate how many full rows can fit
    const fullRowsToAdd = Math.max(0, Math.floor(dragDistance / rowDepth));
    
    console.debug('Extension calculation:', {
      edge,
      baseRowIndex: firstPaver.rowIndex,
      rowDepth,
      dragDistance,
      fullRowsToAdd
    });
    
    if (fullRowsToAdd === 0) {
      return { fullRowsToAdd: 0, newPavers: [] };
    }
    
    // Generate new pavers only for the selected columns
    const newPavers: CopingPaverData[] = [];
    const baseRowIndex = firstPaver.rowIndex;
    
    selectedPavers.forEach(paver => {
      const direction = this.getExtensionDirection(paver, cornerOverrides);
      
      // Calculate position for new row RELATIVE to existing paver position
      let newX = paver.x;
      let newY = paver.y;
      
      switch (direction) {
        case 'leftSide':
          newY = paver.y - fullRowsToAdd * rowDepth;
          break;
        case 'rightSide':
          newY = paver.y + fullRowsToAdd * rowDepth;
          break;
        case 'shallowEnd':
          newX = paver.x - fullRowsToAdd * rowDepth;
          break;
        case 'deepEnd':
          newX = paver.x + fullRowsToAdd * rowDepth;
          break;
      }
      
      const newPaver: CopingPaverData = {
        id: `ext-${paver.id}-row${baseRowIndex + fullRowsToAdd}`,
        x: newX,
        y: newY,
        width: paver.width,
        height: paver.height,
        isPartial: false,
        edge: paver.edge,
        rowIndex: baseRowIndex + fullRowsToAdd,
        columnIndex: paver.columnIndex,
        isCorner: false,
        extensionDirection: direction,
      };
      
      newPavers.push(newPaver);
    });
    
    return { fullRowsToAdd, newPavers };
  }
}

export const copingSelectionController = new CopingPaverSelectionController();

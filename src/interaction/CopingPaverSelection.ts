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
    
    // Determine row depth based on edge
    const rowDepth = edge === 'leftSide' || edge === 'rightSide' 
      ? copingConfig.tile.y 
      : copingConfig.tile.x;
    
    // Calculate how many full rows can fit
    const fullRowsToAdd = Math.max(0, Math.floor(dragDistance / rowDepth));
    
    if (fullRowsToAdd === 0) {
      return { fullRowsToAdd: 0, newPavers: [] };
    }
    
    // Generate new pavers only for the selected columns
    const newPavers: CopingPaverData[] = [];
    const baseRowIndex = firstPaver.rowIndex;
    
    selectedPavers.forEach(paver => {
      const direction = this.getExtensionDirection(paver, cornerOverrides);
      
      // Calculate position offset for new row based on direction
      let offsetX = 0;
      let offsetY = 0;
      
      switch (direction) {
        case 'leftSide':
          offsetY = -(baseRowIndex + fullRowsToAdd) * rowDepth;
          break;
        case 'rightSide':
          offsetY = pool.width + (baseRowIndex + fullRowsToAdd) * rowDepth;
          break;
        case 'shallowEnd':
          offsetX = -(baseRowIndex + fullRowsToAdd) * rowDepth;
          break;
        case 'deepEnd':
          offsetX = pool.length + (baseRowIndex + fullRowsToAdd) * rowDepth;
          break;
      }
      
      const newPaver: CopingPaverData = {
        id: `ext-${paver.id}-row${baseRowIndex + fullRowsToAdd}`,
        x: paver.x + offsetX,
        y: paver.y + offsetY,
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

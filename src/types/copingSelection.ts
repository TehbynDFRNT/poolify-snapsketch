export interface CopingPaverData {
  id: string;
  x: number;          // mm (pool-local coords)
  y: number;          // mm
  width: number;      // mm
  height: number;     // mm
  isPartial: boolean;
  edge: 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd';
  rowIndex: number;   // which row from waterline (0 = first row at waterline)
  columnIndex: number; // which paver along the edge
  isCorner: boolean;  // true if paver is at intersection of two edges
  extensionDirection?: 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd'; // for extended pavers
}

export interface CopingSelectionState {
  selectedPaverIds: Set<string>;
  extensionPavers: CopingPaverData[]; // pavers added via extension
  cornerDirectionOverrides: Map<string, 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd'>; // for corner pavers
}

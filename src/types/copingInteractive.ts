// Re-export types from copingCalculation for convenience
export type { Pool, GlobalTile, CopingConfig, AxisPlan } from '../utils/copingCalculation';

export type CopingEdgeId = 'leftSide' | 'rightSide' | 'shallowEnd' | 'deepEnd';

export interface PaverRect {
  x: number;      // mm (pool-local coords)
  y: number;      // mm
  width: number;  // mm (along edge direction)
  height: number; // mm (row depth)
  isPartial: boolean;
  meta?: {
    edge: CopingEdgeId;
    rowIndex: number;      // absolute row index from the waterline for that edge
    isBoundaryCutRow?: boolean; // last row trimmed to boundary
  };
}

export interface CopingEdgeState {
  // Total rows (full rows) currently installed for this edge (including base rows)
  currentRows: number;

  // Optional cut row at the boundary (depth along outward direction, mm)
  cutRowDepth?: number;   // 0 or undefined = none
  reachedBoundary?: boolean;
  boundaryId?: string | null;

  // Generated geometry for extension rows beyond base, not including base rows:
  pavers?: PaverRect[];
}

export interface CopingEdgesState {
  leftSide: CopingEdgeState;
  rightSide: CopingEdgeState;
  shallowEnd: CopingEdgeState;
  deepEnd: CopingEdgeState;
}

export interface DragPreview {
  edge: CopingEdgeId;
  fullRowsToAdd: number;
  hasCutRow: boolean;
  cutRowDepth?: number; // mm
  reachedBoundary: boolean;
  boundaryId?: string | null;
  dragDistance: number; // mm from the edge's current outermost row
  maxDistance: number;  // mm after boundary clamp
}

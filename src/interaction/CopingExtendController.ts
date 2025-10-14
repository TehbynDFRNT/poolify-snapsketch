import type { Component } from '@/types';
import type { Pool, CopingConfig } from '../utils/copingCalculation';
import type {
  CopingEdgesState,
  CopingEdgeId,
  DragPreview,
  PaverRect,
} from '../types/copingInteractive';
import {
  getNearestBoundaryDistanceFromEdgeOuter,
  makeDragPreview,
  buildExtensionRowsForEdge,
} from '../utils/copingInteractiveExtend';

export interface DragSession {
  edge: CopingEdgeId;
  startEdgesState: CopingEdgesState;
  preview?: DragPreview;
}

export function onDragStart(
  edge: CopingEdgeId,
  edgesState: CopingEdgesState
): DragSession {
  return {
    edge,
    startEdgesState: structuredClone(edgesState),
  };
}

export function onDragMove(
  session: DragSession,
  dragDistance: number,
  pool: Pool,
  poolComponent: Component,
  config: CopingConfig,
  edgesState: CopingEdgesState,
  allComponents: Component[]
): DragPreview {
  const boundaryHit = getNearestBoundaryDistanceFromEdgeOuter(
    session.edge, pool, poolComponent, config, edgesState, allComponents
  );
  
  // G) Boundary hit logging
  if (boundaryHit) {
    console.log('[BOUNDARY]', {
      edge: session.edge,
      distance: Math.round(boundaryHit.distance),
      componentId: boundaryHit.componentId,
      intersection: {
        x: Math.round(boundaryHit.intersection.x),
        y: Math.round(boundaryHit.intersection.y)
      }
    });
  }
  
  const preview = makeDragPreview(
    session.edge, dragDistance, pool, config, edgesState, boundaryHit
  );
  
  // C) Drag preview instrumentation
  console.table({
    edge: preview.edge,
    dragDistance: Math.round(preview.dragDistance),
    maxDistance: Math.round(preview.maxDistance),
    fullRowsToAdd: preview.fullRowsToAdd,
    hasCutRow: preview.hasCutRow,
    cutRowDepth: preview.cutRowDepth ?? 0,
    reachedBoundary: preview.reachedBoundary,
    boundaryId: preview.boundaryId ?? null,
  });
  
  session.preview = preview;
  return preview;
}

export function onDragEnd(
  session: DragSession,
  pool: Pool,
  config: CopingConfig,
  edgesState: CopingEdgesState
): { newEdgesState: CopingEdgesState; newPavers: PaverRect[] } {
  if (!session.preview) return { newEdgesState: edgesState, newPavers: [] };
  const { edge, fullRowsToAdd, hasCutRow, cutRowDepth, reachedBoundary, boundaryId } = session.preview;

  const newPavers = buildExtensionRowsForEdge(
    edge, pool, config, edgesState, fullRowsToAdd, hasCutRow, cutRowDepth
  );

  const updated: CopingEdgesState = structuredClone(edgesState);
  updated[edge].currentRows += fullRowsToAdd;
  updated[edge].reachedBoundary = !!reachedBoundary;
  updated[edge].boundaryId = boundaryId ?? null;
  updated[edge].cutRowDepth = hasCutRow ? (cutRowDepth ?? 0) : undefined;
  updated[edge].pavers = [...(updated[edge].pavers ?? []), ...newPavers];

  return { newEdgesState: updated, newPavers };
}

export function initialCopingEdgesState(config: CopingConfig): CopingEdgesState {
  return {
    leftSide:   { currentRows: config.rows.sides },
    rightSide:  { currentRows: config.rows.sides },
    shallowEnd: { currentRows: config.rows.shallow },
    deepEnd:    { currentRows: config.rows.deep },
  };
}

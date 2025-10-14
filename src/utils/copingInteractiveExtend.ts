import { planAxis } from './copingCalculation';
import type { Pool, GlobalTile, CopingConfig, AxisPlan } from './copingCalculation';
import { findNearestBoundary } from './boundaryDetection';
import type { Component } from '@/types';
import type {
  CopingEdgeId,
  CopingEdgesState,
  CopingEdgeState,
  PaverRect,
  DragPreview,
} from '../types/copingInteractive';

export const GROUT_MM = 5;
export const MIN_BOUNDARY_CUT_ROW_MM = 100;

// ──────────────────────────────────────────────────────────────────────────────
// Helpers: which axis does an edge use? what projects outward? what's along?
// ──────────────────────────────────────────────────────────────────────────────

export function edgeIsLengthAxis(edge: CopingEdgeId): boolean {
  // Shallow and deep ends are now the horizontal edges (along X-axis)
  return edge === 'shallowEnd' || edge === 'deepEnd';
}

export function getAlongAndDepthForEdge(edge: CopingEdgeId, config: CopingConfig) {
  const { tile } = config;
  const along = edgeIsLengthAxis(edge) ? tile.x : tile.y;
  const rowDepth = edgeIsLengthAxis(edge) ? tile.y : tile.x;
  return { along, rowDepth };
}

export function getBaseRowsForEdge(edge: CopingEdgeId, config: CopingConfig) {
  // Shallow/deep ends are horizontal, sides are vertical
  if (edge === 'shallowEnd') return config.rows.shallow;
  if (edge === 'deepEnd') return config.rows.deep;
  return config.rows.sides; // leftSide and rightSide
}

export function getCornerExtensionFromSides(currentSidesRows: number, config: CopingConfig) {
  // Sides are now vertical, so they extend along X (tile.x is row depth)
  const sideRowDepth = config.tile.x;
  return currentSidesRows * sideRowDepth;
}

export function getDynamicEdgeLength(
  edge: CopingEdgeId,
  pool: Pool,
  config: CopingConfig,
  edgesState: CopingEdgesState,
) {
  // Shallow/deep ends are horizontal (use pool.length)
  if (edgeIsLengthAxis(edge)) return pool.length;

  // Sides are vertical (use pool.width + corner extensions from shallow/deep ends)
  const currentEndRows =
    Math.max(getBaseRowsForEdge('shallowEnd', config), edgesState.shallowEnd.currentRows ?? 0) ||
    getBaseRowsForEdge('shallowEnd', config);
  const cornerExt = getCornerExtensionFromSides(currentEndRows, config);
  return pool.width + 2 * cornerExt;
}

export function getAxisMinCut(along: number) {
  return Math.max(200, Math.floor(along / 2));
}

// ──────────────────────────────────────────────────────────────────────────────
// Boundary intersection
// ──────────────────────────────────────────────────────────────────────────────

export interface BoundaryHit {
  componentId: string;
  distance: number;
  intersection: { x: number; y: number };
  segment: { a: { x: number; y: number }; b: { x: number; y: number } };
}

export function rowStartOffset(r: number, rowDepth: number) {
  return GROUT_MM + r * (rowDepth + GROUT_MM);
}

export function getNearestBoundaryDistanceFromEdgeOuter(
  edge: CopingEdgeId,
  pool: Pool,
  poolComponent: Component,
  config: CopingConfig,
  edgesState: CopingEdgesState,
  allComponents: Component[]
): BoundaryHit | null {
  const { rowDepth } = getAlongAndDepthForEdge(edge, config);
  const currentRows = edgesState[edge].currentRows;
  
  // Calculate current outer edge position
  const outerOffset = rowStartOffset(currentRows, rowDepth);
  
  // Pool center in world coordinates
  const poolX = poolComponent.position.x;
  const poolY = poolComponent.position.y;
  const rotation = (poolComponent.rotation * Math.PI) / 180;
  
  // Determine ray origin and direction based on edge
  let rayOrigin: { x: number; y: number };
  let rayDirection: { x: number; y: number };
  
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  
  if (edge === 'leftSide') {
    // Left side (top edge): offset in -Y direction (local), outward is also -Y
    const localX = 0;
    const localY = -outerOffset;
    rayOrigin = {
      x: poolX + localX * cos - localY * sin,
      y: poolY + localX * sin + localY * cos
    };
    rayDirection = {
      x: -sin,
      y: cos
    };
  } else if (edge === 'rightSide') {
    // Right side (bottom edge): offset in +Y direction (local), outward is +Y
    const localX = 0;
    const localY = outerOffset;
    rayOrigin = {
      x: poolX + localX * cos - localY * sin,
      y: poolY + localX * sin + localY * cos
    };
    rayDirection = {
      x: sin,
      y: -cos
    };
  } else if (edge === 'shallowEnd') {
    // Shallow end (left edge): offset in -X direction (local), outward is -X
    const localX = -outerOffset;
    const localY = 0;
    rayOrigin = {
      x: poolX + localX * cos - localY * sin,
      y: poolY + localX * sin + localY * cos
    };
    rayDirection = {
      x: -cos,
      y: -sin
    };
  } else {
    // Deep end (right edge): offset in +X direction (local), outward is +X
    const localX = outerOffset;
    const localY = 0;
    rayOrigin = {
      x: poolX + localX * cos - localY * sin,
      y: poolY + localX * sin + localY * cos
    };
    rayDirection = {
      x: cos,
      y: sin
    };
  }
  
  // Find nearest boundary
  const intersection = findNearestBoundary(
    rayOrigin,
    rayDirection,
    allComponents,
    poolComponent.id
  );
  
  if (!intersection) return null;
  
  return {
    componentId: intersection.componentId,
    distance: intersection.distance,
    intersection: intersection.intersectionPoint,
    segment: {
      a: intersection.intersectionSegment.start,
      b: intersection.intersectionSegment.end
    }
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Drag → rows mapping
// ──────────────────────────────────────────────────────────────────────────────

export function rowsFromDragDistance(
  dragDistance: number,
  reachedBoundary: boolean,
  rowDepth: number,
  minBoundaryCutRow = MIN_BOUNDARY_CUT_ROW_MM
): { fullRowsToAdd: number; hasCutRow: boolean; cutRowDepth?: number } {
  const unit = rowDepth + GROUT_MM;

  let fullRowsToAdd = Math.floor(dragDistance / unit);
  let remaining = dragDistance - fullRowsToAdd * unit;

  if (!reachedBoundary) {
    return { fullRowsToAdd, hasCutRow: false };
  }

  if (remaining >= (GROUT_MM + minBoundaryCutRow)) {
    const cutRowDepth = remaining - GROUT_MM;
    return { fullRowsToAdd, hasCutRow: true, cutRowDepth };
  }

  if (fullRowsToAdd > 0) {
    fullRowsToAdd -= 1;
    remaining = dragDistance - fullRowsToAdd * unit;
    if (remaining >= (GROUT_MM + minBoundaryCutRow)) {
      const cutRowDepth = remaining - GROUT_MM;
      return { fullRowsToAdd, hasCutRow: true, cutRowDepth };
    }
  }

  return { fullRowsToAdd, hasCutRow: false };
}

export function makeDragPreview(
  edge: CopingEdgeId,
  dragDistance: number,
  pool: Pool,
  config: CopingConfig,
  edgesState: CopingEdgesState,
  boundaryHit: BoundaryHit | null,
): DragPreview {
  const { rowDepth } = getAlongAndDepthForEdge(edge, config);

  const reachedBoundary = !!boundaryHit;
  const maxDistance = boundaryHit ? Math.max(0, boundaryHit.distance) : Math.max(0, dragDistance);
  const { fullRowsToAdd, hasCutRow, cutRowDepth } = rowsFromDragDistance(
    maxDistance, reachedBoundary, rowDepth, MIN_BOUNDARY_CUT_ROW_MM
  );

  return {
    edge,
    fullRowsToAdd,
    hasCutRow,
    cutRowDepth,
    reachedBoundary,
    boundaryId: boundaryHit?.componentId ?? null,
    dragDistance,
    maxDistance,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Geometry generation for extension rows
// ──────────────────────────────────────────────────────────────────────────────

export function getAxisPlanForEdge(
  edge: CopingEdgeId,
  pool: Pool,
  config: CopingConfig,
  edgesState: CopingEdgesState
): AxisPlan {
  const edgeLen = getDynamicEdgeLength(edge, pool, config, edgesState);
  const { along } = getAlongAndDepthForEdge(edge, config);
  return planAxis(edgeLen, along, GROUT_MM);
}

export function buildRowPavers(
  edge: CopingEdgeId,
  plan: AxisPlan,
  rowIndex: number,
  rowDepth: number,
  isBoundaryCutRow: boolean
): PaverRect[] {
  const p: PaverRect[] = [];
  const { along } = plan;
  const unit = along + GROUT_MM;

  const startOffset = rowStartOffset(rowIndex, rowDepth);
  const isLengthAxis = edgeIsLengthAxis(edge);
  const alongLen = plan.edgeLength;

  // D) Row placement instrumentation
  console.log('[ROW]', {
    edge, rowIndex, isLengthAxis,
    alongLen: plan.edgeLength,
    along: plan.along, 
    grout: GROUT_MM,
    rowDepth, 
    startOffset,
    centreMode: plan.centreMode,
    cutSizes: plan.cutSizes,
  });

  const pushRect = (x: number, y: number, w: number, h: number, isPartial: boolean) => {
    // D) Rectangle position logging
    console.log('[RECT]', { 
      edge, 
      rowIndex, 
      x: Math.round(x), 
      y: Math.round(y), 
      w: Math.round(w), 
      h: Math.round(h), 
      isPartial 
    });
    
    p.push({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(w),
      height: Math.round(h),
      isPartial,
      meta: { edge, rowIndex, isBoundaryCutRow },
    });
  };

  // 1) From one corner towards centre (left/top side)
  for (let i = 0; i < plan.paversPerCorner; i++) {
    const a0 = i * unit;
    if (isLengthAxis) {
      pushRect(a0, edge === 'leftSide' ? -startOffset - rowDepth : startOffset, along, rowDepth, false);
    } else {
      pushRect(a0, edge === 'shallowEnd' ? -startOffset - rowDepth : startOffset, along, rowDepth, false);
    }
  }

  // 2) Centre group
  let centreWidth = 0;
  if (plan.centreMode === 'perfect') {
    centreWidth = GROUT_MM;
  } else if (plan.centreMode === 'single_cut') {
    centreWidth = GROUT_MM + plan.cutSizes[0] + GROUT_MM;
  } else {
    centreWidth = GROUT_MM + plan.cutSizes[0] + GROUT_MM + plan.cutSizes[1] + GROUT_MM;
  }
  const centreStart = (alongLen - centreWidth) / 2;

  if (plan.centreMode === 'single_cut') {
    const cut = plan.cutSizes[0];
    if (isLengthAxis) {
      const x = centreStart + GROUT_MM;
      pushRect(x, edge === 'leftSide' ? -startOffset - rowDepth : startOffset, cut, rowDepth, true);
    } else {
      const y = centreStart + GROUT_MM;
      pushRect(y, edge === 'shallowEnd' ? -startOffset - rowDepth : startOffset, cut, rowDepth, true);
    }
  } else if (plan.centreMode === 'double_cut') {
    const cL = plan.cutSizes[0];
    const cR = plan.cutSizes[1];
    if (isLengthAxis) {
      const xL = centreStart + GROUT_MM;
      const xR = centreStart + GROUT_MM + cL + GROUT_MM;
      pushRect(xL, edge === 'leftSide' ? -startOffset - rowDepth : startOffset, cL, rowDepth, true);
      pushRect(xR, edge === 'leftSide' ? -startOffset - rowDepth : startOffset, cR, rowDepth, true);
    } else {
      const yL = centreStart + GROUT_MM;
      const yR = centreStart + GROUT_MM + cL + GROUT_MM;
      pushRect(yL, edge === 'shallowEnd' ? -startOffset - rowDepth : startOffset, cL, rowDepth, true);
      pushRect(yR, edge === 'shallowEnd' ? -startOffset - rowDepth : startOffset, cR, rowDepth, true);
    }
  }

  // 3) From the opposite corner towards centre (right/bottom side)
  for (let i = 0; i < plan.paversPerCorner; i++) {
    const a1 = alongLen - (i + 1) * unit + GROUT_MM;
    if (isLengthAxis) {
      pushRect(a1, edge === 'leftSide' ? -startOffset - rowDepth : startOffset, along, rowDepth, false);
    } else {
      pushRect(a1, edge === 'shallowEnd' ? -startOffset - rowDepth : startOffset, along, rowDepth, false);
    }
  }

  return p;
}

export function buildExtensionRowsForEdge(
  edge: CopingEdgeId,
  pool: Pool,
  config: CopingConfig,
  edgesState: CopingEdgesState,
  fullRowsToAdd: number,
  hasCutRow: boolean,
  cutRowDepth?: number
): PaverRect[] {
  const plan = getAxisPlanForEdge(edge, pool, config, edgesState);
  const { rowDepth } = getAlongAndDepthForEdge(edge, config);

  const startRow = edgesState[edge].currentRows;
  const p: PaverRect[] = [];

  // Full rows
  for (let i = 0; i < fullRowsToAdd; i++) {
    const rowIdx = startRow + i;
    p.push(...buildRowPavers(edge, plan, rowIdx, rowDepth, false));
  }

  // Boundary cut row
  if (hasCutRow && cutRowDepth && cutRowDepth > 0) {
    const rowIdx = startRow + fullRowsToAdd;
    p.push(...buildRowPavers(edge, plan, rowIdx, cutRowDepth, true));
  }

  return p;
}

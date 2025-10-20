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
import { validateExtensionPavers } from './copingBoundaryValidation';

export const GROUT_MM = 5;
export const MIN_BOUNDARY_CUT_ROW_MM = 100;

// ──────────────────────────────────────────────────────────────────────────────
// Helpers: which axis does an edge use? what projects outward? what's along?
// ──────────────────────────────────────────────────────────────────────────────

export function edgeIsLengthAxis(edge: CopingEdgeId): boolean {
  return edge === 'leftSide' || edge === 'rightSide';
}

export function getAlongAndDepthForEdge(edge: CopingEdgeId, config: CopingConfig) {
  const { tile } = config;
  const along = edgeIsLengthAxis(edge) ? tile.x : tile.y;
  const rowDepth = edgeIsLengthAxis(edge) ? tile.y : tile.x;
  
  console.log('🧭 [EDGE-MAP] getAlongAndDepthForEdge', {
    edge,
    isLengthAxis: edgeIsLengthAxis(edge),
    tileX: tile.x,
    tileY: tile.y,
    along,
    rowDepth
  });
  
  return { along, rowDepth };
}

export function getBaseRowsForEdge(edge: CopingEdgeId, config: CopingConfig) {
  if (edge === 'leftSide' || edge === 'rightSide') return config.rows.sides;
  if (edge === 'shallowEnd') return config.rows.shallow;
  return config.rows.deep;
}

export function getCornerExtensionFromSides(currentSidesRows: number, config: CopingConfig) {
  const sideRowDepth = config.tile.y;
  return currentSidesRows * sideRowDepth;
}

export function getDynamicEdgeLength(
  edge: CopingEdgeId,
  pool: Pool,
  config: CopingConfig,
  edgesState: CopingEdgesState,
) {
  if (edgeIsLengthAxis(edge)) {
    console.log('🧭 [EDGE-LENGTH] Length axis edge', { edge, length: pool.length });
    return pool.length;
  }

  const currentSideRows =
    Math.max(getBaseRowsForEdge('leftSide', config), edgesState.leftSide.currentRows ?? 0) ||
    getBaseRowsForEdge('leftSide', config);
  const cornerExt = getCornerExtensionFromSides(currentSideRows, config);
  const dynLength = pool.width + 2 * cornerExt;
  
  console.log('🧭 [EDGE-LENGTH] Width axis edge', { 
    edge, 
    poolWidth: pool.width, 
    currentSideRows, 
    cornerExt, 
    dynLength 
  });
  
  return dynLength;
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
  const offset = GROUT_MM + r * (rowDepth + GROUT_MM);
  console.log('🧮 [ROW-OFFSET]', { rowIndex: r, rowDepth, offset });
  return offset;
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
    // Left side: offset in -Y direction (local), outward is also -Y
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
    // Right side: offset in +Y direction (local), outward is +Y
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
    // Shallow end: offset in -X direction (local), outward is -X
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
    // Deep end: offset in +X direction (local), outward is +X
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

  console.log('🧱 [BUILD-ROW] Starting', {
    edge,
    rowIndex,
    rowDepth,
    along,
    startOffset,
    edgeLength: plan.edgeLength,
    isLengthAxis: edgeIsLengthAxis(edge)
  });

  const pushRect = (x: number, y: number, w: number, h: number, isPartial: boolean) => {
    console.log('🧱 [RECT]', { edge, rowIndex, x, y, w, h, isPartial });
    p.push({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(w),
      height: Math.round(h),
      isPartial,
      meta: { edge, rowIndex, isBoundaryCutRow },
    });
  };

  const isLengthAxis = edgeIsLengthAxis(edge);
  const alongLen = plan.edgeLength;
  
  // Log offset calculation
  let offsetX = 0, offsetY = 0;
  if (isLengthAxis) {
    offsetY = edge === 'leftSide' ? -startOffset - rowDepth : startOffset;
  } else {
    offsetX = edge === 'shallowEnd' ? -startOffset - rowDepth : startOffset;
  }
  console.log('🧭 [OFFSET]', { edge, offsetX, offsetY, startOffset, rowDepth });

  // 1) From one corner towards centre (left/top side)
  for (let i = 0; i < plan.paversPerCorner; i++) {
    const a0 = i * unit;
    if (isLengthAxis) {
      pushRect(a0, edge === 'leftSide' ? -startOffset - rowDepth : startOffset, along, rowDepth, false);
    } else {
      pushRect(edge === 'shallowEnd' ? -startOffset - rowDepth : startOffset, a0, rowDepth, along, false);
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
      pushRect(edge === 'shallowEnd' ? -startOffset - rowDepth : startOffset, y, rowDepth, cut, true);
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
      pushRect(edge === 'shallowEnd' ? -startOffset - rowDepth : startOffset, yL, rowDepth, cL, true);
      pushRect(edge === 'shallowEnd' ? -startOffset - rowDepth : startOffset, yR, rowDepth, cR, true);
    }
  }

  // 3) From the opposite corner towards centre (right/bottom side)
  for (let i = 0; i < plan.paversPerCorner; i++) {
    const a1 = alongLen - (i + 1) * unit + GROUT_MM;
    if (isLengthAxis) {
      pushRect(a1, edge === 'leftSide' ? -startOffset - rowDepth : startOffset, along, rowDepth, false);
    } else {
      pushRect(edge === 'shallowEnd' ? -startOffset - rowDepth : startOffset, a1, rowDepth, along, false);
    }
  }

  console.log('🧱 [BUILD-ROW] Complete', { edge, rowIndex, totalPavers: p.length });

  return p;
}

/**
 * Validate preview pavers against boundaries using polygon-based detection
 * This replaces unreliable ray-casting with proven point-in-polygon checks
 */
export function validatePreviewPaversWithBoundaries<T extends { x: number; y: number; width: number; height: number; rowIndex: number }>(
  previewPavers: T[],
  poolComponent: Component,
  poolData: Pool,
  config: CopingConfig,
  allComponents: Component[],
  edge: CopingEdgeId
): {
  validPavers: T[];
  maxValidDistance: number;
  hitBoundary: boolean;
  boundaryId?: string;
} {
  const { rowDepth } = getAlongAndDepthForEdge(edge, config);
  
  return validateExtensionPavers(
    previewPavers,
    poolComponent.position,
    poolComponent.rotation,
    allComponents,
    poolComponent.id,
    rowDepth,
    GROUT_MM
  );
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
  const { along, rowDepth } = getAlongAndDepthForEdge(edge, config);

  const startRow = edgesState[edge].currentRows;
  const p: PaverRect[] = [];

  console.table({
    '🧱 Edge': edge,
    'Along': along,
    'Row Depth': rowDepth,
    'Edge Length': plan.edgeLength,
    'Full Rows': fullRowsToAdd,
    'Has Cut Row': hasCutRow,
    'Cut Row Depth': cutRowDepth ?? 0,
    'Current Rows': startRow,
    'Total Pavers Before': p.length
  });

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

  console.log('🧱 [BUILD-EXT] Complete', { edge, totalPavers: p.length });

  return p;
}

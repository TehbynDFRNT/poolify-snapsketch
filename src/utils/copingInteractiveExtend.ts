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
const SCALE = 0.1; // mm to pixel conversion (1px = 10mm)

// ──────────────────────────────────────────────────────────────────────────────
// Helpers: which axis does an edge use? what projects outward? what's along?
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Determine whether this edge is a side (top/bottom, runs along X)
 */
export function edgeIsSide(edge: CopingEdgeId): boolean {
  return edge === 'leftSide' || edge === 'rightSide';
}

/**
 * Determine whether this edge is an end (left/right, runs along Y)
 */
export function edgeIsEnd(edge: CopingEdgeId): boolean {
  return edge === 'shallowEnd' || edge === 'deepEnd';
}

/**
 * Legacy alias for compatibility
 */
export function edgeIsLengthAxis(edge: CopingEdgeId): boolean {
  return edgeIsSide(edge);
}

/**
 * Get the "along" dimension (tile size along the edge direction)
 * and "depth" dimension (tile size in the outward-normal direction).
 *
 * For sides (top/bottom): along = tile.x, depth = tile.y
 * For ends (left/right):  along = tile.y, depth = tile.x
 */
export function getAlongAndDepthForEdge(
  edge: CopingEdgeId,
  config: CopingConfig
): { along: number; rowDepth: number } {
  const { tile } = config;
  return edgeIsSide(edge)
    ? { along: tile.x, rowDepth: tile.y } // sides: along X, project Y
    : { along: tile.y, rowDepth: tile.x }; // ends: along Y, project X
}

/**
 * Calculate the effective length of an edge considering corner extensions.
 * 
 * For sides: always pool.length
 * For ends: pool.width + 2 * (side row depth * max side rows)
 */
export function getDynamicEdgeLength(
  edge: CopingEdgeId,
  pool: Pool,
  config: CopingConfig,
  edgesState: CopingEdgesState
): number {
  if (edgeIsSide(edge)) {
    return pool.length;
  }

  // Ends include corner returns from side rows
  const sideRowDepth = config.tile.y; // sides project in Y
  const sideRows = Math.max(
    edgesState.leftSide?.currentRows ?? config.rows.sides,
    edgesState.rightSide?.currentRows ?? config.rows.sides
  );
  const cornerExtension = sideRows * sideRowDepth;
  return pool.width + 2 * cornerExtension;
}

/**
 * Get minimum cut size for centre-cut (max of 200mm or half the along dimension)
 */
export function getAxisMinCut(along: number): number {
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
  
  // Calculate current outer edge position in mm
  const outerOffsetMm = rowStartOffset(currentRows, rowDepth);
  
  // Convert mm to pixels for world coordinate calculations
  const outerOffsetPx = outerOffsetMm * SCALE;
  
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
    const localY = -outerOffsetPx;
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
    const localY = outerOffsetPx;
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
    const localX = -outerOffsetPx;
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
    const localX = outerOffsetPx;
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
  
  // Convert distance from pixels back to mm
  const distanceMm = intersection.distance / SCALE;
  
  return {
    componentId: intersection.componentId,
    distance: distanceMm,
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

/**
 * Build the geometry for a single row of pavers along an edge.
 * 
 * @param edge - Which edge (leftSide, rightSide, shallowEnd, deepEnd)
 * @param plan - The axis plan (from planAxis) describing the layout
 * @param rowIndex - Absolute row index from waterline (0 = first row)
 * @param rowDepth - Depth of this row in mm (outward direction)
 * @param isBoundaryCutRow - Whether this is the final partial row at a boundary
 */
export function buildRowPavers(
  edge: CopingEdgeId,
  plan: AxisPlan,
  rowIndex: number,
  rowDepth: number,
  isBoundaryCutRow: boolean,
  poolHalfLength: number,
  poolHalfWidth: number
): PaverRect[] {
  const p: PaverRect[] = [];
  const along = plan.along; // tile.x for sides, tile.y for ends
  const unit = along + GROUT_MM;
  const alongLen = plan.edgeLength;

  // Outward offset from waterline to row START (inner joint face)
  const startOffset = GROUT_MM + rowIndex * (rowDepth + GROUT_MM);

  // Outward direction per edge, starting from pool waterline position
  const offsetX =
    edge === 'shallowEnd' ? -poolHalfLength - startOffset - rowDepth :
    edge === 'deepEnd'    ?  poolHalfLength + startOffset           : 0;

  const offsetY =
    edge === 'leftSide'   ? -poolHalfWidth - startOffset - rowDepth :
    edge === 'rightSide'  ?  poolHalfWidth + startOffset           : 0;

  const push = (x: number, y: number, w: number, h: number, isPartial: boolean) =>
    p.push({ 
      x: Math.round(x), 
      y: Math.round(y), 
      width: Math.round(w), 
      height: Math.round(h),
      isPartial, 
      meta: { edge, rowIndex, isBoundaryCutRow }
    });

  // 1) Corner → centre (fulls)
  for (let i = 0; i < plan.paversPerCorner; i++) {
    const a0 = i * unit;
    if (edgeIsEnd(edge)) push(offsetX, a0, rowDepth, along, false);     // along = Y, offset = X
    else                 push(a0, offsetY, along, rowDepth, false);     // along = X, offset = Y
  }

  // 2) Centre group
  const joint  = GROUT_MM;
  const mode   = plan.centreMode;
  const cuts   = plan.cutSizes;
  const widthP =
    mode === 'perfect'     ? joint :
    mode === 'single_cut'  ? joint + cuts[0] + joint :
                              joint + cuts[0] + joint + cuts[1] + joint;
  const cStart = (alongLen - widthP) / 2;

  if (mode === 'single_cut') {
    const cut = cuts[0];
    if (edgeIsEnd(edge)) push(offsetX, cStart + joint, rowDepth, cut, true);
    else                 push(cStart + joint, offsetY, cut, rowDepth, true);
  } else if (mode === 'double_cut') {
    const [cL, cR] = cuts;
    const cLStart  = cStart + joint;
    const cRStart  = cStart + joint + cL + joint;
    if (edgeIsEnd(edge)) {
      push(offsetX, cLStart, rowDepth, cL, true);
      push(offsetX, cRStart, rowDepth, cR, true);
    } else {
      push(cLStart, offsetY, cL, rowDepth, true);
      push(cRStart, offsetY, cR, rowDepth, true);
    }
  }
  // (perfect ⇒ only a joint at centre; we don't push geometry for joints)

  // 3) Centre → corner (fulls)
  for (let i = 0; i < plan.paversPerCorner; i++) {
    const a1 = alongLen - (i + 1) * unit + GROUT_MM;
    if (edgeIsEnd(edge)) push(offsetX, a1, rowDepth, along, false);
    else                 push(a1, offsetY, along, rowDepth, false);
  }

  return p;
}

/**
 * Validate preview pavers against boundaries using polygon-based detection
 * (final guard only - no quantization)
 */
export function validatePreviewPaversWithBoundaries(
  previewPavers: PaverRect[],
  poolComponent: Component,
  poolData: Pool,
  config: CopingConfig,
  allComponents: Component[],
  edge: CopingEdgeId
): {
  validPavers: PaverRect[];
  truncated: boolean;
  boundaryId?: string;
} {
  const paversWithRowIndex = previewPavers.map(p => ({
    ...p,
    rowIndex: p.meta?.rowIndex ?? 0
  }));
  
  const result = validateExtensionPavers(
    paversWithRowIndex,
    poolComponent.position,
    poolComponent.rotation,
    allComponents,
    poolComponent.id
  );
  
  return {
    validPavers: result.validPavers.map(p => {
      const original = previewPavers.find(o => o.x === p.x && o.y === p.y);
      return original ?? p as any;
    }),
    truncated: result.truncated,
    boundaryId: result.boundaryId
  };
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

  // Pool half-dimensions for waterline positioning
  const poolHalfLength = pool.length / 2;
  const poolHalfWidth = pool.width / 2;

  // Full rows
  for (let i = 0; i < fullRowsToAdd; i++) {
    const rowIdx = startRow + i;
    p.push(...buildRowPavers(edge, plan, rowIdx, rowDepth, false, poolHalfLength, poolHalfWidth));
  }

  // Boundary cut row
  if (hasCutRow && cutRowDepth && cutRowDepth > 0) {
    const rowIdx = startRow + fullRowsToAdd;
    p.push(...buildRowPavers(edge, plan, rowIdx, cutRowDepth, true, poolHalfLength, poolHalfWidth));
  }

  return p;
}

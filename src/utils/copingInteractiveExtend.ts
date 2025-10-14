import { planAxis } from './copingCalculation';
import type { Pool, GlobalTile, CopingConfig, AxisPlan } from './copingCalculation';
import { findNearestBoundary, findBoundaryProfile } from './boundaryDetection';
import type { BoundaryProfile } from './boundaryDetection';
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
const DEBUG_COPING = false;

// ──────────────────────────────────────────────────────────────────────────────
// Helpers: which axis does an edge use? what projects outward? what's along?
// ──────────────────────────────────────────────────────────────────────────────

export function edgeIsSide(edge: CopingEdgeId): boolean {
  // "Sides" are the horizontal top/bottom edges in our UI
  return edge === 'leftSide' || edge === 'rightSide';
}

export function edgeIsEnd(edge: CopingEdgeId): boolean {
  // "Ends" are the vertical left/right edges: shallow (SE) and deep (DE)
  return edge === 'shallowEnd' || edge === 'deepEnd';
}

export function getAlongAndDepthForEdge(edge: CopingEdgeId, config: CopingConfig) {
  const { tile } = config;
  if (edgeIsSide(edge)) {
    // Top/Bottom edges run along X; rows project in Y
    return { along: tile.x, rowDepth: tile.y };
  }
  // Left (SE) / Right (DE) edges run along Y; rows project in X
  return { along: tile.y, rowDepth: tile.x };
}

export function getBaseRowsForEdge(edge: CopingEdgeId, config: CopingConfig) {
  // Shallow/deep ends are horizontal, sides are vertical
  if (edge === 'shallowEnd') return config.rows.shallow;
  if (edge === 'deepEnd') return config.rows.deep;
  return config.rows.sides; // leftSide and rightSide
}

export function getCornerExtensionFromSides(currentSidesRows: number, config: CopingConfig) {
  // Sides (top/bottom) project in Y, so their extension is along Y
  const sideRowDepth = config.tile.y;
  return currentSidesRows * sideRowDepth;
}

export function getDynamicEdgeLength(
  edge: CopingEdgeId,
  pool: Pool,
  config: CopingConfig,
  edgesState: CopingEdgesState,
) {
  if (edgeIsSide(edge)) {
    // Sides (top/bottom) span the pool length (horizontal)
    return pool.length;
  }
  // Ends (left/right) span pool width + corner returns from side rows
  const sideRowDepth = config.tile.y;  // sides project in Y
  // assume sides mirror; take max of both sides to be safe
  const sideRows = Math.max(
    edgesState.leftSide?.currentRows ?? config.rows.sides,
    edgesState.rightSide?.currentRows ?? config.rows.sides
  );
  const cornerExtension = sideRows * sideRowDepth;
  return pool.width + 2 * cornerExtension;
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
  profile?: BoundaryProfile;
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

  const outerOffset = rowStartOffset(currentRows, rowDepth);

  const poolX = poolComponent.position.x;
  const poolY = poolComponent.position.y;
  const rotation = (poolComponent.rotation * Math.PI) / 180;

  let edgeStart: { x: number; y: number };
  let edgeEnd: { x: number; y: number };
  let rayDirection: { x: number; y: number };

  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  const edgeLen = getDynamicEdgeLength(edge, pool, config, edgesState);

  if (edge === 'leftSide') {
    const localY = -outerOffset;
    edgeStart = {
      x: poolX + 0 * cos - localY * sin,
      y: poolY + 0 * sin + localY * cos
    };
    edgeEnd = {
      x: poolX + pool.length * cos - localY * sin,
      y: poolY + pool.length * sin + localY * cos
    };
    rayDirection = { x: -sin, y: cos };
  } else if (edge === 'rightSide') {
    const localY = outerOffset;
    edgeStart = {
      x: poolX + 0 * cos - localY * sin,
      y: poolY + 0 * sin + localY * cos
    };
    edgeEnd = {
      x: poolX + pool.length * cos - localY * sin,
      y: poolY + pool.length * sin + localY * cos
    };
    rayDirection = { x: sin, y: -cos };
  } else if (edge === 'shallowEnd') {
    const localX = -outerOffset;
    const cornerExt = getCornerExtensionFromSides(
      edgesState.leftSide.currentRows,
      config
    );
    edgeStart = {
      x: poolX + localX * cos - (-cornerExt) * sin,
      y: poolY + localX * sin + (-cornerExt) * cos
    };
    edgeEnd = {
      x: poolX + localX * cos - (pool.width + cornerExt) * sin,
      y: poolY + localX * sin + (pool.width + cornerExt) * cos
    };
    rayDirection = { x: -cos, y: -sin };
  } else {
    const localX = outerOffset;
    const cornerExt = getCornerExtensionFromSides(
      edgesState.rightSide.currentRows,
      config
    );
    edgeStart = {
      x: poolX + localX * cos - (-cornerExt) * sin,
      y: poolY + localX * sin + (-cornerExt) * cos
    };
    edgeEnd = {
      x: poolX + localX * cos - (pool.width + cornerExt) * sin,
      y: poolY + localX * sin + (pool.width + cornerExt) * cos
    };
    rayDirection = { x: cos, y: sin };
  }

  const rayOriginCenter = {
    x: (edgeStart.x + edgeEnd.x) / 2,
    y: (edgeStart.y + edgeEnd.y) / 2
  };

  const intersection = findNearestBoundary(
    rayOriginCenter,
    rayDirection,
    allComponents,
    poolComponent.id
  );

  if (!intersection) return null;

  const profile = findBoundaryProfile(
    edgeStart,
    edgeEnd,
    rayDirection,
    allComponents,
    poolComponent.id,
    10
  );

  return {
    componentId: intersection.componentId,
    distance: intersection.distance,
    intersection: intersection.intersectionPoint,
    segment: {
      a: intersection.intersectionSegment.start,
      b: intersection.intersectionSegment.end
    },
    profile: profile || undefined
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Drag → rows mapping
// ──────────────────────────────────────────────────────────────────────────────

export function rowsFromDragDistance(
  dragDistance: number,
  reachedBoundary: boolean,
  rowDepth: number,
  minBoundaryCutRow = MIN_BOUNDARY_CUT_ROW_MM,
  profile?: BoundaryProfile
): { fullRowsToAdd: number; hasCutRow: boolean; cutRowDepth?: number } {
  const unit = rowDepth + GROUT_MM;

  const effectiveDistance = profile && profile.hasVariation
    ? profile.minDistance
    : dragDistance;

  let fullRowsToAdd = Math.floor(effectiveDistance / unit);
  let remaining = effectiveDistance - fullRowsToAdd * unit;

  if (!reachedBoundary) {
    return { fullRowsToAdd, hasCutRow: false };
  }

  if (remaining >= (GROUT_MM + minBoundaryCutRow)) {
    const cutRowDepth = remaining - GROUT_MM;
    return { fullRowsToAdd, hasCutRow: true, cutRowDepth };
  }

  if (fullRowsToAdd > 0) {
    fullRowsToAdd -= 1;
    remaining = effectiveDistance - fullRowsToAdd * unit;
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
): DragPreview & { profile?: BoundaryProfile } {
  const { rowDepth } = getAlongAndDepthForEdge(edge, config);

  const reachedBoundary = !!boundaryHit;
  const maxDistance = boundaryHit ? Math.max(0, boundaryHit.distance) : Math.max(0, dragDistance);
  const { fullRowsToAdd, hasCutRow, cutRowDepth } = rowsFromDragDistance(
    maxDistance, reachedBoundary, rowDepth, MIN_BOUNDARY_CUT_ROW_MM, boundaryHit?.profile
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
    profile: boundaryHit?.profile
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
  const alongLen = plan.edgeLength;

  // D) Row placement instrumentation
  if (DEBUG_COPING) {
    console.log('[ROW]', {
      edge, rowIndex,
      alongLen: plan.edgeLength,
      along: plan.along, 
      grout: GROUT_MM,
      rowDepth, 
      startOffset,
      centreMode: plan.centreMode,
      cutSizes: plan.cutSizes,
    });
  }

  const pushRect = (x: number, y: number, w: number, h: number, isPartial: boolean) => {
    // D) Rectangle position logging
    if (DEBUG_COPING) {
      console.log('[RECT]', { 
        edge, 
        rowIndex, 
        x: Math.round(x), 
        y: Math.round(y), 
        w: Math.round(w), 
        h: Math.round(h), 
        isPartial 
      });
    }
    
    p.push({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(w),
      height: Math.round(h),
      isPartial,
      meta: { edge, rowIndex, isBoundaryCutRow },
    });
  };

  // Helper: outward offsets per edge (distance from waterline to the OUTER face of this row)
  const offsetX =
    edge === 'shallowEnd' ? -(startOffset + rowDepth) :   // SE extends to −X
    edge === 'deepEnd'    ?  (startOffset)           : 0; // DE extends to +X

  const offsetY =
    edge === 'leftSide'   ? -(startOffset + rowDepth) :   // top side extends to −Y
    edge === 'rightSide'  ?  (startOffset)           : 0; // bottom side extends to +Y

  // 1) From one corner towards centre (left/top side)
  for (let i = 0; i < plan.paversPerCorner; i++) {
    const a0 = i * unit;
    if (edgeIsEnd(edge)) {
      pushRect(offsetX, a0, rowDepth, plan.along, false);
    } else {
      pushRect(a0, offsetY, plan.along, rowDepth, false);
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
    const cStart = centreStart + GROUT_MM;
    if (edgeIsEnd(edge)) {
      pushRect(offsetX, cStart, rowDepth, cut, true);
    } else {
      pushRect(cStart, offsetY, cut, rowDepth, true);
    }
  } else if (plan.centreMode === 'double_cut') {
    const cL = plan.cutSizes[0];
    const cR = plan.cutSizes[1];
    const cStartL = centreStart + GROUT_MM;
    const cStartR = cStartL + cL + GROUT_MM;
    if (edgeIsEnd(edge)) {
      pushRect(offsetX, cStartL, rowDepth, cL, true);
      pushRect(offsetX, cStartR, rowDepth, cR, true);
    } else {
      pushRect(cStartL, offsetY, cL, rowDepth, true);
      pushRect(cStartR, offsetY, cR, rowDepth, true);
    }
  }

  // 3) From the opposite corner towards centre (right/bottom side)
  for (let i = 0; i < plan.paversPerCorner; i++) {
    const a1 = alongLen - (i + 1) * unit + GROUT_MM;
    if (edgeIsEnd(edge)) {
      pushRect(offsetX, a1, rowDepth, plan.along, false);
    } else {
      pushRect(a1, offsetY, plan.along, rowDepth, false);
    }
  }

  return p;
}

function buildVariableDepthBoundaryRow(
  edge: CopingEdgeId,
  plan: AxisPlan,
  rowIndex: number,
  profile: BoundaryProfile,
  baseRowDepth: number
): PaverRect[] {
  const p: PaverRect[] = [];
  const { along } = plan;
  const unit = along + GROUT_MM;
  const alongLen = plan.edgeLength;

  const baseOffset = rowStartOffset(rowIndex, baseRowDepth);

  const pushRect = (x: number, y: number, w: number, h: number, isPartial: boolean) => {
    p.push({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(w),
      height: Math.round(h),
      isPartial,
      meta: { edge, rowIndex, isBoundaryCutRow: true },
    });
  };

  const getTileDepthAtPosition = (position: number): number => {
    if (!profile.samples || profile.samples.length === 0) {
      return profile.minDistance - baseOffset;
    }

    let closestSample = profile.samples[0];
    let minDist = Math.abs(profile.samples[0].position - position);

    for (const sample of profile.samples) {
      const dist = Math.abs(sample.position - position);
      if (dist < minDist) {
        minDist = dist;
        closestSample = sample;
      }
    }

    const tileDepth = Math.max(MIN_BOUNDARY_CUT_ROW_MM, closestSample.distance - baseOffset);
    return Math.min(tileDepth, baseRowDepth);
  };

  for (let i = 0; i < plan.paversPerCorner; i++) {
    const a0 = i * unit;
    const tileDepth = getTileDepthAtPosition(a0 + along / 2);

    if (tileDepth >= MIN_BOUNDARY_CUT_ROW_MM) {
      if (edgeIsEnd(edge)) {
        const offsetX = edge === 'shallowEnd' ? -(baseOffset + tileDepth) : baseOffset;
        pushRect(offsetX, a0, tileDepth, plan.along, true);
      } else {
        const offsetY = edge === 'leftSide' ? -(baseOffset + tileDepth) : baseOffset;
        pushRect(a0, offsetY, plan.along, tileDepth, true);
      }
    }
  }

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
    const cStart = centreStart + GROUT_MM;
    const tileDepth = getTileDepthAtPosition(cStart + cut / 2);

    if (tileDepth >= MIN_BOUNDARY_CUT_ROW_MM) {
      if (edgeIsEnd(edge)) {
        const offsetX = edge === 'shallowEnd' ? -(baseOffset + tileDepth) : baseOffset;
        pushRect(offsetX, cStart, tileDepth, cut, true);
      } else {
        const offsetY = edge === 'leftSide' ? -(baseOffset + tileDepth) : baseOffset;
        pushRect(cStart, offsetY, cut, tileDepth, true);
      }
    }
  } else if (plan.centreMode === 'double_cut') {
    const cL = plan.cutSizes[0];
    const cR = plan.cutSizes[1];
    const cStartL = centreStart + GROUT_MM;
    const cStartR = cStartL + cL + GROUT_MM;

    const tileDepthL = getTileDepthAtPosition(cStartL + cL / 2);
    if (tileDepthL >= MIN_BOUNDARY_CUT_ROW_MM) {
      if (edgeIsEnd(edge)) {
        const offsetX = edge === 'shallowEnd' ? -(baseOffset + tileDepthL) : baseOffset;
        pushRect(offsetX, cStartL, tileDepthL, cL, true);
      } else {
        const offsetY = edge === 'leftSide' ? -(baseOffset + tileDepthL) : baseOffset;
        pushRect(cStartL, offsetY, cL, tileDepthL, true);
      }
    }

    const tileDepthR = getTileDepthAtPosition(cStartR + cR / 2);
    if (tileDepthR >= MIN_BOUNDARY_CUT_ROW_MM) {
      if (edgeIsEnd(edge)) {
        const offsetX = edge === 'shallowEnd' ? -(baseOffset + tileDepthR) : baseOffset;
        pushRect(offsetX, cStartR, tileDepthR, cR, true);
      } else {
        const offsetY = edge === 'leftSide' ? -(baseOffset + tileDepthR) : baseOffset;
        pushRect(cStartR, offsetY, cR, tileDepthR, true);
      }
    }
  }

  for (let i = 0; i < plan.paversPerCorner; i++) {
    const a1 = alongLen - (i + 1) * unit + GROUT_MM;
    const tileDepth = getTileDepthAtPosition(a1 + along / 2);

    if (tileDepth >= MIN_BOUNDARY_CUT_ROW_MM) {
      if (edgeIsEnd(edge)) {
        const offsetX = edge === 'shallowEnd' ? -(baseOffset + tileDepth) : baseOffset;
        pushRect(offsetX, a1, tileDepth, plan.along, true);
      } else {
        const offsetY = edge === 'leftSide' ? -(baseOffset + tileDepth) : baseOffset;
        pushRect(a1, offsetY, plan.along, tileDepth, true);
      }
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
  cutRowDepth?: number,
  profile?: BoundaryProfile
): PaverRect[] {
  const plan = getAxisPlanForEdge(edge, pool, config, edgesState);
  const { rowDepth } = getAlongAndDepthForEdge(edge, config);

  const startRow = edgesState[edge].currentRows;
  const p: PaverRect[] = [];

  for (let i = 0; i < fullRowsToAdd; i++) {
    const rowIdx = startRow + i;
    p.push(...buildRowPavers(edge, plan, rowIdx, rowDepth, false));
  }

  if (hasCutRow && cutRowDepth && cutRowDepth > 0) {
    const rowIdx = startRow + fullRowsToAdd;

    if (profile && profile.hasVariation) {
      p.push(...buildVariableDepthBoundaryRow(edge, plan, rowIdx, profile, rowDepth));
    } else {
      p.push(...buildRowPavers(edge, plan, rowIdx, cutRowDepth, true));
    }
  }

  return p;
}

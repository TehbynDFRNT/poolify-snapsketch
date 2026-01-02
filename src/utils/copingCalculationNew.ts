import { TILE_GAP, TILE_SIZES } from '@/constants/tileConfig';

export const GROUT_MM = TILE_GAP.size;
export const MIN_CUT_MM = 200;

// =============================================================================
// 1. Configuration & Types
// =============================================================================

export type CutStrategy = 'START' | 'END' | 'MIDDLE';

export interface PoolCopingConfig {
  tileWidth: number;  // Dimension along the pool edge (e.g. 400 or 600)
  tileDepth: number;  // Dimension perpendicular to the edge (e.g. 400)
  strategies?: CutStrategy[]; // Array of strategies corresponding to pool segments
}

export interface CopingTile {
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  isPartial: boolean;
  id: string;
}

interface Point { x: number; y: number; }

// --- Legacy Types for Compatibility ---

/**
 * Legacy config interface with along/inward
 */
export interface LegacyCopingConfig {
  id: string;
  name: string;
  tile: {
    along: number;
    inward: number;
  };
  rows: {
    sides: number;
    shallow: number;
    deep: number;
  };
}

// Re-export CopingConfig as alias or union if needed by consumers
export type CopingConfig = LegacyCopingConfig | PoolCopingConfig;

export interface CopingCalculation {
  tiles: CopingTile[];
  totalPavers: number;
  totalFullPavers: number;
  totalPartialPavers: number;
  totalArea: number;
  // Legacy side stubs to prevent crashes in old components
  deepEnd: { paverPositions: any[] };
  shallowEnd: { paverPositions: any[] };
  leftSide: { paverPositions: any[] };
  rightSide: { paverPositions: any[] };
}

export const DEFAULT_COPING_OPTIONS: LegacyCopingConfig[] = [
  {
    id: 'coping-400x400',
    name: 'Coping 400×400 (square)',
    tile: { along: 400, inward: 400 },
    rows: { sides: 1, shallow: 1, deep: 2 },
  },
  {
    id: 'coping-600x400',
    name: 'Coping 600×400 (long-X)',
    tile: { along: 600, inward: 400 },
    rows: { sides: 1, shallow: 1, deep: 2 },
  },
  {
    id: 'coping-400x600',
    name: 'Coping 400×600 (long-Y)',
    tile: { along: 400, inward: 600 },
    rows: { sides: 1, shallow: 1, deep: 2 },
  }
];

// =============================================================================
// 2. Geometric Helpers
// =============================================================================

const getVec = (p1: Point, p2: Point) => ({ x: p2.x - p1.x, y: p2.y - p1.y });
const mag = (v: Point) => Math.sqrt(v.x * v.x + v.y * v.y);

// Cross product 2D. In a Y-Down system (Canvas):
// Vector A x Vector B > 0 implies a "Right Turn" (Standard/Convex).
// Vector A x Vector B < 0 implies a "Left Turn" (Armpit/Reflex).
const cross = (v1: Point, v2: Point) => v1.x * v2.y - v1.y * v2.x;

/**
 * Determines if a corner is STANDARD (90°/Convex) or ARMPIT (270°/Reflex).
 * Assumes Clockwise winding for the pool polygon.
 */
function getCornerType(prev: Point, curr: Point, next: Point): 'STANDARD' | 'ARMPIT' {
  const v1 = getVec(prev, curr);
  const v2 = getVec(curr, next);
  const val = cross(v1, v2);
  return val > -1e-6 ? 'STANDARD' : 'ARMPIT'; 
}

// =============================================================================
// 3. The Solver
// =============================================================================

export function calculatePoolCoping(
  poolData: { outline: Point[] } | any, // accept any for legacy prop compat
  config: CopingConfig
): CopingCalculation {
  
  const points: Point[] = poolData.outline || [];
  const n = points.length;
  
  if (n < 3) {
    return {
      tiles: [],
      totalPavers: 0,
      totalFullPavers: 0,
      totalPartialPavers: 0,
      totalArea: 0,
      deepEnd: { paverPositions: [] },
      shallowEnd: { paverPositions: [] },
      leftSide: { paverPositions: [] },
      rightSide: { paverPositions: [] }
    };
  }

  // Adapter: Handle Legacy Config
  let tileWidth = 400;
  let tileDepth = 400;
  
  if ('tile' in config && 'along' in config.tile) {
    tileWidth = (config as LegacyCopingConfig).tile.along;
    tileDepth = (config as LegacyCopingConfig).tile.inward;
  } else if ('tileWidth' in config) {
    tileWidth = (config as PoolCopingConfig).tileWidth;
    tileDepth = (config as PoolCopingConfig).tileDepth;
  }

  // Auto-Detect Strategies if not provided
  // Default to MIDDLE for standard pools, specific mix for T-Shape
  let strategies: CutStrategy[] = (config as any).strategies;
  if (!strategies) {
    if (n === 8) {
      // 8-Point T-Shape map
      strategies = ['END', 'START', 'MIDDLE', 'END', 'START', 'MIDDLE', 'MIDDLE', 'MIDDLE'];
    } else {
      // Standard 4-Point or other poly
      strategies = Array(n).fill('MIDDLE');
    }
  }

  const step = tileWidth + GROUT_MM;
  const tiles: CopingTile[] = [];

  // ---------------------------------------------------------------------------
  // PASS 1: Analyze Segments & Apply Horizontal Dominance Hierarchy
  // ---------------------------------------------------------------------------
  
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];
    const nextNext = points[(i + 2) % n];

    // 1. Determine Axis
    const vec = getVec(curr, next);
    const len = mag(vec);
    const isHorizontal = Math.abs(vec.y) < 1.0; 

    // 2. Determine Corner Types
    const startCornerType = getCornerType(prev, curr, next);
    const endCornerType = getCornerType(curr, next, nextNext);

    // 3. Apply HIERARCHY Rules
    let startExtension = 0;
    let endExtension = 0;
    const extensionAmount = tileDepth + GROUT_MM;

    if (isHorizontal) {
      // HORIZONTAL: Extends on Standard, Flushes on Armpit
      if (startCornerType === 'STANDARD') startExtension = -extensionAmount; 
      else startExtension = 0; 

      if (endCornerType === 'STANDARD') endExtension = extensionAmount; 
      else endExtension = 0; 
    } else {
      // VERTICAL: Shrinks on Standard, Flushes on Armpit
      if (startCornerType === 'STANDARD') startExtension = extensionAmount; 
      else startExtension = 0; 

      if (endCornerType === 'STANDARD') endExtension = -extensionAmount; 
      else endExtension = 0; 
    }

    // 4. Calculate Effective Geometry
    const effectiveStart = startExtension; 
    const effectiveEnd = len + endExtension;
    const span = effectiveEnd - effectiveStart;

    if (span <= 1) continue;

    // 5. Determine Cut Strategy
    const strategy = strategies[i] || 'MIDDLE';

    // 6. Calculate Grid Origin
    let gridOffset = 0;
    if (strategy === 'START') {
      const remainder = span % step;
      gridOffset = remainder; 
    } else if (strategy === 'END') { 
      gridOffset = 0; 
    } else {
      // MIDDLE
      const remainder = span % step;
      gridOffset = remainder / 2;
    }

    // -------------------------------------------------------------------------
    // PASS 2: Generate Tiles
    // -------------------------------------------------------------------------
    const dirX = vec.x / len;
    const dirY = vec.y / len;
    const angleRad = Math.atan2(dirY, dirX);
    const angleDeg = angleRad * (180 / Math.PI);

    const anchor = effectiveStart + gridOffset;
    const minK = Math.floor((effectiveStart - anchor) / step);
    const maxK = Math.ceil((effectiveEnd - anchor) / step);

    for (let k = minK; k <= maxK; k++) {
      const localTileStart = anchor + k * step;
      const localTileEnd = localTileStart + tileWidth;

      const cutStart = Math.max(localTileStart, effectiveStart);
      const cutEnd = Math.min(localTileEnd, effectiveEnd);
      const cutWidth = cutEnd - cutStart;

      if (cutWidth < 1) continue; 

      const isPartial = Math.abs(cutWidth - tileWidth) > 1;
      const px = curr.x + dirX * cutStart;
      const py = curr.y + dirY * cutStart;

      tiles.push({
        x: px,
        y: py,
        width: cutWidth,
        height: tileDepth,
        angle: angleDeg,
        isPartial: isPartial,
        id: `seg${i}-t${k}`
      });
    }
  }

  // Calculate Totals
  const totalPavers = tiles.length;
  const totalFullPavers = tiles.filter(t => !t.isPartial).length;
  const totalPartialPavers = tiles.filter(t => t.isPartial).length;
  const totalArea = tiles.reduce((sum, t) => sum + (t.width * t.height), 0) / 1_000_000;

  return {
    tiles,
    totalPavers,
    totalFullPavers,
    totalPartialPavers,
    totalArea,
    // Legacy stubs
    deepEnd: { paverPositions: [] },
    shallowEnd: { paverPositions: [] },
    leftSide: { paverPositions: [] },
    rightSide: { paverPositions: [] }
  };
}
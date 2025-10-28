//
// Global‑orientation coping planner
// - Corner‑first, centre‑only cuts, mirrored left/right & shallow/deep
// - One global tile orientation (no rotation at corners)
// - Per‑axis MIN_CUT = max(200, floor(along/2))  => 600‑along → 300 mm
//

import { TILE_GAP, TILE_SIZES } from '@/constants/tileConfig';

export const GROUT_MM = TILE_GAP.size; // Use centralized gap configuration
export const MIN_CUT_MM = 200;

export interface Pool {
  length: number;  // mm (distance along the long sides)
  width: number;   // mm (distance along the short ends)
}

/**
 * Tile dimensions in world coordinates (fixed orientation for all sides):
 *   width = tile size in X-axis (world horizontal)
 *   height = tile size in Y-axis (world vertical)
 *
 * 400x400:  { width: 400, height: 400 }  → square tiles
 * 600x400:  { width: 600, height: 400 }  → all tiles 600mm(X) × 400mm(Y)
 * 400x600:  { width: 400, height: 600 }  → all tiles 400mm(X) × 600mm(Y)
 *
 * Mapping to edges:
 * - Horizontal edges (top/bottom): along = width, row depth = height
 * - Vertical edges (left/right): along = height, row depth = width
 */
export interface GlobalTile {
  width: number;  // mm in world X-axis
  height: number; // mm in world Y-axis
}

export interface CopingConfig {
  id: string;
  name: string;
  tile: GlobalTile;           // fixed world orientation for the whole pool
  rows: {
    sides: number;            // rows on the long sides (left/right)
    shallow: number;          // rows at shallow end
    deep: number;             // rows at deep end
  };
}

export const COPING_OPTIONS: CopingConfig[] = [
  {
    id: 'coping-400x400',
    name: 'Coping 400×400 (square)',
    tile: { width: 400, height: 400 },
    rows: { sides: 1, shallow: 1, deep: 2 },
  },
  {
    id: 'coping-600x400',
    name: 'Coping 600×400 (long-X)',
    tile: { width: 600, height: 400 },
    rows: { sides: 1, shallow: 1, deep: 2 },
  },
  {
    id: 'coping-400x600',
    name: 'Coping 400×600 (long-Y)',
    tile: { width: 400, height: 600 },
    rows: { sides: 1, shallow: 1, deep: 2 },
  },
];

export type CentreMode = 'perfect' | 'single_cut' | 'double_cut';

export interface AxisPlan {
  // Inputs (for one axis)
  edgeLength: number;   // L
  along: number;        // A (tile size along the edge for this axis)
  grout: number;        // G
  minCut: number;       // min cut for this axis (>=200, 600‑along → 300)

  // Core outputs for one row on this axis
  paversPerCorner: number;       // p per corner, placed from each end
  removedFromEachSide: number;   // symmetric removals to hit min cuts
  gapBeforeCentre: number;       // g0 (mm) BEFORE inserting any centre pieces
  centreMode: CentreMode;
  cutSizes: number[];            // [] | [c] | [cL, cR]  (mm)
  meetsMinCut: boolean;

  // Counts for one row
  fullPaversTotal: number;       // 2*p
  partialPaversTotal: number;    // 0, 1, or 2
  paversTotal: number;           // full + partial
}

export interface EdgeTotals {
  rows: number;
  depth: number;  // tile depth for this edge (mm) - pure tile size without grout
  fullPavers: number;
  partialPavers: number;
  pavers: number;
}

export interface CopingPlan {
  // Axis plans (reused/mirrored)
  lengthAxis: AxisPlan; // applies to both long sides (left & right)
  widthAxis: AxisPlan;  // applies to both ends (shallow & deep), after corner extension

  // Per‑edge totals (rows applied)
  leftSide: EdgeTotals;
  rightSide: EdgeTotals;
  shallowEnd: EdgeTotals;
  deepEnd: EdgeTotals;

  // Totals
  totalFullPavers: number;
  totalPartialPavers: number;
  totalPavers: number;

  // Sanity: by construction these are always true
  symmetry: { sidesMirror: true; endsMirror: true; };
}

/**
 * Compute per‑axis plan (corner‑first → centre‑only cuts).
 *
 * Definitions:
 *   A = along, G = grout, U = A + G, L = edgeLength
 *   p = pavers per corner
 *   g0 = remaining centre free space BEFORE adding centre pieces:
 *        g0 = L - 2*p*U + 2*G
 *
 * Centre requirements (with joints counted explicitly):
 *   perfect:             g0 ≈ 1*G
 *   single cut:          g0 = 2*G + c,          c ≥ minCut
 *   double cut (equal):  g0 = 3*G + cL + cR,   cL,cR ≥ minCut
 *
 * If 0 < g0 < (2*G + minCut), remove one full paver from EACH side (p--) → g0 += 2*U.
 */
export function planAxis(edgeLength: number, along: number, grout = GROUT_MM): AxisPlan {
  const G = grout;
  const A = along;
  const U = A + G;
  const eps = 1; // mm tolerance for "perfect"
  const minCut = Math.max(200, Math.floor(A / 2)); // <= YOUR RULE: 600‑along → 300

  // ensure at least one centre joint can exist: 2*p*U - G ≤ L
  let p = Math.floor((edgeLength + G) / (2 * U));
  p = Math.max(0, p);

  let g0 = edgeLength - 2 * p * U + 2 * G;
  let removed = 0;

  while (g0 > 0 && g0 < (2 * G + minCut) && p > 0) {
    p -= 1;
    removed += 1;
    g0 += 2 * U;
  }

  let centreMode: CentreMode;
  let cutSizes: number[] = [];
  let meetsMinCut = true;

  if (Math.abs(g0 - G) <= eps) {
    centreMode = 'perfect';
  } else if (g0 >= (3 * G + 2 * minCut)) {
    // two equal cuts with exact decimal precision
    const totalCuts = g0 - 3 * G;
    const cL = totalCuts / 2;  // exact division with decimal precision
    const cR = totalCuts / 2;  // same value for perfect symmetry
    centreMode = 'double_cut';
    cutSizes = [cL, cR];
    meetsMinCut = (cL >= minCut && cR >= minCut);
  } else if (g0 >= (2 * G + minCut)) {
    const c = g0 - 2 * G;
    centreMode = 'single_cut';
    cutSizes = [c];
    meetsMinCut = (c >= minCut);
  } else {
    // Tiny pools: accept undersize single cut (flagged)
    const c = Math.max(0, g0 - 2 * G);
    centreMode = 'single_cut';
    cutSizes = [c];
    meetsMinCut = (c >= minCut);
  }

  const fullPaversTotal = 2 * p;
  const partialPaversTotal = cutSizes.length;
  const paversTotal = fullPaversTotal + partialPaversTotal;

  return {
    edgeLength,
    along: A,
    grout: G,
    minCut,

    paversPerCorner: p,
    removedFromEachSide: removed,
    gapBeforeCentre: Math.round(g0),
    centreMode,
    cutSizes,
    meetsMinCut,

    fullPaversTotal,
    partialPaversTotal,
    paversTotal,
  };
}

/**
 * Main planner with global‑orientation rules.
 *
 * IMPORTANT: With a single global tile orientation:
 *  • Long sides (length axis, horizontal) run ALONG = tile.x, rows project by tile.y per row.
 *  • Ends (width axis, vertical) run ALONG = tile.y, rows project by tile.x per row.
 *  • Corner extension on the ends is produced by the side rows: rows.sides × (side row depth).
 */
export function planPoolCopingGlobal(pool: Pool, config: CopingConfig): CopingPlan {
  const { tile, rows } = config;

  // Map tile dimensions to edge orientations:
  // - Horizontal edges (long sides, X-direction): tiles are width(X) along edge, height(Y) per row
  // - Vertical edges (ends, Y-direction): tiles are height(Y) along edge, width(X) per row
  const sideRowDepth = tile.height;  // horizontal edges extend in Y
  const endRowDepth = tile.width;     // vertical edges extend in X

  // Edge lengths match pool dimensions (no extension)
  const widthEdgeLength = pool.width;
  const lengthEdgeLength = pool.length;

  // Axis plans for different edge orientations
  const lengthAxis = planAxis(lengthEdgeLength, /*along*/ tile.width); // horizontal edges
  const widthAxis  = planAxis(widthEdgeLength, /*along*/ tile.height); // vertical edges

  // Totals per edge (apply rows)
  const leftSide: EdgeTotals = {
    rows: rows.sides,
    depth: tile.height,  // horizontal edge uses tile.height as depth
    fullPavers: lengthAxis.fullPaversTotal * rows.sides,
    partialPavers: lengthAxis.partialPaversTotal * rows.sides,
    pavers: lengthAxis.paversTotal * rows.sides,
  };
  const rightSide: EdgeTotals = {
    rows: rows.sides,
    depth: tile.height,  // horizontal edge uses tile.height as depth
    fullPavers: lengthAxis.fullPaversTotal * rows.sides,
    partialPavers: lengthAxis.partialPaversTotal * rows.sides,
    pavers: lengthAxis.paversTotal * rows.sides,
  };
  const shallowEnd: EdgeTotals = {
    rows: rows.shallow,
    depth: tile.width,  // vertical edge uses tile.width as depth
    fullPavers: widthAxis.fullPaversTotal * rows.shallow,
    partialPavers: widthAxis.partialPaversTotal * rows.shallow,
    pavers: widthAxis.paversTotal * rows.shallow,
  };
  const deepEnd: EdgeTotals = {
    rows: rows.deep,
    depth: tile.width,  // vertical edge uses tile.width as depth
    fullPavers: widthAxis.fullPaversTotal * rows.deep,
    partialPavers: widthAxis.partialPaversTotal * rows.deep,
    pavers: widthAxis.paversTotal * rows.deep,
  };

  const totalFullPavers =
    leftSide.fullPavers + rightSide.fullPavers + shallowEnd.fullPavers + deepEnd.fullPavers;

  const totalPartialPavers =
    leftSide.partialPavers + rightSide.partialPavers + shallowEnd.partialPavers + deepEnd.partialPavers;

  return {
    lengthAxis,
    widthAxis,

    leftSide,
    rightSide,
    shallowEnd,
    deepEnd,

    totalFullPavers,
    totalPartialPavers,
    totalPavers: totalFullPavers + totalPartialPavers,

    symmetry: { sidesMirror: true, endsMirror: true },
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// LEGACY TYPES AND FUNCTIONS (for backward compatibility)
// ──────────────────────────────────────────────────────────────────────────────

export interface CopingPaver {
  x: number;
  y: number;
  width: number;
  height: number;
  isPartial: boolean;
}

export interface CopingSide {
  rows: number;
  depth: number;  // tile depth for this edge (mm) - pure tile size without grout
  width: number;  // total width of coping on this edge
  length: number; // edge length
  fullPavers: number;
  partialPaver: number | null;
  paverPositions: CopingPaver[];
}

export interface CopingCalculation {
  deepEnd: CopingSide;
  shallowEnd: CopingSide;
  leftSide: CopingSide;
  rightSide: CopingSide;
  totalFullPavers: number;
  totalPartialPavers: number;
  totalPavers: number;
  totalArea: number;
}

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

/**
 * Legacy coping options (for backward compatibility)
 */
export const DEFAULT_COPING_OPTIONS: LegacyCopingConfig[] = [
  {
    id: 'coping-400x400',
    name: TILE_SIZES['400x400'].label,
    tile: { along: TILE_SIZES['400x400'].width, inward: TILE_SIZES['400x400'].height },
    rows: { sides: 1, shallow: 1, deep: 2 },
  },
  {
    id: 'coping-600x400',
    name: TILE_SIZES['600x400'].label,
    tile: { along: TILE_SIZES['600x400'].width, inward: TILE_SIZES['600x400'].height },
    rows: { sides: 1, shallow: 1, deep: 2 },
  },
  {
    id: 'coping-400x600',
    name: TILE_SIZES['400x600'].label,
    tile: { along: TILE_SIZES['400x600'].width, inward: TILE_SIZES['400x600'].height },
    rows: { sides: 1, shallow: 1, deep: 2 },
  }
];

/**
 * Generate paver positions with fixed world orientation.
 *
 * @param startX - Starting X coordinate in mm
 * @param startY - Starting Y coordinate in mm
 * @param axisPlan - Axis plan containing tile layout along the edge
 * @param tileWidth - Tile width in world X-axis (mm)
 * @param tileHeight - Tile height in world Y-axis (mm)
 * @param isHorizontal - true for horizontal edges (top/bottom), false for vertical edges (left/right)
 * @param rows - Number of rows to generate
 *
 * All tiles maintain fixed world orientation (tileWidth × tileHeight):
 * - Horizontal edges: tiles placed along X, rows stack in Y
 * - Vertical edges: tiles placed along Y, rows stack in X
 * - Dimensions are always width × height regardless of edge
 */
const generatePaverPositions = (
  startX: number,
  startY: number,
  axisPlan: AxisPlan,
  tileWidth: number,
  tileHeight: number,
  isHorizontal: boolean,
  rows: number
): CopingPaver[] => {
  const positions: CopingPaver[] = [];
  const alongDim = axisPlan.along;
  const G = axisPlan.grout;
  const U = alongDim + G;
  const p = axisPlan.paversPerCorner;

  // Row depth depends on edge orientation
  const rowDepth = isHorizontal ? tileHeight : tileWidth;

  for (let row = 0; row < rows; row++) {
    // Place pavers from LEFT/TOP corner
    for (let i = 0; i < p; i++) {
      const offset = i * U;
      const rowOffset = row * (rowDepth + GROUT_MM);
      positions.push({
        x: startX + (isHorizontal ? offset : rowOffset),
        y: startY + (isHorizontal ? rowOffset : offset),
        width: tileWidth,
        height: tileHeight,
        isPartial: false,
      });
    }

    // Place pavers from RIGHT/BOTTOM corner
    for (let i = 0; i < p; i++) {
      const offset = axisPlan.edgeLength - (i + 1) * U + G;
      const rowOffset = row * (rowDepth + GROUT_MM);
      positions.push({
        x: startX + (isHorizontal ? offset : rowOffset),
        y: startY + (isHorizontal ? rowOffset : offset),
        width: tileWidth,
        height: tileHeight,
        isPartial: false,
      });
    }

    // Place centre cuts based on strategy
    const centreStart = p * U;

    if (axisPlan.centreMode === 'single_cut') {
      const cutSize = axisPlan.cutSizes[0];
      const cutPosition = centreStart; // g0 already includes grout on left
      const rowOffset = row * (rowDepth + GROUT_MM);
      positions.push({
        x: startX + (isHorizontal ? cutPosition : rowOffset),
        y: startY + (isHorizontal ? rowOffset : cutPosition),
        width: isHorizontal ? cutSize : tileWidth,
        height: isHorizontal ? tileHeight : cutSize,
        isPartial: true,
      });
    } else if (axisPlan.centreMode === 'double_cut') {
      const [cLeft, cRight] = axisPlan.cutSizes;
      const rowOffset = row * (rowDepth + GROUT_MM);

      // First cut (left/top)
      const leftCutPosition = centreStart; // g0 already includes grout on left
      positions.push({
        x: startX + (isHorizontal ? leftCutPosition : rowOffset),
        y: startY + (isHorizontal ? rowOffset : leftCutPosition),
        width: isHorizontal ? cLeft : tileWidth,
        height: isHorizontal ? tileHeight : cLeft,
        isPartial: true,
      });

      // Second cut (right/bottom) with grout line between
      const rightCutPosition = leftCutPosition + cLeft + G;
      positions.push({
        x: startX + (isHorizontal ? rightCutPosition : rowOffset),
        y: startY + (isHorizontal ? rowOffset : rightCutPosition),
        width: isHorizontal ? cRight : tileWidth,
        height: isHorizontal ? tileHeight : cRight,
        isPartial: true,
      });
    }
    // If centreMode === 'perfect', no cuts needed
  }

  return positions;
};

/**
 * Legacy API for PoolComponent - wraps the new algorithm
 * Accepts both legacy (along/inward) and new (width/height) config formats
 */
export const calculatePoolCoping = (pool: Pool, config?: LegacyCopingConfig | CopingConfig): CopingCalculation => {
  const copingConfig = config || DEFAULT_COPING_OPTIONS[0];

  // Detect if this is a legacy or new config
  const isLegacy = 'along' in (copingConfig.tile as any);

  let globalConfig: CopingConfig;

  if (isLegacy) {
    const legacyConfig = copingConfig as LegacyCopingConfig;
    // Convert legacy config to world orientation (width/height)
    globalConfig = {
      id: legacyConfig.id,
      name: legacyConfig.name,
      tile: { width: legacyConfig.tile.along, height: legacyConfig.tile.inward },
      rows: legacyConfig.rows,
    };
  } else {
    globalConfig = copingConfig as CopingConfig;
  }

  // Use new algorithm
  const plan = planPoolCopingGlobal(pool, globalConfig);

  // Tile depths per edge type (pure tile size, no grout)
  const sideRowDepth = globalConfig.tile.height;  // horizontal edges extend in Y
  const endRowDepth  = globalConfig.tile.width;     // vertical edges extend in X

  // Generate positions for each side with fixed world orientation
  const deepEnd: CopingSide = {
    rows: globalConfig.rows.deep,
    depth: endRowDepth,  // vertical edge uses tile.width
    width: endRowDepth * globalConfig.rows.deep,
    length: plan.widthAxis.edgeLength,
    fullPavers: plan.deepEnd.fullPavers,
    partialPaver: plan.widthAxis.cutSizes.length > 0 ? plan.widthAxis.gapBeforeCentre : null,
    paverPositions: generatePaverPositions(
      pool.length + GROUT_MM, // offset from pool edge
      0,  // start at corner
      plan.widthAxis,
      globalConfig.tile.width,
      globalConfig.tile.height,
      false, // vertical edge
      globalConfig.rows.deep
    ),
  };

  const shallowEnd: CopingSide = {
    rows: globalConfig.rows.shallow,
    depth: endRowDepth,  // vertical edge uses tile.width
    width: endRowDepth * globalConfig.rows.shallow,
    length: plan.widthAxis.edgeLength,
    fullPavers: plan.shallowEnd.fullPavers,
    partialPaver: plan.widthAxis.cutSizes.length > 0 ? plan.widthAxis.gapBeforeCentre : null,
    paverPositions: generatePaverPositions(
      -(endRowDepth + GROUT_MM) * globalConfig.rows.shallow, // offset from pool edge
      0,  // start at corner
      plan.widthAxis,
      globalConfig.tile.width,
      globalConfig.tile.height,
      false, // vertical edge
      globalConfig.rows.shallow
    ),
  };

  const leftSide: CopingSide = {
    rows: globalConfig.rows.sides,
    depth: sideRowDepth,  // horizontal edge uses tile.height
    width: sideRowDepth * globalConfig.rows.sides,
    length: pool.length,  // no extension - just pool length
    fullPavers: plan.leftSide.fullPavers,
    partialPaver: plan.lengthAxis.cutSizes.length > 0 ? plan.lengthAxis.gapBeforeCentre : null,
    paverPositions: generatePaverPositions(
      0,  // start at corner
      -(sideRowDepth + GROUT_MM) * globalConfig.rows.sides,  // offset from pool edge
      plan.lengthAxis,
      globalConfig.tile.width,
      globalConfig.tile.height,
      true, // horizontal edge
      globalConfig.rows.sides
    ),
  };

  const rightSide: CopingSide = {
    rows: globalConfig.rows.sides,
    depth: sideRowDepth,  // horizontal edge uses tile.height
    width: sideRowDepth * globalConfig.rows.sides,
    length: pool.length,  // no extension - just pool length
    fullPavers: plan.rightSide.fullPavers,
    partialPaver: plan.lengthAxis.cutSizes.length > 0 ? plan.lengthAxis.gapBeforeCentre : null,
    paverPositions: generatePaverPositions(
      0,  // start at corner
      pool.width + GROUT_MM,  // offset from pool edge
      plan.lengthAxis,
      globalConfig.tile.width,
      globalConfig.tile.height,
      true, // horizontal edge
      globalConfig.rows.sides
    ),
  };

  const totalArea = (
    (plan.widthAxis.edgeLength * endRowDepth * globalConfig.rows.deep) +
    (plan.widthAxis.edgeLength * endRowDepth * globalConfig.rows.shallow) +
    (pool.length * sideRowDepth * globalConfig.rows.sides) +
    (pool.length * sideRowDepth * globalConfig.rows.sides)
  ) / 1000000;

  return {
    deepEnd,
    shallowEnd,
    leftSide,
    rightSide,
    totalFullPavers: plan.totalFullPavers,
    totalPartialPavers: plan.totalPartialPavers,
    totalPavers: plan.totalPavers,
    totalArea,
  };
};

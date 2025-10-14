//
// Global‑orientation coping planner
// - Corner‑first, centre‑only cuts, mirrored left/right & shallow/deep
// - One global tile orientation (no rotation at corners)
// - Per‑axis MIN_CUT = max(200, floor(along/2))  => 600‑along → 300 mm
//

export const GROUT_MM = 5;
export const MIN_CUT_MM = 200;

export interface Pool {
  length: number;  // mm (distance along the long sides)
  width: number;   // mm (distance along the short ends)
}

/**
 * Global orientation of a rectangular tile:
 *   x = tile size along global X (horizontal)
 *   y = tile size along global Y (vertical)
 *
 * 400x400:  { x: 400, y: 400 }
 * 600x400 (long‑X): { x: 600, y: 400 }  → ends rows = 600, sides rows = 400
 * 400x600 (long‑Y): { x: 400, y: 600 }  → ends rows = 400, sides rows = 600
 */
export interface GlobalTile {
  x: number; // mm along global X
  y: number; // mm along global Y
}

export interface CopingConfig {
  id: string;
  name: string;
  tile: GlobalTile;           // one global orientation for the whole pool
  rows: {
    sides: number;            // rows on the long sides (left/right)
    shallow: number;          // rows at shallow end
    deep: number;             // rows at deep end
  };
}

export const COPING_OPTIONS: CopingConfig[] = [
  {
    id: 'coping-400x400',
    name: 'Coping 400×400 (global square)',
    tile: { x: 400, y: 400 },
    rows: { sides: 1, shallow: 1, deep: 2 },
  },
  {
    id: 'coping-600x400',
    name: 'Coping 600×400 (global long‑X)',
    tile: { x: 600, y: 400 },               // ✅ ends rows = 600, sides rows = 400
    rows: { sides: 1, shallow: 1, deep: 2 },
  },
  {
    id: 'coping-400x600',
    name: 'Coping 400×600 (global long‑Y)',
    tile: { x: 400, y: 600 },               // ✅ ends rows = 400, sides rows = 600
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
    // two (nearly) equal cuts
    const totalCuts = g0 - 3 * G;
    const cL = Math.floor(totalCuts / 2);
    const cR = totalCuts - cL; // exact sum
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

  // For uniform tiling, determine the long edge (runs along pool edges)
  // and short edge (projects inward) from the tile dimensions
  const along = Math.max(tile.x, tile.y);   // e.g., 600mm for both 600×400 and 400×600
  const inward = Math.min(tile.x, tile.y);  // e.g., 400mm for both

  // Row depths (how far each row projects perpendicular to the edge)
  const rowDepth = inward;  // same depth for all edges

  // Corner extension for ends
  const cornerExtension = rows.sides * rowDepth;
  const widthEdgeLength = pool.width + 2 * cornerExtension;

  // Calculate axis plans using the SAME 'along' dimension for all edges
  const lengthAxis = planAxis(pool.length, along, GROUT_MM);
  const widthAxis = planAxis(widthEdgeLength, along, GROUT_MM);

  // Totals per edge (apply rows)
  const leftSide: EdgeTotals = {
    rows: rows.sides,
    fullPavers: lengthAxis.fullPaversTotal * rows.sides,
    partialPavers: lengthAxis.partialPaversTotal * rows.sides,
    pavers: lengthAxis.paversTotal * rows.sides,
  };
  const rightSide: EdgeTotals = {
    rows: rows.sides,
    fullPavers: lengthAxis.fullPaversTotal * rows.sides,
    partialPavers: lengthAxis.partialPaversTotal * rows.sides,
    pavers: lengthAxis.paversTotal * rows.sides,
  };
  const shallowEnd: EdgeTotals = {
    rows: rows.shallow,
    fullPavers: widthAxis.fullPaversTotal * rows.shallow,
    partialPavers: widthAxis.partialPaversTotal * rows.shallow,
    pavers: widthAxis.paversTotal * rows.shallow,
  };
  const deepEnd: EdgeTotals = {
    rows: rows.deep,
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
  width: number;
  length: number;
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
    name: 'Coping 400×400',
    tile: { along: 400, inward: 400 },
    rows: { sides: 1, shallow: 1, deep: 2 },
  },
  {
    id: 'coping-600x400',
    name: 'Coping 600×400',
    tile: { along: 600, inward: 400 },
    rows: { sides: 1, shallow: 1, deep: 2 },
  },
  {
    id: 'coping-400x600',
    name: 'Coping 400×600',
    tile: { along: 400, inward: 600 },
    rows: { sides: 1, shallow: 1, deep: 2 },
  }
];

/**
 * Generate paver positions using the new AxisPlan approach.
 */
const generatePaverPositions = (
  startX: number,
  startY: number,
  axisPlan: AxisPlan,
  paverWidth: number,
  isHorizontal: boolean,
  rows: number
): CopingPaver[] => {
  const positions: CopingPaver[] = [];
  const A = axisPlan.along;
  const G = axisPlan.grout;
  const U = A + G;
  const p = axisPlan.paversPerCorner;

  for (let row = 0; row < rows; row++) {
    // Place pavers from LEFT/TOP corner
    for (let i = 0; i < p; i++) {
      const offset = i * U;
      positions.push({
        x: startX + (isHorizontal ? offset : row * paverWidth),
        y: startY + (isHorizontal ? row * paverWidth : offset),
        width: isHorizontal ? A : paverWidth,
        height: isHorizontal ? paverWidth : A,
        isPartial: false,
      });
    }

    // Place pavers from RIGHT/BOTTOM corner
    for (let i = 0; i < p; i++) {
      const offset = axisPlan.edgeLength - (i + 1) * U + G;
      positions.push({
        x: startX + (isHorizontal ? offset : row * paverWidth),
        y: startY + (isHorizontal ? row * paverWidth : offset),
        width: isHorizontal ? A : paverWidth,
        height: isHorizontal ? paverWidth : A,
        isPartial: false,
      });
    }

    // Place centre cuts based on strategy
    const centreStart = p * U;

    if (axisPlan.centreMode === 'single_cut') {
      const cutSize = axisPlan.cutSizes[0];
      const cutPosition = centreStart + G;
      positions.push({
        x: startX + (isHorizontal ? cutPosition : row * paverWidth),
        y: startY + (isHorizontal ? row * paverWidth : cutPosition),
        width: isHorizontal ? cutSize : paverWidth,
        height: isHorizontal ? paverWidth : cutSize,
        isPartial: true,
      });
    } else if (axisPlan.centreMode === 'double_cut') {
      const [cLeft, cRight] = axisPlan.cutSizes;
      
      // First cut (left/top)
      const leftCutPosition = centreStart + G;
      positions.push({
        x: startX + (isHorizontal ? leftCutPosition : row * paverWidth),
        y: startY + (isHorizontal ? row * paverWidth : leftCutPosition),
        width: isHorizontal ? cLeft : paverWidth,
        height: isHorizontal ? paverWidth : cLeft,
        isPartial: true,
      });

      // Second cut (right/bottom) with grout line between
      const rightCutPosition = leftCutPosition + cLeft + G;
      positions.push({
        x: startX + (isHorizontal ? rightCutPosition : row * paverWidth),
        y: startY + (isHorizontal ? row * paverWidth : rightCutPosition),
        width: isHorizontal ? cRight : paverWidth,
        height: isHorizontal ? paverWidth : cRight,
        isPartial: true,
      });
    }
    // If centreMode === 'perfect', no cuts needed
  }

  return positions;
};

/**
 * Legacy API for PoolComponent - wraps the new algorithm
 * Accepts both legacy (along/inward) and new (x/y) config formats
 */
export const calculatePoolCoping = (pool: Pool, config?: LegacyCopingConfig | CopingConfig): CopingCalculation => {
  const copingConfig = config || DEFAULT_COPING_OPTIONS[0];
  
  // Detect if this is a legacy or new config
  const isLegacy = 'along' in (copingConfig.tile as any);
  
  let globalConfig: CopingConfig;
  let paverInward: number;
  
  if (isLegacy) {
    const legacyConfig = copingConfig as LegacyCopingConfig;
    // Convert legacy config to global orientation
    globalConfig = {
      id: legacyConfig.id,
      name: legacyConfig.name,
      tile: { x: legacyConfig.tile.along, y: legacyConfig.tile.inward },
      rows: legacyConfig.rows,
    };
    paverInward = legacyConfig.tile.inward;
  } else {
    globalConfig = copingConfig as CopingConfig;
    // For new config, inward dimension is tile.y for sides
    paverInward = globalConfig.tile.y;
  }
  
  // Use new algorithm
  const plan = planPoolCopingGlobal(pool, globalConfig);
  const cornerExtension = copingConfig.rows.sides * paverInward;

  // Generate positions for each side using the new approach
  const deepEnd: CopingSide = {
    rows: copingConfig.rows.deep,
    width: paverInward * copingConfig.rows.deep,
    length: plan.widthAxis.edgeLength,
    fullPavers: plan.deepEnd.fullPavers,
    partialPaver: plan.widthAxis.cutSizes.length > 0 ? plan.widthAxis.gapBeforeCentre : null,
    paverPositions: generatePaverPositions(
      pool.length,
      -cornerExtension,
      plan.widthAxis,
      paverInward,
      false,
      copingConfig.rows.deep
    ),
  };

  const shallowEnd: CopingSide = {
    rows: copingConfig.rows.shallow,
    width: paverInward * copingConfig.rows.shallow,
    length: plan.widthAxis.edgeLength,
    fullPavers: plan.shallowEnd.fullPavers,
    partialPaver: plan.widthAxis.cutSizes.length > 0 ? plan.widthAxis.gapBeforeCentre : null,
    paverPositions: generatePaverPositions(
      -paverInward * copingConfig.rows.shallow,
      -cornerExtension,
      plan.widthAxis,
      paverInward,
      false,
      copingConfig.rows.shallow
    ),
  };

  const leftSide: CopingSide = {
    rows: copingConfig.rows.sides,
    width: paverInward * copingConfig.rows.sides,
    length: pool.length,
    fullPavers: plan.leftSide.fullPavers,
    partialPaver: plan.lengthAxis.cutSizes.length > 0 ? plan.lengthAxis.gapBeforeCentre : null,
    paverPositions: generatePaverPositions(
      0,
      -paverInward * copingConfig.rows.sides,
      plan.lengthAxis,
      paverInward,
      true,
      copingConfig.rows.sides
    ),
  };

  const rightSide: CopingSide = {
    rows: copingConfig.rows.sides,
    width: paverInward * copingConfig.rows.sides,
    length: pool.length,
    fullPavers: plan.rightSide.fullPavers,
    partialPaver: plan.lengthAxis.cutSizes.length > 0 ? plan.lengthAxis.gapBeforeCentre : null,
    paverPositions: generatePaverPositions(
      0,
      pool.width,
      plan.lengthAxis,
      paverInward,
      true,
      copingConfig.rows.sides
    ),
  };

  const totalArea = (
    (plan.widthAxis.edgeLength * paverInward * copingConfig.rows.deep) +
    (plan.widthAxis.edgeLength * paverInward * copingConfig.rows.shallow) +
    (pool.length * paverInward * copingConfig.rows.sides) +
    (pool.length * paverInward * copingConfig.rows.sides)
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

import { Pool } from '@/constants/pools';

// ──────────────────────────────────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────────────────────────────────

export const GROUT_MM = 5;            // grout between every adjacent paver
export const MIN_CUT_MM = 200;        // minimum acceptable cut paver width

export interface CopingConfig {
  id: string;
  name: string;
  tile: {
    along: number;   // mm (dimension that runs along each pool edge)
    inward: number;  // mm (dimension that runs away from the waterline towards the deck)
  };
  rows: {
    sides: number;    // rows along each long side (left/right)
    shallow: number;  // rows at the shallow end
    deep: number;     // rows at the deep end
  };
}

export const DEFAULT_COPING_OPTIONS: CopingConfig[] = [
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

// ──────────────────────────────────────────────────────────────────────────────
// NEW ALGORITHM TYPES
// ──────────────────────────────────────────────────────────────────────────────

export type CentreStrategy = 'perfect' | 'single_cut' | 'double_cut';

export interface AxisPlan {
  edgeLength: number;
  tileAlong: number;
  grout: number;
  minCut: number;
  paversPerCorner: number;
  centreMode: CentreStrategy;
  cutSizes: number[];
  centreJoints: number;
  removedFromEachSide: number;
  gapBeforeCuts: number;
  meetsMinCut: boolean;
  fullPaversTotal: number;
  partialPaversTotal: number;
  paversTotal: number;
}

export interface EdgeTotals {
  rows: number;
  fullPavers: number;
  partialPavers: number;
  pavers: number;
}

export interface CopingPlan {
  lengthAxis: AxisPlan;
  widthAxis: AxisPlan;
  leftSide: EdgeTotals;
  rightSide: EdgeTotals;
  shallowEnd: EdgeTotals;
  deepEnd: EdgeTotals;
  totalFullPavers: number;
  totalPartialPavers: number;
  totalPavers: number;
  symmetry: {
    sidesMirror: boolean;
    endsMirror: boolean;
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// LEGACY TYPES (for backward compatibility with PoolComponent)
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

// ──────────────────────────────────────────────────────────────────────────────
// CORE MATH (corner-first, centre-only cuts, mirrored)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Plan a single axis (one edge, then mirrored to the opposite).
 *
 * Key definitions:
 * - A = tileAlong
 * - G = grout
 * - U = A + G
 * - p = number of full pavers placed from EACH corner towards centre
 *
 * We first place p full pavers from both corners (including the p-1 interior joints per side).
 * The remaining central free space BEFORE any centre pieces is:
 *   g0 = L - [2*p*A + 2*(p-1)*G] = L - 2*p*U + 2*G
 *
 * Centre requirements:
 *   • perfect fit:          needs exactly 1 joint → g0 = 1*G
 *   • single centred cut:   needs 2 joints + 1 cut → g0 = 2*G + c,  c ≥ MIN_CUT
 *   • two equal centred cuts: needs 3 joints + 2 cuts → g0 = 3*G + 2*c,  c ≥ MIN_CUT
 */
export function planAxis(
  edgeLength: number,
  tileAlong: number,
  grout: number = GROUT_MM,
  minCut: number = MIN_CUT_MM
): AxisPlan {
  const A = tileAlong;
  const G = grout;
  const U = A + G;

  const eps = 1; // 1 mm tolerance for "perfect" comparisons

  // Choose p so that at least one centre joint (G) is always possible
  const pInitial = Math.floor((edgeLength + G) / (2 * U));

  let p = Math.max(0, pInitial);
  let g0 = edgeLength - 2 * p * U + 2 * G;
  let removed = 0;

  // If g0 is too small to host a single cut, increase by removing pavers symmetrically
  while (g0 > 0 && g0 < (2 * G + minCut) && p > 0) {
    p -= 1;
    removed += 1;
    g0 += 2 * U;
  }

  // Decide centre strategy
  let centreMode: CentreStrategy;
  let cutSizes: number[] = [];
  let centreJoints = 0;
  let meetsMinCut = true;

  if (Math.abs(g0 - G) <= eps) {
    centreMode = 'perfect';
    centreJoints = 1;
    cutSizes = [];
  } else if (g0 >= (3 * G + 2 * minCut)) {
    // Two equal cuts
    const c = (g0 - 3 * G) / 2;
    const cLeft = Math.floor(c);
    const cRight = Math.round(g0 - 3 * G - cLeft);
    centreMode = 'double_cut';
    centreJoints = 3;
    cutSizes = [cLeft, cRight];
    meetsMinCut = (cLeft >= minCut && cRight >= minCut);
  } else if (g0 >= (2 * G + minCut)) {
    // One centred cut
    const c = g0 - 2 * G;
    centreMode = 'single_cut';
    centreJoints = 2;
    cutSizes = [Math.round(c)];
    meetsMinCut = (cutSizes[0] >= minCut);
  } else {
    // Edge case: fall back to single cut
    const c = Math.max(0, g0 - 2 * G);
    centreMode = 'single_cut';
    centreJoints = 2;
    cutSizes = [Math.round(c)];
    meetsMinCut = (cutSizes[0] >= minCut);
  }

  const fullPaversTotal = 2 * p;
  const partialPaversTotal = cutSizes.length;
  const paversTotal = fullPaversTotal + partialPaversTotal;

  return {
    edgeLength,
    tileAlong: A,
    grout: G,
    minCut,
    paversPerCorner: p,
    centreMode,
    cutSizes,
    centreJoints,
    removedFromEachSide: removed,
    gapBeforeCuts: Math.round(g0),
    meetsMinCut,
    fullPaversTotal,
    partialPaversTotal,
    paversTotal,
  };
}

/**
 * High-level planner for a rectangular pool with corner-first, centre-only cuts,
 * mirrored left/right and shallow/deep.
 */
export function planPoolCoping(pool: Pool, config: CopingConfig): CopingPlan {
  const { tile, rows } = config;
  const { along: A, inward: I } = tile;

  const cornerExtension = rows.sides * I;
  const endEdgeLength = pool.width + 2 * cornerExtension;

  const lengthAxis = planAxis(pool.length, A, GROUT_MM, MIN_CUT_MM);
  const widthAxis = planAxis(endEdgeLength, A, GROUT_MM, MIN_CUT_MM);

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

  const totalPavers = totalFullPavers + totalPartialPavers;

  return {
    lengthAxis,
    widthAxis,
    leftSide,
    rightSide,
    shallowEnd,
    deepEnd,
    totalFullPavers,
    totalPartialPavers,
    totalPavers,
    symmetry: {
      sidesMirror: true,
      endsMirror: true,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// POSITION GENERATION (for visual rendering)
// ──────────────────────────────────────────────────────────────────────────────

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
  const A = axisPlan.tileAlong;
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

// ──────────────────────────────────────────────────────────────────────────────
// BRIDGE FUNCTION (maintains backward compatibility)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Legacy API for PoolComponent - wraps the new algorithm
 */
export const calculatePoolCoping = (pool: Pool, config?: CopingConfig): CopingCalculation => {
  const copingConfig = config || DEFAULT_COPING_OPTIONS[0];
  
  // Use new algorithm
  const plan = planPoolCoping(pool, copingConfig);
  
  const paverInward = copingConfig.tile.inward;
  const cornerExtension = copingConfig.rows.sides * paverInward;

  // Generate positions for each side using the new approach
  const deepEnd: CopingSide = {
    rows: copingConfig.rows.deep,
    width: paverInward * copingConfig.rows.deep,
    length: plan.widthAxis.edgeLength,
    fullPavers: plan.deepEnd.fullPavers,
    partialPaver: plan.widthAxis.cutSizes.length > 0 ? plan.widthAxis.gapBeforeCuts : null,
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
    partialPaver: plan.widthAxis.cutSizes.length > 0 ? plan.widthAxis.gapBeforeCuts : null,
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
    partialPaver: plan.lengthAxis.cutSizes.length > 0 ? plan.lengthAxis.gapBeforeCuts : null,
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
    partialPaver: plan.lengthAxis.cutSizes.length > 0 ? plan.lengthAxis.gapBeforeCuts : null,
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

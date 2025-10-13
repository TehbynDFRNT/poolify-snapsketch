import { Pool } from '@/constants/pools';

// Grout line width constant (5mm between all pavers)
const GROUT_LINE_WIDTH = 5;

export interface CopingConfig {
  id: string;
  name: string;
  tile: {
    along: number; // mm - dimension along pool edge
    inward: number; // mm - dimension extending from pool
  };
  rows: {
    sides: number;
    shallow: number;
    deep: number;
  };
  cornerStrategy: 'corner-first';
  balanceCuts: 'two-small-on-long-edges' | 'one-at-end';
}

export const DEFAULT_COPING_OPTIONS: CopingConfig[] = [
  {
    id: 'coping-400x400',
    name: 'Coping 400×400',
    tile: { along: 400, inward: 400 },
    rows: { sides: 1, shallow: 1, deep: 2 },
    cornerStrategy: 'corner-first',
    balanceCuts: 'two-small-on-long-edges'
  },
  {
    id: 'coping-600x400',
    name: 'Coping 600×400',
    tile: { along: 600, inward: 400 },
    rows: { sides: 1, shallow: 1, deep: 2 },
    cornerStrategy: 'corner-first',
    balanceCuts: 'two-small-on-long-edges'
  },
  {
    id: 'coping-400x600',
    name: 'Coping 400×600',
    tile: { along: 400, inward: 600 },
    rows: { sides: 1, shallow: 1, deep: 2 },
    cornerStrategy: 'corner-first',
    balanceCuts: 'two-small-on-long-edges'
  }
];

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

// Corner-first strategy: calculate pavers from both corners inward with grout lines
const calculatePavers = (
  dimension: number, 
  paverSize: number
): { 
  fullPavers: number; 
  paversPerCorner: number;
  middleFullPavers: number;
  middleGap: number; 
  groutLines: number;
  effectiveUnit: number;
} => {
  // Effective unit includes paver size + grout line
  const effectiveUnit = paverSize + GROUT_LINE_WIDTH;
  
  // Work from each corner inward (half the dimension per corner)
  const paversPerCorner = Math.floor((dimension / 2) / effectiveUnit);
  
  // Total full pavers from both corners
  let fullPavers = paversPerCorner * 2;
  
  // Calculate space used by pavers and grout lines
  let groutLines = fullPavers > 0 ? fullPavers - 1 : 0;
  let spaceUsed = (fullPavers * paverSize) + (groutLines * GROUT_LINE_WIDTH);
  
  // Calculate initial middle gap
  let middleGap = dimension - spaceUsed;
  
  // Check if we can fit more full pavers in the middle gap
  let middleFullPavers = 0;
  while (middleGap >= paverSize) {
    middleFullPavers++;
    fullPavers++;
    groutLines++; // Add grout line for the new paver
    middleGap -= paverSize + GROUT_LINE_WIDTH;
  }
  
  return { 
    fullPavers, 
    paversPerCorner,
    middleFullPavers,
    middleGap, 
    groutLines,
    effectiveUnit
  };
};

// Corner-first strategy: generate paver positions from corners inward with grout lines
const generatePaverPositions = (
  startX: number,
  startY: number,
  length: number,
  paverSize: number,
  paverWidth: number,
  isHorizontal: boolean,
  rows: number
): CopingPaver[] => {
  const positions: CopingPaver[] = [];
  const { fullPavers, paversPerCorner, middleFullPavers, middleGap, effectiveUnit } = calculatePavers(length, paverSize);
  
  for (let row = 0; row < rows; row++) {
    // Place pavers from LEFT/TOP corner working inward
    for (let i = 0; i < paversPerCorner; i++) {
      // Position accounts for grout lines: each paver starts at i * effectiveUnit
      const offset = i * effectiveUnit;
      
      positions.push({
        x: startX + (isHorizontal ? offset : row * paverWidth),
        y: startY + (isHorizontal ? row * paverWidth : offset),
        width: isHorizontal ? paverSize : paverWidth,
        height: isHorizontal ? paverWidth : paverSize,
        isPartial: false,
      });
    }
    
    // Place full pavers in the middle (if any fit)
    let middleStart = paversPerCorner * effectiveUnit;
    for (let i = 0; i < middleFullPavers; i++) {
      positions.push({
        x: startX + (isHorizontal ? middleStart : row * paverWidth),
        y: startY + (isHorizontal ? row * paverWidth : middleStart),
        width: isHorizontal ? paverSize : paverWidth,
        height: isHorizontal ? paverWidth : paverSize,
        isPartial: false,
      });
      middleStart += effectiveUnit;
    }
    
    // Place pavers from RIGHT/BOTTOM corner working inward
    for (let i = 0; i < paversPerCorner; i++) {
      // Start from the far end and work backwards
      const offset = length - (i + 1) * effectiveUnit + GROUT_LINE_WIDTH;
      
      positions.push({
        x: startX + (isHorizontal ? offset : row * paverWidth),
        y: startY + (isHorizontal ? row * paverWidth : offset),
        width: isHorizontal ? paverSize : paverWidth,
        height: isHorizontal ? paverWidth : paverSize,
        isPartial: false,
      });
    }
    
    // Fill remaining middle gap with cut paver if gap exists
    if (middleGap > 0) {
      positions.push({
        x: startX + (isHorizontal ? middleStart : row * paverWidth),
        y: startY + (isHorizontal ? row * paverWidth : middleStart),
        width: isHorizontal ? middleGap : paverWidth,
        height: isHorizontal ? paverWidth : middleGap,
        isPartial: true,
      });
    }
  }
  
  return positions;
};

export const calculatePoolCoping = (pool: Pool, config?: CopingConfig): CopingCalculation => {
  // Use default 400x400 config if not provided (backward compatibility)
  const copingConfig = config || DEFAULT_COPING_OPTIONS[0];
  
  const paverAlong = copingConfig.tile.along;
  const paverInward = copingConfig.tile.inward;
  const rowsDeep = copingConfig.rows.deep;
  const rowsShallow = copingConfig.rows.shallow;
  const rowsSides = copingConfig.rows.sides;
  const balanceCuts = copingConfig.balanceCuts;
  
  // Corner extension = width of top/bottom coping
  const cornerExtension = rowsSides * paverInward;
  
  // Deep End (RIGHT side - configurable rows, extends top and bottom to cover corners)
  const deWidth = pool.width + (cornerExtension * 2); // Add both corners
  const deCalc = calculatePavers(deWidth, paverAlong);
  const deepEnd: CopingSide = {
    rows: rowsDeep,
    width: paverInward * rowsDeep,
    length: deWidth,
    fullPavers: deCalc.fullPavers * rowsDeep,
    partialPaver: deCalc.middleGap > 0 ? deCalc.middleGap : null,
    paverPositions: generatePaverPositions(
      pool.length, // Start at right edge of pool
      -cornerExtension, // Start above pool (corner extension matches top/bottom width)
      deWidth,
      paverAlong,
      paverInward,
      false, // vertical (running up/down on right side)
      rowsDeep
    ),
  };

  // Shallow End (LEFT side - configurable rows, extends top and bottom to cover corners)
  const seWidth = pool.width + (cornerExtension * 2);
  const seCalc = calculatePavers(seWidth, paverAlong);
  const shallowEnd: CopingSide = {
    rows: rowsShallow,
    width: paverInward * rowsShallow,
    length: seWidth,
    fullPavers: seCalc.fullPavers * rowsShallow,
    partialPaver: seCalc.middleGap > 0 ? seCalc.middleGap : null,
    paverPositions: generatePaverPositions(
      -paverInward * rowsShallow, // Left of pool
      -cornerExtension, // Start above pool (corner extension matches top/bottom width)
      seWidth,
      paverAlong,
      paverInward,
      false, // vertical (running up/down on left side)
      rowsShallow
    ),
  };

  // Top Side (configurable rows, between SE and DE - no corner extension)
  const topLength = pool.length;
  const topCalc = calculatePavers(topLength, paverAlong);
  const leftSide: CopingSide = {
    rows: rowsSides,
    width: paverInward * rowsSides,
    length: topLength,
    fullPavers: topCalc.fullPavers * rowsSides,
    partialPaver: topCalc.middleGap > 0 ? topCalc.middleGap : null,
    paverPositions: generatePaverPositions(
      0, // Start at left edge of pool
      -paverInward * rowsSides, // Above pool
      topLength,
      paverAlong,
      paverInward,
      true, // horizontal (running left/right on top)
      rowsSides
    ),
  };

  // Bottom Side (configurable rows, between SE and DE - no corner extension)
  const bottomLength = pool.length;
  const bottomCalc = calculatePavers(bottomLength, paverAlong);
  const rightSide: CopingSide = {
    rows: rowsSides,
    width: paverInward * rowsSides,
    length: bottomLength,
    fullPavers: bottomCalc.fullPavers * rowsSides,
    partialPaver: bottomCalc.middleGap > 0 ? bottomCalc.middleGap : null,
    paverPositions: generatePaverPositions(
      0, // Start at left edge of pool
      pool.width, // Below pool
      bottomLength,
      paverAlong,
      paverInward,
      true, // horizontal (running left/right on bottom)
      rowsSides
    ),
  };

  // Totals
  const totalFullPavers = 
    deepEnd.fullPavers + 
    shallowEnd.fullPavers + 
    leftSide.fullPavers + 
    rightSide.fullPavers;
  
  const totalPartialPavers = 
    (deepEnd.partialPaver ? rowsDeep : 0) +
    (shallowEnd.partialPaver ? rowsShallow : 0) +
    (leftSide.partialPaver ? rowsSides : 0) +
    (rightSide.partialPaver ? rowsSides : 0);
  
  const totalPavers = totalFullPavers + totalPartialPavers;
  
  const totalArea = (
    (deWidth * paverInward * rowsDeep) + // Deep End
    (seWidth * paverInward * rowsShallow) + // Shallow End
    (topLength * paverInward * rowsSides) + // Top
    (bottomLength * paverInward * rowsSides) // Bottom
  ) / 1000000; // mm² to m²

  return {
    deepEnd,
    shallowEnd,
    leftSide,
    rightSide,
    totalFullPavers,
    totalPartialPavers,
    totalPavers,
    totalArea,
  };
};

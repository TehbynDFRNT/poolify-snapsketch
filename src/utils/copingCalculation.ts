import { Pool } from '@/constants/pools';

const PAVER_SIZE = 400; // mm (400×400 pavers)

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

// Helper to calculate pavers for a dimension
const calculatePavers = (dimension: number): { fullPavers: number; partialPaver: number | null } => {
  const fullPavers = Math.floor(dimension / PAVER_SIZE);
  const remainder = dimension % PAVER_SIZE;
  const partialPaver = remainder > 0 ? remainder : null;
  
  return { fullPavers, partialPaver };
};

// Helper to generate paver positions
const generatePaverPositions = (
  startX: number,
  startY: number,
  length: number,
  width: number,
  isHorizontal: boolean,
  rows: number
): CopingPaver[] => {
  const positions: CopingPaver[] = [];
  const { fullPavers, partialPaver } = calculatePavers(length);
  
  for (let row = 0; row < rows; row++) {
    for (let i = 0; i < fullPavers; i++) {
      positions.push({
        x: startX + (isHorizontal ? i * PAVER_SIZE : row * PAVER_SIZE),
        y: startY + (isHorizontal ? row * PAVER_SIZE : i * PAVER_SIZE),
        width: PAVER_SIZE,
        height: PAVER_SIZE,
        isPartial: false,
      });
    }
    
    // Add partial paver if exists
    if (partialPaver) {
      positions.push({
        x: startX + (isHorizontal ? fullPavers * PAVER_SIZE : row * PAVER_SIZE),
        y: startY + (isHorizontal ? row * PAVER_SIZE : fullPavers * PAVER_SIZE),
        width: isHorizontal ? partialPaver : PAVER_SIZE,
        height: isHorizontal ? PAVER_SIZE : partialPaver,
        isPartial: true,
      });
    }
  }
  
  return positions;
};

export const calculatePoolCoping = (pool: Pool): CopingCalculation => {
  // Deep End (RIGHT side - 2 rows, extends top and bottom 400mm for corners)
  const deWidth = pool.width + 800; // Add both corners (top and bottom)
  const deCalc = calculatePavers(deWidth);
  const deepEnd: CopingSide = {
    rows: 2,
    width: 800,
    length: deWidth,
    fullPavers: deCalc.fullPavers * 2, // 2 rows
    partialPaver: deCalc.partialPaver,
    paverPositions: generatePaverPositions(
      pool.length, // Start at right edge of pool
      -400, // Start 400mm above pool (corner extension)
      deWidth,
      800,
      false, // vertical (running up/down on right side)
      2 // 2 rows extending to the right
    ),
  };

  // Shallow End (LEFT side - 1 row, extends top and bottom 400mm)
  const seWidth = pool.width + 800;
  const seCalc = calculatePavers(seWidth);
  const shallowEnd: CopingSide = {
    rows: 1,
    width: 400,
    length: seWidth,
    fullPavers: seCalc.fullPavers,
    partialPaver: seCalc.partialPaver,
    paverPositions: generatePaverPositions(
      -400, // Left of pool
      -400, // Start 400mm above pool (corner extension)
      seWidth,
      400,
      false, // vertical (running up/down on left side)
      1
    ),
  };

  // Top Side (1 row, between SE and DE - no corner extension)
  const topLength = pool.length;
  const topCalc = calculatePavers(topLength);
  const leftSide: CopingSide = {
    rows: 1,
    width: 400,
    length: topLength,
    fullPavers: topCalc.fullPavers,
    partialPaver: topCalc.partialPaver,
    paverPositions: generatePaverPositions(
      0, // Start at left edge of pool
      -400, // Above pool
      topLength,
      400,
      true, // horizontal (running left/right on top)
      1
    ),
  };

  // Bottom Side (1 row, between SE and DE - no corner extension)
  const bottomLength = pool.length;
  const bottomCalc = calculatePavers(bottomLength);
  const rightSide: CopingSide = {
    rows: 1,
    width: 400,
    length: bottomLength,
    fullPavers: bottomCalc.fullPavers,
    partialPaver: bottomCalc.partialPaver,
    paverPositions: generatePaverPositions(
      0, // Start at left edge of pool
      pool.width, // Below pool
      bottomLength,
      400,
      true, // horizontal (running left/right on bottom)
      1
    ),
  };

  // Totals
  const totalFullPavers = 
    deepEnd.fullPavers + 
    shallowEnd.fullPavers + 
    leftSide.fullPavers + 
    rightSide.fullPavers;
  
  const totalPartialPavers = 
    (deepEnd.partialPaver ? 2 : 0) + // 2 rows at DE
    (shallowEnd.partialPaver ? 1 : 0) + // 1 row at SE
    (leftSide.partialPaver ? 1 : 0) + // 1 row at top
    (rightSide.partialPaver ? 1 : 0); // 1 row at bottom
  
  const totalPavers = totalFullPavers + totalPartialPavers;
  
  const totalArea = (
    (deWidth * 800) + // Deep End: 2 rows
    (seWidth * 400) + // Shallow End: 1 row
    (topLength * 400) + // Top: 1 row
    (bottomLength * 400) // Bottom: 1 row
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

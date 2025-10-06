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
        x: startX + (isHorizontal ? i * PAVER_SIZE : 0),
        y: startY + (isHorizontal ? row * PAVER_SIZE : i * PAVER_SIZE),
        width: PAVER_SIZE,
        height: PAVER_SIZE,
        isPartial: false,
      });
    }
    
    // Add partial paver if exists
    if (partialPaver) {
      positions.push({
        x: startX + (isHorizontal ? fullPavers * PAVER_SIZE : 0),
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
  // Deep End (2 rows, extends left and right 400mm for corners)
  const deLength = pool.length + 800; // Add both corners
  const deCalc = calculatePavers(deLength);
  const deepEnd: CopingSide = {
    rows: 2,
    width: 800,
    length: deLength,
    fullPavers: deCalc.fullPavers * 2, // 2 rows
    partialPaver: deCalc.partialPaver,
    paverPositions: generatePaverPositions(
      -400, // Start 400mm left of pool
      -800, // Start 800mm above pool (2 rows)
      deLength,
      800,
      true, // horizontal
      2 // 2 rows
    ),
  };

  // Shallow End (1 row, extends left and right 400mm)
  const seLength = pool.length + 800;
  const seCalc = calculatePavers(seLength);
  const shallowEnd: CopingSide = {
    rows: 1,
    width: 400,
    length: seLength,
    fullPavers: seCalc.fullPavers,
    partialPaver: seCalc.partialPaver,
    paverPositions: generatePaverPositions(
      -400,
      pool.width, // Below pool
      seLength,
      400,
      true,
      1
    ),
  };

  // Left Side (1 row, no corner extension)
  const sideLength = pool.width;
  const leftCalc = calculatePavers(sideLength);
  const leftSide: CopingSide = {
    rows: 1,
    width: 400,
    length: sideLength,
    fullPavers: leftCalc.fullPavers,
    partialPaver: leftCalc.partialPaver,
    paverPositions: generatePaverPositions(
      -400, // Left of pool
      0,
      sideLength,
      400,
      false, // vertical
      1
    ),
  };

  // Right Side (1 row, no corner extension)
  const rightCalc = calculatePavers(sideLength);
  const rightSide: CopingSide = {
    rows: 1,
    width: 400,
    length: sideLength,
    fullPavers: rightCalc.fullPavers,
    partialPaver: rightCalc.partialPaver,
    paverPositions: generatePaverPositions(
      pool.length, // Right of pool
      0,
      sideLength,
      400,
      false,
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
    (deepEnd.partialPaver ? 2 : 0) + // 2 rows
    (shallowEnd.partialPaver ? 1 : 0) +
    (leftSide.partialPaver ? 1 : 0) +
    (rightSide.partialPaver ? 1 : 0);
  
  const totalPavers = totalFullPavers + totalPartialPavers;
  
  const totalArea = (
    (deLength * 800) +
    (seLength * 400) +
    (sideLength * 400 * 2)
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

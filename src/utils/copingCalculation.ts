import { Pool } from '@/constants/pools';

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

// Helper to calculate pavers for a dimension with balanced cuts
const calculatePavers = (
  dimension: number, 
  paverSize: number, 
  balanceCuts: 'two-small-on-long-edges' | 'one-at-end' = 'two-small-on-long-edges'
): { fullPavers: number; partialPaver: number | null; cutCount: number } => {
  const fullPavers = Math.floor(dimension / paverSize);
  const remainder = dimension % paverSize;
  
  if (remainder === 0) {
    return { fullPavers, partialPaver: null, cutCount: 0 };
  }
  
  if (balanceCuts === 'two-small-on-long-edges') {
    // Split remainder into two smaller cuts (one at each end)
    return { 
      fullPavers, 
      partialPaver: remainder / 2, 
      cutCount: 2 
    };
  } else {
    // Single cut at one end
    return { 
      fullPavers, 
      partialPaver: remainder, 
      cutCount: 1 
    };
  }
};

// Helper to generate paver positions with balanced cuts
const generatePaverPositions = (
  startX: number,
  startY: number,
  length: number,
  paverSize: number,
  paverWidth: number,
  isHorizontal: boolean,
  rows: number,
  balanceCuts: 'two-small-on-long-edges' | 'one-at-end'
): CopingPaver[] => {
  const positions: CopingPaver[] = [];
  const { fullPavers, partialPaver, cutCount } = calculatePavers(length, paverSize, balanceCuts);
  
  for (let row = 0; row < rows; row++) {
    let currentOffset = 0;
    
    // If two balanced cuts, add first cut at start
    if (cutCount === 2 && partialPaver) {
      positions.push({
        x: startX + (isHorizontal ? currentOffset : row * paverWidth),
        y: startY + (isHorizontal ? row * paverWidth : currentOffset),
        width: isHorizontal ? partialPaver : paverWidth,
        height: isHorizontal ? paverWidth : partialPaver,
        isPartial: true,
      });
      currentOffset += partialPaver;
    }
    
    // Add all full pavers
    for (let i = 0; i < fullPavers; i++) {
      positions.push({
        x: startX + (isHorizontal ? currentOffset : row * paverWidth),
        y: startY + (isHorizontal ? row * paverWidth : currentOffset),
        width: isHorizontal ? paverSize : paverWidth,
        height: isHorizontal ? paverWidth : paverSize,
        isPartial: false,
      });
      currentOffset += paverSize;
    }
    
    // Add partial paver at end if exists
    if (partialPaver && (cutCount === 1 || cutCount === 2)) {
      positions.push({
        x: startX + (isHorizontal ? currentOffset : row * paverWidth),
        y: startY + (isHorizontal ? row * paverWidth : currentOffset),
        width: isHorizontal ? partialPaver : paverWidth,
        height: isHorizontal ? paverWidth : partialPaver,
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
  const deCalc = calculatePavers(deWidth, paverAlong, balanceCuts);
  const deepEnd: CopingSide = {
    rows: rowsDeep,
    width: paverInward * rowsDeep,
    length: deWidth,
    fullPavers: deCalc.fullPavers * rowsDeep,
    partialPaver: deCalc.partialPaver,
    paverPositions: generatePaverPositions(
      pool.length, // Start at right edge of pool
      -cornerExtension, // Start above pool (corner extension matches top/bottom width)
      deWidth,
      paverAlong,
      paverInward,
      false, // vertical (running up/down on right side)
      rowsDeep,
      balanceCuts
    ),
  };

  // Shallow End (LEFT side - configurable rows, extends top and bottom to cover corners)
  const seWidth = pool.width + (cornerExtension * 2);
  const seCalc = calculatePavers(seWidth, paverAlong, balanceCuts);
  const shallowEnd: CopingSide = {
    rows: rowsShallow,
    width: paverInward * rowsShallow,
    length: seWidth,
    fullPavers: seCalc.fullPavers * rowsShallow,
    partialPaver: seCalc.partialPaver,
    paverPositions: generatePaverPositions(
      -paverInward * rowsShallow, // Left of pool
      -cornerExtension, // Start above pool (corner extension matches top/bottom width)
      seWidth,
      paverAlong,
      paverInward,
      false, // vertical (running up/down on left side)
      rowsShallow,
      balanceCuts
    ),
  };

  // Top Side (configurable rows, between SE and DE - no corner extension)
  const topLength = pool.length;
  const topCalc = calculatePavers(topLength, paverAlong, balanceCuts);
  const leftSide: CopingSide = {
    rows: rowsSides,
    width: paverInward * rowsSides,
    length: topLength,
    fullPavers: topCalc.fullPavers * rowsSides,
    partialPaver: topCalc.partialPaver,
    paverPositions: generatePaverPositions(
      0, // Start at left edge of pool
      -paverInward * rowsSides, // Above pool
      topLength,
      paverAlong,
      paverInward,
      true, // horizontal (running left/right on top)
      rowsSides,
      balanceCuts
    ),
  };

  // Bottom Side (configurable rows, between SE and DE - no corner extension)
  const bottomLength = pool.length;
  const bottomCalc = calculatePavers(bottomLength, paverAlong, balanceCuts);
  const rightSide: CopingSide = {
    rows: rowsSides,
    width: paverInward * rowsSides,
    length: bottomLength,
    fullPavers: bottomCalc.fullPavers * rowsSides,
    partialPaver: bottomCalc.partialPaver,
    paverPositions: generatePaverPositions(
      0, // Start at left edge of pool
      pool.width, // Below pool
      bottomLength,
      paverAlong,
      paverInward,
      true, // horizontal (running left/right on bottom)
      rowsSides,
      balanceCuts
    ),
  };

  // Totals
  const totalFullPavers = 
    deepEnd.fullPavers + 
    shallowEnd.fullPavers + 
    leftSide.fullPavers + 
    rightSide.fullPavers;
  
  const totalPartialPavers = 
    (deepEnd.partialPaver ? deCalc.cutCount * rowsDeep : 0) +
    (shallowEnd.partialPaver ? seCalc.cutCount * rowsShallow : 0) +
    (leftSide.partialPaver ? topCalc.cutCount * rowsSides : 0) +
    (rightSide.partialPaver ? bottomCalc.cutCount * rowsSides : 0);
  
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

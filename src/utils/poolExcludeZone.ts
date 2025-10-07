import { Component } from '@/types';
import { POOL_LIBRARY } from '@/constants/pools';
import { GRID_CONFIG } from '@/constants/grid';

export interface PoolExcludeZone {
  outline: Array<{x: number, y: number}>;
  componentId: string;
}

/**
 * Get the exclude zone for a pool
 * If coping enabled: outer edge of coping pavers
 * If no coping: pool waterline outline
 */
export const getPoolExcludeZone = (pool: Component): PoolExcludeZone | null => {
  if (pool.type !== 'pool') return null;

  const poolData = POOL_LIBRARY.find(p => p.id === pool.properties.poolId);
  if (!poolData) return null;

  const pxPerMm = GRID_CONFIG.spacing / 100; // 0.1 px/mm

  // If pool has coping, use the outer boundary of all coping pavers
  if (pool.properties.showCoping && pool.properties.copingCalculation) {
    const copingOutline = getCopingOuterBoundary(
      pool.properties.copingCalculation,
      poolData,
      pool.position,
      pool.rotation,
      pxPerMm
    );
    
    return {
      outline: copingOutline,
      componentId: pool.id
    };
  }

  // No coping - use pool waterline outline
  const poolOutline = transformPoolOutline(
    poolData.outline,
    pool.position,
    pool.rotation,
    pxPerMm
  );

  return {
    outline: poolOutline,
    componentId: pool.id
  };
};

/**
 * Calculate outer boundary of all coping pavers
 * This is the edge where paving area pavers should meet
 */
const getCopingOuterBoundary = (
  copingData: any,
  poolData: any,
  poolPosition: {x: number, y: number},
  rotation: number,
  pxPerMm: number
): Array<{x: number, y: number}> => {
  // Deep end extends 400mm on each side (800mm total width)
  // Shallow end is 400mm
  // Each side is 400mm
  
  const poolLength = poolData.length * pxPerMm;
  const poolWidth = poolData.width * pxPerMm;
  
  // Coping extends 400mm beyond pool on all sides
  const copingExtension = 400 * pxPerMm;
  
  // Create rectangular outline around pool with coping
  // Deep end (right) has 2 rows (800mm), extends top/bottom by 400mm
  // Other sides have 1 row (400mm)
  const outline = [
    { x: -copingExtension, y: -copingExtension }, // Top-left corner
    { x: poolLength + copingExtension * 2, y: -copingExtension }, // Top-right (deep end extends 2 rows)
    { x: poolLength + copingExtension * 2, y: poolWidth + copingExtension }, // Bottom-right
    { x: -copingExtension, y: poolWidth + copingExtension } // Bottom-left
  ];

  // Apply rotation and translation
  return transformPoints(outline, poolPosition, rotation);
};

/**
 * Transform pool outline from mm to canvas coordinates with rotation
 */
const transformPoolOutline = (
  outline: Array<{x: number, y: number}>,
  position: {x: number, y: number},
  rotation: number,
  pxPerMm: number
): Array<{x: number, y: number}> => {
  // Scale from mm to pixels
  const scaledOutline = outline.map(point => ({
    x: point.x * pxPerMm,
    y: point.y * pxPerMm
  }));

  // Apply rotation and translation
  return transformPoints(scaledOutline, position, rotation);
};

/**
 * Apply rotation and translation to points
 */
const transformPoints = (
  points: Array<{x: number, y: number}>,
  position: {x: number, y: number},
  rotation: number
): Array<{x: number, y: number}> => {
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return points.map(point => {
    const rotatedX = point.x * cos - point.y * sin;
    const rotatedY = point.x * sin + point.y * cos;

    return {
      x: rotatedX + position.x,
      y: rotatedY + position.y
    };
  });
};


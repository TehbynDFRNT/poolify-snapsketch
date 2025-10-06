import { Component } from '@/types';
import { POOL_LIBRARY } from '@/constants/pools';

export interface ExcludeZone {
  outline: Array<{ x: number; y: number }>;
  componentId: string;
}

/**
 * Calculate the exclude zone polygon for a pool component
 * If pool has coping, includes pool + all coping pavers
 * If no coping, just the pool waterline outline
 */
export const getPoolExcludeZone = (pool: Component): ExcludeZone | null => {
  if (pool.type !== 'pool') return null;

  const poolData = POOL_LIBRARY.find(p => p.id === pool.properties.poolId);
  if (!poolData) return null;

  const pxPerMm = 0.1; // 1mm = 0.1px on canvas

  // If pool has coping, create outline from coping calculation
  if (pool.properties.showCoping && pool.properties.copingCalculation) {
    const copingOutline = createCopingOutline(
      pool.properties.copingCalculation,
      poolData,
      pool.position,
      pool.rotation,
      pxPerMm
    );
    
    return {
      outline: copingOutline,
      componentId: pool.id,
    };
  }

  // No coping - just use pool waterline outline
  const poolOutline = transformPoolOutline(
    poolData.outline,
    pool.position,
    pool.rotation,
    pxPerMm
  );

  return {
    outline: poolOutline,
    componentId: pool.id,
  };
};

/**
 * Transform pool outline from mm coordinates to canvas coordinates
 * accounting for position and rotation
 */
const transformPoolOutline = (
  outline: Array<{ x: number; y: number }>,
  position: { x: number; y: number },
  rotation: number,
  pxPerMm: number
): Array<{ x: number; y: number }> => {
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return outline.map(point => {
    // Scale from mm to canvas units
    const scaledX = point.x * pxPerMm;
    const scaledY = point.y * pxPerMm;

    // Rotate around origin
    const rotatedX = scaledX * cos - scaledY * sin;
    const rotatedY = scaledX * sin + scaledY * cos;

    // Translate to position
    return {
      x: rotatedX + position.x,
      y: rotatedY + position.y,
    };
  });
};

/**
 * Create outline polygon that encompasses all coping pavers
 * This creates the cutout boundary for paving areas
 */
const createCopingOutline = (
  copingCalculation: any,
  poolData: any,
  poolPosition: { x: number; y: number },
  rotation: number,
  pxPerMm: number
): Array<{ x: number; y: number }> => {
  // Calculate bounding box of coping in mm
  // DE: 2 rows (800mm) on right side, extends 400mm top and bottom
  // SE: 1 row (400mm) on left side, extends 400mm top and bottom
  // Top/Bottom: 1 row (400mm) each
  
  const poolLength = poolData.length;
  const poolWidth = poolData.width;
  
  // Outline includes all coping
  // In mm coordinates (before rotation):
  const outlinePoints = [
    { x: -400, y: -400 },              // Top-left (SE side + top corner)
    { x: poolLength + 800, y: -400 },  // Top-right (DE side + top corner)
    { x: poolLength + 800, y: poolWidth + 400 }, // Bottom-right (DE side + bottom corner)
    { x: -400, y: poolWidth + 400 },   // Bottom-left (SE side + bottom corner)
  ];

  // Transform the outline points
  return transformPoolOutline(outlinePoints, poolPosition, rotation, pxPerMm);
};

/**
 * Check if point is inside any exclude zone
 */
export const isPointInExcludeZone = (
  point: { x: number; y: number },
  excludeZones: ExcludeZone[]
): boolean => {
  return excludeZones.some(zone => isPointInPolygon(point, zone.outline));
};

/**
 * Ray casting algorithm to check if point is inside polygon
 */
const isPointInPolygon = (
  point: { x: number; y: number },
  polygon: Array<{ x: number; y: number }>
): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}

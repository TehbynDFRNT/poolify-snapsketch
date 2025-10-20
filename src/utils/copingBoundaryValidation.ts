import { Component } from '@/types';
import { GRID_CONFIG } from '@/constants/grid';

interface Point {
  x: number;
  y: number;
}

/**
 * Ray-casting algorithm to check if a point is inside a polygon
 * Adapted from pavingFill.ts - proven to be reliable
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}

/**
 * Extract boundary polygon points from component in world coordinates
 */
export function getComponentPolygon(component: Component): Point[] | null {
  const { type, position, rotation, properties } = component;
  
  switch (type) {
    case 'house':
      // House has points array
      if (!properties.points || !Array.isArray(properties.points)) return null;
      return properties.points.map((p: any) => ({
        x: position.x + p.x,
        y: position.y + p.y
      }));
    
    case 'fence':
    case 'wall':
    case 'drainage': {
      // These are line components - create rectangle from length
      const length = properties.length || 100;
      const width = 5; // Small width for line detection
      
      const cos = Math.cos((rotation * Math.PI) / 180);
      const sin = Math.sin((rotation * Math.PI) / 180);
      
      // Create rectangle corners in local coords, then transform to world
      const localCorners = [
        { x: 0, y: -width/2 },
        { x: length, y: -width/2 },
        { x: length, y: width/2 },
        { x: 0, y: width/2 },
      ];
      
      return localCorners.map(corner => ({
        x: position.x + corner.x * cos - corner.y * sin,
        y: position.y + corner.x * sin + corner.y * cos
      }));
    }
    
    case 'boundary': {
      // Boundary polygon - must apply rotation like fence/wall
      if (!properties.points || !Array.isArray(properties.points)) return null;
      
      const cos = Math.cos((rotation * Math.PI) / 180);
      const sin = Math.sin((rotation * Math.PI) / 180);
      
      return properties.points.map((p: any) => ({
        x: position.x + p.x * cos - p.y * sin,
        y: position.y + p.x * sin + p.y * cos
      }));
    }
    
    case 'paving_area': {
      // Paving area boundary
      if (!properties.boundary || !Array.isArray(properties.boundary)) return null;
      return properties.boundary.map((p: any) => ({
        x: position.x + p.x,
        y: position.y + p.y
      }));
    }
    
    default:
      return null;
  }
}

/**
 * Transform paver from pool-local coordinates to world coordinates
 */
export function transformPaverToWorld(
  paver: { x: number; y: number; width: number; height: number },
  poolPosition: { x: number; y: number },
  poolRotation: number
): Point[] {
  const scale = 0.1; // mm to canvas pixels
  const cos = Math.cos((poolRotation * Math.PI) / 180);
  const sin = Math.sin((poolRotation * Math.PI) / 180);
  
  // Paver corners in pool-local coordinates (mm)
  const localCorners = [
    { x: paver.x, y: paver.y },
    { x: paver.x + paver.width, y: paver.y },
    { x: paver.x + paver.width, y: paver.y + paver.height },
    { x: paver.x, y: paver.y + paver.height },
  ];
  
  // Transform to world coordinates (canvas pixels)
  return localCorners.map(corner => {
    const scaledX = corner.x * scale;
    const scaledY = corner.y * scale;
    return {
      x: poolPosition.x + scaledX * cos - scaledY * sin,
      y: poolPosition.y + scaledX * sin + scaledY * cos
    };
  });
}

/**
 * Check if a paver (in world coordinates) is valid (not intersecting boundaries)
 * 
 * Two-phase validation:
 * 1. Obstacles (fence, wall, house, drainage, paving_area): Paver invalid if ANY corner is INSIDE
 * 2. Property boundaries (boundary): Paver invalid if ANY corner is OUTSIDE
 */
export function isPaverValid(
  paverCorners: Point[],
  boundaryComponents: Component[],
  poolComponentId: string
): { valid: boolean; intersectedComponentId?: string } {
  
  // Phase 1: Check obstacles (pavers must NOT be inside)
  for (const component of boundaryComponents) {
    if (component.id === poolComponentId) continue;
    
    const polygon = getComponentPolygon(component);
    if (!polygon || polygon.length < 3) continue;
    
    // Obstacles: fence, wall, house, drainage, paving_area
    if (['fence', 'wall', 'house', 'drainage', 'paving_area'].includes(component.type)) {
      // Check if ANY corner is INSIDE obstacle → invalid
      const anyInside = paverCorners.some(corner => isPointInPolygon(corner, polygon));
      if (anyInside) {
        console.log('🚫 [BOUNDARY-HIT] Paver inside obstacle', { 
          type: component.type, 
          id: component.id 
        });
        return { valid: false, intersectedComponentId: component.id };
      }
    }
  }
  
  // Phase 2: Check property boundaries (pavers must be INSIDE)
  for (const component of boundaryComponents) {
    if (component.id === poolComponentId) continue;
    if (component.type !== 'boundary') continue;
    
    const polygon = getComponentPolygon(component);
    if (!polygon || polygon.length < 3) continue;
    
    // Check if ANY corner is OUTSIDE boundary → invalid
    const anyOutside = paverCorners.some(corner => !isPointInPolygon(corner, polygon));
    if (anyOutside) {
      console.log('🚫 [BOUNDARY-HIT] Paver outside property boundary', { 
        id: component.id 
      });
      return { valid: false, intersectedComponentId: component.id };
    }
  }
  
  return { valid: true };
}

/**
 * Validate a list of pavers and return the maximum valid drag distance
 * This is the "generate then validate" approach
 */
export function validateExtensionPavers<T extends { x: number; y: number; width: number; height: number; rowIndex: number }>(
  pavers: T[],
  poolPosition: { x: number; y: number },
  poolRotation: number,
  boundaryComponents: Component[],
  poolComponentId: string,
  rowDepthMm: number,
  groutMm: number
): {
  validPavers: T[];
  maxValidDistance: number;
  hitBoundary: boolean;
  boundaryId?: string;
} {
  if (pavers.length === 0) {
    return { validPavers: [], maxValidDistance: 0, hitBoundary: false };
  }
  
  // Sort pavers by rowIndex to validate in order
  const sortedPavers = [...pavers].sort((a, b) => a.rowIndex - b.rowIndex);
  const validPavers: T[] = [];
  let lastValidRowIndex = -1;
  let intersectedComponentId: string | undefined;
  
  for (const paver of sortedPavers) {
    const corners = transformPaverToWorld(paver, poolPosition, poolRotation);
    const result = isPaverValid(corners, boundaryComponents, poolComponentId);
    
    if (result.valid) {
      validPavers.push(paver);
      lastValidRowIndex = paver.rowIndex;
    } else {
      // Hit a boundary - stop validating
      intersectedComponentId = result.intersectedComponentId;
      console.log('🚫 [BOUNDARY-HIT]', { 
        paverId: `row-${paver.rowIndex}`,
        rowIndex: paver.rowIndex,
        componentId: intersectedComponentId 
      });
      break;
    }
  }
  
  // Calculate max valid distance based on last valid row
  const hitBoundary = lastValidRowIndex < sortedPavers[sortedPavers.length - 1].rowIndex;
  const maxValidDistance = hitBoundary && lastValidRowIndex >= 0
    ? (lastValidRowIndex + 1) * (rowDepthMm + groutMm)
    : pavers.length > 0 
      ? (sortedPavers[sortedPavers.length - 1].rowIndex + 1) * (rowDepthMm + groutMm)
      : 0;
  
  console.log('✅ [VALIDATION-RESULT]', {
    totalPavers: pavers.length,
    validPavers: validPavers.length,
    lastValidRow: lastValidRowIndex,
    maxValidDistance,
    hitBoundary,
    boundaryId: intersectedComponentId
  });
  
  return {
    validPavers,
    maxValidDistance,
    hitBoundary,
    boundaryId: intersectedComponentId
  };
}

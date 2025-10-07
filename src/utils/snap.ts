import { SNAP_CONFIG, GRID_CONFIG } from '@/constants/grid';
import { Component } from '@/types';
import { getPaverDimensions } from './pavingFill';

export const snapToGrid = (value: number): number => {
  if (!SNAP_CONFIG.enabled) return value;
  return Math.round(value / SNAP_CONFIG.gridSnap) * SNAP_CONFIG.gridSnap;
};

export const snapPoint = (point: { x: number; y: number }): { x: number; y: number } => {
  return {
    x: snapToGrid(point.x),
    y: snapToGrid(point.y),
  };
};

/**
 * Snap pool to paver grid if inside a paving area
 * This ensures pavers align perfectly with pool edges
 */
export const snapPoolToPaverGrid = (
  poolPosition: { x: number; y: number },
  poolData: { length: number; width: number }, // in mm
  components: Component[]
): { x: number; y: number } => {
  const pxPerMm = GRID_CONFIG.spacing / 100; // 0.1 px/mm
  const poolLengthPx = poolData.length * pxPerMm;
  const poolWidthPx = poolData.width * pxPerMm;
  
  // Find paving areas that might contain this pool
  const pavingAreas = components.filter(c => c.type === 'paving_area');
  
  for (const area of pavingAreas) {
    const boundary = area.properties.boundary;
    if (!boundary || boundary.length < 3) continue;
    
    // Check if pool overlaps this paving area (center OR any corner inside)
    const poolCenter = {
      x: poolPosition.x + poolLengthPx / 2,
      y: poolPosition.y + poolWidthPx / 2
    };
    const poolCorners = [
      { x: poolPosition.x, y: poolPosition.y },
      { x: poolPosition.x + poolLengthPx, y: poolPosition.y },
      { x: poolPosition.x, y: poolPosition.y + poolWidthPx },
      { x: poolPosition.x + poolLengthPx, y: poolPosition.y + poolWidthPx },
    ];

    const overlapsArea = isPointInPolygon(poolCenter, boundary) ||
      poolCorners.some(corner => isPointInPolygon(corner, boundary));

    if (!overlapsArea) continue;
    
    // Get paver dimensions for this area
    const { width: paverWidthMm, height: paverHeightMm } = getPaverDimensions(
      area.properties.paverSize || '400x400',
      area.properties.paverOrientation || 'vertical'
    );
    
    const paverWidth = paverWidthMm * pxPerMm;
    const paverHeight = paverHeightMm * pxPerMm;
    
    // Get paving area bounding box to determine grid origin
    const xs = boundary.map(p => p.x);
    const ys = boundary.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    
    // Calculate pool position relative to paver grid origin
    const relativeX = poolPosition.x - minX;
    const relativeY = poolPosition.y - minY;
    
    // Snap to nearest paver grid intersection
    const snappedRelativeX = Math.round(relativeX / paverWidth) * paverWidth;
    const snappedRelativeY = Math.round(relativeY / paverHeight) * paverHeight;
    
    // Convert back to absolute position
    return {
      x: minX + snappedRelativeX,
      y: minY + snappedRelativeY
    };
  }
  
  // No paving area found, use regular grid snap
  return snapPoint(poolPosition);
};

/**
 * Check if point is inside polygon (ray casting algorithm)
 */
function isPointInPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>): boolean {
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

// Smart snap: prioritize nearby component points, then fall back to grid
export const smartSnap = (
  point: { x: number; y: number },
  components: Component[],
  tolerance: number = 15
): { x: number; y: number; snappedTo: string | null } => {
  let closestPoint: { x: number; y: number } | null = null;
  let minDistance = tolerance;
  let snappedTo: string | null = null;

  // Check all components for nearby points
  components.forEach(component => {
    const pointsToCheck: Array<{ x: number; y: number }> = [];

    // Collect points from different component types
    if (component.properties.points) {
      pointsToCheck.push(...component.properties.points);
    }
    if (component.properties.boundary) {
      pointsToCheck.push(...component.properties.boundary);
    }

    // Check distance to each point
    pointsToCheck.forEach(p => {
      const distance = Math.sqrt(
        Math.pow(point.x - p.x, 2) + Math.pow(point.y - p.y, 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = p;
        snappedTo = component.type;
      }
    });
  });

  // If we found a nearby point, snap to it
  if (closestPoint) {
    return { ...closestPoint, snappedTo };
  }

  // Otherwise snap to grid
  return {
    x: snapToGrid(point.x),
    y: snapToGrid(point.y),
    snappedTo: null,
  };
};

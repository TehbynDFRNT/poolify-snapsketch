import { Component } from '@/types';
import { POOL_LIBRARY } from '@/constants/pools';

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export interface ExcludeZone {
  outline: Point[];
  componentId: string;
}

export function getBoundingBox(points: Point[]): BoundingBox {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

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

export function boxesIntersect(box1: BoundingBox, box2: BoundingBox): boolean {
  return !(
    box1.maxX < box2.minX ||
    box1.minX > box2.maxX ||
    box1.maxY < box2.minY ||
    box1.minY > box2.maxY
  );
}

export function boundingBoxesOverlap(
  boundary: Point[],
  poolBox: BoundingBox
): boolean {
  // Quick bounding box check first
  const boundaryBox = getBoundingBox(boundary);
  
  if (!boxesIntersect(boundaryBox, poolBox)) {
    return false;
  }
  
  // More precise check: any pool corner inside boundary?
  const poolCorners = [
    {x: poolBox.minX, y: poolBox.minY},
    {x: poolBox.maxX, y: poolBox.minY},
    {x: poolBox.maxX, y: poolBox.maxY},
    {x: poolBox.minX, y: poolBox.maxY}
  ];
  
  return poolCorners.some(corner => 
    isPointInPolygon(corner, boundary)
  );
}

export function transformPoolOutline(
  outline: Point[],
  position: {x: number, y: number},
  rotation: number
): Point[] {
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  
  return outline.map(point => {
    // Scale from mm to canvas units (0.1 scale factor)
    const scaledX = point.x * 0.1;
    const scaledY = point.y * 0.1;
    
    // Rotate around origin
    const rotatedX = scaledX * cos - scaledY * sin;
    const rotatedY = scaledX * sin + scaledY * cos;
    
    // Translate to position
    return {
      x: rotatedX + position.x,
      y: rotatedY + position.y
    };
  });
}

export function getPoolBoundingBox(pool: Component): BoundingBox {
  const poolData = POOL_LIBRARY.find(p => p.id === pool.properties.poolId);
  
  if (!poolData) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  }
  
  const transformedOutline = transformPoolOutline(
    poolData.outline,
    pool.position,
    pool.rotation
  );
  
  return getBoundingBox(transformedOutline);
}

export function isInsideExcludeZone(point: Point, zones: ExcludeZone[]): boolean {
  return zones.some(zone => isPointInPolygon(point, zone.outline));
}

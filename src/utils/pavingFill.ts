import { GRID_CONFIG } from '@/constants/grid';
import { ExcludeZone, isInsideExcludeZone } from './geometry';

interface Point {
  x: number;
  y: number;
}

interface Paver {
  id: string;
  position: Point;
  width: number; // pixels on canvas
  height: number; // pixels on canvas
  isEdgePaver: boolean;
  cutPercentage?: number;
  mmWidth?: number; // original paver width in mm
  mmHeight?: number; // original paver height in mm
}

export function getPaverDimensions(
  paverSize: '400x400' | '400x600',
  orientation: 'vertical' | 'horizontal'
): { width: number; height: number } {
  if (paverSize === '400x400') {
    return { width: 400, height: 400 };
  }
  
  if (orientation === 'vertical') {
    return { width: 400, height: 600 };
  } else {
    return { width: 600, height: 400 };
  }
}

export function fillAreaWithPavers(
  boundary: Point[],
  paverSize: '400x400' | '400x600',
  paverOrientation: 'vertical' | 'horizontal',
  showEdgePavers: boolean,
  excludeZones?: ExcludeZone[]
): Paver[] {
  const pavers: Paver[] = [];
  
  // Get paver dimensions (mm) and convert to canvas pixels
  const { width: paverWidthMm, height: paverHeightMm } = getPaverDimensions(paverSize, paverOrientation);
  const pxPerMm = GRID_CONFIG.spacing / 100; // 10px per 100mm => 0.1 px/mm
  const paverWidth = paverWidthMm * pxPerMm;
  const paverHeight = paverHeightMm * pxPerMm;
  
  // Get bounding box (canvas pixels)
  const bbox = getBoundingBox(boundary);
  
  // Calculate grid counts using pixel sizes - add extra row/col to catch edge pavers
  const cols = Math.ceil(bbox.width / paverWidth) + 1;
  const rows = Math.ceil(bbox.height / paverHeight) + 1;
  
  // Create grid
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = bbox.minX + (col * paverWidth);
      const y = bbox.minY + (row * paverHeight);
      
      // Check corners to determine if paver overlaps boundary
      const corners = [
        { x, y },
        { x: x + paverWidth, y },
        { x: x + paverWidth, y: y + paverHeight },
        { x, y: y + paverHeight },
      ];
      
      // Check center point too
      const paverCenter = {
        x: x + paverWidth / 2,
        y: y + paverHeight / 2,
      };
      
      // Check if paver center is inside any exclude zone (e.g., pool)
      if (excludeZones && isInsideExcludeZone(paverCenter, excludeZones)) {
        continue; // Skip this paver position
      }
      
      // Count how many corners are inside
      const cornersInside = corners.filter(corner => isPointInPolygon(corner, boundary));
      const centerInside = isPointInPolygon(paverCenter, boundary);
      
      // Include paver if center is inside OR at least one corner is inside
      if (centerInside || cornersInside.length > 0) {
        const cornersOutside = corners.length - cornersInside.length;
        const isEdge = cornersOutside > 0;
        
        // Only add if showing edge pavers OR it's a full paver
        if (showEdgePavers || !isEdge) {
          pavers.push({
            id: `paver-${row}-${col}`,
            position: { x, y },
            width: paverWidth,
            height: paverHeight,
            isEdgePaver: isEdge,
            cutPercentage: isEdge ? Math.round((cornersOutside / 4) * 100) : 0,
            mmWidth: paverWidthMm,
            mmHeight: paverHeightMm,
          });
        }
      }
    }
  }
  
  return pavers;
}

export function calculateStatistics(
  pavers: Paver[],
  wastagePercentage: number
) {
  const fullPavers = pavers.filter(p => !p.isEdgePaver).length;
  const edgePavers = pavers.filter(p => p.isEdgePaver).length;
  const totalPavers = fullPavers + edgePavers;
  
  // Calculate area (area should be in square meters)
  let paverAreaM2 = 0;
  if (pavers.length > 0) {
    const pxPerMm = GRID_CONFIG.spacing / 100; // 0.1 px/mm
    const mmW = pavers[0].mmWidth ?? (pavers[0].width / pxPerMm);
    const mmH = pavers[0].mmHeight ?? (pavers[0].height / pxPerMm);
    paverAreaM2 = (mmW * mmH) / 1000000; // mm² to m²
  }
  const totalArea = paverAreaM2 * totalPavers;
  
  // Calculate order quantity with wastage
  const wastageAmount = Math.ceil(totalPavers * (wastagePercentage / 100));
  const orderQuantity = totalPavers + wastageAmount;
  
  return {
    fullPavers,
    edgePavers,
    totalArea,
    orderQuantity,
  };
}

function getBoundingBox(points: Point[]) {
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

function isPointInPolygon(point: Point, polygon: Point[]): boolean {
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

export function validateBoundary(
  points: Point[], 
  paverSize?: '400x400' | '400x600',
  orientation?: 'vertical' | 'horizontal'
): { valid: boolean; error?: string } {
  if (points.length < 3) {
    return { valid: false, error: 'Need at least 3 points' };
  }
  
  if (hasIntersectingEdges(points)) {
    return { valid: false, error: 'Boundary lines cannot cross each other' };
  }
  
  const area = calculatePolygonArea(points);
  if (area < 100000) {
    return { valid: false, error: 'Area too small (minimum 0.1 m²)' };
  }
  
  if (area > 10000000000) {
    return { valid: false, error: 'Area too large (maximum 10,000 m²)' };
  }
  
  // Additional validation if paver info provided
  if (paverSize && orientation) {
    const bbox = getBoundingBox(points);
    const { width: paverWidthMm, height: paverHeightMm } = getPaverDimensions(paverSize, orientation);
    const pxPerMm = GRID_CONFIG.spacing / 100;
    const paverWidth = paverWidthMm * pxPerMm;
    const paverHeight = paverHeightMm * pxPerMm;
    
    // Check if area is large enough to fit at least one paver
    if (bbox.width < paverWidth || bbox.height < paverHeight) {
      return { 
        valid: false, 
        error: `Area too small to fit ${paverSize} pavers (needs at least ${paverWidthMm}×${paverHeightMm}mm)` 
      };
    }
  }
  
  return { valid: true };
}

function hasIntersectingEdges(points: Point[]): boolean {
  for (let i = 0; i < points.length; i++) {
    const a1 = points[i];
    const a2 = points[(i + 1) % points.length];
    
    for (let j = i + 2; j < points.length; j++) {
      if (j === (i + points.length - 1) % points.length) continue;
      
      const b1 = points[j];
      const b2 = points[(j + 1) % points.length];
      
      if (lineSegmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }
  
  return false;
}

function lineSegmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const det = (a2.x - a1.x) * (b2.y - b1.y) - (b2.x - b1.x) * (a2.y - a1.y);
  if (det === 0) return false;
  
  const lambda = ((b2.y - b1.y) * (b2.x - a1.x) + (b1.x - b2.x) * (b2.y - a1.y)) / det;
  const gamma = ((a1.y - a2.y) * (b2.x - a1.x) + (a2.x - a1.x) * (b2.y - a1.y)) / det;
  
  return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
}

function calculatePolygonArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
}


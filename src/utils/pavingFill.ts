import { GRID_CONFIG } from '@/constants/grid';
import { GROUT_MM } from '@/utils/copingCalculation';
import { TILE_SIZES, TileSize, TileOrientation, getTileDimensions } from '@/constants/tileConfig';

interface Point {
  x: number;
  y: number;
}

export interface PoolExcludeZone {
  outline: Array<{x: number, y: number}>;
  componentId: string;
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
  paverSize: TileSize,
  orientation: TileOrientation
): { width: number; height: number } {
  // Use centralized getTileDimensions
  return getTileDimensions(paverSize, orientation);
}

export function fillAreaWithPavers(
  boundary: Point[],
  paverSize: TileSize,
  paverOrientation: TileOrientation,
  showEdgePavers: boolean,
  poolExcludeZones: PoolExcludeZone[] = [],
  groutMmOpt?: number
): Paver[] {
  // Standardize grout to match coping (GROUT_MM) unless overridden
  return fillAreaWithPaversFromOrigin(
    boundary,
    paverSize,
    paverOrientation,
    showEdgePavers,
    poolExcludeZones,
    undefined,
    groutMmOpt ?? GROUT_MM
  );
}

/**
 * Fill a polygon area with a rect grid, allowing a custom origin so the grid can
 * align with an external reference (e.g., pool coping grid).
 */
export function fillAreaWithPaversFromOrigin(
  boundary: Point[],
  paverSize: TileSize,
  paverOrientation: TileOrientation,
  showEdgePavers: boolean,
  poolExcludeZones: PoolExcludeZone[] = [],
  origin?: { x?: number; y?: number },
  groutMm: number = 0,
  seamX: number[] = [],
  seamY: number[] = []
): Paver[] {
  const pavers: Paver[] = [];
  
  // Get paver dimensions (mm) and convert to canvas pixels
  const { width: paverWidthMm, height: paverHeightMm } = getPaverDimensions(paverSize, paverOrientation);
  const pxPerMm = GRID_CONFIG.spacing / 100; // 10px per 100mm => 0.1 px/mm
  const paverWidth = paverWidthMm * pxPerMm;
  const paverHeight = paverHeightMm * pxPerMm;
  const stepX = (paverWidthMm + groutMm) * pxPerMm;
  const stepY = (paverHeightMm + groutMm) * pxPerMm;
  
  // Get bounding box (canvas pixels)
  const bbox = getBoundingBox(boundary);
  
  // Calculate grid counts using pixel sizes - add extra row/col to catch edge pavers
  // Align start to origin (if provided), otherwise to bbox min
  const xOrigin = origin?.x ?? bbox.minX;
  const yOrigin = origin?.y ?? bbox.minY;
  // Choose starting grid line just before bbox.min
  const startX = xOrigin + Math.floor((bbox.minX - xOrigin) / stepX) * stepX;
  const startY = yOrigin + Math.floor((bbox.minY - yOrigin) / stepY) * stepY;

  // Build grid lines including optional seam lines
  const endX = bbox.maxX + stepX * 2;
  const endY = bbox.maxY + stepY * 2;
  const xLinesSet = new Set<number>();
  for (let x = startX; x <= endX; x += stepX) xLinesSet.add(roundPx(x));
  seamX.forEach((sx) => { if (sx >= startX - stepX && sx <= endX + stepX) xLinesSet.add(roundPx(sx)); });
  const yLinesSet = new Set<number>();
  for (let y = startY; y <= endY; y += stepY) yLinesSet.add(roundPx(y));
  seamY.forEach((sy) => { if (sy >= startY - stepY && sy <= endY + stepY) yLinesSet.add(roundPx(sy)); });

  const xLines = Array.from(xLinesSet).sort((a, b) => a - b);
  const yLines = Array.from(yLinesSet).sort((a, b) => a - b);

  // Create grid cells from lines
  for (let r = 0; r < yLines.length - 1; r++) {
    for (let c = 0; c < xLines.length - 1; c++) {
      const x = xLines[c];
      const y = yLines[r];
      const cellW = xLines[c + 1] - x;
      const cellH = yLines[r + 1] - y;
      
      // Check corners to determine if paver overlaps boundary
      const corners = [
        { x, y },
        { x: x + cellW, y },
        { x: x + cellW, y: y + cellH },
        { x, y: y + cellH },
      ];
      
      // Check center point too
      const paverCenter = { x: x + cellW / 2, y: y + cellH / 2 };
      
      // Check paver against OUTER boundary first
      const cornersInside = corners.filter(corner => isPointInPolygon(corner, boundary));
      const centerInside = isPointInPolygon(paverCenter, boundary);
      
      // Skip if completely outside boundary
      if (!centerInside && cornersInside.length === 0) {
        continue;
      }

      // Check paver against POOL exclude zones
      const poolOverlap = checkPaverPoolOverlap(corners, paverCenter, poolExcludeZones);

      if (poolOverlap.completelyInside) {
        continue; // Paver entirely inside pool - skip it
      }

      // Determine if this is an edge paver
      const cornersOutside = corners.length - cornersInside.length;
      const boundaryIsEdge = cornersOutside > 0;
      let isEdge = boundaryIsEdge || poolOverlap.isEdge;
      let cutPercentage = 0;

      if (isEdge) {
        if (poolOverlap.isEdge) {
          // Paver partially overlaps pool - use exposed percentage
          cutPercentage = Math.round(100 - poolOverlap.exposedPercentage);
        } else if (boundaryIsEdge) {
          // Paver on outer boundary edge
          cutPercentage = Math.round((cornersOutside / 4) * 100);
        }
      }
      
      // Only add if showing edge pavers OR it's a full paver
      if (showEdgePavers || !isEdge) {
        pavers.push({
          id: `paver-${r}-${c}`,
          position: { x, y },
          width: cellW,
          height: cellH,
          isEdgePaver: isEdge,
          cutPercentage,
          mmWidth: paverWidthMm,
          mmHeight: paverHeightMm,
        });
      }
    }
  }
  
  return pavers;
}

/**
 * Check if paver overlaps with pool exclude zones
 */
function checkPaverPoolOverlap(
  corners: Point[],
  center: Point,
  poolZones: PoolExcludeZone[]
): {
  completelyInside: boolean;
  isEdge: boolean;
  exposedPercentage: number;
} {
  if (poolZones.length === 0) {
    return { completelyInside: false, isEdge: false, exposedPercentage: 100 };
  }

  const BOUNDARY_TOLERANCE = 2; // 2 pixels tolerance for boundary alignment

  // Check against each pool zone
  for (const zone of poolZones) {
    const cornersInsidePool = corners.filter(c => 
      isPointInPolygon(c, zone.outline)
    ).length;

    const centerInsidePool = isPointInPolygon(center, zone.outline);

    if (cornersInsidePool === 4 && centerInsidePool) {
      // Paver completely inside pool - should be excluded
      return { completelyInside: true, isEdge: false, exposedPercentage: 0 };
    }

    if (cornersInsidePool > 0 || centerInsidePool) {
      // Check if corners are just touching the boundary (aligned pavers)
      // These should be treated as full pavers, not edge pavers
      const cornersNearBoundary = corners.filter(corner => {
        const distanceToNearestEdge = getDistanceToPolygonEdge(corner, zone.outline);
        return distanceToNearestEdge <= BOUNDARY_TOLERANCE;
      }).length;

      // If corners are on/very close to boundary AND paver is mostly outside, treat as full paver
      if (cornersNearBoundary > 0 && !centerInsidePool && cornersInsidePool <= 2) {
        // This is a boundary-aligned paver, not an edge paver
        return { completelyInside: false, isEdge: false, exposedPercentage: 100 };
      }

      // Paver genuinely crosses into pool - this is an edge paver
      // Calculate what % is OUTSIDE the pool (exposed)
      const percentageInsidePool = centerInsidePool 
        ? Math.min(100, (cornersInsidePool / 4) * 100 + 25) // Center adds weight
        : (cornersInsidePool / 4) * 100;
      
      const exposedPercentage = Math.max(10, 100 - percentageInsidePool); // Minimum 10% to show

      // Skip very small slivers
      if (exposedPercentage < 10) {
        return { completelyInside: true, isEdge: false, exposedPercentage: 0 };
      }

      return { 
        completelyInside: false, 
        isEdge: true, 
        exposedPercentage 
      };
    }
  }

  // No overlap with any pool
  return { completelyInside: false, isEdge: false, exposedPercentage: 100 };
}

/**
 * Calculate minimum distance from a point to any edge of a polygon
 */
function getDistanceToPolygonEdge(point: Point, polygon: Point[]): number {
  let minDistance = Infinity;

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    
    const distance = getDistanceToLineSegment(point, p1, p2);
    minDistance = Math.min(minDistance, distance);
  }

  return minDistance;
}

/**
 * Calculate distance from a point to a line segment
 */
function getDistanceToLineSegment(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  // Calculate the length squared of the line segment
  const lengthSquared = dx * dx + dy * dy;
  
  if (lengthSquared === 0) {
    // Line segment is a point
    const pdx = point.x - lineStart.x;
    const pdy = point.y - lineStart.y;
    return Math.sqrt(pdx * pdx + pdy * pdy);
  }
  
  // Calculate projection of point onto line (clamped to segment)
  const t = Math.max(0, Math.min(1, 
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared
  ));
  
  // Find closest point on line segment
  const closestX = lineStart.x + t * dx;
  const closestY = lineStart.y + t * dy;
  
  // Calculate distance
  const pdx = point.x - closestX;
  const pdy = point.y - closestY;
  return Math.sqrt(pdx * pdx + pdy * pdy);
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
    totalPavers,
    totalArea,
    orderQuantity,
    wastage: wastagePercentage,
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
  paverSize?: TileSize,
  orientation?: TileOrientation
): { valid: boolean; error?: string } {
  if (points.length < 3) {
    return { valid: false, error: 'Need at least 3 points' };
  }
  
  if (hasIntersectingEdges(points)) {
    return { valid: false, error: 'Boundary lines cannot cross each other' };
  }

  const area = calculatePolygonArea(points);

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

// Small helper to reduce floating line duplicates
function roundPx(v: number): number {
  return Math.round(v * 1000) / 1000; // 0.001 px precision
}

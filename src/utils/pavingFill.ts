import { GRID_CONFIG } from '@/constants/grid';
import { GROUT_MM } from '@/utils/copingCalculation';
import { TILE_SIZES, TileSize, TileOrientation, getTileDimensions } from '@/constants/tileConfig';

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
  groutMmOpt?: number
): Paver[] {
  // Standardize grout to match coping (GROUT_MM) unless overridden
  return fillAreaWithPaversFromOrigin(
    boundary,
    paverSize,
    paverOrientation,
    showEdgePavers,
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

      // Inclusion test: require STRICT interior overlap (no boundary-only tiles)
      const cornersStrictInside = corners.filter(corner => isPointInPolygon(corner, boundary));
      if (cornersStrictInside.length === 0) {
        // As a fallback, consider center strictly inside
        const centerStrict = isPointInPolygon({ x: x + cellW / 2, y: y + cellH / 2 }, boundary);
        if (!centerStrict) {
          continue; // tile has no interior area within polygon
        }
      }

      // Edge/full classification: treat boundary points as inside for corner counting
      const cornersInOrOn = corners.filter(corner => isPointInPolygonOrOnEdge(corner, boundary, 0.5));
      const cornersOutside = corners.length - cornersInOrOn.length;
      const isEdge = cornersOutside > 0;
      const cutPercentage = isEdge ? Math.round((cornersOutside / 4) * 100) : 0;
      
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

// Distance of a point to segment AB
function pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  const lx = ax + t * dx;
  const ly = ay + t * dy;
  return Math.hypot(px - lx, py - ly);
}

// Consider boundary points (within tol px) as inside
function isPointInPolygonOrOnEdge(point: Point, polygon: Point[], tol = 0.5): boolean {
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const ax = polygon[j].x, ay = polygon[j].y;
    const bx = polygon[i].x, by = polygon[i].y;
    if (pointToSegmentDist(point.x, point.y, ax, ay, bx, by) <= tol) return true;
  }
  return isPointInPolygon(point, polygon);
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

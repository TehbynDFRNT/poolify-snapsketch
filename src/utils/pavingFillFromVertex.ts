import { GRID_CONFIG } from '@/constants/grid';
import { GROUT_MM } from '@/utils/copingCalculation';
import { TileSize, TileOrientation, getTileDimensions } from '@/constants/tileConfig';

interface Point {
  x: number;
  y: number;
}

interface Paver {
  id: string;
  position: Point;
  width: number;
  height: number;
  isEdgePaver: boolean;
  cutPercentage?: number;
  mmWidth?: number;
  mmHeight?: number;
}

/**
 * Fill a polygon area with pavers starting from a specific vertex
 * Creates a full rectangular grid encompassing the polygon, then masks to shape
 */
export function fillAreaFromVertex(
  boundary: Point[],
  paverSize: TileSize,
  paverOrientation: TileOrientation,
  tilePlacementOrigin: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
  showEdgePavers: boolean,
  groutMm: number = GROUT_MM
): Paver[] {
  if (boundary.length < 3) return [];

  const { width: paverWidthMm, height: paverHeightMm } = getTileDimensions(paverSize, paverOrientation);
  const pxPerMm = GRID_CONFIG.spacing / 100;
  const paverWidth = paverWidthMm * pxPerMm;
  const paverHeight = paverHeightMm * pxPerMm;
  const stepX = (paverWidthMm + groutMm) * pxPerMm;
  const stepY = (paverHeightMm + groutMm) * pxPerMm;

  // Find the actual vertex that represents the selected corner
  const origin = findCornerVertex(boundary, tilePlacementOrigin);

  // Get bounding box of the polygon
  const minX = Math.min(...boundary.map(p => p.x));
  const maxX = Math.max(...boundary.map(p => p.x));
  const minY = Math.min(...boundary.map(p => p.y));
  const maxY = Math.max(...boundary.map(p => p.y));

  // Calculate how many tiles we need in each direction from origin
  const tilesLeft = Math.ceil((origin.x - minX + stepX) / stepX);
  const tilesRight = Math.ceil((maxX - origin.x + stepX) / stepX);
  const tilesUp = Math.ceil((origin.y - minY + stepY) / stepY);
  const tilesDown = Math.ceil((maxY - origin.y + stepY) / stepY);

  // Create grid of pavers covering the entire bounding box
  // Always start exactly at the origin vertex
  const pavers: Paver[] = [];

  // Generate tiles based on the selected corner
  switch (tilePlacementOrigin) {
    case 'top-left':
      // Tiles go right and down from origin
      for (let r = 0; r < tilesDown; r++) {
        for (let c = 0; c < tilesRight; c++) {
          checkAndAddPaver(
            origin.x + c * stepX,
            origin.y + r * stepY,
            paverWidth, paverHeight, r, c,
            boundary, showEdgePavers, paverWidthMm, paverHeightMm, pavers
          );
        }
      }
      break;

    case 'top-right':
      // Tiles go left and down from origin
      for (let r = 0; r < tilesDown; r++) {
        for (let c = 0; c < tilesLeft; c++) {
          checkAndAddPaver(
            origin.x - c * stepX - paverWidth,
            origin.y + r * stepY,
            paverWidth, paverHeight, r, c,
            boundary, showEdgePavers, paverWidthMm, paverHeightMm, pavers
          );
        }
      }
      break;

    case 'bottom-left':
      // Tiles go right and up from origin
      for (let r = 0; r < tilesUp; r++) {
        for (let c = 0; c < tilesRight; c++) {
          checkAndAddPaver(
            origin.x + c * stepX,
            origin.y - r * stepY - paverHeight,
            paverWidth, paverHeight, r, c,
            boundary, showEdgePavers, paverWidthMm, paverHeightMm, pavers
          );
        }
      }
      break;

    case 'bottom-right':
      // Tiles go left and up from origin
      for (let r = 0; r < tilesUp; r++) {
        for (let c = 0; c < tilesLeft; c++) {
          checkAndAddPaver(
            origin.x - c * stepX - paverWidth,
            origin.y - r * stepY - paverHeight,
            paverWidth, paverHeight, r, c,
            boundary, showEdgePavers, paverWidthMm, paverHeightMm, pavers
          );
        }
      }
      break;
  }

  return pavers;
}

/**
 * Check if a paver intersects the polygon and add it if needed
 */
function checkAndAddPaver(
  paverX: number,
  paverY: number,
  paverWidth: number,
  paverHeight: number,
  row: number,
  col: number,
  boundary: Point[],
  showEdgePavers: boolean,
  paverWidthMm: number,
  paverHeightMm: number,
  pavers: Paver[]
): void {
  // Check if paver intersects with polygon
  const corners = [
    { x: paverX, y: paverY },
    { x: paverX + paverWidth, y: paverY },
    { x: paverX + paverWidth, y: paverY + paverHeight },
    { x: paverX, y: paverY + paverHeight }
  ];

  const center = {
    x: paverX + paverWidth / 2,
    y: paverY + paverHeight / 2
  };

  const cornersInside = corners.filter(c => isPointInPolygon(c, boundary));
  const centerInside = isPointInPolygon(center, boundary);

  // Include paver if it has any overlap with the polygon
  if (centerInside || cornersInside.length > 0) {
    const isEdge = cornersInside.length < 4 && cornersInside.length > 0;
    const cutPercentage = isEdge ? Math.round(((4 - cornersInside.length) / 4) * 100) : 0;

    if (showEdgePavers || !isEdge) {
      pavers.push({
        id: `paver-${row}-${col}`,
        position: { x: paverX, y: paverY },
        width: paverWidth,
        height: paverHeight,
        isEdgePaver: isEdge,
        cutPercentage,
        mmWidth: paverWidthMm,
        mmHeight: paverHeightMm
      });
    }
  }
}

/**
 * Find the actual vertex that best represents the selected corner
 * First find leftmost/rightmost, then top/bottom from those
 */
function findCornerVertex(boundary: Point[], corner: string): Point {
  const minX = Math.min(...boundary.map(p => p.x));
  const maxX = Math.max(...boundary.map(p => p.x));
  const minY = Math.min(...boundary.map(p => p.y));
  const maxY = Math.max(...boundary.map(p => p.y));

  switch (corner) {
    case 'top-left': {
      // Find leftmost points first, then pick the topmost among them
      const leftPoints = boundary.filter(p => Math.abs(p.x - minX) < 1);
      return leftPoints.reduce((top, p) => p.y < top.y ? p : top);
    }
    case 'top-right': {
      // Find rightmost points first, then pick the topmost among them
      const rightPoints = boundary.filter(p => Math.abs(p.x - maxX) < 1);
      return rightPoints.reduce((top, p) => p.y < top.y ? p : top);
    }
    case 'bottom-left': {
      // Find leftmost points first, then pick the bottommost among them
      const leftPoints = boundary.filter(p => Math.abs(p.x - minX) < 1);
      return leftPoints.reduce((bottom, p) => p.y > bottom.y ? p : bottom);
    }
    case 'bottom-right': {
      // Find rightmost points first, then pick the bottommost among them
      const rightPoints = boundary.filter(p => Math.abs(p.x - maxX) < 1);
      return rightPoints.reduce((bottom, p) => p.y > bottom.y ? p : bottom);
    }
    default:
      return boundary[0];
  }
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  const x = point.x;
  const y = point.y;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}
import { TILE_GAP } from '@/constants/tileConfig';
import type { SimpleCopingConfig, SimpleCopingStats } from '@/types';

// Keep GROUT_MM export for pavingFill.ts compatibility
export const GROUT_MM = TILE_GAP.size;

// =============================================================================
// Tile depth lookup based on tile size selection
// =============================================================================

// Tile dimensions for coping:
// - Depth = dimension perpendicular to pool edge (into the coping)
// - Width = dimension along the pool edge
// For 400x600, the 600mm is always along the edge, so depth is 400mm
const TILE_DEPTHS: Record<string, number> = {
  '400x400': 400,
  '400x600': 400,  // 600mm runs along edge, 400mm is depth
};

const TILE_WIDTHS: Record<string, number> = {
  '400x400': 400,
  '400x600': 600,  // 600mm runs along the pool edge
};

// =============================================================================
// Simple Coping Calculation (New System)
// =============================================================================

interface Point { x: number; y: number; }

/**
 * Calculate perimeter of a polygon from its outline points
 */
function calculatePerimeter(outline: Point[]): number {
  if (!outline || outline.length < 2) return 0;

  let perimeter = 0;
  for (let i = 0; i < outline.length; i++) {
    const p1 = outline[i];
    const p2 = outline[(i + 1) % outline.length];
    perimeter += Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }
  return perimeter;
}

/**
 * Calculate polygon area using Shoelace formula
 */
function polygonArea(pts: Point[]): number {
  if (!pts || pts.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Calculate simple coping area based on pool perimeter and tile configuration
 * Returns base coping area (the ring around the pool) in square meters
 */
export function calculateSimpleCoping(
  poolOutline: Point[],
  config: SimpleCopingConfig
): { baseCopingAreaM2: number; tileDepthMm: number; tileWidthMm: number } {
  const perimeter = calculatePerimeter(poolOutline);
  const tileDepthMm = TILE_DEPTHS[config.tileSize] || 400;
  const tileWidthMm = TILE_WIDTHS[config.tileSize] || 400;
  const rows = config.rowsPerSide || 1;

  // Base coping area = perimeter × tile_depth × rows
  // This is approximate - actual area accounts for corner overlaps
  const baseCopingAreaMm2 = perimeter * tileDepthMm * rows;
  const baseCopingAreaM2 = baseCopingAreaMm2 / 1_000_000;

  return { baseCopingAreaM2, tileDepthMm, tileWidthMm };
}

/**
 * Calculate extension area from boundary polygon
 * Extension = boundary polygon area - pool area - base coping area
 */
export function calculateExtensionArea(
  boundaryPolygon: Point[] | undefined,
  poolOutline: Point[],
  baseCopingAreaM2: number,
  scale: number
): number {
  if (!boundaryPolygon || boundaryPolygon.length < 3) return 0;

  // Convert pool outline to stage units for comparison
  const poolOutlineStage = poolOutline.map(p => ({ x: p.x * scale, y: p.y * scale }));

  // Calculate areas
  const boundaryArea = polygonArea(boundaryPolygon);
  const poolArea = polygonArea(poolOutlineStage);

  // Convert base coping area to stage units (mm² to px²)
  const baseCopingAreaPx = baseCopingAreaM2 * 1_000_000 * scale * scale;

  // Extension is the area beyond base coping
  const extensionAreaPx = boundaryArea - poolArea - baseCopingAreaPx;

  // Convert back to m²
  const extensionAreaM2 = (extensionAreaPx / (scale * scale)) / 1_000_000;

  return Math.max(0, extensionAreaM2);
}

/**
 * Calculate complete coping statistics
 */
export function calculateCopingStats(
  poolOutline: Point[],
  config: SimpleCopingConfig,
  boundaryPolygon?: Point[],
  scale: number = 0.1
): SimpleCopingStats {
  const { baseCopingAreaM2 } = calculateSimpleCoping(poolOutline, config);
  const extensionAreaM2 = calculateExtensionArea(boundaryPolygon, poolOutline, baseCopingAreaM2, scale);

  return {
    areaM2: baseCopingAreaM2 + extensionAreaM2,
    baseCopingAreaM2,
    extensionAreaM2,
  };
}

// =============================================================================
// Polygon Expansion Helper (for rendering coping band)
// =============================================================================

/**
 * Determine if polygon is clockwise in SCREEN coordinates (Y increases downward).
 *
 * Uses the surveyor's formula (trapezoidal rule):
 *   sum = Σ (x_{i+1} - x_i) * (y_{i+1} + y_i)
 *
 * For this formula:
 *   - NEGATIVE sum = Clockwise (CW) in screen coords
 *   - POSITIVE sum = Counter-clockwise (CCW) in screen coords
 *
 * Example: Rectangle (0,0)→(100,0)→(100,100)→(0,100) is CW in screen coords
 *   Edge 0→1: (100-0)*(0+0) = 0
 *   Edge 1→2: (100-100)*(100+0) = 0
 *   Edge 2→3: (0-100)*(100+100) = -20000
 *   Edge 3→0: (0-0)*(0+100) = 0
 *   Sum = -20000 (negative = CW) ✓
 *
 * IMPORTANT: Pool outlines are defined CW (top-left → top-right → bottom-right → bottom-left)
 */
function isClockwise(pts: Point[]): boolean {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    sum += (pts[j].x - pts[i].x) * (pts[j].y + pts[i].y);
  }
  return sum < 0; // Negative sum = CW in screen coordinates
}

/**
 * Expand a polygon outward by a given distance
 * Used to create the outer edge of the coping band from pool outline
 * Automatically detects winding order and expands correctly
 */
export function expandPolygon(pts: Point[], distance: number): Point[] {
  if (!pts || pts.length < 3) return pts;

  // Remove duplicate closing point if present (first == last)
  let cleanPts = pts;
  if (pts.length > 3) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (Math.abs(first.x - last.x) < 0.01 && Math.abs(first.y - last.y) < 0.01) {
      cleanPts = pts.slice(0, -1);
    }
  }
  if (cleanPts.length < 3) return pts;

  const n = cleanPts.length;
  const result: Point[] = [];

  // Detect winding order to determine outward normal direction
  // CW polygon (in screen coords Y-down): outside is to the RIGHT of edge direction
  // CCW polygon: outside is to the LEFT of edge direction
  const cw = isClockwise(cleanPts);

  const normalize = (v: Point): Point => {
    const m = Math.hypot(v.x, v.y);
    return m > 0 ? { x: v.x / m, y: v.y / m } : { x: 0, y: 0 };
  };

  for (let i = 0; i < n; i++) {
    const prev = cleanPts[(i - 1 + n) % n];
    const curr = cleanPts[i];
    const next = cleanPts[(i + 1) % n];

    // Edge vectors
    const v1 = normalize({ x: curr.x - prev.x, y: curr.y - prev.y });
    const v2 = normalize({ x: next.x - curr.x, y: next.y - curr.y });

    // Outward normals - for CW use right perpendicular (y, -x), for CCW use left (-y, x)
    const n1 = cw ? { x: v1.y, y: -v1.x } : { x: -v1.y, y: v1.x };
    const n2 = cw ? { x: v2.y, y: -v2.x } : { x: -v2.y, y: v2.x };

    // Bisector direction
    const bisector = normalize({ x: n1.x + n2.x, y: n1.y + n2.y });

    // Handle sharp corners - limit offset to prevent self-intersection
    const cross = v1.x * v2.y - v1.y * v2.x;
    const angle = Math.asin(Math.min(1, Math.max(-1, cross)));
    const cosHalfAngle = Math.cos(angle / 2);
    const offset = distance / Math.max(0.3, Math.abs(cosHalfAngle));

    result.push({
      x: curr.x + bisector.x * offset,
      y: curr.y + bisector.y * offset,
    });
  }

  return result;
}

/**
 * Expand a polygon outward with per-edge distances
 * Each vertex i is expanded based on the distances of its adjacent edges (i-1 and i)
 * Used to create coping with different widths per side (e.g., double width on deep end)
 *
 * @param pts - Polygon points (CW or CCW)
 * @param edgeDistances - Distance for each edge (edge i connects vertex i to vertex i+1)
 *                        If shorter than pts.length, remaining edges use the last value
 */
export function expandPolygonPerEdge(pts: Point[], edgeDistances: number[]): Point[] {
  if (!pts || pts.length < 3) return pts;

  // Remove duplicate closing point if present (first == last)
  let cleanPts = pts;
  if (pts.length > 3) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (Math.abs(first.x - last.x) < 0.01 && Math.abs(first.y - last.y) < 0.01) {
      cleanPts = pts.slice(0, -1);
    }
  }
  if (cleanPts.length < 3) return pts;

  const n = cleanPts.length;
  const result: Point[] = [];

  // Build full edge distances array
  const distances: number[] = [];
  for (let i = 0; i < n; i++) {
    distances.push(edgeDistances[Math.min(i, edgeDistances.length - 1)] || 0);
  }

  const cw = isClockwise(cleanPts);

  const normalize = (v: Point): Point => {
    const m = Math.hypot(v.x, v.y);
    return m > 0 ? { x: v.x / m, y: v.y / m } : { x: 0, y: 0 };
  };

  for (let i = 0; i < n; i++) {
    const prev = cleanPts[(i - 1 + n) % n];
    const curr = cleanPts[i];
    const next = cleanPts[(i + 1) % n];

    // Edge vectors
    const v1 = normalize({ x: curr.x - prev.x, y: curr.y - prev.y }); // edge i-1 (prev -> curr)
    const v2 = normalize({ x: next.x - curr.x, y: next.y - curr.y }); // edge i (curr -> next)

    // Outward normals
    const n1 = cw ? { x: v1.y, y: -v1.x } : { x: -v1.y, y: v1.x };
    const n2 = cw ? { x: v2.y, y: -v2.x } : { x: -v2.y, y: v2.x };

    // Get distances for the two edges meeting at this vertex
    const prevEdgeIdx = (i - 1 + n) % n;
    const currEdgeIdx = i;
    const d1 = distances[prevEdgeIdx]; // distance for edge i-1
    const d2 = distances[currEdgeIdx]; // distance for edge i

    // If distances are equal, use bisector method (simpler)
    if (Math.abs(d1 - d2) < 0.01) {
      const bisector = normalize({ x: n1.x + n2.x, y: n1.y + n2.y });
      const cross = v1.x * v2.y - v1.y * v2.x;
      const angle = Math.asin(Math.min(1, Math.max(-1, cross)));
      const cosHalfAngle = Math.cos(angle / 2);
      const offset = d1 / Math.max(0.3, Math.abs(cosHalfAngle));
      result.push({
        x: curr.x + bisector.x * offset,
        y: curr.y + bisector.y * offset,
      });
    } else {
      // Different distances: compute intersection of the two offset lines
      // Offset line 1: point on edge i-1 offset by d1 along n1
      // Offset line 2: point on edge i offset by d2 along n2

      // Points on the offset edges
      const p1 = { x: curr.x + n1.x * d1, y: curr.y + n1.y * d1 };
      const p2 = { x: curr.x + n2.x * d2, y: curr.y + n2.y * d2 };

      // Line directions (same as edge directions)
      const dir1 = v1; // direction of edge i-1
      const dir2 = v2; // direction of edge i

      // Find intersection of the two offset lines
      // Line 1: p1 + t * dir1
      // Line 2: p2 + s * dir2
      const cross = dir1.x * dir2.y - dir1.y * dir2.x;

      if (Math.abs(cross) < 1e-9) {
        // Parallel edges - just use average offset
        const avgD = (d1 + d2) / 2;
        const bisector = normalize({ x: n1.x + n2.x, y: n1.y + n2.y });
        result.push({
          x: curr.x + bisector.x * avgD,
          y: curr.y + bisector.y * avgD,
        });
      } else {
        // Solve for t: (p1 + t * dir1) = (p2 + s * dir2)
        // t = ((p2 - p1) × dir2) / (dir1 × dir2)
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const t = (dx * dir2.y - dy * dir2.x) / cross;

        result.push({
          x: p1.x + t * dir1.x,
          y: p1.y + t * dir1.y,
        });
      }
    }
  }

  return result;
}

// =============================================================================
// Legacy Exports (for backwards compatibility)
// =============================================================================

export interface LegacyCopingConfig {
  id: string;
  name: string;
  tile: { along: number; inward: number };
  rows: { sides: number; shallow: number; deep: number };
}

export const DEFAULT_COPING_OPTIONS: LegacyCopingConfig[] = [
  {
    id: 'coping-400x400',
    name: 'Coping 400×400',
    tile: { along: 400, inward: 400 },
    rows: { sides: 1, shallow: 1, deep: 2 },
  },
  {
    id: 'coping-400x600',
    name: 'Coping 400×600',
    tile: { along: 600, inward: 400 }, // 600mm along edge, 400mm depth
    rows: { sides: 1, shallow: 1, deep: 2 },
  },
];

// Convert legacy config to simple config
export function legacyToSimpleConfig(legacy: LegacyCopingConfig): SimpleCopingConfig {
  const along = legacy.tile.along;

  // 400x600 has 600mm along the edge
  const tileSize: SimpleCopingConfig['tileSize'] = along === 600 ? '400x600' : '400x400';

  return { tileSize, rowsPerSide: legacy.rows.sides };
}

// Get tile depth from legacy config
export function getTileDepthFromConfig(config: any): number {
  if (!config) return 400;

  // New simple config
  if ('tileSize' in config) {
    return TILE_DEPTHS[config.tileSize] || 400;
  }

  // Legacy config
  if ('tile' in config && 'inward' in config.tile) {
    return config.tile.inward;
  }

  return 400;
}

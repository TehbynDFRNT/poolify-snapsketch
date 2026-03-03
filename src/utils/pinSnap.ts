import type { Component, PinAttachment } from '@/types';
import {
  closestPointOnPolyline,
  isPointInPolygon,
  getComponentWorldEdges,
  getComponentHitShape,
  getComponentWorldPoints,
  closestPointOnSegment,
} from './constraintGeometry';

interface Point {
  x: number;
  y: number;
}

export interface PinSnapResult {
  attachment: PinAttachment;
  worldPoint: Point;
  targetId: string;
}

// Component types that are polylines (open, with edges to snap to)
const POLYLINE_TYPES = new Set(['fence', 'wall', 'drainage', 'boundary']);

// Component types that are closed shapes (snap anywhere inside)
const CLOSED_SHAPE_TYPES = new Set(['pool', 'house', 'paving_area']);

/**
 * Find the nearest pin target for a given point on the canvas.
 * Checks polyline edges and closed shape containment.
 *
 * @param point - The canvas point to find a pin target for
 * @param components - All components on the canvas
 * @param excludeIds - Component IDs to exclude (e.g., the measurement itself)
 * @param tolerance - Max distance in canvas units to consider a snap
 * @returns The best PinSnapResult if within tolerance, or null
 */
export function findNearestPinTarget(
  point: Point,
  components: Component[],
  excludeIds: string[],
  tolerance: number = 15
): PinSnapResult | null {
  const excludeSet = new Set(excludeIds);
  let bestResult: PinSnapResult | null = null;
  let bestDistance = tolerance;

  for (const component of components) {
    if (excludeSet.has(component.id)) continue;

    // Skip measurements and other non-pinnable types
    if (component.type === 'quick_measure' || component.type === 'height' || component.type === 'decoration' || component.type === 'paver' || component.type === 'gate') {
      continue;
    }

    // Polyline components: check edge proximity
    if (POLYLINE_TYPES.has(component.type)) {
      const worldPoints = getComponentWorldPoints(component);
      if (worldPoints.length < 2) continue;

      const result = closestPointOnPolyline(point, worldPoints);
      if (!result || result.distance >= bestDistance) continue;

      // We need the segment index in the original (unrotated) points for the attachment.
      // Since rotation preserves segment count and parametric position,
      // the segmentIndex and t are the same.
      bestDistance = result.distance;
      bestResult = {
        attachment: {
          targetComponentId: component.id,
          segmentIndex: result.segmentIndex,
          t: result.t,
        },
        worldPoint: result.closest,
        targetId: component.id,
      };
    }

    // Closed shape components: check containment first, then edge proximity
    if (CLOSED_SHAPE_TYPES.has(component.type)) {
      const hitShape = getComponentHitShape(component);
      if (!hitShape || hitShape.length < 3) continue;

      // Check edge proximity first (more precise)
      let edgeBest: { closest: Point; distance: number } | null = null;
      for (let i = 0; i < hitShape.length; i++) {
        const a = hitShape[i];
        const b = hitShape[(i + 1) % hitShape.length];
        const { closest } = closestPointOnSegment(point, a, b);
        const dx = point.x - closest.x;
        const dy = point.y - closest.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (!edgeBest || dist < edgeBest.distance) {
          edgeBest = { closest, distance: dist };
        }
      }

      // Accept if edge is within tolerance, or if point is inside the shape
      const insideShape = isPointInPolygon(point, hitShape);
      if (!edgeBest) continue;

      const effectiveDistance = insideShape ? 0 : edgeBest.distance;
      if (effectiveDistance >= bestDistance) continue;

      // Calculate local offset (pre-rotation) for the attachment
      const localOffset = computeLocalOffset(point, component);
      if (!localOffset) continue;

      bestDistance = effectiveDistance;
      bestResult = {
        attachment: {
          targetComponentId: component.id,
          localOffset,
        },
        worldPoint: insideShape ? point : edgeBest.closest,
        targetId: component.id,
      };
    }
  }

  return bestResult;
}

/**
 * Compute the local offset for a world point relative to a component's position,
 * accounting for rotation (inverse-rotating the point back to local space).
 */
function computeLocalOffset(worldPoint: Point, component: Component): Point | null {
  const rotation = component.rotation || 0;

  if (rotation === 0) {
    return {
      x: worldPoint.x - component.position.x,
      y: worldPoint.y - component.position.y,
    };
  }

  // For pools, rotation is around the position origin
  if (component.type === 'pool') {
    const rad = (-rotation * Math.PI) / 180; // inverse rotation
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = worldPoint.x - component.position.x;
    const dy = worldPoint.y - component.position.y;
    return {
      x: dx * cos - dy * sin,
      y: dx * sin + dy * cos,
    };
  }

  // For other shapes, inverse-rotate around the pivot
  const pts = component.properties.points || component.properties.boundary || [];
  if (pts.length === 0) return null;

  const localPts = pts.map((p: Point) => ({
    x: p.x - component.position.x,
    y: p.y - component.position.y,
  }));
  const xs = localPts.map((p: Point) => p.x);
  const ys = localPts.map((p: Point) => p.y);
  const pivotX = (Math.min(...xs) + Math.max(...xs)) / 2 + component.position.x;
  const pivotY = (Math.min(...ys) + Math.max(...ys)) / 2 + component.position.y;

  const rad = (-rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = worldPoint.x - pivotX;
  const dy = worldPoint.y - pivotY;
  const unrotatedWorld = {
    x: pivotX + dx * cos - dy * sin,
    y: pivotY + dx * sin + dy * cos,
  };

  return {
    x: unrotatedWorld.x - component.position.x,
    y: unrotatedWorld.y - component.position.y,
  };
}

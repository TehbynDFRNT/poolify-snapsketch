import type { Component, PinAttachment } from '@/types';

interface Point {
  x: number;
  y: number;
}

/**
 * Find the closest point on a line segment AB to a given point P.
 * Returns the closest point and the parametric t value [0,1].
 */
export function closestPointOnSegment(
  p: Point,
  a: Point,
  b: Point
): { closest: Point; t: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;

  if (lengthSq === 0) {
    return { closest: { x: a.x, y: a.y }, t: 0 };
  }

  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  return {
    closest: {
      x: a.x + t * abx,
      y: a.y + t * aby,
    },
    t,
  };
}

/**
 * Find the closest point on a polyline (array of points) to a given point P.
 * Returns the closest point, segment index, parametric t, and distance.
 */
export function closestPointOnPolyline(
  p: Point,
  points: Point[]
): { closest: Point; segmentIndex: number; t: number; distance: number } | null {
  if (points.length < 2) return null;

  let bestDist = Infinity;
  let bestResult = { closest: points[0], segmentIndex: 0, t: 0 };

  for (let i = 0; i < points.length - 1; i++) {
    const { closest, t } = closestPointOnSegment(p, points[i], points[i + 1]);
    const dx = p.x - closest.x;
    const dy = p.y - closest.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < bestDist) {
      bestDist = dist;
      bestResult = { closest, segmentIndex: i, t };
    }
  }

  return { ...bestResult, distance: bestDist };
}

/**
 * Ray-casting point-in-polygon test.
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Rotate a point around an origin by angleDeg degrees.
 */
function rotatePoint(p: Point, origin: Point, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

/**
 * Get the pivot point used for rotation of a component.
 * For polyline/polygon components, this is the centroid of the bounding box.
 */
function getComponentPivot(component: Component): Point {
  const pts = component.properties.points || component.properties.boundary || [];
  if (pts.length === 0) {
    return { x: component.position.x, y: component.position.y };
  }
  const localPts = pts.map((p: Point) => ({
    x: p.x - component.position.x,
    y: p.y - component.position.y,
  }));
  const xs = localPts.map((p: Point) => p.x);
  const ys = localPts.map((p: Point) => p.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2 + component.position.x,
    y: (Math.min(...ys) + Math.max(...ys)) / 2 + component.position.y,
  };
}

/**
 * Get the world-space edges (segments) of a polyline component, with rotation applied.
 * Works for fence, wall, drainage, boundary (open polylines).
 */
export function getComponentWorldEdges(component: Component): Array<[Point, Point]> {
  const pts = component.properties.points;
  if (!pts || pts.length < 2) return [];

  const rotation = component.rotation || 0;
  if (rotation === 0) {
    const edges: Array<[Point, Point]> = [];
    for (let i = 0; i < pts.length - 1; i++) {
      edges.push([pts[i], pts[i + 1]]);
    }
    return edges;
  }

  const pivot = component.properties.rotationPivot || getComponentPivot(component);
  const rotatedPts = pts.map((p: Point) => rotatePoint(p, pivot, rotation));
  const edges: Array<[Point, Point]> = [];
  for (let i = 0; i < rotatedPts.length - 1; i++) {
    edges.push([rotatedPts[i], rotatedPts[i + 1]]);
  }
  return edges;
}

/**
 * Get the world-space polygon of a closed-shape component, with rotation applied.
 * Works for pool, house, paving_area.
 */
export function getComponentHitShape(component: Component): Point[] | null {
  // Pool: use outline scaled + rotated
  if (component.type === 'pool' && component.properties.pool) {
    const pool = component.properties.pool as { outline?: Point[] };
    const outline = pool.outline;
    if (!outline || outline.length === 0) return null;

    const scale = 0.1; // mm to canvas pixels
    const rotation = component.rotation || 0;
    const cos = Math.cos((rotation * Math.PI) / 180);
    const sin = Math.sin((rotation * Math.PI) / 180);

    return outline.map((p: Point) => {
      const sx = p.x * scale;
      const sy = p.y * scale;
      const rx = sx * cos - sy * sin;
      const ry = sx * sin + sy * cos;
      return {
        x: component.position.x + rx,
        y: component.position.y + ry,
      };
    });
  }

  // House: uses properties.points (closed polygon)
  if (component.type === 'house') {
    const pts = component.properties.points;
    if (!pts || pts.length < 3) return null;
    const rotation = component.rotation || 0;
    if (rotation === 0) return pts;
    const pivot = component.properties.rotationPivot || getComponentPivot(component);
    return pts.map((p: Point) => rotatePoint(p, pivot, rotation));
  }

  // Paving area: uses properties.boundary (closed polygon)
  if (component.type === 'paving_area') {
    const boundary = component.properties.boundary;
    if (!boundary || boundary.length < 3) return null;
    const rotation = component.rotation || 0;
    if (rotation === 0) return boundary;
    const pivot = component.properties.rotationPivot || getComponentPivot(component);
    return boundary.map((p: Point) => rotatePoint(p, pivot, rotation));
  }

  return null;
}

/**
 * Resolve a PinAttachment to a world-space position, given the target component.
 */
export function resolveWorldPosition(
  pin: PinAttachment,
  targetComponent: Component
): Point | null {
  // Polyline lock: parametric position on segment
  if (pin.segmentIndex !== undefined && pin.t !== undefined) {
    const pts = targetComponent.properties.points;
    if (!pts || pin.segmentIndex >= pts.length - 1) return null;

    const a = pts[pin.segmentIndex];
    const b = pts[pin.segmentIndex + 1];
    const localPoint = {
      x: a.x + pin.t * (b.x - a.x),
      y: a.y + pin.t * (b.y - a.y),
    };

    // Apply component rotation if needed
    const rotation = targetComponent.rotation || 0;
    if (rotation === 0) return localPoint;

    const pivot = targetComponent.properties.rotationPivot || getComponentPivot(targetComponent);
    return rotatePoint(localPoint, pivot, rotation);
  }

  // Closed shape lock: localOffset relative to component.position
  if (pin.localOffset) {
    const worldUnrotated = {
      x: targetComponent.position.x + pin.localOffset.x,
      y: targetComponent.position.y + pin.localOffset.y,
    };

    const rotation = targetComponent.rotation || 0;
    if (rotation === 0) return worldUnrotated;

    // For pools, rotation is around the position origin
    if (targetComponent.type === 'pool') {
      const cos = Math.cos((rotation * Math.PI) / 180);
      const sin = Math.sin((rotation * Math.PI) / 180);
      return {
        x: targetComponent.position.x + pin.localOffset.x * cos - pin.localOffset.y * sin,
        y: targetComponent.position.y + pin.localOffset.x * sin + pin.localOffset.y * cos,
      };
    }

    // For other shapes, rotate around the component pivot
    const pivot = targetComponent.properties.rotationPivot || getComponentPivot(targetComponent);
    return rotatePoint(worldUnrotated, pivot, rotation);
  }

  return null;
}

/**
 * Get the world-space points of a polyline component (with rotation applied).
 */
export function getComponentWorldPoints(component: Component): Point[] {
  const pts = component.properties.points;
  if (!pts || pts.length === 0) return [];

  const rotation = component.rotation || 0;
  if (rotation === 0) return pts;

  const pivot = component.properties.rotationPivot || getComponentPivot(component);
  return pts.map((p: Point) => rotatePoint(p, pivot, rotation));
}

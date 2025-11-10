/**
 * Shared geometry utility functions for polygon operations
 */

export type Point = { x: number; y: number };

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect =
      (yi > point.y) !== (yj > point.y) &&
      point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Check if point Q is on line segment PR
 */
export function onSegment(p: Point, q: Point, r: Point): boolean {
  return (
    q.x <= Math.max(p.x, r.x) + 1e-6 &&
    q.x + 1e-6 >= Math.min(p.x, r.x) &&
    q.y <= Math.max(p.y, r.y) + 1e-6 &&
    q.y + 1e-6 >= Math.min(p.y, r.y)
  );
}

/**
 * Calculate orientation of ordered triplet (p, q, r)
 * @returns 0 = collinear, 1 = clockwise, 2 = counterclockwise
 */
export function orientation(p: Point, q: Point, r: Point): number {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (Math.abs(val) < 1e-9) return 0;
  return val > 0 ? 1 : 2;
}

/**
 * Check if two line segments intersect
 */
export function segmentsIntersect(p1: Point, q1: Point, p2: Point, q2: Point): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

/**
 * Get corner points of a rectangle
 */
export function rectCorners(r: { x: number; y: number; w: number; h: number }): Point[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}

/**
 * Check if a point is near a polygon boundary within tolerance
 */
export function isPointNearPolygonBoundary(pt: Point, poly: Point[], tol = 2): boolean {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const L2 = dx * dx + dy * dy;
    if (L2 < 1e-6) continue;
    const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / (L2 || 1e-9)));
    const px = a.x + t * dx, py = a.y + t * dy;
    const d2 = (pt.x - px) ** 2 + (pt.y - py) ** 2;
    if (d2 <= tol * tol) return true;
  }
  return false;
}

/**
 * Check if a rectangle is fully inside a polygon
 */
export function rectFullyInsidePolygon(
  rect: { x: number; y: number; w: number; h: number },
  poly: Point[]
): boolean {
  const inset = 0.5; // keep crisp, avoid float jitter
  const r = {
    x: rect.x + inset,
    y: rect.y + inset,
    w: Math.max(1, rect.w - 2 * inset),
    h: Math.max(1, rect.h - 2 * inset)
  };
  const corners = rectCorners(r);
  return corners.every(c => pointInPolygon(c, poly) || isPointNearPolygonBoundary(c, poly, 1.5));
}

/**
 * Check if a rectangle intersects with a polygon
 */
export function rectIntersectsPolygon(
  rect: { x: number; y: number; w: number; h: number },
  poly: Point[]
): boolean {
  const corners = rectCorners(rect);
  // any 2 corners in/on poly ⇒ meaningful overlap
  let inOrOn = 0;
  for (const c of corners) if (pointInPolygon(c, poly) || isPointNearPolygonBoundary(c, poly, 1.5)) inOrOn++;
  if (inOrOn >= 2) return true;

  // polygon vertex inside rect?
  const inRect = (p: Point) => p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
  if (poly.some(inRect)) return true;

  // edge intersections
  const edges: [Point, Point][] = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    for (const [r1, r2] of edges) if (segmentsIntersect(a, b, r1, r2)) return true;
  }
  return false;
}

/**
 * Find closest point on a line segment to a given point
 */
export function closestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const abx = b.x - a.x, aby = b.y - a.y;
  const apx = p.x - a.x, apy = p.y - a.y;
  const ab2 = abx * abx + aby * aby || 1;
  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * abx, y: a.y + t * aby };
}

/**
 * Clamp a point to the nearest point on a polygon boundary if outside
 */
export function clampPointToPolygon(p: Point, poly: Point[]): Point {
  if (!poly || poly.length < 3) return p;
  if (pointInPolygon(p, poly) || isPointNearPolygonBoundary(p, poly, 0.01)) return p;
  let best: Point | null = null;
  let bestD2 = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const q = closestPointOnSegment(p, a, b);
    const dx = p.x - q.x, dy = p.y - q.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) { bestD2 = d2; best = q; }
  }
  return best || p;
}

/**
 * Calculate polygon area (signed area * 2)
 */
export function polygonArea2(poly: Point[]): number {
  return poly.reduce((a, p, i) => {
    const q = poly[(i + 1) % poly.length];
    return a + (p.x * q.y - q.x * p.y);
  }, 0);
}

/**
 * Find intersection point between two line segments
 */
export function intersectionPoint(s: Point, e: Point, a: Point, b: Point): Point {
  const A1 = e.y - s.y;
  const B1 = s.x - e.x;
  const C1 = A1 * s.x + B1 * s.y;
  const A2 = b.y - a.y;
  const B2 = a.x - b.x;
  const C2 = A2 * a.x + B2 * a.y;
  const det = A1 * B2 - A2 * B1 || 1e-12;
  return { x: (B2 * C1 - B1 * C2) / det, y: (A1 * C2 - A2 * C1) / det };
}

/**
 * Clip a polygon using Sutherland-Hodgman algorithm
 */
export function clipPolygon(subject: Point[], clip: Point[]): Point[] {
  if (!clip || clip.length < 3 || !subject || subject.length < 3) return subject;
  // Determine clip orientation; inside is to the left if CCW, to the right if CW
  const clipCCW = polygonArea2(clip) > 0; // positive area => CCW
  let output = subject.slice();
  for (let i = 0; i < clip.length; i++) {
    const A = clip[i];
    const B = clip[(i + 1) % clip.length];
    const edge = (p: Point) => (B.x - A.x) * (p.y - A.y) - (B.y - A.y) * (p.x - A.x);
    const inside = (p: Point) => clipCCW ? edge(p) >= 0 : edge(p) <= 0;
    const input = output.slice();
    output = [];
    if (input.length === 0) break;
    for (let j = 0; j < input.length; j++) {
      const S = input[j];
      const E = input[(j + 1) % input.length];
      const Ein = inside(E);
      const Sin = inside(S);
      if (Ein) {
        if (!Sin) output.push(intersectionPoint(S, E, A, B));
        output.push(E);
      } else if (Sin) {
        output.push(intersectionPoint(S, E, A, B));
      }
    }
  }
  // Remove near-duplicate points
  const dedup: Point[] = [];
  const eps = 1e-6;
  for (const p of output) {
    const last = dedup[dedup.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > eps) dedup.push(p);
  }
  return dedup;
}

/**
 * Remove redundant vertices: near-duplicates and collinear points within tolerance
 */
export function simplifyPolygon(poly: Point[], eps = 1e-6): Point[] {
  if (!poly || poly.length < 3) return poly || [];
  // Remove consecutive duplicates first
  const uniq: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const last = uniq[uniq.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > eps) uniq.push(p);
  }
  // If closes back to start, drop the last
  if (uniq.length >= 2) {
    const first = uniq[0], last = uniq[uniq.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) <= eps) uniq.pop();
  }
  if (uniq.length < 3) return uniq;
  // Remove collinear points
  const out: Point[] = [];
  const n = uniq.length;
  const isCollinear = (a: Point, b: Point, c: Point): boolean => {
    const abx = b.x - a.x, aby = b.y - a.y;
    const bcx = c.x - b.x, bcy = c.y - b.y;
    const cross = Math.abs(abx * bcy - aby * bcx);
    const abLen = Math.hypot(abx, aby) || 1;
    const bcLen = Math.hypot(bcx, bcy) || 1;
    // scale-invariant collinearity tolerance
    return cross <= eps * (abLen + bcLen);
  };
  for (let i = 0; i < n; i++) {
    const a = uniq[(i - 1 + n) % n];
    const b = uniq[i];
    const c = uniq[(i + 1) % n];
    if (!isCollinear(a, b, c)) out.push(b);
  }
  // Edge case: if everything became collinear, fall back to uniq
  return out.length >= 3 ? out : uniq;
}

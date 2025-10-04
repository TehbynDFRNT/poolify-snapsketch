export interface Point {
  x: number;
  y: number;
}

export const lockToAxis = (start: Point, end: Point): Point => {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  
  // Lock to stronger axis
  if (dx > dy) {
    return { x: end.x, y: start.y }; // Horizontal lock
  } else {
    return { x: start.x, y: end.y }; // Vertical lock
  }
};

export const detectAxisLock = (start: Point, end: Point): 'horizontal' | 'vertical' | null => {
  const threshold = 5; // Allow small deviation
  if (Math.abs(start.y - end.y) < threshold) return 'horizontal';
  if (Math.abs(start.x - end.x) < threshold) return 'vertical';
  return null;
};

export const calculateDistance = (p1: Point, p2: Point): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

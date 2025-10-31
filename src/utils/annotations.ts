import type { Component } from '@/types';

// Compute a deterministic, slightly different annotation offset per object.
// - Uses component id hash and 100px grid cell index so nearby objects vary.
// - Returns a small perpendicular offset in pixels to reduce label overlap.
export function getAnnotationOffsetPx(id: string, position?: { x: number; y: number }): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const steps = 5; // number of distinct offsets
  const base = 8;  // minimum offset px (closer to line)
  const max = 16;  // maximum offset px (keep labels tight)
  const range = max - base;

  const cellIndex = position
    ? (Math.floor(position.x / 100) + Math.floor(position.y / 100))
    : 0;

  const idx = Math.abs((hash + cellIndex) % steps);
  const stepSize = steps > 1 ? range / (steps - 1) : 0;
  return Math.round(base + idx * stepSize);
}

// Normalize a label angle so text is always upright and readable left-to-right.
// Returns an angle in degrees within [-90, 90].
export function normalizeLabelAngle(angleDeg: number): number {
  // Wrap to [-180, 180]
  let a = ((angleDeg % 360) + 360) % 360;
  if (a > 180) a -= 360;
  // Flip upside-down angles to keep text upright and left-to-right
  if (a > 90) a -= 180;
  if (a < -90) a += 180;
  return a;
}

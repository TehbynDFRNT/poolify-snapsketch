/**
 * Canvas snapping utilities for consistent grout rendering across all components
 */

/**
 * Snap a value to the nearest half-pixel for crisp rendering
 */
export const roundHalf = (px: number): number => Math.round(px * 2) / 2;

/**
 * Snap a rectangle to half-pixels on all edges to ensure consistent grout thickness
 * @param xMm - X position in mm
 * @param yMm - Y position in mm
 * @param wMm - Width in mm
 * @param hMm - Height in mm
 * @param scale - Scale factor (px per mm)
 * @returns Snapped rectangle in pixels with both edges aligned to 0.5px
 */
export const snapRectPx = (
  xMm: number,
  yMm: number,
  wMm: number,
  hMm: number,
  scale: number
): { x: number; y: number; width: number; height: number } => {
  // Snap both edges to half-pixels
  const x1 = roundHalf(xMm * scale);
  const y1 = roundHalf(yMm * scale);
  const x2 = roundHalf((xMm + wMm) * scale);
  const y2 = roundHalf((yMm + hMm) * scale);

  // Compute size from snapped edges to avoid rounding errors
  return {
    x: x1,
    y: y1,
    width: Math.max(1, x2 - x1),
    height: Math.max(1, y2 - y1)
  };
};

/**
 * Snap a point to half-pixels
 */
export const snapPointPx = (xMm: number, yMm: number, scale: number): { x: number; y: number } => {
  return {
    x: roundHalf(xMm * scale),
    y: roundHalf(yMm * scale),
  };
};
/**
 * Blueprint Mode Color Palette
 *
 * Blue-hue monochrome color scheme for technical/construction-style rendering.
 * Used when blueprintMode toggle is enabled.
 * Designed to stand out from the gray grid/background.
 */

export const BLUEPRINT_COLORS = {
  // Primary elements - main outlines
  primary: '#1e3a5f',        // Dark navy blue - Pool edges, house outlines, boundaries

  // Secondary elements
  secondary: '#2563eb',      // Medium blue - Walls, coping, drainage, fences

  // Tertiary/subtle elements
  tertiary: '#60a5fa',       // Light blue - Grout lines, subtle details

  // Fills (replacing colored fills and patterns)
  fillLight: '#dbeafe',      // Very light blue - Pool water, paving areas
  fillMedium: '#bfdbfe',     // Light blue - Coping, concrete areas
  fillDark: '#93c5fd',       // Medium light blue - House footprint

  // Annotations
  text: '#1e3a5f',           // Dark navy - All measurement text
  textSecondary: '#1d4ed8',  // Blue - Secondary labels

  // Note: Selection colors remain blue for UX consistency
  // selection: '#3B82F6',   // Keep existing blue selection
};

/**
 * Helper to get blueprint or normal color based on mode
 */
export function getBlueprintColor(
  normalColor: string,
  blueprintMode: boolean,
  blueprintColor: string = BLUEPRINT_COLORS.primary
): string {
  return blueprintMode ? blueprintColor : normalColor;
}

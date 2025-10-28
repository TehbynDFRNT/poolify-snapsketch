/**
 * Centralized tile configuration for all paver/tile components
 * This ensures consistency across PaverComponent, PavingAreaComponent, and Pool coping
 */

// Tile color scheme
export const TILE_COLORS = {
  // Base tile colors
  baseTile: '#E8DBC4',        // Slightly darker sandstone for base/original tiles
  extendedTile: '#F3EBD9',    // Lighter sandstone for extensions and regular pavers
  cutTile: '#D9C7A9',         // Darker sandstone for cut tiles (partial pavers)

  // Grout colors
  groutColor: '#D4C5A9',       // Grout/joint color between tiles

  // Special indicators
  cutIndicator: '#B8AE94',     // Scissors/cut indicator color
} as const;

// Tile sizes available across all components
export const TILE_SIZES = {
  '400x400': {
    width: 400,
    height: 400,
    label: '400×400mm',
    // For pool coping global orientation
    globalTile: { x: 400, y: 400 }
  },
  '400x600': {
    width: 400,
    height: 600,
    label: '400×600mm',
    globalTile: { x: 400, y: 600 }
  },
  '600x400': {
    width: 600,
    height: 400,
    label: '600×400mm',
    globalTile: { x: 600, y: 400 }
  },
} as const;

// Grout/gap configuration
export const TILE_GAP = {
  // Gap size (in mm) - this is padding around each tile
  // Set to 0 for no gaps, or restore to 5 for traditional grout lines
  size: 5,  // mm - 5mm gap between tiles

  // Visual rendering of gaps
  renderGap: true,  // Whether to visually show gaps between tiles

  // If you want to show grout visually but keep tiles aligned,
  // you could render a thin line overlay instead of actual spacing
  visualGroutLine: false,
  visualGroutWidth: 1, // px - for visual grout lines if enabled
} as const;

// Helper to get tile dimensions with orientation
export function getTileDimensions(
  size: keyof typeof TILE_SIZES,
  orientation: 'vertical' | 'horizontal' = 'vertical'
): { width: number; height: number } {
  const tile = TILE_SIZES[size];
  if (orientation === 'vertical') {
    return { width: tile.width, height: tile.height };
  } else {
    return { width: tile.height, height: tile.width };
  }
}

// Helper to get all available size options for UI selects
export function getTileSizeOptions() {
  return Object.entries(TILE_SIZES).map(([key, value]) => ({
    value: key,
    label: value.label,
  }));
}

// Export type definitions
export type TileSize = keyof typeof TILE_SIZES;
export type TileOrientation = 'vertical' | 'horizontal';

// Legacy compatibility exports (to minimize breaking changes)
export const PAVER_SIZES = Object.entries(TILE_SIZES).reduce((acc, [key, value]) => {
  acc[key] = { width: value.width, height: value.height, label: value.label };
  return acc;
}, {} as Record<string, { width: number; height: number; label: string }>);

// For pool coping calculations
export const GROUT_MM = TILE_GAP.size;
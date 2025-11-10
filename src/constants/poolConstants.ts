/**
 * Constants for pool component rendering and interactions
 */

// Scale factor: 1 canvas unit = 10mm (0.1 scale from mm to canvas)
export const POOL_SCALE = 0.1;

// Geometric tolerances
export const GEOMETRIC_TOLERANCE = {
  /** Epsilon for floating-point comparisons */
  EPSILON: 1e-6,
  /** Division-by-zero protection threshold */
  DIV_ZERO_GUARD: 1e-9,
  /** Tolerance for near-boundary checks (mm) */
  BOUNDARY_NEAR_MM: 0.25,
  /** Inset for rectangle containment checks (px) */
  RECT_INSET_PX: 0.5,
  /** Boundary check tolerance (px) */
  BOUNDARY_CHECK_PX: 1.5,
  /** Point near polygon edge tolerance (px) */
  POINT_NEAR_EDGE_PX: 2,
} as const;

// Visual constants
export const POOL_VISUAL = {
  /** Padding around clickable bounds (px) */
  CLICKABLE_PADDING: 10,
  /** Minimum clickable dimension (px) */
  MIN_CLICKABLE_SIZE: 20,
  /** Pool stroke width (px) */
  STROKE_WIDTH: 2,
  /** Pool fill opacity */
  FILL_OPACITY: 0.3,
  /** Pool stroke color */
  STROKE_COLOR: '#3B82F6',
  /** Pool fill color (fallback when no pattern) */
  FILL_COLOR: 'rgba(59, 130, 246, 0.3)',
} as const;

// Boundary editing constants
export const BOUNDARY_EDITING = {
  /** Dash pattern for boundary line */
  DASH_PATTERN: [8, 6],
  /** Boundary line stroke color */
  STROKE_COLOR: '#10B981',
  /** Boundary line stroke width */
  STROKE_WIDTH: 2,
  /** Node radius (base size, divided by zoom) */
  NODE_RADIUS_BASE: 4.2,
  /** Minimum node radius */
  NODE_RADIUS_MIN: 2,
  /** Node fill color */
  NODE_FILL: '#10B981',
  /** Node stroke color */
  NODE_STROKE: '#fff',
  /** Node stroke width */
  NODE_STROKE_WIDTH: 2,
} as const;

// Snapping constants
export const POOL_SNAPPING = {
  /** Tile edge snap tolerance (px) - relative to grid spacing */
  TILE_EDGE_TOLERANCE_FACTOR: 0.35,
  /** Maximum tile edge snap tolerance (px) */
  TILE_EDGE_TOLERANCE_MAX: 8,
} as const;

// Coping measurements
export const COPING_MEASUREMENTS = {
  /** Additional offset for coping labels beyond standard annotation offset */
  LABEL_EXTRA_OFFSET: 12,
  /** Font size for coping measurements */
  FONT_SIZE: 11,
  /** Text color for coping measurements */
  TEXT_COLOR: '#3B82F6',
  /** Text offset for centering */
  TEXT_OFFSET_X: 20,
} as const;

// End labels (DE/SE)
export const END_LABELS = {
  /** Font size for deep/shallow end labels */
  FONT_SIZE: 10,
  /** Font style */
  FONT_STYLE: 'bold',
  /** Text color */
  TEXT_COLOR: '#ffffff',
  /** Text offset X */
  OFFSET_X: 10,
  /** Text offset Y */
  OFFSET_Y: 5,
} as const;

// Auto-tile generation
export const AUTO_TILE = {
  /** Default tile width fallback (mm) */
  DEFAULT_TILE_WIDTH: 600,
  /** Default tile depth fallback (mm) */
  DEFAULT_TILE_DEPTH: 400,
  /** Overlap check tolerance (px) */
  OVERLAP_TOLERANCE: 0.5,
} as const;

// Grout rendering
export const GROUT = {
  /** Tolerance for floating-point comparison in grout adjacency (mm) */
  ADJACENCY_TOLERANCE: 0.01,
  /** Minimum rendered dimension for grout (px) */
  MIN_RENDER_SIZE: 1,
} as const;

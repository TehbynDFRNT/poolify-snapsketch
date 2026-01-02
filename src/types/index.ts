export interface Project {
  id: string;
  customerName: string;
  address: string;
  coordinates?: { lat: number; lng: number };
  notes?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  components: Component[];
}

export type ToolType =
  | 'select'
  | 'hand'
  | 'pool'
  | 'paver'
  | 'gate'
  | 'paving_area'
  | 'drainage'
  | 'fence'
  | 'wall'
  | 'boundary'
  | 'house'
  | 'quick_measure'
  | 'height'
  | 'decoration';

export type ComponentType =
  | 'pool'
  | 'paver'
  | 'paving_area'
  | 'drainage'
  | 'fence'
  | 'gate'
  | 'wall'
  | 'boundary'
  | 'house'
  | 'quick_measure'
  | 'height'
  | 'decoration';

export interface Component {
  id: string;
  type: ComponentType;
  position: { x: number; y: number };
  rotation: number;
  dimensions: { width: number; height: number };
  properties: ComponentProperties;
}


// Simplified coping configuration (new system)
// Tile sizes: 400x400 or 400x600 (600mm always runs along pool edge)
export interface SimpleCopingConfig {
  tileSize: '400x400' | '400x600';
  rowsPerSide?: number; // 1-3, defaults to 1 (uniform for sides/shallow)
  rowsDeepEnd?: number; // 1-3, defaults to 2 (double width on deep end)
}

// Simplified coping statistics (new system)
export interface SimpleCopingStats {
  areaM2: number;           // Total coping area in square meters
  baseCopingAreaM2: number; // Just the ring around pool
  extensionAreaM2: number;  // Area from boundary polygon - pool - base coping
}

// @deprecated - Legacy interface, kept for backwards compatibility with saved projects
export interface CopingCalculation {
  deepEnd: {
    rows: number;
    width: number;
    length: number;
    fullPavers: number;
    partialPaver: number | null;
    paverPositions: Array<{ x: number; y: number; width: number; height: number; isPartial: boolean }>;
  };
  shallowEnd: {
    rows: number;
    width: number;
    length: number;
    fullPavers: number;
    partialPaver: number | null;
    paverPositions: Array<{ x: number; y: number; width: number; height: number; isPartial: boolean }>;
  };
  leftSide: {
    rows: number;
    width: number;
    length: number;
    fullPavers: number;
    partialPaver: number | null;
    paverPositions: Array<{ x: number; y: number; width: number; height: number; isPartial: boolean }>;
  };
  rightSide: {
    rows: number;
    width: number;
    length: number;
    fullPavers: number;
    partialPaver: number | null;
    paverPositions: Array<{ x: number; y: number; width: number; height: number; isPartial: boolean }>;
  };
  totalFullPavers: number;
  totalPartialPavers: number;
  totalPavers: number;
  totalArea: number;
}

export interface ComponentProperties {
  // Pool
  poolId?: string;
  pool?: any; // embedded pool geometry
  showCoping?: boolean;
  copingConfig?: SimpleCopingConfig;
  copingStatistics?: SimpleCopingStats;
  copingBoundary?: Array<{ x: number; y: number }>; // Extension boundary polygon (stage units)
  // @deprecated - Legacy properties kept for backwards compatibility
  copingCalculation?: CopingCalculation;
  copingTiles?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    isPartial: boolean;
    side: 'top' | 'bottom' | 'left' | 'right';
  }>;
  copingExtensions?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    isPartial: boolean;
    side: 'top' | 'bottom' | 'left' | 'right';
  }>;
  // Paver
  paverSize?: '400x400' | '400x600';
  paverCount?: { rows: number; cols: number };
  // Optional: additional paver blocks to allow partial extensions while keeping one component
  paverExtraBlocks?: Array<{ col: number; row: number; cols: number; rows: number }>;
  // Base grid offset in tile units (for left/top extensions)
  baseOffset?: { col: number; row: number };
  
  // Paving Area
  boundary?: Array<{ x: number; y: number }>;
  paverOrientation?: 'vertical' | 'horizontal';
  // When set, align grid origin to the coping grid of this pool component
  alignToPoolId?: string;
  // Snapping division for vertex edits: 1=edge only, 2=half, 4=quarter
  tileSnapDivision?: 1 | 2 | 4;
  // Invisible square frame that encloses the paving area for consistent tiling
  tilingFrame?: { x: number; y: number; side: number };
  // Per-vertex snap meta (edge/inbetween) for the current boundary
  boundarySnapMeta?: Array<'edge' | 'inbetween'>;
  // Per-vertex axis meta: 'edge-x' (on vertical grout), 'edge-y' (on horizontal grout), 'corner' (on both), or 'inbetween'
  boundaryVertexAxisMeta?: Array<'edge-x' | 'edge-y' | 'corner' | 'inbetween'>;
  // Per-edge orientation for the closed boundary (i -> i+1)
  boundaryEdgeMeta?: Array<'horizontal' | 'vertical' | 'angled'>;
  // Per-edge grout alignment flag (true if edge follows a grout line per rules)
  boundaryGroutEdge?: boolean[];
  pavers?: Array<{
    id: string;
    position: { x: number; y: number };
    width: number;
    height: number;
    isEdgePaver: boolean;
    cutPercentage?: number;
  }>;
  showEdgePavers?: boolean;
  wastagePercentage?: number;
  statistics?: {
    fullPavers: number;
    edgePavers: number;
    totalArea: number;
    orderQuantity: number;
  };
  // Generic area (concrete/grass/pavers)
  areaSurface?: 'concrete' | 'grass' | 'pavers';
  
  // Drainage
  drainageType?: 'rock' | 'ultradrain';
  length?: number;
  
  // Fence
  fenceType?: 'glass' | 'metal' | 'boundary';

  // Gate
  gateType?: 'glass' | 'metal';

  // Wall
  wallMaterial?: 'timber' | 'concrete' | 'concrete_sleeper' | 'sandstone';
  wallHeight?: number;
  wallStatus?: 'proposed' | 'existing';
  
  // Boundary
  points?: Array<{ x: number; y: number }>;
  closed?: boolean;
  segments?: Array<{
    id: string;
    label: string;
    length: number;
    angle: number;
  }>;
  centerOfMass?: { x: number; y: number }; // Grid-snapped center point of closed boundary

  // House
  area?: number;
  notes?: string;
  
  // Reference Line / Quick Measure
  label?: string;
  style?: {
    color: string;
    dashed: boolean;
    lineWidth: number;
    arrowEnds: boolean;
  };
  locked?: 'horizontal' | 'vertical' | null;
  showMeasurement?: boolean;
  exportToPDF?: boolean;
  temporary?: boolean;
  createdAt?: number;
  measurement?: number;

  // Height Marker
  heightValue?: number; // Height in millimeters
  heightAnnotation?: string; // Optional text annotation

  // Decoration
  decorationType?: 'bush' | 'umbrella' | 'waterfeature' | 'deckchairs';
  imagePath?: string;
}

export interface Summary {
  pools: Array<{
    type: string;
    dimensions: string;
    coping?: {
      area: number;       // Total area in m²
      paverSize: string;  // e.g., "400x400"
    };
  }>;
  paving: Array<{
    size: string;
    count: number;
    fullPavers: number;
    partialPavers: number;
    area: number;
    wastage: number;
  }>;
  drainage: Array<{
    type: string;
    length: number;
  }>;
  fencing: Array<{
    type: string;
    length: number;
  }>;
  walls: Array<{
    material: string;
    length: number;
    height: number;
    status?: string;
  }>;
}

export interface ExportOptions {
  format: 'pdf' | 'png' | 'jpeg';
  scale: '1:50' | '1:100' | '1:200';
  includeGrid: boolean;
  includeMeasurements: boolean;
  includeLegend: boolean;
  includeSummary: boolean;
  paperSize: 'A4' | 'A3';
  orientation: 'landscape' | 'portrait';
  resolution?: '1080p' | '4K' | '8K';
  backgroundColor?: 'white' | 'transparent';
}

export interface Project {
  id: string;
  customerName: string;
  address: string;
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
  | 'paving_area'
  | 'drainage' 
  | 'fence' 
  | 'wall' 
  | 'boundary'
  | 'house'
  | 'reference_line'
  | 'quick_measure';

export type ComponentType = 
  | 'pool' 
  | 'paver' 
  | 'paving_area'
  | 'drainage' 
  | 'fence' 
  | 'wall' 
  | 'boundary'
  | 'house'
  | 'reference_line'
  | 'quick_measure';

export interface Component {
  id: string;
  type: ComponentType;
  position: { x: number; y: number };
  rotation: number;
  dimensions: { width: number; height: number };
  properties: ComponentProperties;
}

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
  copingConfig?: any;
  copingCalculation?: CopingCalculation;
  
  // Paver
  paverSize?: '400x400' | '400x600';
  paverCount?: { rows: number; cols: number };
  
  // Paving Area
  boundary?: Array<{ x: number; y: number }>;
  paverOrientation?: 'vertical' | 'horizontal';
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
  
  // Drainage
  drainageType?: 'rock' | 'ultradrain';
  length?: number;
  
  // Fence
  fenceType?: 'glass' | 'metal' | 'boundary';
  gates?: Array<{ position: number; width: number }>;
  
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
}

export interface Summary {
  pools: Array<{
    type: string;
    dimensions: string;
    coping?: {
      totalPavers: number;
      fullPavers: number;
      partialPavers: number;
      area: number;
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
    gates: number;
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

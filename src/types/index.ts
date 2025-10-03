export interface Project {
  id: string;
  customerName: string;
  address: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  components: Component[];
}

export type ComponentType = 
  | 'pool' 
  | 'paver' 
  | 'drainage' 
  | 'fence' 
  | 'wall' 
  | 'garden' 
  | 'text' 
  | 'area';

export interface Component {
  id: string;
  type: ComponentType;
  position: { x: number; y: number };
  rotation: number;
  dimensions: { width: number; height: number };
  properties: ComponentProperties;
}

export interface ComponentProperties {
  // Pool
  poolId?: string;
  
  // Paver
  paverSize?: '400x400' | '400x600';
  paverCount?: { rows: number; cols: number };
  
  // Drainage
  drainageType?: 'rock' | 'ultradrain';
  length?: number;
  
  // Fence
  fenceType?: 'glass' | 'metal' | 'boundary';
  gates?: Array<{ position: number; width: number }>;
  
  // Wall
  wallMaterial?: 'timber' | 'concrete';
  wallHeight?: number;
  
  // Garden
  points?: Array<{ x: number; y: number }>;
  
  // Text
  text?: string;
  fontSize?: 'small' | 'medium' | 'large';
  
  // Area
  areaType?: 'house' | 'structure' | 'general';
}

export interface Summary {
  pools: Array<{
    type: string;
    dimensions: string;
  }>;
  paving: Array<{
    size: string;
    count: number;
    area: number;
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
  }>;
  garden: {
    area: number;
  };
}

export interface ExportOptions {
  scale: '1:50' | '1:100' | '1:200';
  includeGrid: boolean;
  includeMeasurements: boolean;
  includeLegend: boolean;
  includeSummary: boolean;
  paperSize: 'A4' | 'A3';
  orientation: 'landscape' | 'portrait';
}

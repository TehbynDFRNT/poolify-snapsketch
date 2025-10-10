export interface PoolVariant {
  id: string;
  pool_name: string;
  variant_name: string;
  display_name: string;
  length: number; // mm
  width: number; // mm
  outline_points: Array<{ x: number; y: number }>;
  shallow_end?: { x: number; y: number; label: string };
  deep_end?: { x: number; y: number; label: string };
  features: PoolFeature[];
  has_coping: boolean;
  coping_type?: '400x400' | '600x400_h' | '600x400_v';
  coping_width: number; // mm
  grout_width: number; // mm
  coping_layout?: CopingLayout;
  status: 'draft' | 'published' | 'archived';
  published_at?: string;
  published_by?: string;
  notes?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface PoolFeature {
  id: string;
  type: 'steps' | 'bench' | 'spa' | 'custom';
  position: { x: number; y: number };
  dimensions: {
    width: number;
    height: number;
    depth?: number;
  };
  properties?: {
    stepCount?: number;
    side?: 'north' | 'south' | 'east' | 'west';
    corner?: 'NW' | 'NE' | 'SW' | 'SE';
  };
  label?: string;
}

export interface CopingPaver {
  id: string;
  position: { x: number; y: number };
  dimensions: { width: number; height: number };
  rotation: number;
  type: 'corner' | 'full' | 'stripe_cut';
  original_size: '400x400' | '600x400' | '400x600';
  cut_width?: number;
  notes?: string;
}

export interface CopingMetadata {
  total_pavers: number;
  corner_pavers: number;
  full_pavers: number;
  stripe_pavers: number;
  total_area_m2: number;
  grout_width_mm: number;
}

export interface CopingValidation {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CopingLayout {
  pavers: CopingPaver[];
  metadata: CopingMetadata;
  validation: CopingValidation;
  generated_at: string;
}

export interface PoolActivityLog {
  id: string;
  pool_variant_id: string;
  action: 'created' | 'updated' | 'published' | 'unpublished' | 'archived';
  user_id: string;
  changes?: any;
  created_at: string;
}

import { Component, Summary } from '@/types';
import { PAVER_SIZES, DRAINAGE_TYPES, FENCE_TYPES, WALL_MATERIALS } from '@/constants/components';
import { POOL_LIBRARY } from '@/constants/pools';

export const calculateMeasurements = (components: Component[]): Summary => {
  const summary: Summary = {
    pools: [],
    paving: [],
    drainage: [],
    fencing: [],
    walls: [],
  };

  components.forEach(component => {
    switch (component.type) {
      case 'pool':
        const poolId = component.properties.poolId;
        const pool = POOL_LIBRARY.find(p => p.id === poolId) || (component.properties as any).pool;
        if (pool) {
          const copingConfig = component.properties.copingConfig;
          const paverSize = copingConfig 
            ? `${copingConfig.tile.along}×${copingConfig.tile.inward}mm`
            : '400×400mm';
          
          summary.pools.push({
            type: pool.name,
            dimensions: `${pool.length}×${pool.width}mm`,
            coping: component.properties.showCoping && component.properties.copingCalculation ? {
              totalPavers: component.properties.copingCalculation.totalPavers,
              fullPavers: component.properties.copingCalculation.totalFullPavers,
              partialPavers: component.properties.copingCalculation.totalPartialPavers,
              area: component.properties.copingCalculation.totalArea,
              paverSize,
            } : undefined,
          });
        }
        break;

      case 'paver': {
        const size = component.properties.paverSize || '400x400';
        const count = component.properties.paverCount || { rows: 1, cols: 1 };
        const totalCount = count.rows * count.cols;
        const paverDim = PAVER_SIZES[size] || PAVER_SIZES['400x400'];
        const label = paverDim.label;
        const area = (totalCount * paverDim.width * paverDim.height) / 1000000; // m²
        
        // For grid pavers, all are considered full pavers
        const fullCount = totalCount;
        const partialCount = 0;
        const wastage = 5;

        const existing = summary.paving.find(p => p.size === label);
        if (existing) {
          existing.count += totalCount;
          existing.fullPavers += fullCount;
          existing.partialPavers += partialCount;
          existing.area += area;
        } else {
          summary.paving.push({ 
            size: label, 
            count: totalCount, 
            fullPavers: fullCount,
            partialPavers: partialCount,
            area,
            wastage 
          });
        }
        break;
      }

      case 'paving_area': {
        const size = component.properties.paverSize || '400x400';
        const label = PAVER_SIZES[size].label;
        const stats = component.properties.statistics;
        const boundary = component.properties.boundary as Array<{ x: number; y: number }> | undefined;
        // Fallback: derive counts from pavers array if statistics missing
        const full = stats?.fullPavers ?? (component.properties.pavers?.filter(p => !p.isEdgePaver).length || 0);
        const edge = (component.properties.showEdgePavers === false)
          ? 0
          : (stats?.edgePavers ?? (component.properties.pavers?.filter(p => p.isEdgePaver).length || 0));
        const totalCount = full + edge;
        // Fallback area: compute from boundary polygon if stats missing
        const area = stats?.totalArea ?? (boundary && boundary.length >= 3 ? calculatePolygonArea(boundary) : 0);
        const wastage = component.properties.wastagePercentage ?? 5;

        const existing = summary.paving.find(p => p.size === label);
        if (existing) {
          existing.count += totalCount;
          existing.fullPavers += full;
          existing.partialPavers += edge;
          existing.area += area;
        } else {
          summary.paving.push({ 
            size: label, 
            count: totalCount, 
            fullPavers: full,
            partialPavers: edge,
            area,
            wastage 
          });
        }
        break;
      }

      case 'drainage': {
        const type = component.properties.drainageType || 'rock';
        const length = component.properties.length || component.dimensions.width;
        const label = DRAINAGE_TYPES[type]?.label || type;
        
        const existing = summary.drainage.find(d => d.type === label);
        if (existing) {
          existing.length += length;
        } else {
          summary.drainage.push({
            type: label,
            length,
          });
        }
        break;
      }

      case 'fence': {
        const type = component.properties.fenceType || 'glass';
        const fenceLabel = FENCE_TYPES[type]?.label || 'Glass Pool Fence';
        // Use dimensions.width (in pixels) and convert to mm (1 pixel = 10mm)
        const length = (component.dimensions.width || 0) * 10;
        const gates = component.properties.gates?.length || 0;
        
        // Only add fences with valid lengths (ignore zero-length fences)
        if (length > 0) {
          summary.fencing.push({
            type: fenceLabel,
            length,
            gates,
          });
        }
        break;
      }

      case 'wall': {
        const material = component.properties.wallMaterial || 'timber';
        const materialData = WALL_MATERIALS[material as keyof typeof WALL_MATERIALS];
        const length = component.dimensions.width;
        const height = component.properties.wallHeight || 1200;
        const status = component.properties.wallStatus || 'proposed';
        
        summary.walls.push({
          material: materialData?.label || 'Timber',
          length,
          height,
          status,
        });
        break;
      }
    }
  });

  return summary;
};

const calculatePolygonArea = (points: Array<{ x: number; y: number }>): number => {
  let area = 0;
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  
  area = Math.abs(area) / 2;
  return area / 1000000; // Convert mm² to m²
};

export const formatLength = (mm: number): string => {
  if (mm >= 1000) {
    return `${(mm / 1000).toFixed(1)}m`;
  }
  return `${mm}mm`;
};

export const formatArea = (m2: number): string => {
  return `${m2.toFixed(2)} m²`;
};

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
    garden: { area: 0 },
  };

  components.forEach(component => {
    switch (component.type) {
      case 'pool':
        const poolId = component.properties.poolId;
        const pool = POOL_LIBRARY.find(p => p.id === poolId);
        if (pool) {
          summary.pools.push({
            type: pool.name,
            dimensions: `${pool.length}×${pool.width}mm`,
            coping: component.properties.showCoping ? `${(pool.length * 2 + pool.width * 2)}mm @ ${component.properties.copingWidth || 400}mm wide` : undefined,
          });
        }
        break;

      case 'paver': {
        const size = component.properties.paverSize || '400x400';
        const count = component.properties.paverCount || { rows: 1, cols: 1 };
        const totalCount = count.rows * count.cols;
        const paverDim = PAVER_SIZES[size];
        const area = (totalCount * paverDim.width * paverDim.height) / 1000000; // Convert to m²

        const existing = summary.paving.find(p => p.size === size);
        if (existing) {
          existing.count += totalCount;
          existing.area += area;
        } else {
          summary.paving.push({ size: PAVER_SIZES[size].label, count: totalCount, area });
        }
        break;
      }

      case 'drainage': {
        const type = component.properties.drainageType || 'rock';
        const length = component.properties.length || component.dimensions.width;
        
        const existing = summary.drainage.find(d => d.type === type);
        if (existing) {
          existing.length += length;
        } else {
          summary.drainage.push({
            type: DRAINAGE_TYPES[type].label,
            length,
          });
        }
        break;
      }

      case 'fence': {
        const type = component.properties.fenceType || 'glass';
        const length = component.dimensions.width;
        const gates = component.properties.gates?.length || 0;
        
        const existing = summary.fencing.find(f => f.type === type);
        if (existing) {
          existing.length += length;
          existing.gates += gates;
        } else {
          summary.fencing.push({
            type: FENCE_TYPES[type].label,
            length,
            gates,
          });
        }
        break;
      }

      case 'wall': {
        const material = component.properties.wallMaterial || 'timber';
        const length = component.dimensions.width;
        const height = component.properties.wallHeight || 1200;
        
        summary.walls.push({
          material: WALL_MATERIALS[material].label,
          length,
          height,
        });
        break;
      }

      case 'garden': {
        if (component.properties.points && component.properties.points.length > 2) {
          const area = calculatePolygonArea(component.properties.points);
          summary.garden.area += area;
        }
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

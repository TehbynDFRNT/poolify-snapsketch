import { Component, Summary, SimpleCopingStats } from '@/types';
import { PAVER_SIZES, DRAINAGE_TYPES, FENCE_TYPES, WALL_MATERIALS } from '@/constants/components';
import { POOL_LIBRARY } from '@/constants/pools';

export const calculateMeasurements = (components: Component[]): Summary => {
  const summary: Summary = {
    pools: [],
    paving: [],
    concrete: [],
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
          const paverSize = copingConfig?.tileSize || '400x400';

          // Use stored coping statistics (simplified system)
          let copingData = undefined;
          if (component.properties.showCoping) {
            const stats = component.properties.copingStatistics as SimpleCopingStats | undefined;
            copingData = {
              area: stats?.areaM2 || 0,
              paverSize,
            };
          }

          summary.pools.push({
            type: pool.name,
            dimensions: `${pool.length}×${pool.width}mm`,
            coping: copingData,
          });
        }
        break;

      case 'paver': {
        const size = component.properties.paverSize || '400x400';
        const count = component.properties.paverCount || { rows: 1, cols: 1 };
        const extra = component.properties.paverExtraBlocks || [];
        const totalExtra = extra.reduce((acc, b) => acc + (Math.max(0, b.rows) * Math.max(0, b.cols)), 0);
        const totalCount = count.rows * count.cols + totalExtra;
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
        const surface = component.properties.areaSurface || 'pavers';
        const boundary = component.properties.boundary as Array<{ x: number; y: number }> | undefined;
        const stats = component.properties.statistics;
        // Fallback area: compute from boundary polygon if stats missing
        const area = stats?.totalArea ?? (boundary && boundary.length >= 3 ? calculatePolygonArea(boundary) : 0);

        // Skip grass - not a material
        if (surface === 'grass') {
          break;
        }

        // Concrete - just track area
        if (surface === 'concrete') {
          summary.concrete.push({ area });
          break;
        }

        // Pavers - track counts and group by size
        const size = component.properties.paverSize || '400x400';
        const label = PAVER_SIZES[size].label;
        // Fallback: derive counts from pavers array if statistics missing
        const full = stats?.fullPavers ?? (component.properties.pavers?.filter(p => !p.isEdgePaver).length || 0);
        const edge = (component.properties.showEdgePavers === false)
          ? 0
          : (stats?.edgePavers ?? (component.properties.pavers?.filter(p => p.isEdgePaver).length || 0));
        const totalCount = full + edge;
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
        const drainageData = DRAINAGE_TYPES[type];
        const label = drainageData?.label || type;
        const width = drainageData?.width || 100;

        // Use totalLM for polyline drains, fallback to length or dimensions
        const totalLM = component.properties.totalLM as number | undefined;
        const lengthMm = totalLM
          ? totalLM * 1000  // totalLM is in meters, convert to mm
          : (component.properties.length || (component.dimensions.width * 10)); // dimensions in px, 1px = 10mm

        const existing = summary.drainage.find(d => d.type === label);
        if (existing) {
          existing.length += lengthMm;
        } else {
          summary.drainage.push({
            type: label,
            length: lengthMm,
            width,
          });
        }
        break;
      }

      case 'fence': {
        const type = component.properties.fenceType || 'glass';
        const fenceLabel = FENCE_TYPES[type]?.label || 'Glass Pool Fence';

        // Use totalLM for polyline fences, fallback to dimensions
        const totalLM = component.properties.totalLM as number | undefined;
        const lengthMm = totalLM
          ? totalLM * 1000  // totalLM is in meters, convert to mm
          : (component.dimensions.width || 0) * 10; // dimensions in px, 1px = 10mm

        // Count gates
        const gates = (component.properties.gates as Array<any> || []).length;

        // Only add fences with valid lengths (ignore zero-length fences)
        if (lengthMm > 0) {
          summary.fencing.push({
            type: fenceLabel,
            length: lengthMm,
            gates,
          });
        }
        break;
      }

      case 'wall': {
        const material = component.properties.wallMaterial || 'timber';
        const materialData = WALL_MATERIALS[material as keyof typeof WALL_MATERIALS];

        // Use totalLM for polyline walls, fallback to dimensions
        const totalLM = component.properties.totalLM as number | undefined;
        const lengthMm = totalLM
          ? totalLM * 1000  // totalLM is in meters, convert to mm
          : (component.dimensions.width || 0) * 10; // dimensions in px, 1px = 10mm

        const height = component.properties.wallHeight || 1200;
        const status = (component.properties.wallStatus || 'proposed') as 'proposed' | 'existing';
        const nodeHeights = component.properties.nodeHeights as Record<number, number> | undefined;

        summary.walls.push({
          material: materialData?.label || 'Timber',
          length: lengthMm,
          height,
          status,
          nodeHeights,
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

import { Component, ExtensionConfig } from '@/types';
import { fillAreaWithPavers, calculateStatistics, PoolExcludeZone } from './pavingFill';
import { findNearestBoundary } from './boundaryDetection';
import { GRID_CONFIG } from '@/constants/grid';

export interface ExtensionRectangle {
  direction: 'deepEnd' | 'shallowEnd' | 'leftSide' | 'rightSide';
  boundary: Array<{ x: number; y: number }>; // Rectangle outline in world coords
  paverSize: '400x400' | '400x600';
  paverOrientation: 'vertical' | 'horizontal';
  boundaryDistance: number;
  targetBoundaryId: string | null;
}

/**
 * Calculate extension rectangle for a single pool edge
 */
export function calculateExtensionRectangle(
  pool: Component,
  poolData: any,
  direction: 'deepEnd' | 'shallowEnd' | 'leftSide' | 'rightSide',
  copingWidth: number,
  allComponents: Component[],
  extensionConfig: ExtensionConfig
): ExtensionRectangle | null {
  if (!extensionConfig.enabled) return null;

  const scale = GRID_CONFIG.spacing / 100; // 0.1 px/mm

  // Get coping outer edge position in pool-local coordinates (mm)
  const copingEdge = getCopingEdgeInfo(poolData, direction, copingWidth);
  
  // Transform to world coordinates
  const worldEdge = transformToWorld(copingEdge, pool.position, pool.rotation, scale);

  // Cast ray perpendicular to edge outward
  const boundary = findNearestBoundary(
    worldEdge.midpoint,
    worldEdge.outwardNormal,
    allComponents,
    pool.id
  );

  const maxDistance = extensionConfig.maxDistance || 5000; // Default 5m in mm
  const distance = boundary 
    ? Math.min(boundary.distance, maxDistance * scale)
    : maxDistance * scale;

  // Create rectangle boundary extending from coping edge
  const rectBoundary = createExtensionBoundary(worldEdge, distance);

  // Get paver config
  const copingConfig = pool.properties.copingConfig || {};
  const paverSize = copingConfig.tile?.along === 600 || copingConfig.tile?.inward === 600
    ? '400x600' as const
    : '400x400' as const;
  
  const paverOrientation = getPaverOrientation(direction);

  return {
    direction,
    boundary: rectBoundary,
    paverSize,
    paverOrientation,
    boundaryDistance: distance / scale, // mm
    targetBoundaryId: boundary?.componentId || null
  };
}

/**
 * Generate extension pavers for a pool edge
 */
export function generateExtensionPavers(
  extensionRect: ExtensionRectangle,
  pool: Component,
  allComponents: Component[]
): Array<{
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  isEdgePaver: boolean;
  cutPercentage?: number;
}> {
  // Get exclude zones (other pools, obstacles)
  const excludeZones: PoolExcludeZone[] = allComponents
    .filter(c => c.id !== pool.id && (c.type === 'pool' || c.type === 'house'))
    .map(c => {
      if (c.type === 'house' && c.properties.points) {
        return {
          outline: c.properties.points,
          componentId: c.id
        };
      }
      return null;
    })
    .filter((z): z is PoolExcludeZone => z !== null);

  // Fill extension area with pavers
  const pavers = fillAreaWithPavers(
    extensionRect.boundary,
    extensionRect.paverSize,
    extensionRect.paverOrientation,
    true, // Show edge pavers
    excludeZones
  );

  return pavers.map(p => ({
    id: p.id,
    position: p.position,
    width: p.width,
    height: p.height,
    isEdgePaver: p.isEdgePaver,
    cutPercentage: p.cutPercentage
  }));
}

/**
 * Calculate all four extensions for a pool and return updated extensions
 */
export function calculateAllExtensions(
  pool: Component,
  poolData: any,
  allComponents: Component[]
): typeof pool.properties.copingExtensions | undefined {
  if (pool.properties.copingMode !== 'extensible' || !pool.properties.copingExtensions) {
    return undefined;
  }

  const copingConfig = pool.properties.copingConfig || {};
  const copingWidth = copingConfig.width || 400;
  const updatedExtensions = { ...pool.properties.copingExtensions };

  const directions: Array<'deepEnd' | 'shallowEnd' | 'leftSide' | 'rightSide'> = [
    'deepEnd', 'shallowEnd', 'leftSide', 'rightSide'
  ];

  for (const direction of directions) {
    const ext = updatedExtensions[direction];
    if (ext.enabled) {
      const extensionRect = calculateExtensionRectangle(
        pool,
        poolData,
        direction,
        copingWidth,
        allComponents,
        ext
      );

      if (extensionRect) {
        const pavers = generateExtensionPavers(extensionRect, pool, allComponents);
        const paverSize = extensionRect.paverSize === '400x400' ? '400x400' : '400x600';
        const stats = calculateStatistics(pavers, 0); // No wastage for coping

        updatedExtensions[direction] = {
          ...ext,
          pavers,
          statistics: {
            fullPavers: stats.fullPavers,
            edgePavers: stats.edgePavers,
            totalArea: stats.totalArea
          }
        };
      }
    }
  }

  return updatedExtensions;
}

/**
 * Get coping edge info in pool-local coordinates
 */
function getCopingEdgeInfo(
  poolData: any,
  direction: 'deepEnd' | 'shallowEnd' | 'leftSide' | 'rightSide',
  copingWidth: number
): {
  start: { x: number; y: number };
  end: { x: number; y: number };
  outwardNormal: { x: number; y: number };
} {
  const poolLength = poolData.length;
  const poolWidth = poolData.width;
  const extension = copingWidth;

  switch (direction) {
    case 'deepEnd': // Right side
      return {
        start: { x: poolLength + extension * 2, y: -extension },
        end: { x: poolLength + extension * 2, y: poolWidth + extension },
        outwardNormal: { x: 1, y: 0 }
      };
    case 'shallowEnd': // Left side
      return {
        start: { x: -extension, y: -extension },
        end: { x: -extension, y: poolWidth + extension },
        outwardNormal: { x: -1, y: 0 }
      };
    case 'leftSide': // Top
      return {
        start: { x: -extension, y: -extension },
        end: { x: poolLength + extension * 2, y: -extension },
        outwardNormal: { x: 0, y: -1 }
      };
    case 'rightSide': // Bottom
      return {
        start: { x: -extension, y: poolWidth + extension },
        end: { x: poolLength + extension * 2, y: poolWidth + extension },
        outwardNormal: { x: 0, y: 1 }
      };
  }
}

/**
 * Transform pool-local coordinates to world coordinates
 */
function transformToWorld(
  edge: {
    start: { x: number; y: number };
    end: { x: number; y: number };
    outwardNormal: { x: number; y: number };
  },
  poolPosition: { x: number; y: number },
  rotation: number,
  scale: number
): {
  start: { x: number; y: number };
  end: { x: number; y: number };
  midpoint: { x: number; y: number };
  outwardNormal: { x: number; y: number };
} {
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const transformPoint = (p: { x: number; y: number }) => {
    const scaledX = p.x * scale;
    const scaledY = p.y * scale;
    return {
      x: scaledX * cos - scaledY * sin + poolPosition.x,
      y: scaledX * sin + scaledY * cos + poolPosition.y
    };
  };

  const transformVector = (v: { x: number; y: number }) => {
    const length = Math.sqrt(v.x * v.x + v.y * v.y);
    if (length === 0) return v;
    return {
      x: (v.x * cos - v.y * sin) / length,
      y: (v.x * sin + v.y * cos) / length
    };
  };

  const worldStart = transformPoint(edge.start);
  const worldEnd = transformPoint(edge.end);

  return {
    start: worldStart,
    end: worldEnd,
    midpoint: {
      x: (worldStart.x + worldEnd.x) / 2,
      y: (worldStart.y + worldEnd.y) / 2
    },
    outwardNormal: transformVector(edge.outwardNormal)
  };
}

/**
 * Create rectangular boundary for extension
 */
function createExtensionBoundary(
  edge: {
    start: { x: number; y: number };
    end: { x: number; y: number };
    outwardNormal: { x: number; y: number };
  },
  distance: number
): Array<{ x: number; y: number }> {
  const extendedStart = {
    x: edge.start.x + edge.outwardNormal.x * distance,
    y: edge.start.y + edge.outwardNormal.y * distance
  };

  const extendedEnd = {
    x: edge.end.x + edge.outwardNormal.x * distance,
    y: edge.end.y + edge.outwardNormal.y * distance
  };

  return [
    edge.start,
    edge.end,
    extendedEnd,
    extendedStart
  ];
}

/**
 * Get paver orientation for edge direction
 */
function getPaverOrientation(
  direction: 'deepEnd' | 'shallowEnd' | 'leftSide' | 'rightSide'
): 'vertical' | 'horizontal' {
  // Pavers perpendicular to pool edge
  return direction === 'leftSide' || direction === 'rightSide' ? 'vertical' : 'horizontal';
}

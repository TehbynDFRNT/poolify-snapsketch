import { Component } from '@/types';
import { GRID_CONFIG } from '@/constants/grid';

export interface BoundaryIntersection {
  componentId: string;
  componentType: string;
  distance: number;
  intersectionPoint: { x: number; y: number };
  intersectionSegment: {
    start: { x: number; y: number };
    end: { x: number; y: number };
  };
}

/**
 * Find nearest boundary component in a given direction from pool edge
 */
export function findNearestBoundary(
  rayOrigin: { x: number; y: number },
  rayDirection: { x: number; y: number },
  allComponents: Component[],
  excludePoolId: string
): BoundaryIntersection | null {
  const boundaryTypes = ['fence', 'wall', 'boundary', 'house', 'drainage', 'paver', 'paving_area'];
  const boundaries = allComponents.filter(
    c => boundaryTypes.includes(c.type) && c.id !== excludePoolId
  );

  let nearest: BoundaryIntersection | null = null;
  let minDistance = Infinity;

  for (const component of boundaries) {
    const edges = getComponentEdges(component);
    
    for (const edge of edges) {
      const intersection = rayLineIntersection(
        rayOrigin,
        rayDirection,
        edge.start,
        edge.end
      );

      if (intersection && intersection.t > 0 && intersection.t < minDistance) {
        minDistance = intersection.t;
        nearest = {
          componentId: component.id,
          componentType: component.type,
          distance: intersection.t,
          intersectionPoint: intersection.point,
          intersectionSegment: edge,
        };
      }
    }
  }

  return nearest;
}

/**
 * Get component's boundary edges for intersection testing
 */
function getComponentEdges(component: Component): Array<{
  start: { x: number; y: number };
  end: { x: number; y: number };
}> {
  const edges: Array<{ start: { x: number; y: number }; end: { x: number; y: number } }> = [];

  if (component.type === 'fence' || component.type === 'wall' || component.type === 'drainage') {
    // Line components
    const startX = component.position.x;
    const startY = component.position.y;
    const length = component.properties.length || component.dimensions.width;
    const radians = (component.rotation * Math.PI) / 180;
    const endX = startX + Math.cos(radians) * length;
    const endY = startY + Math.sin(radians) * length;
    
    edges.push({
      start: { x: startX, y: startY },
      end: { x: endX, y: endY }
    });
  } else if (component.type === 'boundary' || component.type === 'house') {
    // Polygon components - transform local points to world coordinates
    const points = component.properties.points || [];
    const cos = Math.cos((component.rotation * Math.PI) / 180);
    const sin = Math.sin((component.rotation * Math.PI) / 180);
    
    const transformedPoints = points.map((p: any) => ({
      x: component.position.x + p.x * cos - p.y * sin,
      y: component.position.y + p.x * sin + p.y * cos,
    }));
    
    for (let i = 0; i < transformedPoints.length; i++) {
      const nextIndex = (i + 1) % transformedPoints.length;
      edges.push({
        start: transformedPoints[i],
        end: transformedPoints[nextIndex]
      });
    }
  } else if (component.type === 'paver' || component.type === 'paving_area') {
    // Axis-aligned rectangle components (transformed by rotation around position)
    const w = component.dimensions.width;
    const h = component.dimensions.height;
    const cos = Math.cos((component.rotation * Math.PI) / 180);
    const sin = Math.sin((component.rotation * Math.PI) / 180);

    const local = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ];

    const transformed = local.map((p) => ({
      x: component.position.x + p.x * cos - p.y * sin,
      y: component.position.y + p.x * sin + p.y * cos,
    }));

    for (let i = 0; i < transformed.length; i++) {
      const next = (i + 1) % transformed.length;
      edges.push({ start: transformed[i], end: transformed[next] });
    }
  }

  return edges;
}

/**
 * Calculate ray-line segment intersection
 */
function rayLineIntersection(
  rayOrigin: { x: number; y: number },
  rayDirection: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number }
): { t: number; point: { x: number; y: number } } | null {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  const det = rayDirection.x * dy - rayDirection.y * dx;
  
  if (Math.abs(det) < 1e-10) {
    // Ray and line are parallel
    return null;
  }

  const t = ((lineStart.x - rayOrigin.x) * dy - (lineStart.y - rayOrigin.y) * dx) / det;
  const u = ((lineStart.x - rayOrigin.x) * rayDirection.y - (lineStart.y - rayOrigin.y) * rayDirection.x) / det;

  if (t >= 0 && u >= 0 && u <= 1) {
    // Valid intersection on ray and within line segment
    return {
      t,
      point: {
        x: rayOrigin.x + t * rayDirection.x,
        y: rayOrigin.y + t * rayDirection.y
      }
    };
  }

  return null;
}

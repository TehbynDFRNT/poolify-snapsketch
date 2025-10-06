import { SNAP_CONFIG } from '@/constants/grid';
import { Component } from '@/types';

export const snapToGrid = (value: number): number => {
  if (!SNAP_CONFIG.enabled) return value;
  return Math.round(value / SNAP_CONFIG.gridSnap) * SNAP_CONFIG.gridSnap;
};

export const snapPoint = (point: { x: number; y: number }): { x: number; y: number } => {
  return {
    x: snapToGrid(point.x),
    y: snapToGrid(point.y),
  };
};

// Smart snap: prioritize nearby component points, then fall back to grid
export const smartSnap = (
  point: { x: number; y: number },
  components: Component[],
  tolerance: number = 15
): { x: number; y: number; snappedTo: string | null } => {
  let closestPoint: { x: number; y: number } | null = null;
  let minDistance = tolerance;
  let snappedTo: string | null = null;

  // Check all components for nearby points
  components.forEach(component => {
    const pointsToCheck: Array<{ x: number; y: number }> = [];

    // Collect points from different component types
    if (component.properties.points) {
      pointsToCheck.push(...component.properties.points);
    }
    if (component.properties.boundary) {
      pointsToCheck.push(...component.properties.boundary);
    }

    // Check distance to each point
    pointsToCheck.forEach(p => {
      const distance = Math.sqrt(
        Math.pow(point.x - p.x, 2) + Math.pow(point.y - p.y, 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = p;
        snappedTo = component.type;
      }
    });
  });

  // If we found a nearby point, snap to it
  if (closestPoint) {
    return { ...closestPoint, snappedTo };
  }

  // Otherwise snap to grid
  return {
    x: snapToGrid(point.x),
    y: snapToGrid(point.y),
    snappedTo: null,
  };
};

import { Component } from '@/types';

/**
 * Get the center of mass (centroid) of a boundary component
 * Returns null if the boundary is not closed or doesn't have a valid center
 */
export function getBoundaryCenterOfMass(boundary: Component | null | undefined): { x: number; y: number } | null {
  if (!boundary || boundary.type !== 'boundary') {
    return null;
  }

  // Check if the boundary has a calculated center of mass
  if (boundary.properties.centerOfMass) {
    return boundary.properties.centerOfMass;
  }

  return null;
}

/**
 * Find the first boundary component in a list of components
 */
export function findBoundary(components: Component[]): Component | null {
  return components.find(c => c.type === 'boundary') || null;
}

/**
 * Get the center of mass from all components
 * Useful for snapping or alignment operations
 */
export function getBoundaryCenterFromComponents(components: Component[]): { x: number; y: number } | null {
  const boundary = findBoundary(components);
  return getBoundaryCenterOfMass(boundary);
}

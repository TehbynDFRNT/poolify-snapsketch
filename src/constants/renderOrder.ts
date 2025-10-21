import { ComponentType, Component } from '@/types';

/**
 * Render order for canvas components (lower numbers render behind higher numbers).
 *
 * Order from lowest to highest:
 * - Pavers & Paving Areas (back)
 * - Pools
 * - Boundaries (reference/guide element)
 * - Walls
 * - Drainage
 * - Fences
 * - Houses
 * - Measurement tools (front)
 */
export const RENDER_ORDER: Record<ComponentType, number> = {
  // Layer 0: Pavers and paving areas (lowest/back)
  paver: 0,
  paving_area: 0,

  // Layer 1: Pools with coping
  pool: 1,

  // Layer 2: Boundaries (property lines - reference element)
  boundary: 2,

  // Layer 3: Walls
  wall: 3,

  // Layer 4: Drainage
  drainage: 4,

  // Layer 5: Fences
  fence: 5,

  // Layer 6: Houses
  house: 6,

  // Layer 7: Measurement tools (highest/front)
  reference_line: 7,
  quick_measure: 7,
};

/**
 * Get the render order value for a component type.
 */
export const getComponentRenderOrder = (type: ComponentType): number => {
  return RENDER_ORDER[type] ?? 99; // Unknown types render on top
};

/**
 * Sort components by render order (lowest to highest).
 * Within the same render order, maintains creation order (array position).
 *
 * @param components - Array of components to sort
 * @returns New array sorted by render order
 */
export const sortComponentsByRenderOrder = (components: Component[]): Component[] => {
  return [...components].sort((a, b) => {
    const orderA = getComponentRenderOrder(a.type);
    const orderB = getComponentRenderOrder(b.type);

    // Sort by render order first
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // If same render order, maintain original array order (creation order)
    // This is automatically preserved by stable sort
    return 0;
  });
};

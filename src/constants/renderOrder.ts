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
 * - Fences & Gates
 * - Houses
 * - Decorations (bushes, umbrellas, water features)
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

  // Layer 5: Fences & Gates
  fence: 5,
  gate: 5,

  // Layer 6: Houses
  house: 6,

  // Layer 7: Decorations (bushes, umbrellas, water features)
  decoration: 7,

  // Layer 8: Measurement tools (highest/front)
  quick_measure: 8,
  height: 8,
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
 * IMPORTANT: If a component is selected, it will be moved to the top layer
 * (rendered last) to ensure it's always clickable and editable, regardless of
 * its normal layer order. This allows easy manipulation without being blocked
 * by higher-layer components.
 *
 * @param components - Array of components to sort
 * @param selectedComponentId - Optional ID of the selected component to render on top
 * @returns New array sorted by render order, with selected component moved to top
 */
export const sortComponentsByRenderOrder = (components: Component[], selectedComponentId?: string | null): Component[] => {
  const sorted = [...components].sort((a, b) => {
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

  // Move selected component to the end (top layer) for easy editing
  if (selectedComponentId) {
    const selectedIndex = sorted.findIndex(c => c.id === selectedComponentId);
    if (selectedIndex !== -1) {
      const [selected] = sorted.splice(selectedIndex, 1);
      sorted.push(selected);
    }
  }

  return sorted;
};

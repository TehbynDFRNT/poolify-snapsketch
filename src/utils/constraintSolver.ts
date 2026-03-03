import type { Component } from '@/types';
import { resolveWorldPosition } from './constraintGeometry';

/**
 * Build a graph of components connected via fully-pinned measurements.
 * A measurement "connects" two components if BOTH pinStart and pinEnd
 * are set and point to different components.
 *
 * Returns an adjacency list: Map<componentId, Set<componentId>>
 */
export function buildPinGraph(
  components: Component[]
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  for (const c of components) {
    if (c.type !== 'quick_measure') continue;
    const pinStart = c.properties.pinStart;
    const pinEnd = c.properties.pinEnd;
    if (!pinStart || !pinEnd) continue;

    const a = pinStart.targetComponentId;
    const b = pinEnd.targetComponentId;
    if (a === b) continue; // Same component, no constraint

    if (!graph.has(a)) graph.set(a, new Set());
    if (!graph.has(b)) graph.set(b, new Set());
    graph.get(a)!.add(b);
    graph.get(b)!.add(a);
  }

  return graph;
}

/**
 * Count how many pins attach to each component (as a target).
 * Returns Map<componentId, pinCount>.
 */
export function getPinCountMap(
  components: Component[]
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const c of components) {
    if (c.type !== 'quick_measure') continue;

    const pinStart = c.properties.pinStart;
    const pinEnd = c.properties.pinEnd;

    if (pinStart) {
      const id = pinStart.targetComponentId;
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    if (pinEnd) {
      const id = pinEnd.targetComponentId;
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  }

  return counts;
}

/**
 * Get all component IDs connected transitively to the given component (BFS).
 * Includes the starting component.
 */
export function getConnectedGroup(
  componentId: string,
  graph: Map<string, Set<string>>
): Set<string> {
  const visited = new Set<string>();
  const queue = [componentId];
  visited.add(componentId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = graph.get(current);
    if (!neighbors) continue;

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return visited;
}

/**
 * Resolve and update all measurement endpoints from their pin attachments.
 * Returns a map of measurement IDs → updated properties for batch application.
 */
export function resolveAllMeasurementEndpoints(
  components: Component[]
): Map<string, Partial<Component>> {
  const componentMap = new Map<string, Component>();
  for (const c of components) {
    componentMap.set(c.id, c);
  }

  const updates = new Map<string, Partial<Component>>();

  for (const c of components) {
    if (c.type !== 'quick_measure') continue;

    const pinStart = c.properties.pinStart;
    const pinEnd = c.properties.pinEnd;
    if (!pinStart && !pinEnd) continue;

    const points = c.properties.points || [];
    if (points.length < 2) continue;

    let newStart = points[0];
    let newEnd = points[1];
    let changed = false;

    if (pinStart) {
      const target = componentMap.get(pinStart.targetComponentId);
      if (target) {
        const resolved = resolveWorldPosition(pinStart, target);
        if (resolved) {
          newStart = resolved;
          changed = true;
        }
      }
    }

    if (pinEnd) {
      const target = componentMap.get(pinEnd.targetComponentId);
      if (target) {
        const resolved = resolveWorldPosition(pinEnd, target);
        if (resolved) {
          newEnd = resolved;
          changed = true;
        }
      }
    }

    if (changed) {
      const dx = newEnd.x - newStart.x;
      const dy = newEnd.y - newStart.y;
      const measurement = Math.sqrt(dx * dx + dy * dy);

      updates.set(c.id, {
        properties: {
          ...c.properties,
          points: [newStart, newEnd],
          measurement,
        },
      });
    }
  }

  return updates;
}

/**
 * Find all measurement component IDs that pin to a given target component.
 */
export function findMeasurementsPinningTo(
  targetId: string,
  components: Component[]
): string[] {
  const result: string[] = [];
  for (const c of components) {
    if (c.type !== 'quick_measure') continue;
    if (
      c.properties.pinStart?.targetComponentId === targetId ||
      c.properties.pinEnd?.targetComponentId === targetId
    ) {
      result.push(c.id);
    }
  }
  return result;
}

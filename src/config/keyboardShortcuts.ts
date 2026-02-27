import type { ToolType } from '@/types';

export interface KeyboardShortcut {
  keys: string[];
  description: string;
  action: string;
}

export interface ToolKeyboardShortcuts {
  tool: ToolType | 'select';
  shortcuts: KeyboardShortcut[];
}

/**
 * Shortcuts that appear when any object is selected (generic)
 * These are context-dependent and override tool shortcuts
 */
export const SELECTION_SHORTCUTS: KeyboardShortcut[] = [
  {
    keys: ['↑↓←→'],
    description: 'Move object',
    action: 'move_object',
  },
  {
    keys: ['Shift', '↑↓←→'],
    description: 'Move object faster',
    action: 'move_object_fast',
  },
];

/**
 * Shortcuts for selected open boundary (not closed) — shows extension hint
 */
export const OPEN_BOUNDARY_SELECTION_SHORTCUTS: KeyboardShortcut[] = [
  {
    keys: ['Click'],
    description: 'Click endpoint to extend',
    action: 'extend_boundary',
  },
  {
    keys: ['Shift', 'Click'],
    description: 'Click a node to edit',
    action: 'edit_node',
  },
  {
    keys: ['↑↓←→'],
    description: 'Move object',
    action: 'move_object',
  },
  {
    keys: ['Shift', '↑↓←→'],
    description: 'Move object faster',
    action: 'move_object_fast',
  },
];

/**
 * Additional shortcuts for selected polyshape objects (boundary, house, fence, wall, drainage, reference_line)
 */
export const POLYSHAPE_SELECTION_SHORTCUTS: KeyboardShortcut[] = [
  {
    keys: ['Shift', 'Click'],
    description: 'Click a node to edit',
    action: 'edit_node',
  },
  {
    keys: ['↑↓←→'],
    description: 'Move object',
    action: 'move_object',
  },
  {
    keys: ['Shift', '↑↓←→'],
    description: 'Move object faster',
    action: 'move_object_fast',
  },
];

/**
 * Shortcuts for selected pool objects
 */
export const POOL_SELECTION_SHORTCUTS: KeyboardShortcut[] = [
  {
    keys: ['Shift', 'Click'],
    description: 'Click a paver to select',
    action: 'select_paver',
  },
  {
    keys: ['↑↓←→'],
    description: 'Move object',
    action: 'move_object',
  },
  {
    keys: ['Shift', '↑↓←→'],
    description: 'Move object faster',
    action: 'move_object_fast',
  },
];

/**
 * Keyboard shortcuts configuration for each tool
 * This centralizes all keyboard shortcuts and makes them easy to maintain
 */
export const TOOL_KEYBOARD_SHORTCUTS: Partial<Record<ToolType, KeyboardShortcut[]>> = {
  select: [
    {
      keys: ['Shift', 'Click'],
      description: 'Temporarily pan while held',
      action: 'temp_pan',
    },
  ],
  hand: [],
  pool: [],
  paver: [],
  paving_area: [],
  drainage: [
    {
      keys: ['Shift'],
      description: 'Lock to horizontal/vertical',
      action: 'lock_axis',
    },
  ],
  fence: [
    {
      keys: ['Shift'],
      description: 'Lock to horizontal/vertical',
      action: 'lock_axis',
    },
  ],
  wall: [
    {
      keys: ['Shift'],
      description: 'Lock to horizontal/vertical',
      action: 'lock_axis',
    },
  ],
  boundary: [
    {
      keys: ['Shift'],
      description: 'Lock to horizontal/vertical',
      action: 'lock_axis',
    },
  ],
  house: [
    {
      keys: ['Shift'],
      description: 'Lock to horizontal/vertical',
      action: 'lock_axis',
    },
  ],
  quick_measure: [
    {
      keys: ['Shift'],
      description: 'Lock to horizontal/vertical',
      action: 'lock_axis',
    },
  ],
  gate: [],
  decoration: [],
};

/**
 * Get keyboard shortcuts for a specific tool
 */
export const getToolShortcuts = (tool: ToolType): KeyboardShortcut[] => {
  return TOOL_KEYBOARD_SHORTCUTS[tool] || [];
};

/**
 * Get all shortcuts that should be displayed
 * Filters out shortcuts with no keys
 */
export const getActiveShortcuts = (tool: ToolType): KeyboardShortcut[] => {
  return getToolShortcuts(tool).filter(shortcut => shortcut.keys.length > 0);
};

/**
 * Check if a component type is a polyshape (has editable nodes)
 */
export const isPolyshapeType = (type: string): boolean => {
  return ['boundary', 'house', 'fence', 'wall', 'drainage', 'quick_measure', 'reference_line', 'paving_area'].includes(type);
};

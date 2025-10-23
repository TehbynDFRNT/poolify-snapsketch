import { ComponentType } from './index';

export type ContextMenuAction =
  | 'delete'
  | 'add_annotation'
  | 'duplicate'
  | 'bring_to_front'
  | 'send_to_back';

export interface ContextMenuItem {
  action: ContextMenuAction;
  label: string;
  icon?: string;
  separator?: boolean;
  requiresInput?: boolean;
}

export const CONTEXT_MENU_ITEMS: Record<ContextMenuAction, Omit<ContextMenuItem, 'action'>> = {
  delete: {
    label: 'Delete',
  },
  add_annotation: {
    label: 'Add Annotation',
    requiresInput: true,
  },
  duplicate: {
    label: 'Duplicate',
  },
  bring_to_front: {
    label: 'Bring to Front',
  },
  send_to_back: {
    label: 'Send to Back',
  },
};

// Define which menu items appear for each component type
export const COMPONENT_CONTEXT_MENUS: Record<ComponentType, ContextMenuAction[]> = {
  pool: ['delete'],
  paver: ['delete'],
  paving_area: ['delete'],
  drainage: ['delete'],
  fence: ['delete'],
  wall: ['delete'],
  boundary: ['delete'],
  house: ['delete'],
  quick_measure: ['add_annotation', 'delete'],
};

// Helper to get menu items for a component type
export const getContextMenuItems = (type: ComponentType): ContextMenuItem[] => {
  const actions = COMPONENT_CONTEXT_MENUS[type] || ['delete'];
  return actions.map(action => ({
    action,
    ...CONTEXT_MENU_ITEMS[action],
  }));
};

import { useEffect } from 'react';
import { useDesignStore } from '@/store/designStore';

export const useKeyboardShortcuts = () => {
  const { undo, redo, deleteComponent, selectedComponentId, toggleGrid, saveCurrentProject } = useDesignStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }

      // Ctrl/Cmd + Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z: Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }

      // Ctrl/Cmd + S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveCurrentProject();
      }

      // Delete or Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedComponentId) {
        // If PoolComponent has tile selection active, let it handle per-tile delete
        const body = document.body as any;
        if (body && body.dataset && body.dataset.copingTileSelected === '1') {
          e.preventDefault();
          return; // PoolComponent will perform tile-level delete if applicable
        }
        e.preventDefault();
        deleteComponent(selectedComponentId);
      }

      // G: Toggle grid
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleGrid();
      }

      // Escape: Deselect
      if (e.key === 'Escape') {
        useDesignStore.getState().selectComponent(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, deleteComponent, selectedComponentId, toggleGrid, saveCurrentProject]);
};

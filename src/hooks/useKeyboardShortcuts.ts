import { useEffect } from 'react';
import { useDesignStore } from '@/store/designStore';

export const useKeyboardShortcuts = () => {
  const { undo, redo, deleteComponent, selectedComponentId, toggleGrid, saveCurrentProject, components, updateComponent } = useDesignStore();

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

      // Arrow keys: Move selected component
      // Regular arrows: 5mm, Shift + arrows: 15mm
      if (selectedComponentId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();

        const selectedComponent = components.find(c => c.id === selectedComponentId);
        if (!selectedComponent) return;

        // Canvas units: 1 unit = 10mm (grid square is 10 units = 100mm)
        // So 2.5mm = 0.25 units, 25mm = 2.5 units
        const moveDistance = e.shiftKey ? 2.5 : 0.25; // 25mm with Shift, 2.5mm without
        let dx = 0;
        let dy = 0;

        switch (e.key) {
          case 'ArrowUp':
            dy = -moveDistance;
            break;
          case 'ArrowDown':
            dy = moveDistance;
            break;
          case 'ArrowLeft':
            dx = -moveDistance;
            break;
          case 'ArrowRight':
            dx = moveDistance;
            break;
        }

        // Check which property stores the geometry
        const hasPoints = selectedComponent.properties?.points && Array.isArray(selectedComponent.properties.points);
        const hasBoundary = selectedComponent.properties?.boundary && Array.isArray(selectedComponent.properties.boundary);

        if (hasPoints) {
          // Polyline components (fences, walls, boundaries, houses): move all points
          const oldPoints = selectedComponent.properties.points as Array<{ x: number; y: number }>;
          const newPoints = oldPoints.map(point => ({
            x: point.x + dx,
            y: point.y + dy,
          }));

          updateComponent(selectedComponentId, {
            properties: {
              ...selectedComponent.properties,
              points: newPoints,
            },
          });
        } else if (hasBoundary) {
          // Paving areas: move all boundary points and tiling frame
          const oldBoundary = selectedComponent.properties.boundary as Array<{ x: number; y: number }>;
          const newBoundary = oldBoundary.map(point => ({
            x: point.x + dx,
            y: point.y + dy,
          }));

          // Also move the tiling frame if it exists
          const oldFrame = (selectedComponent.properties as any).tilingFrame;
          const newFrame = oldFrame ? {
            x: oldFrame.x + dx,
            y: oldFrame.y + dy,
            side: oldFrame.side,
          } : undefined;

          updateComponent(selectedComponentId, {
            properties: {
              ...selectedComponent.properties,
              boundary: newBoundary,
              ...(newFrame && { tilingFrame: newFrame }),
            },
          });
        } else {
          // Standard components: move position
          updateComponent(selectedComponentId, {
            position: {
              x: selectedComponent.position.x + dx,
              y: selectedComponent.position.y + dy,
            },
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, deleteComponent, selectedComponentId, toggleGrid, saveCurrentProject, components, updateComponent]);
};

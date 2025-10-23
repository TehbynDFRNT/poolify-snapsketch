import React, { useState } from 'react';
import { Component } from '@/types';
import { getContextMenuItems, ContextMenuAction } from '@/types/contextMenu';

interface ComponentContextMenuProps {
  component: Component;
  position: { x: number; y: number };
  onAction: (action: ContextMenuAction, data?: any) => void;
  onClose: () => void;
}

export const ComponentContextMenu: React.FC<ComponentContextMenuProps> = ({
  component,
  position,
  onAction,
  onClose,
}) => {
  const [annotationInput, setAnnotationInput] = useState(component.properties.annotation || '');
  const [showAnnotationInput, setShowAnnotationInput] = useState(false);

  const menuItems = getContextMenuItems(component.type);

  const handleAction = (action: ContextMenuAction) => {
    if (action === 'add_annotation') {
      setShowAnnotationInput(true);
    } else {
      onAction(action);
      onClose();
    }
  };

  const handleAnnotationSave = () => {
    onAction('add_annotation', annotationInput);
    onClose();
  };

  // Show annotation input if needed
  if (showAnnotationInput) {
    return (
      <div
        style={{ position: 'fixed', left: position.x, top: position.y, zIndex: 50 }}
        className="bg-popover border rounded-md shadow-md p-2 text-sm"
        onMouseLeave={onClose}
      >
        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Add Annotation</div>
        <input
          type="text"
          value={annotationInput}
          onChange={(e) => setAnnotationInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleAnnotationSave();
            } else if (e.key === 'Escape') {
              onClose();
            }
          }}
          placeholder="Enter annotation..."
          className="w-48 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
          autoFocus
        />
        <div className="flex gap-1 mt-2">
          <button
            className="flex-1 px-2 py-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded"
            onClick={handleAnnotationSave}
          >
            Save
          </button>
          <button
            className="flex-1 px-2 py-1 text-xs border hover:bg-accent rounded"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Show regular menu
  return (
    <div
      style={{ position: 'fixed', left: position.x, top: position.y, zIndex: 50 }}
      className="bg-popover border rounded-md shadow-md p-1 text-sm min-w-[140px]"
      onMouseLeave={onClose}
    >
      {menuItems.map((item, index) => (
        <button
          key={item.action}
          className="w-full text-left px-3 py-1.5 hover:bg-accent rounded flex items-center gap-2"
          onClick={() => handleAction(item.action)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

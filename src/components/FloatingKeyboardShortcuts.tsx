import { useState, useEffect } from 'react';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { getActiveShortcuts, SELECTION_SHORTCUTS, POLYSHAPE_SELECTION_SHORTCUTS, POOL_SELECTION_SHORTCUTS, isPolyshapeType } from '@/config/keyboardShortcuts';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ToolType } from '@/types';

interface FloatingKeyboardShortcutsProps {
  activeTool: ToolType;
  hasSelection?: boolean;
  selectedComponentType?: string;
}

export const FloatingKeyboardShortcuts = ({ activeTool, hasSelection = false, selectedComponentType }: FloatingKeyboardShortcutsProps) => {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);

  // If object is selected, show appropriate selection shortcuts
  const rawShortcuts = hasSelection
    ? (selectedComponentType === 'pool'
        ? POOL_SELECTION_SHORTCUTS
        : selectedComponentType && isPolyshapeType(selectedComponentType)
          ? POLYSHAPE_SELECTION_SHORTCUTS
          : SELECTION_SHORTCUTS)
    : getActiveShortcuts(activeTool).filter(shortcut => {
        // For select tool, hide Shift+Click shortcut when object is selected (already filtered above)
        if (activeTool === 'select' && shortcut.action === 'temp_pan' && hasSelection) {
          return false;
        }
        return true;
      });

  // Combine move_object and move_object_fast into a single card
  const shortcuts = rawShortcuts.reduce((acc, shortcut, index) => {
    // Check if this is move_object and the next is move_object_fast
    if (shortcut.action === 'move_object' && rawShortcuts[index + 1]?.action === 'move_object_fast') {
      acc.push({
        keys: ['Shift', '+/OR', '↑↓←→'],
        description: 'Move object (hold Shift for faster)',
        action: 'move_object_combined',
      });
      // Skip the next shortcut since we combined it
      return acc;
    }
    // Skip if this was already combined in the previous iteration
    if (shortcut.action === 'move_object_fast' && rawShortcuts[index - 1]?.action === 'move_object') {
      return acc;
    }
    acc.push(shortcut);
    return acc;
  }, [] as typeof rawShortcuts);

  // Reset carousel index when shortcuts change
  useEffect(() => {
    setCurrentIndex(0);
  }, [shortcuts.length, activeTool, hasSelection, selectedComponentType]);

  useEffect(() => {
    // Map arrow key event names to symbols
    const mapKeyToSymbol = (key: string): string => {
      const keyMap: Record<string, string> = {
        'ArrowUp': '↑',
        'ArrowDown': '↓',
        'ArrowLeft': '←',
        'ArrowRight': '→',
      };
      return keyMap[key] || key;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const mappedKey = mapKeyToSymbol(e.key);
      setPressedKeys((prev) => new Set(prev).add(mappedKey));
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const mappedKey = mapKeyToSymbol(e.key);
      setPressedKeys((prev) => {
        const next = new Set(prev);
        next.delete(mappedKey);
        return next;
      });
    };

    // Also track mouse button for "Click"
    const handleMouseDown = () => {
      setPressedKeys((prev) => new Set(prev).add('Click'));
    };

    const handleMouseUp = () => {
      setPressedKeys((prev) => {
        const next = new Set(prev);
        next.delete('Click');
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const renderArrowGroup = () => (
    <div className="flex flex-col items-center gap-0.5 scale-50">
      {/* Top row: ↑ */}
      <div className="flex justify-center">
        <Kbd
          className={cn(
            'transition-all duration-75 h-4 min-w-4 w-4 text-[10px] px-0.5',
            pressedKeys.has('↑') && 'bg-primary text-primary-foreground font-semibold scale-105'
          )}
        >
          ↑
        </Kbd>
      </div>
      {/* Bottom row: ← ↓ → */}
      <KbdGroup className="gap-0.5">
        <Kbd
          className={cn(
            'transition-all duration-75 h-4 min-w-4 w-4 text-[10px] px-0.5',
            pressedKeys.has('←') && 'bg-primary text-primary-foreground font-semibold scale-105'
          )}
        >
          ←
        </Kbd>
        <Kbd
          className={cn(
            'transition-all duration-75 h-4 min-w-4 w-4 text-[10px] px-0.5',
            pressedKeys.has('↓') && 'bg-primary text-primary-foreground font-semibold scale-105'
          )}
        >
          ↓
        </Kbd>
        <Kbd
          className={cn(
            'transition-all duration-75 h-4 min-w-4 w-4 text-[10px] px-0.5',
            pressedKeys.has('→') && 'bg-primary text-primary-foreground font-semibold scale-105'
          )}
        >
          →
        </Kbd>
      </KbdGroup>
    </div>
  );

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : shortcuts.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < shortcuts.length - 1 ? prev + 1 : 0));
  };

  if (shortcuts.length === 0) {
    return null;
  }

  const currentShortcut = shortcuts[currentIndex];

  // Safety check - if currentShortcut is undefined, return null
  if (!currentShortcut) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Left arrow - only show if multiple shortcuts */}
      {shortcuts.length > 1 && (
        <button
          onClick={handlePrevious}
          className="pointer-events-auto p-1 rounded-md bg-background/95 backdrop-blur-sm border shadow-lg hover:bg-accent transition-colors"
          aria-label="Previous shortcut"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Current shortcut card */}
      <div className="flex flex-col items-center gap-1 p-2 border rounded-md bg-background/95 backdrop-blur-sm shadow-lg min-w-[120px]">
        <KbdGroup className="items-center">
          {currentShortcut.keys.map((key, keyIndex) => {
            // Special handling for "+/OR" separator - just plain text
            if (key === '+/OR') {
              return (
                <span key={keyIndex} className="text-[10px] text-muted-foreground/70 px-1 font-normal">
                  +/OR
                </span>
              );
            }

            // Special handling for arrow key group (↑↓←→) - display as keyboard layout
            if (key === '↑↓←→') {
              return <div key={keyIndex} className="-ml-2">{renderArrowGroup()}</div>;
            }

            const isPressed = pressedKeys.has(key);
            return (
              <Kbd
                key={keyIndex}
                className={cn(
                  'transition-all duration-75',
                  isPressed && 'bg-primary text-primary-foreground font-semibold scale-105'
                )}
              >
                {key}
              </Kbd>
            );
          })}
        </KbdGroup>
        <span className="text-[10px] text-muted-foreground text-center leading-tight">{currentShortcut.description}</span>

        {/* Page indicator */}
        {shortcuts.length > 1 && (
          <span className="text-[9px] text-muted-foreground/70">
            {currentIndex + 1} of {shortcuts.length}
          </span>
        )}
      </div>

      {/* Right arrow - only show if multiple shortcuts */}
      {shortcuts.length > 1 && (
        <button
          onClick={handleNext}
          className="pointer-events-auto p-1 rounded-md bg-background/95 backdrop-blur-sm border shadow-lg hover:bg-accent transition-colors"
          aria-label="Next shortcut"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

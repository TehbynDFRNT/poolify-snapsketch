import { useState, useRef, useEffect } from 'react';
import {
  MousePointer2,
  Hand,
  Home,
  Waves,
  Droplets,
  Fence,
  Construction,
  Flower2,
  ScanLine,
  Ruler,
  Square,
  LayoutGrid,
  Pentagon,
  DoorOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ToolType, Component } from '@/types';
import { DRAINAGE_TYPES, WALL_MATERIALS } from '@/constants/components';

interface LeftToolbarProps {
  activeTool: ToolType;
  components: Component[];
  onToolChange: (
    tool: ToolType,
    options?: {
      decorationType?: 'bush' | 'umbrella' | 'waterfeature' | 'deckchairs';
      fenceType?: 'glass' | 'metal';
      areaType?: 'pavers' | 'concrete' | 'grass';
      drainageType?: 'rock' | 'ultradrain';
      wallMaterial?: 'timber' | 'concrete' | 'concrete_sleeper' | 'sandstone';
    }
  ) => void;
}

export const LeftToolbar = ({ activeTool, components, onToolChange }: LeftToolbarProps) => {
  const [toolMenu, setToolMenu] = useState<{ open: boolean; x: number; y: number; tool: ToolType | 'area' | 'select' | null }>({ open: false, x: 0, y: 0, tool: null });
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Track selected sub-options
  const [selectedAreaType, setSelectedAreaType] = useState<'pavers' | 'concrete' | 'grass'>('pavers');
  const [selectedFenceType, setSelectedFenceType] = useState<'glass' | 'metal' | 'gate'>('glass');
  const [selectedDecorationType, setSelectedDecorationType] = useState<'bush' | 'umbrella' | 'waterfeature' | 'deckchairs'>('bush');
  const [selectedSelectType, setSelectedSelectType] = useState<'select' | 'hand'>('select');
  const [selectedDrainageType, setSelectedDrainageType] = useState<'rock' | 'ultradrain'>('rock');
  const [selectedWallMaterial, setSelectedWallMaterial] = useState<'timber' | 'concrete' | 'concrete_sleeper' | 'sandstone'>('timber');

  // Check if boundary already exists
  const hasBoundary = components.some(c => c.type === 'boundary');

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (toolMenu.open) setToolMenu({ open: false, x: 0, y: 0, tool: null });
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [toolMenu.open]);

  // Helper to render a colored square with the original icon inside
  const coloredIcon = (bg: string, icon: JSX.Element, iconClassName?: string) => (
    <span className="relative inline-flex w-5 h-5 items-center justify-center rounded-sm" style={{ backgroundColor: bg }}>
      <span className="absolute inset-0 rounded-sm" style={{ backgroundColor: bg }} />
      <span className={cn('relative', iconClassName)}>{icon}</span>
    </span>
  );

  // Get the appropriate icon based on selected sub-options
  const getToolIcon = (toolId: ToolType | 'area' | 'select') => {
    if (toolId === 'select') {
      return selectedSelectType === 'hand' ? <Hand className="w-5 h-5" /> : <MousePointer2 className="w-5 h-5" />;
    }
    if (toolId === 'area') {
      // Show the Area icon (rounded square color) with the Area glyph (Square), not the paver grid
      const color = selectedAreaType === 'pavers'
        ? '#d2b48c' // sandy
        : selectedAreaType === 'concrete'
          ? '#9ca3af' // gray-400
          : '#4ade80'; // green-400
      return coloredIcon(color, <Square className="w-3 h-3" />, 'text-black');
    }
    if (toolId === 'fence') {
      if (selectedFenceType === 'glass') return coloredIcon('#5DA5DA', <Fence className="w-3 h-3" />, 'text-white');
      if (selectedFenceType === 'metal') return coloredIcon('#595959', <Fence className="w-3 h-3" />, 'text-white');
      if (selectedFenceType === 'gate') return <DoorOpen className="w-5 h-5" />;
    }
    if (toolId === 'drainage') {
      const color = DRAINAGE_TYPES[selectedDrainageType]?.color || '#888';
      const isDark = selectedDrainageType === 'ultradrain';
      return coloredIcon(color, <Droplets className="w-3 h-3" />, isDark ? 'text-white' : 'text-black');
    }
    if (toolId === 'wall') {
      const color = WALL_MATERIALS[selectedWallMaterial]?.color || '#888';
      return coloredIcon(color, <Construction className="w-3 h-3" />, 'text-black');
    }
    if (toolId === 'boundary') {
      return <Pentagon className="w-5 h-5" />;
    }
    if (toolId === 'decoration') {
      return <Flower2 className="w-5 h-5" />;
    }
    // Default icons
    switch (toolId) {
      case 'house': return <Home className="w-5 h-5" />;
      case 'pool': return <Waves className="w-5 h-5" />;
      case 'drainage': return <Droplets className="w-5 h-5" />;
      case 'wall': return <Construction className="w-5 h-5" />;
      case 'quick_measure':
        // Show active measure variant: Ruler when height tool is active
        return activeTool === 'height' ? <Ruler className="w-5 h-5" /> : <ScanLine className="w-5 h-5" />;
      case 'height': return <Ruler className="w-5 h-5" />;
      default: return <Square className="w-5 h-5" />;
    }
  };

  const tools: Array<{ id: ToolType | 'area' | 'select'; name: string; shortcut: string; hasMenu?: boolean; disabled?: boolean }> = [
    { id: 'select', name: 'Select/Pan', shortcut: 'V', hasMenu: true },
    // Group 1
    { id: 'boundary', name: 'Boundary', shortcut: 'B', hasMenu: false },
    { id: 'house', name: 'House', shortcut: 'U', hasMenu: true },
    { id: 'pool', name: 'Pool', shortcut: 'O', hasMenu: true },
    // Group 2
    { id: 'area', name: 'Paver', shortcut: '', hasMenu: true },
    { id: 'fence', name: 'Fence', shortcut: 'F', hasMenu: true },
    { id: 'drainage', name: 'Drainage', shortcut: 'D', hasMenu: true },
    { id: 'wall', name: 'Wall', shortcut: 'W', hasMenu: true },
    // Group 3
    { id: 'quick_measure', name: 'Measure', shortcut: 'M', hasMenu: true },
    { id: 'decoration', name: 'Decoration', shortcut: 'C', hasMenu: true },
  ];

  const handleToolClick = (toolId: ToolType | 'area' | 'select') => {
    if (toolId === 'select') {
      if (selectedSelectType === 'select') {
        onToolChange('select');
      } else {
        onToolChange('hand');
      }
    } else if (toolId === 'area') {
      onToolChange('paving_area', { areaType: selectedAreaType });
    } else if (toolId === 'area') {
      onToolChange('paving_area', { areaType: selectedAreaType });
    } else if (toolId === 'drainage') {
      onToolChange('drainage', { drainageType: selectedDrainageType });
    } else if (toolId === 'wall') {
      onToolChange('wall', { wallMaterial: selectedWallMaterial });
    } else {
      onToolChange(toolId as ToolType);
    }
  };

  return (
    <div className="w-[72px] border-r bg-background flex flex-col gap-2 p-2 flex-shrink-0">
      {tools.map(tool => {
        const isActive = tool.id === 'select'
          ? (activeTool === 'select' || activeTool === 'hand')
          : tool.id === 'area'
            ? (activeTool === 'paving_area' || activeTool === 'area')
            : tool.id === 'quick_measure'
              ? (activeTool === 'quick_measure' || activeTool === 'height')
              : activeTool === tool.id;

        return (
          <div key={tool.id} className="flex flex-col items-center">
            <Button
              variant={isActive ? 'default' : 'ghost'}
              size="icon"
              onClick={() => !tool.disabled && handleToolClick(tool.id)}
              onContextMenu={(e) => {
                if (tool.hasMenu && !tool.disabled) {
                  e.preventDefault();
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setToolMenu({ open: true, x: rect.right + 4, y: rect.top, tool: tool.id });
                }
              }}
              className={cn(
                "w-14 h-14 flex-shrink-0",
                isActive && 'bg-primary text-primary-foreground',
                tool.disabled && 'opacity-40 cursor-not-allowed'
              )}
              title={tool.disabled ? `${tool.name} (Already exists)` : `${tool.name}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
              disabled={tool.disabled}
            >
              {getToolIcon(tool.id)}
            </Button>
            {(tool.id === 'pool' || tool.id === 'wall') && (
              <div className="h-px w-10 bg-border my-1" role="separator" aria-orientation="horizontal" />
            )}
          </div>
        );
      })}

      {/* Tool options context menu */}
      {toolMenu.open && toolMenu.tool === 'select' && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: toolMenu.x, top: toolMenu.y, zIndex: 70 }}
          className="bg-popover border rounded-md shadow-md p-2 text-sm"
        >
          <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">Select Options</div>
          <button
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded w-full"
            onClick={() => {
              setSelectedSelectType('select');
              onToolChange('select');
              setToolMenu({ open: false, x: 0, y: 0, tool: null });
            }}
            title="Select Tool"
          >
            <MousePointer2 className="w-5 h-5" />
            <span>Select</span>
          </button>
          <button
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded w-full"
            onClick={() => {
              setSelectedSelectType('hand');
              onToolChange('hand');
              setToolMenu({ open: false, x: 0, y: 0, tool: null });
            }}
            title="Pan Tool"
          >
            <Hand className="w-5 h-5" />
            <span>Pan</span>
          </button>
        </div>
      )}

      {toolMenu.open && toolMenu.tool === 'area' && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: toolMenu.x, top: toolMenu.y, zIndex: 70 }}
          className="bg-popover border rounded-md shadow-md p-2 text-sm"
        >
      <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">Area Options</div>
      <button
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded w-full"
        onClick={() => {
          setSelectedAreaType('pavers');
          onToolChange('paving_area', { areaType: 'pavers' });
          setToolMenu({ open: false, x: 0, y: 0, tool: null });
        }}
        title="Pavers Area"
      >
            {coloredIcon('#d2b48c', <Square className="w-3 h-3" />, 'text-black')}
            <span>Pavers</span>
          </button>
          <button
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded w-full"
            onClick={() => {
              setSelectedAreaType('concrete');
              onToolChange('paving_area', { areaType: 'concrete' });
              setToolMenu({ open: false, x: 0, y: 0, tool: null });
            }}
            title="Concrete Area"
          >
            {coloredIcon('#9ca3af', <Square className="w-3 h-3" />, 'text-black')}
            <span>Concrete</span>
          </button>
          <button
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded w-full"
            onClick={() => {
              setSelectedAreaType('grass');
              onToolChange('paving_area', { areaType: 'grass' });
              setToolMenu({ open: false, x: 0, y: 0, tool: null });
            }}
            title="Grass Area"
          >
            {coloredIcon('#4ade80', <Square className="w-3 h-3" />, 'text-black')}
            <span>Grass</span>
          </button>
        </div>
      )}

      {toolMenu.open && toolMenu.tool === 'fence' && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: toolMenu.x, top: toolMenu.y, zIndex: 70 }}
          className="bg-popover border rounded-md shadow-md p-2 text-sm"
        >
      <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">Fence Options</div>
      <button
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded w-full"
        onClick={() => {
          setSelectedFenceType('glass');
          onToolChange('fence', { fenceType: 'glass' });
          setToolMenu({ open: false, x: 0, y: 0, tool: null });
        }}
        title="Glass"
      >
          {coloredIcon('#5DA5DA', <Fence className="w-3 h-3" />, 'text-white')}
          <span>Glass</span>
      </button>
      <button
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded w-full"
        onClick={() => {
          setSelectedFenceType('metal');
          onToolChange('fence', { fenceType: 'metal' });
          setToolMenu({ open: false, x: 0, y: 0, tool: null });
        }}
        title="Metal"
      >
          {coloredIcon('#595959', <Fence className="w-3 h-3" />, 'text-white')}
          <span>Metal</span>
      </button>
          <button
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded w-full"
            onClick={() => {
              setSelectedFenceType('gate');
              onToolChange('gate');
              setToolMenu({ open: false, x: 0, y: 0, tool: null });
            }}
            title="Gate"
          >
            <DoorOpen className="w-5 h-5" />
            <span>Gate</span>
          </button>
        </div>
      )}

      {/* Decoration menu with image previews */}
      {toolMenu.open && toolMenu.tool === 'decoration' && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: toolMenu.x, top: toolMenu.y, zIndex: 70 }}
          className="bg-popover border rounded-md shadow-md p-2 text-sm"
        >
          <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">Select Decoration</div>
          <div className="flex flex-col gap-1">
            <button
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded w-full"
              onClick={() => {
                setSelectedDecorationType('bush');
                onToolChange('decoration', { decorationType: 'bush' });
                setToolMenu({ open: false, x: 0, y: 0, tool: null });
              }}
            >
              <img src="/Bush.png" alt="Bush" className="w-5 h-auto object-contain" />
              <span>Bush</span>
            </button>
            <button
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded w-full"
              onClick={() => {
                setSelectedDecorationType('umbrella');
                onToolChange('decoration', { decorationType: 'umbrella' });
                setToolMenu({ open: false, x: 0, y: 0, tool: null });
              }}
            >
              <img src="/Umbrella.png" alt="Umbrella" className="w-5 h-auto object-contain" />
              <span>Umbrella</span>
            </button>
            <button
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded w-full"
              onClick={() => {
                setSelectedDecorationType('waterfeature');
                onToolChange('decoration', { decorationType: 'waterfeature' });
                setToolMenu({ open: false, x: 0, y: 0, tool: null });
              }}
            >
              <img src="/WaterFeature.png" alt="Water Feature" className="w-5 h-auto object-contain" />
              <span>Water Feature</span>
            </button>
            <button
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded w-full"
              onClick={() => {
                setSelectedDecorationType('deckchairs');
                onToolChange('decoration', { decorationType: 'deckchairs' });
                setToolMenu({ open: false, x: 0, y: 0, tool: null });
              }}
            >
              <img src="/DeckChairs.png" alt="Deck Chairs" className="w-5 h-auto object-contain" />
              <span>Deck Chairs</span>
            </button>
          </div>
        </div>
      )}

      {/* House menu */}
      {toolMenu.open && toolMenu.tool === 'house' && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: toolMenu.x, top: toolMenu.y, zIndex: 70 }}
          className="bg-popover border rounded-md shadow-md p-2 text-sm"
        >
          <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">House Options</div>
          <button
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded w-full"
            onClick={() => {
              onToolChange('house');
              setToolMenu({ open: false, x: 0, y: 0, tool: null });
            }}
            title="House"
          >
            <Home className="w-5 h-5" />
            <span>House</span>
          </button>
        </div>
      )}

      {/* Pool menu */}
      {toolMenu.open && toolMenu.tool === 'pool' && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: toolMenu.x, top: toolMenu.y, zIndex: 70 }}
          className="bg-popover border rounded-md shadow-md p-2 text-sm"
        >
          <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">Pool Options</div>
          <button
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded w-full"
            onClick={() => {
              onToolChange('pool');
              setToolMenu({ open: false, x: 0, y: 0, tool: null });
            }}
            title="Pool"
          >
            <Waves className="w-5 h-5" />
            <span>Pool</span>
          </button>
        </div>
      )}

      {/* Drainage menu */}
      {toolMenu.open && toolMenu.tool === 'drainage' && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: toolMenu.x, top: toolMenu.y, zIndex: 70 }}
          className="bg-popover border rounded-md shadow-md p-2 text-sm"
        >
      <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">Drainage Options</div>
      <button
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded w-full"
        onClick={() => {
          setSelectedDrainageType('rock');
          onToolChange('drainage', { drainageType: 'rock' });
          setToolMenu({ open: false, x: 0, y: 0, tool: null });
        }}
        title="Rock Drainage"
      >
          {coloredIcon(DRAINAGE_TYPES.rock.color, <Droplets className="w-3 h-3" />, 'text-black')}
          <span>Rock</span>
      </button>
      <button
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded w-full"
        onClick={() => {
          setSelectedDrainageType('ultradrain');
          onToolChange('drainage', { drainageType: 'ultradrain' });
          setToolMenu({ open: false, x: 0, y: 0, tool: null });
        }}
        title="Ultradrain"
      >
          {coloredIcon(DRAINAGE_TYPES.ultradrain.color, <Droplets className="w-3 h-3" />, 'text-white')}
          <span>Ultradrain</span>
      </button>
        </div>
      )}

      {/* Wall menu */}
      {toolMenu.open && toolMenu.tool === 'wall' && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: toolMenu.x, top: toolMenu.y, zIndex: 70 }}
          className="bg-popover border rounded-md shadow-md p-2 text-sm"
        >
      <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">Wall Options</div>
      <button
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded w-full"
        onClick={() => {
          setSelectedWallMaterial('timber');
          onToolChange('wall', { wallMaterial: 'timber' });
          setToolMenu({ open: false, x: 0, y: 0, tool: null });
        }}
        title="Timber Wall"
      >
          {coloredIcon(WALL_MATERIALS.timber.color, <Construction className="w-3 h-3" />, 'text-black')}
          <span>Timber</span>
      </button>
      <button
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded w-full"
        onClick={() => {
          setSelectedWallMaterial('concrete');
          onToolChange('wall', { wallMaterial: 'concrete' });
          setToolMenu({ open: false, x: 0, y: 0, tool: null });
        }}
        title="Concrete Wall"
      >
          {coloredIcon(WALL_MATERIALS.concrete.color, <Construction className="w-3 h-3" />, 'text-black')}
          <span>Concrete</span>
      </button>
      <button
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded w-full"
        onClick={() => {
          setSelectedWallMaterial('concrete_sleeper');
          onToolChange('wall', { wallMaterial: 'concrete_sleeper' });
          setToolMenu({ open: false, x: 0, y: 0, tool: null });
        }}
        title="Concrete Sleeper Wall"
      >
          {coloredIcon(WALL_MATERIALS.concrete_sleeper.color, <Construction className="w-3 h-3" />, 'text-black')}
          <span>Concrete Sleeper</span>
      </button>
      <button
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded w-full"
        onClick={() => {
          setSelectedWallMaterial('sandstone');
          onToolChange('wall', { wallMaterial: 'sandstone' });
          setToolMenu({ open: false, x: 0, y: 0, tool: null });
        }}
        title="Sandstone Wall"
      >
          {coloredIcon(WALL_MATERIALS.sandstone.color, <Construction className="w-3 h-3" />, 'text-black')}
          <span>Sandstone</span>
      </button>
        </div>
      )}

      {/* Measure menu */}
      {toolMenu.open && toolMenu.tool === 'quick_measure' && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: toolMenu.x, top: toolMenu.y, zIndex: 70 }}
          className="bg-popover border rounded-md shadow-md p-2 text-sm"
        >
          <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">Measure Options</div>
          <button
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded w-full"
            onClick={() => {
              onToolChange('quick_measure');
              setToolMenu({ open: false, x: 0, y: 0, tool: null });
            }}
            title="Measure"
          >
            <ScanLine className="w-5 h-5" />
            <span>Measure</span>
          </button>
          <button
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded w-full"
            onClick={() => {
              onToolChange('height');
              setToolMenu({ open: false, x: 0, y: 0, tool: null });
            }}
            title="Height"
          >
            <Ruler className="w-5 h-5" />
            <span>Height</span>
          </button>
        </div>
      )}
    </div>
  );
};

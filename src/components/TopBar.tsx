import { Link } from 'react-router-dom';
import {
  Home,
  Undo2,
  Redo2,
  Save,
  Download,
  Menu,
  MousePointer2,
  Hand,
  Pentagon,
  Waves,
  Droplets,
  Fence,
  LayoutGrid,
  ScanLine,
  Construction,
  Blocks,
  Flower2,
  DoorOpen,
  Square
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useRef, useEffect } from 'react';
import type { ToolType } from '@/types';

interface TopBarProps {
  projectName: string;
  lastSaved: Date | null;
  activeTool: ToolType;
  onToolChange: (
    tool: ToolType,
    options?: {
      decorationType?: 'bush' | 'umbrella' | 'waterfeature' | 'deckchairs';
      fenceType?: 'glass' | 'metal';
      areaType?: 'pavers' | 'concrete' | 'grass';
    }
  ) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  gridVisible: boolean;
  onGridToggle: () => void;
  onSave: () => void;
  onExport: () => void;
  onMenuClick: () => void;
}

const tools: Array<{ id: ToolType | 'area'; icon: React.ReactNode; name: string; shortcut: string }> = [
  { id: 'select', icon: <MousePointer2 className="w-5 h-5" />, name: 'Select', shortcut: 'V' },
  { id: 'hand', icon: <Hand className="w-5 h-5" />, name: 'Pan', shortcut: 'H' },
  { id: 'house', icon: <Home className="w-5 h-5" />, name: 'House', shortcut: 'U' },
  { id: 'pool', icon: <Waves className="w-5 h-5" />, name: 'Pool', shortcut: 'O' },
  { id: 'area', icon: <Square className="w-5 h-5" />, name: 'Area', shortcut: '' },
  { id: 'drainage', icon: <Droplets className="w-5 h-5" />, name: 'Drainage', shortcut: 'D' },
  { id: 'fence', icon: <Fence className="w-5 h-5" />, name: 'Fence', shortcut: 'F' },
  { id: 'wall', icon: <Construction className="w-5 h-5" />, name: 'Wall', shortcut: 'W' },
  { id: 'decoration', icon: <Flower2 className="w-5 h-5" />, name: 'Decoration', shortcut: 'C' },
  { id: 'quick_measure', icon: <ScanLine className="w-5 h-5" />, name: 'Measure', shortcut: 'M' },
];

export const TopBar = ({
  projectName,
  lastSaved,
  activeTool,
  onToolChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  gridVisible,
  onGridToggle,
  onSave,
  onExport,
  onMenuClick,
}: TopBarProps) => {
  const [toolMenu, setToolMenu] = useState<{ open: boolean; x: number; y: number; tool: ToolType | null }>({ open: false, x: 0, y: 0, tool: null });
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (toolMenu.open) setToolMenu({ open: false, x: 0, y: 0, tool: null });
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [toolMenu.open]);
  const handleToolClick = (toolId: ToolType | 'area') => {
    console.log('Tool clicked:', toolId);
    console.log('Current active tool:', activeTool);
    if (toolId === 'area') {
      onToolChange('paving_area', { areaType: 'pavers' });
    } else {
      onToolChange(toolId);
    }
    console.log('Tool change called');
  };

  const formatLastSaved = (date: Date | null) => {
    if (!date) return 'Not saved';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <header className="h-[60px] border-b bg-background flex items-center justify-between px-4 flex-shrink-0">
      {/* Left: Project Info */}
      <div className="flex items-center gap-3 min-w-0">
        <Link 
          to="/projects" 
          className="text-primary hover:text-primary/80 flex-shrink-0"
          title="Back to projects"
        >
          <Home className="w-5 h-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="font-semibold text-foreground truncate">{projectName}</h1>
          <p className="text-xs text-muted-foreground">
            Auto-saved: {formatLastSaved(lastSaved)}
          </p>
        </div>
      </div>

      {/* Center: Tools */}
      <div className="flex items-center gap-1 overflow-x-auto flex-shrink-0 mx-4">
        {tools.map(tool => (
          <Button
            key={tool.id}
            variant={(tool.id === 'area' ? (activeTool === 'paving_area' || activeTool === 'area') : activeTool === tool.id) ? 'default' : 'ghost'}
            size="icon"
            onClick={() => handleToolClick(tool.id)}
            onContextMenu={(e) => {
              if (tool.id === 'fence' || tool.id === 'decoration' || tool.id === 'area') {
                e.preventDefault();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setToolMenu({ open: true, x: rect.left, y: rect.bottom + 4, tool: tool.id });
              }
            }}
            className="min-w-[44px] min-h-[44px] flex-shrink-0"
            title={`${tool.name} (${tool.shortcut})`}
          >
            {tool.icon}
          </Button>
        ))}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onUndo}
          disabled={!canUndo}
          className="min-w-[44px] min-h-[44px]"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-5 h-5" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={onRedo}
          disabled={!canRedo}
          className="min-w-[44px] min-h-[44px]"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-5 h-5" />
        </Button>
        
        <label className="flex items-center gap-2 px-2 cursor-pointer">
          <input
            type="checkbox"
            checked={gridVisible}
            onChange={(e) => onGridToggle()}
            className="w-4 h-4"
          />
          <span className="text-sm hidden md:inline">Grid</span>
        </label>

        <Button
          variant="ghost"
          size="icon"
          onClick={onSave}
          className="min-w-[44px] min-h-[44px]"
          title="Save (Ctrl+S)"
        >
          <Save className="w-5 h-5" />
        </Button>
        
        <Button
          onClick={onExport}
          className="min-h-[44px] gap-2"
        >
          <Download className="w-4 h-4" />
          <span className="hidden md:inline">Export</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="min-w-[44px] min-h-[44px]"
        >
          <Menu className="w-5 h-5" />
        </Button>
      </div>

      {/* Tool options context menu (top bar) */}
      {toolMenu.open && toolMenu.tool === 'area' && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: toolMenu.x, top: toolMenu.y, zIndex: 70 }}
          className="bg-popover border rounded-md shadow-md p-2 text-sm"
        >
          <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">Area Options</div>
          <button
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded"
            onClick={() => {
              onToolChange('paving_area', { areaType: 'pavers' });
              setToolMenu({ open: false, x: 0, y: 0, tool: null });
            }}
            title="Pavers Area"
          >
            <LayoutGrid className="w-5 h-5" />
            <span>Pavers</span>
          </button>
          <button
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded"
            onClick={() => {
              onToolChange('paving_area', { areaType: 'concrete' });
              setToolMenu({ open: false, x: 0, y: 0, tool: null });
            }}
            title="Concrete Area"
          >
            <span className="inline-block w-5 h-5 rounded-sm bg-gray-300" />
            <span>Concrete</span>
          </button>
          <button
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded"
            onClick={() => {
              onToolChange('paving_area', { areaType: 'grass' });
              setToolMenu({ open: false, x: 0, y: 0, tool: null });
            }}
            title="Grass Area"
          >
            <span className="inline-block w-5 h-5 rounded-sm bg-green-300" />
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
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded"
            onClick={() => {
              onToolChange('fence', { fenceType: 'glass' });
              setToolMenu({ open: false, x: 0, y: 0, tool: null });
            }}
            title="Glass"
          >
            <span className="inline-block w-5 h-5 rounded-sm bg-[#5DA5DA]" />
            <span>Glass</span>
          </button>
          <button
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded"
            onClick={() => {
              onToolChange('fence', { fenceType: 'metal' });
              setToolMenu({ open: false, x: 0, y: 0, tool: null });
            }}
            title="Metal"
          >
            <span className="inline-block w-5 h-5 rounded-sm bg-[#595959]" />
            <span>Metal</span>
          </button>
          <button
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded"
            onClick={() => {
              onToolChange('boundary');
              setToolMenu({ open: false, x: 0, y: 0, tool: null });
            }}
            title="Boundary"
          >
            <Pentagon className="w-5 h-5" />
            <span>Boundary</span>
          </button>
          <button
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded"
            onClick={() => {
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
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded"
              onClick={() => {
                onToolChange('decoration', { decorationType: 'bush' });
                setToolMenu({ open: false, x: 0, y: 0, tool: null });
              }}
            >
              <img src="/Bush.png" alt="Bush" className="w-5 h-auto object-contain" />
              <span>Bush</span>
            </button>
            <button
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded"
              onClick={() => {
                onToolChange('decoration', { decorationType: 'umbrella' });
                setToolMenu({ open: false, x: 0, y: 0, tool: null });
              }}
            >
              <img src="/Umbrella.png" alt="Umbrella" className="w-5 h-auto object-contain" />
              <span>Umbrella</span>
            </button>
            <button
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded"
              onClick={() => {
                onToolChange('decoration', { decorationType: 'waterfeature' });
                setToolMenu({ open: false, x: 0, y: 0, tool: null });
              }}
            >
              <img src="/WaterFeature.png" alt="Water Feature" className="w-5 h-auto object-contain" />
              <span>Water Feature</span>
            </button>
            <button
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded"
              onClick={() => {
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
    </header>
  );
};

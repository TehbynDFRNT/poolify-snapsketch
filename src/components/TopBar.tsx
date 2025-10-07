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
  Square,
  Box,
  Droplets,
  Fence,
  Blocks,
  Ruler,
  ScanLine,
  Move,
  Maximize2,
  Grid3x3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ToolType } from '@/types';

interface TopBarProps {
  projectName: string;
  lastSaved: Date | null;
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
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

const tools: Array<{ id: ToolType; icon: React.ReactNode; name: string; shortcut: string }> = [
  { id: 'select', icon: <MousePointer2 className="w-5 h-5" />, name: 'Select', shortcut: 'V' },
  { id: 'hand', icon: <Hand className="w-5 h-5" />, name: 'Pan', shortcut: 'H' },
  { id: 'boundary', icon: <Square className="w-5 h-5" />, name: 'Boundary', shortcut: 'B' },
  { id: 'house', icon: <Home className="w-5 h-5" />, name: 'House', shortcut: 'U' },
  { id: 'pool', icon: <Box className="w-5 h-5" />, name: 'Pool', shortcut: 'O' },
  { id: 'paver', icon: <Blocks className="w-5 h-5" />, name: 'Paver', shortcut: 'A' },
  { id: 'paving_area', icon: <Grid3x3 className="w-5 h-5" />, name: 'Paving Area', shortcut: 'P' },
  { id: 'drainage', icon: <Droplets className="w-5 h-5" />, name: 'Drainage', shortcut: 'D' },
  { id: 'fence', icon: <Fence className="w-5 h-5" />, name: 'Fence', shortcut: 'F' },
  { id: 'wall', icon: <Blocks className="w-5 h-5" />, name: 'Wall', shortcut: 'W' },
  { id: 'reference_line', icon: <Ruler className="w-5 h-5" />, name: 'Reference', shortcut: 'R' },
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
          to="/" 
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
            variant={activeTool === tool.id ? 'default' : 'ghost'}
            size="icon"
            onClick={() => onToolChange(tool.id)}
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
    </header>
  );
};

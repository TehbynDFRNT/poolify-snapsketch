import { Link } from 'react-router-dom';
import {
  Home,
  Undo2,
  Redo2,
  Save,
  Download,
  Menu,
  Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TopBarProps {
  projectName: string;
  lastSaved: Date | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  gridVisible: boolean;
  satelliteVisible: boolean;
  annotationsVisible: boolean;
  onGridToggle: () => void;
  onSatelliteToggle: () => void;
  onAnnotationsToggle: () => void;
  onSave: () => void;
  onShare?: () => void;
  onExport: () => void;
  onMenuClick: () => void;
}

export const TopBar = ({
  projectName,
  lastSaved,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  gridVisible,
  satelliteVisible,
  annotationsVisible,
  onGridToggle,
  onSatelliteToggle,
  onAnnotationsToggle,
  onSave,
  onShare,
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

        <label className="flex items-center gap-2 px-2 cursor-pointer">
          <input
            type="checkbox"
            checked={satelliteVisible}
            onChange={() => onSatelliteToggle()}
            className="w-4 h-4"
          />
          <span className="text-sm hidden md:inline">Satellite</span>
        </label>

        <label className="flex items-center gap-2 px-2 cursor-pointer">
          <input
            type="checkbox"
            checked={annotationsVisible}
            onChange={() => onAnnotationsToggle()}
            className="w-4 h-4"
          />
          <span className="text-sm hidden md:inline">Annotations</span>
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

        {onShare && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onShare}
            className="min-w-[44px] min-h-[44px]"
            title="Share project"
          >
            <Share2 className="w-5 h-5" />
          </Button>
        )}

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

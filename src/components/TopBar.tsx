import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Home,
  Save,
  Download,
  Menu,
  Share2,
  Grid3X3,
  Satellite,
  Tag,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { StageStatusBar } from './StageStatusBar';

interface TopBarProps {
  projectName: string;
  lastSaved: Date | null;
  gridVisible: boolean;
  satelliteVisible: boolean;
  annotationsVisible: boolean;
  blueprintMode: boolean;
  onGridToggle: () => void;
  onSatelliteToggle: () => void;
  onAnnotationsToggle: () => void;
  onBlueprintToggle: () => void;
  onSave: () => void;
  onShare?: () => void;
  onExport: () => void;
  onMenuClick: () => void;
  onHistoryClick?: () => void;
}

export const TopBar = ({
  projectName,
  lastSaved,
  gridVisible,
  satelliteVisible,
  annotationsVisible,
  blueprintMode,
  onGridToggle,
  onSatelliteToggle,
  onAnnotationsToggle,
  onBlueprintToggle,
  onSave,
  onShare,
  onExport,
  onMenuClick,
  onHistoryClick,
}: TopBarProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          <p className="text-xs text-muted-foreground hidden sm:block">
            Auto-saved: {formatLastSaved(lastSaved)}
          </p>
        </div>

        {/* Stage Status - visible on md+ screens */}
        <div className="hidden md:block ml-4">
          <StageStatusBar onHistoryClick={onHistoryClick} />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {/* Desktop: Inline layer checkboxes */}
        <label className="hidden lg:flex items-center gap-2 px-2 cursor-pointer">
          <input
            type="checkbox"
            checked={gridVisible}
            onChange={() => onGridToggle()}
            className="w-4 h-4"
          />
          <span className="text-sm">Grid</span>
        </label>

        <label className="hidden lg:flex items-center gap-2 px-2 cursor-pointer">
          <input
            type="checkbox"
            checked={satelliteVisible}
            onChange={() => onSatelliteToggle()}
            className="w-4 h-4"
          />
          <span className="text-sm">Satellite</span>
        </label>

        <label className="hidden lg:flex items-center gap-2 px-2 cursor-pointer">
          <input
            type="checkbox"
            checked={annotationsVisible}
            onChange={() => onAnnotationsToggle()}
            className="w-4 h-4"
          />
          <span className="text-sm">Annotations</span>
        </label>

        <label className="hidden lg:flex items-center gap-2 px-2 cursor-pointer">
          <input
            type="checkbox"
            checked={blueprintMode}
            onChange={() => onBlueprintToggle()}
            className="w-4 h-4"
          />
          <span className="text-sm">Blueprint</span>
        </label>

        {/* Share button - always visible if available */}
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

        {/* Mobile: Hamburger menu with layers, save, export */}
        <Popover open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden min-w-[44px] min-h-[44px]"
              title="Menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="end">
            <div className="space-y-1">
              {/* Layer toggles */}
              <div className="text-xs font-semibold text-muted-foreground px-3 py-1">Layers</div>
              <button
                onClick={() => onGridToggle()}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent text-left"
              >
                <Grid3X3 className="w-4 h-4" />
                <span className="flex-1 text-sm">Grid</span>
                <input
                  type="checkbox"
                  checked={gridVisible}
                  onChange={() => {}}
                  className="w-4 h-4 pointer-events-none"
                />
              </button>
              <button
                onClick={() => onSatelliteToggle()}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent text-left"
              >
                <Satellite className="w-4 h-4" />
                <span className="flex-1 text-sm">Satellite</span>
                <input
                  type="checkbox"
                  checked={satelliteVisible}
                  onChange={() => {}}
                  className="w-4 h-4 pointer-events-none"
                />
              </button>
              <button
                onClick={() => onAnnotationsToggle()}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent text-left"
              >
                <Tag className="w-4 h-4" />
                <span className="flex-1 text-sm">Annotations</span>
                <input
                  type="checkbox"
                  checked={annotationsVisible}
                  onChange={() => {}}
                  className="w-4 h-4 pointer-events-none"
                />
              </button>
              <button
                onClick={() => onBlueprintToggle()}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent text-left"
              >
                <FileText className="w-4 h-4" />
                <span className="flex-1 text-sm">Blueprint</span>
                <input
                  type="checkbox"
                  checked={blueprintMode}
                  onChange={() => {}}
                  className="w-4 h-4 pointer-events-none"
                />
              </button>

              <div className="h-px bg-border my-2" />

              {/* Stage Status */}
              <div className="text-xs font-semibold text-muted-foreground px-3 py-1">Project Stage</div>
              <div className="px-3 py-2">
                <StageStatusBar onHistoryClick={() => { onHistoryClick?.(); setMobileMenuOpen(false); }} />
              </div>

              <div className="h-px bg-border my-2" />

              {/* Actions */}
              <button
                onClick={() => { onSave(); setMobileMenuOpen(false); }}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent text-left"
              >
                <Save className="w-4 h-4" />
                <span className="text-sm">Save</span>
              </button>
              <button
                onClick={() => { onExport(); setMobileMenuOpen(false); }}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent text-left"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm">Export</span>
              </button>
              <button
                onClick={() => { onMenuClick(); setMobileMenuOpen(false); }}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent text-left"
              >
                <Menu className="w-4 h-4" />
                <span className="text-sm">Project Settings</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Desktop: Individual action buttons */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onSave}
          className="hidden lg:flex min-w-[44px] min-h-[44px]"
          title="Save (Ctrl+S)"
        >
          <Save className="w-5 h-5" />
        </Button>

        <Button
          onClick={onExport}
          className="hidden lg:flex min-h-[44px] gap-2"
        >
          <Download className="w-4 h-4" />
          <span>Export</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="hidden lg:flex min-w-[44px] min-h-[44px]"
          title="Project settings"
        >
          <Menu className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
};

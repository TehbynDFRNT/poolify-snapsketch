import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Menu as MenuIcon, Undo2, Redo2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDesignStore } from '@/store/designStore';
import { loadProject } from '@/utils/storage';
import { toast } from 'sonner';
import { Toolbar } from './Toolbar';
import { Canvas } from './Canvas';
import { PropertiesPanel } from './PropertiesPanel';
import { format } from 'date-fns';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export const DesignCanvas = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  useKeyboardShortcuts(); // Enable keyboard shortcuts
  
  const {
    currentProject,
    setCurrentProject,
    saveCurrentProject,
    undo,
    redo,
    historyIndex,
    history,
  } = useDesignStore();

  useEffect(() => {
    if (id) {
      const project = loadProject(id);
      if (project) {
        setCurrentProject(project);
        setLastSaved(project.updatedAt);
      } else {
        toast.error('Project not found');
        navigate('/');
      }
    }
  }, [id, setCurrentProject, navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (currentProject) {
        saveCurrentProject();
        setLastSaved(new Date());
        toast.success('Auto-saved', { duration: 1000 });
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [currentProject, saveCurrentProject]);

  const handleSave = () => {
    saveCurrentProject();
    setLastSaved(new Date());
    toast.success('Project saved');
  };

  const handleBack = () => {
    saveCurrentProject();
    navigate('/');
  };

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    );
  }

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                {currentProject.customerName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {currentProject.address}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastSaved && (
              <span className="text-sm text-muted-foreground hidden md:inline">
                💾 Auto-saved: {format(lastSaved, 'h:mm a')}
              </span>
            )}
            
            <div className="flex items-center gap-1 border-r border-border pr-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={undo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={redo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </div>

            <Button onClick={handleSave} size="sm" className="gap-2">
              <Save className="h-4 w-4" />
              <span className="hidden md:inline">Save</span>
            </Button>

            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden md:inline">Export PDF</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Toolbar - Left sidebar */}
        <div className="w-20 border-r border-border bg-card overflow-y-auto">
          <Toolbar />
        </div>

        {/* Canvas - Center */}
        <div className="flex-1 overflow-hidden">
          <Canvas />
        </div>

        {/* Properties - Right sidebar */}
        <div className="w-80 border-l border-border bg-card overflow-y-auto">
          <PropertiesPanel />
        </div>
      </div>
    </div>
  );
};

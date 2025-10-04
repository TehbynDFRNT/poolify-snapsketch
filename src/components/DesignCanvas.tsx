import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDesignStore } from '@/store/designStore';
import { loadProject } from '@/utils/storage';
import { toast } from 'sonner';
import { Canvas } from './Canvas';
import { TopBar } from './TopBar';
import { BottomPanel } from './BottomPanel';
import { ExportDialog } from './ExportDialog';
import { exportToPDF } from '@/utils/pdfExport';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import type { ToolType, ExportOptions } from '@/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export const DesignCanvas = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(350);
  const [menuOpen, setMenuOpen] = useState(false);
  
  useKeyboardShortcuts(); // Enable keyboard shortcuts
  
  const {
    currentProject,
    setCurrentProject,
    saveCurrentProject,
    clearAll,
    undo,
    redo,
    historyIndex,
    history,
    gridVisible,
    toggleGrid,
    selectedComponentId,
    components,
  } = useDesignStore();

  // Tool keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }

      // Tool shortcuts
      if (e.key === 'v' || e.key === 'V') setActiveTool('select');
      if (e.key === 'h' || e.key === 'H') setActiveTool('hand');
      if (e.key === 'b' || e.key === 'B') setActiveTool('boundary');
      if (e.key === 'p' || e.key === 'P') setActiveTool('pool');
      if (e.key === 'a' || e.key === 'A') setActiveTool('paver');
      if (e.key === 'd' || e.key === 'D') setActiveTool('drainage');
      if (e.key === 'f' || e.key === 'F') setActiveTool('fence');
      if (e.key === 'w' || e.key === 'W') setActiveTool('wall');
      if (e.key === 'm' || e.key === 'M') setActiveTool('quick_measure');
      if (e.key === 'r' || e.key === 'R') setActiveTool('reference_line');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (id) {
      const project = loadProject(id);
      if (project) {
        setCurrentProject(project);
        const updatedDate = typeof project.updatedAt === 'string' 
          ? new Date(project.updatedAt)
          : project.updatedAt;
        setLastSaved(updatedDate);
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

  const handleExport = async (options: ExportOptions) => {
    if (!currentProject) return;
    
    // Get the canvas element from the Konva stage
    const stage = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement;
    if (!stage) {
      toast.error('Canvas not found');
      return;
    }

    try {
      await exportToPDF(currentProject, stage, options);
      toast.success('PDF exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export PDF');
    }
  };

  const handleClearAll = () => {
    clearAll();
    setClearAllDialogOpen(false);
    toast.success('Canvas cleared');
  };

  const selectedComponent = selectedComponentId 
    ? components.find(c => c.id === selectedComponentId) || null
    : null;

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Top Bar */}
      <TopBar
        projectName={currentProject.customerName || 'Untitled Project'}
        lastSaved={lastSaved}
        activeTool={activeTool}
        onToolChange={setActiveTool}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={undo}
        onRedo={redo}
        gridVisible={gridVisible}
        onGridToggle={toggleGrid}
        onSave={handleSave}
        onExport={() => setExportDialogOpen(true)}
        onMenuClick={() => setMenuOpen(true)}
      />

      {/* Dialogs */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={handleExport}
      />

      <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all components?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all components from the canvas. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted-foreground">Additional options will appear here</p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Canvas - takes remaining space */}
      <main 
        className="flex-1 overflow-hidden relative"
        style={{ height: `calc(100vh - 60px - ${bottomPanelHeight}px)` }}
      >
        <Canvas activeTool={activeTool} />
      </main>

      {/* Bottom Panel */}
      <BottomPanel
        height={bottomPanelHeight}
        onHeightChange={setBottomPanelHeight}
        selectedComponent={selectedComponent}
        project={currentProject}
      />
    </div>
  );
};

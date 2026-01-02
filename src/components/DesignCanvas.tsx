import { useEffect, useState, useCallback, useRef } from 'react';
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
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useDesignStore } from '@/store/designStore';
import { toast } from 'sonner';
import { Canvas } from './Canvas';
import { TopBar } from './TopBar';
import { LeftToolbar } from './LeftToolbar';
import { BottomPanel } from './BottomPanel';
import { FloatingPropertiesCard } from './FloatingPropertiesCard';
import { FloatingKeyboardShortcuts } from './FloatingKeyboardShortcuts';
import { ExportDialog } from './ExportDialog';
import { ShareProjectDialog } from './ShareProjectDialog';
import { AddressAutocomplete } from './AddressAutocomplete';
import { exportToPDF } from '@/utils/pdfExport';
import { exportAsImage } from '@/utils/imageExport';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { geocodeAddress } from '@/utils/geocoding';
import type { ToolType, ExportOptions } from '@/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

export const DesignCanvas = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const initializedRef = useRef(false);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [selectedDecorationType, setSelectedDecorationType] = useState<'bush' | 'umbrella' | 'waterfeature' | 'deckchairs'>('bush');
  const [selectedFenceType, setSelectedFenceType] = useState<'glass' | 'metal'>('glass');
  const [selectedAreaType, setSelectedAreaType] = useState<'pavers' | 'concrete' | 'grass'>('pavers');
  const [selectedDrainageType, setSelectedDrainageType] = useState<'rock' | 'ultradrain'>('rock');
  const [selectedWallMaterial, setSelectedWallMaterial] = useState<'timber' | 'concrete' | 'concrete_sleeper' | 'sandstone'>('timber');

  const handleToolChange = (
    tool: ToolType,
    options?: {
      decorationType?: 'bush' | 'umbrella' | 'waterfeature' | 'deckchairs';
      fenceType?: 'glass' | 'metal';
      areaType?: 'pavers' | 'concrete' | 'grass';
      drainageType?: 'rock' | 'ultradrain';
      wallMaterial?: 'timber' | 'concrete' | 'concrete_sleeper' | 'sandstone';
    }
  ) => {
    console.log('DesignCanvas: Tool changing from', activeTool, 'to', tool);
    setActiveTool(tool);
    if (options?.decorationType) {
      setSelectedDecorationType(options.decorationType);
    }
    if (options?.fenceType) {
      setSelectedFenceType(options.fenceType);
    }
    if (options?.areaType) {
      setSelectedAreaType(options.areaType);
    }
    if (options?.drainageType) {
      setSelectedDrainageType(options.drainageType);
    }
    if (options?.wallMaterial) {
      setSelectedWallMaterial(options.wallMaterial);
    }
  };
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  // Start collapsed by default
  const [bottomPanelHeight, setBottomPanelHeight] = useState(40);
  const [menuOpen, setMenuOpen] = useState(false);

  // Project details form state
  const [editingCustomerName, setEditingCustomerName] = useState('');
  const [editingAddress, setEditingAddress] = useState('');
  const [editingCoordinates, setEditingCoordinates] = useState<{ lat: number; lng: number } | undefined>();
  const [editingNotes, setEditingNotes] = useState('');
  const [detailsErrors, setDetailsErrors] = useState<{ customerName?: string; address?: string }>({});
  const [detailsTouched, setDetailsTouched] = useState<{ customerName?: boolean; address?: boolean }>({});
  const [permission, setPermission] = useState<'view' | 'edit' | 'admin' | 'owner'>('owner');
  const [loading, setLoading] = useState(true);
  const [zoomState, setZoomState] = useState({
    zoom: 1,
    zoomLocked: false,
    handlers: {
      zoomIn: () => {},
      zoomOut: () => {},
      fitView: () => {},
      toggleLock: () => {},
    }
  });
  const [drawingState, setDrawingState] = useState({
    isDrawing: false,
    pointsCount: 0,
    isMeasuring: false,
    shiftPressed: false,
    measureStart: null as { x: number; y: number } | null,
    measureEnd: null as { x: number; y: number } | null,
    ghostDistance: null as number | null,
  });
  
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
    satelliteVisible,
    annotationsVisible,
    blueprintMode,
    toggleGrid,
    toggleSatellite,
    toggleAnnotations,
    toggleBlueprintMode,
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
      if (e.key === 'c' || e.key === 'C') setActiveTool('decoration');
      if (e.key === 'm' || e.key === 'M') setActiveTool('quick_measure');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [components]);

  useEffect(() => {
    if (id && user) {
      loadCloudProject(id);
    }
  }, [id, user]);

  const loadCloudProject = async (projectId: string) => {
    if (!user) return;

    try {
      // Check if user owns the project
      const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;

      if (!project) {
        toast.error('Project not found');
        navigate('/projects');
        return;
      }

      // Check permission
      if (project.owner_id === user.id) {
        setPermission('owner');
      } else {
        // Check if shared
        const { data: share } = await supabase
          .from('project_shares')
          .select('permission')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .is('revoked_at', null)
          .single();

        if (share) {
          setPermission(share.permission as any);
        } else {
          toast.error('You do not have access to this project');
          navigate('/projects');
          return;
        }
      }

      // Geocode address to get coordinates for satellite view
      let coordinates: { lat: number; lng: number } | undefined;
      if (project.address) {
        coordinates = (await geocodeAddress(project.address)) || undefined;
      }

      // Load project into store
      setCurrentProject({
        id: project.id,
        customerName: project.customer_name,
        address: project.address,
        coordinates, // Add geocoded coordinates
        notes: project.notes || '',
        createdAt: new Date(project.created_at),
        updatedAt: new Date(project.updated_at),
        components: (project.components as any) || [],
      });

      // View state (zoom/pan) is restored per-project by the store (session-based)

      setLastSaved(new Date(project.updated_at));
      setIsDirty(false);
      initializedRef.current = true;
      setLoading(false);
    } catch (error: any) {
      toast.error(error.message);
      navigate('/projects');
    }
  };

  // Auto-save to cloud - use ref to get latest components
  const componentsRef = useRef(components);
  useEffect(() => {
    componentsRef.current = components;
  }, [components]);

  // Auto-save function
  const autoSave = async () => {
    if (currentProject && user && id && permission !== 'view' && componentsRef.current) {
      try {
        const { error } = await supabase
          .from('projects')
          .update({
            customer_name: currentProject.customerName,
            address: currentProject.address,
            notes: currentProject.notes,
            components: componentsRef.current as any,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (error) throw error;
        setLastSaved(new Date());
        setIsDirty(false);
      } catch (error: any) {
        console.error('Auto-save failed:', error);
      }
    }
  };

  // Debounced auto-save on component changes (500ms delay after last edit)
  useEffect(() => {
    if (!initializedRef.current) return; // Skip initial render

    const timer = setTimeout(() => {
      autoSave();
    }, 500); // Save 500ms after last change

    return () => clearTimeout(timer);
  }, [components]);

  // Fallback: periodic auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(autoSave, 30000);
    return () => clearInterval(interval);
  }, [currentProject, user, id, permission]);

  // Track unsaved changes across project fields and components
  useEffect(() => {
    if (!initializedRef.current) return;
    setIsDirty(true);
  }, [components, currentProject?.customerName, currentProject?.address, currentProject?.notes]);

  const handleSave = async () => {
    if (!currentProject || !user || !id || permission === 'view') return;
    
    const latestComponents = componentsRef.current || components;
    
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          customer_name: currentProject.customerName,
          address: currentProject.address,
          notes: currentProject.notes,
          components: latestComponents as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      
      if (error) throw error;
      setLastSaved(new Date());
      setIsDirty(false);
      toast.success('Project saved');
    } catch (error: any) {
      console.error('Save failed:', error);
      toast.error('Save failed: ' + error.message);
    }
  };

  const handleBack = async () => {
    await handleSave(); // Wait for save to complete
    navigate('/projects');
  };

  // Warn before page unload only if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    if (isDirty) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
    return;
  }, [isDirty]);

  const handleExport = async (options: ExportOptions) => {
    if (!currentProject) return;
    
    console.log('Export options:', options);
    console.log('Export format:', options.format);
    
    // Get the canvas element from the Konva stage
    const stage = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement;
    if (!stage) {
      toast.error('Canvas not found');
      return;
    }

    try {
      if (options.format === 'pdf') {
        console.log('Exporting as PDF');
        await exportToPDF(currentProject, stage, options);
        toast.success('PDF exported successfully');
      } else {
        console.log('Exporting as image:', options.format);
        await exportAsImage(currentProject, stage, options);
        toast.success(`${options.format.toUpperCase()} exported successfully`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(`Failed to export ${options.format.toUpperCase()}`);
    }
  };

  const handleClearAll = () => {
    clearAll();
    setClearAllDialogOpen(false);
    toast.success('Canvas cleared');
  };

  // Initialize form when menu opens
  useEffect(() => {
    if (menuOpen && currentProject) {
      setEditingCustomerName(currentProject.customerName || '');
      setEditingAddress(currentProject.address || '');
      setEditingCoordinates(currentProject.coordinates);
      setEditingNotes(currentProject.notes || '');
      setDetailsErrors({});
      setDetailsTouched({});
    }
  }, [menuOpen, currentProject]);

  const validateDetailsField = (field: 'customerName' | 'address', value: string) => {
    if (field === 'customerName') {
      if (value.trim().length < 2) {
        return 'Customer name must be at least 2 characters';
      }
    }
    if (field === 'address') {
      if (value.trim().length < 5) {
        return 'Please select an address from the suggestions';
      }
      if (!editingCoordinates) {
        return 'Please select an address from the dropdown suggestions';
      }
    }
    return undefined;
  };

  const handleDetailsBlur = (field: 'customerName' | 'address') => {
    setDetailsTouched((prev) => ({ ...prev, [field]: true }));
    const value = field === 'customerName' ? editingCustomerName : editingAddress;
    const error = validateDetailsField(field, value);
    if (error) {
      setDetailsErrors((prev) => ({ ...prev, [field]: error }));
    } else {
      setDetailsErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleAddressChange = (newAddress: string, coords?: { lat: number; lng: number }) => {
    setEditingAddress(newAddress);
    setEditingCoordinates(coords);

    // Clear error if valid address with coordinates is selected
    if (coords && newAddress.trim().length >= 5) {
      setDetailsErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.address;
        return newErrors;
      });
    }
  };

  const handleSaveProjectDetails = async () => {
    if (!currentProject) return;

    // Validate all fields
    const newErrors: { customerName?: string; address?: string } = {};
    const customerNameError = validateDetailsField('customerName', editingCustomerName);
    const addressError = validateDetailsField('address', editingAddress);

    if (customerNameError) newErrors.customerName = customerNameError;
    if (addressError) newErrors.address = addressError;

    if (Object.keys(newErrors).length > 0) {
      setDetailsErrors(newErrors);
      setDetailsTouched({ customerName: true, address: true });
      return;
    }

    try {
      // Update local state
      const updatedProject = {
        ...currentProject,
        customerName: editingCustomerName.trim(),
        address: editingAddress.trim(),
        coordinates: editingCoordinates,
        notes: editingNotes.trim() || undefined,
      };

      setCurrentProject(updatedProject);

      // If cloud project, update in Supabase
      if (user && id) {
        const { error } = await supabase
          .from('projects')
          .update({
            customer_name: editingCustomerName.trim(),
            address: editingAddress.trim(),
            notes: editingNotes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (error) throw error;

        // Log activity
        await supabase.from('activity_log').insert({
          project_id: id,
          user_id: user.id,
          action: 'updated',
          details: { field: 'project_details' },
        });
      }

      toast.success('Project details updated');
      setLastSaved(new Date());
    } catch (error: any) {
      console.error('Failed to update project details:', error);
      toast.error('Failed to update project details');
    }
  };

  const handleZoomChange = useCallback((zoom: number, zoomLocked: boolean, handlers: any) => {
    setZoomState({ zoom, zoomLocked, handlers });
  }, []);

  const handleDrawingStateChange = useCallback((
    isDrawing: boolean,
    pointsCount: number,
    isMeasuring: boolean,
    shiftPressed: boolean,
    measureStart: { x: number; y: number } | null,
    measureEnd: { x: number; y: number } | null,
    ghostDistance: number | null
  ) => {
    setDrawingState({ isDrawing, pointsCount, isMeasuring, shiftPressed, measureStart, measureEnd, ghostDistance });
  }, []);

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
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={undo}
        onRedo={redo}
        gridVisible={gridVisible}
        satelliteVisible={satelliteVisible}
        annotationsVisible={annotationsVisible}
        blueprintMode={blueprintMode}
        onGridToggle={toggleGrid}
        onSatelliteToggle={toggleSatellite}
        onAnnotationsToggle={toggleAnnotations}
        onBlueprintToggle={toggleBlueprintMode}
        onSave={handleSave}
        onShare={permission === 'owner' ? () => setShareDialogOpen(true) : undefined}
        onExport={() => setExportDialogOpen(true)}
        onMenuClick={() => setMenuOpen(true)}
      />

      {/* Main content area with left toolbar and canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar */}
        <LeftToolbar
          activeTool={activeTool}
          components={components}
          onToolChange={handleToolChange}
        />

        {/* Right side: Canvas and Bottom Panel */}
        <div className="flex-1 flex flex-col relative">
          {/* Canvas - takes remaining space */}
          <main
            className="flex-1 overflow-hidden relative"
            style={{ height: `calc(100vh - 60px - ${bottomPanelHeight}px)` }}
          >
            <Canvas
              activeTool={activeTool}
              selectedDecorationType={selectedDecorationType}
              selectedFenceType={selectedFenceType}
              selectedAreaType={selectedAreaType}
              selectedDrainageType={selectedDrainageType}
              selectedWallMaterial={selectedWallMaterial}
              onZoomChange={handleZoomChange}
              onDrawingStateChange={handleDrawingStateChange}
              onToolChange={handleToolChange}
            />

            {/* Floating Properties Card */}
            <FloatingPropertiesCard component={selectedComponent} />
          </main>

          {/* Floating Keyboard Shortcuts - positioned above bottom panel */}
          <div
            className="absolute left-1/2 transform -translate-x-1/2 z-50 pointer-events-none"
            style={{ bottom: `${bottomPanelHeight + 16}px` }}
          >
            <FloatingKeyboardShortcuts
              activeTool={activeTool}
              hasSelection={!!selectedComponentId}
              selectedComponentType={selectedComponent?.type}
            />
          </div>

          {/* Bottom Panel */}
          <BottomPanel
            height={bottomPanelHeight}
            onHeightChange={setBottomPanelHeight}
            project={currentProject}
            zoom={zoomState.zoom}
            zoomLocked={zoomState.zoomLocked}
            onZoomIn={zoomState.handlers.zoomIn}
            onZoomOut={zoomState.handlers.zoomOut}
            onFitView={zoomState.handlers.fitView}
            onToggleZoomLock={zoomState.handlers.toggleLock}
            isDrawing={drawingState.isDrawing}
            drawingPointsCount={drawingState.pointsCount}
            isMeasuring={drawingState.isMeasuring}
            shiftPressed={drawingState.shiftPressed}
            measureStart={drawingState.measureStart}
            measureEnd={drawingState.measureEnd}
            ghostDistance={drawingState.ghostDistance}
          />
        </div>
      </div>

      {/* Dialogs */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={handleExport}
      />

      {currentProject.id && permission === 'owner' && (
        <ShareProjectDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          project={{
            id: currentProject.id,
            customer_name: currentProject.customerName || 'Untitled Project',
          }}
        />
      )}

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

      <Sheet open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
        <SheetContent className="overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <SheetHeader>
            <SheetTitle>Project Settings</SheetTitle>
          </SheetHeader>

          {/* Project Details Form */}
          <div className="mt-6 space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-3">Project Details</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="menu-customerName">
                    Customer Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="menu-customerName"
                    value={editingCustomerName}
                    onChange={(e) => setEditingCustomerName(e.target.value)}
                    onBlur={() => handleDetailsBlur('customerName')}
                    placeholder="John Smith"
                    className={detailsTouched.customerName && detailsErrors.customerName ? 'border-destructive' : ''}
                  />
                  {detailsTouched.customerName && detailsErrors.customerName && (
                    <p className="text-sm text-destructive">{detailsErrors.customerName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="menu-address">
                    Property Address <span className="text-destructive">*</span>
                  </Label>
                  <AddressAutocomplete
                    value={editingAddress}
                    onChange={handleAddressChange}
                    onBlur={() => handleDetailsBlur('address')}
                    placeholder="Start typing to search..."
                    className={detailsTouched.address && detailsErrors.address ? 'border-destructive' : ''}
                    error={detailsTouched.address && !!detailsErrors.address}
                  />
                  {detailsTouched.address && detailsErrors.address && (
                    <p className="text-sm text-destructive">{detailsErrors.address}</p>
                  )}
                  {editingCoordinates && (
                    <p className="text-xs text-muted-foreground">✓ Valid address selected</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="menu-notes">Project Notes</Label>
                  <Textarea
                    id="menu-notes"
                    value={editingNotes}
                    onChange={(e) => setEditingNotes(e.target.value)}
                    placeholder="Empire pool, glass fencing..."
                    rows={3}
                  />
                </div>

                <Button
                  onClick={handleSaveProjectDetails}
                  className="w-full"
                >
                  Save Changes
                </Button>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Actions */}
            <div>
              <h3 className="text-sm font-medium mb-3">Actions</h3>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  setMenuOpen(false);
                  setClearAllDialogOpen(true);
                }}
              >
                Clear All Components
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

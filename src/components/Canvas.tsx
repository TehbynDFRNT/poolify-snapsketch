import { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Line, Circle, Text, Label, Tag, Group, Rect } from 'react-konva';
import { useDesignStore } from '@/store/designStore';
import { GRID_CONFIG } from '@/constants/grid';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize, Lock, Unlock } from 'lucide-react';
import { PoolComponent } from './canvas/PoolComponent';
import { PaverComponent } from './canvas/PaverComponent';
import { DrainageComponent } from './canvas/DrainageComponent';
import { FenceComponent } from './canvas/FenceComponent';
import { WallComponent } from './canvas/WallComponent';
import { BoundaryComponent } from './canvas/BoundaryComponent';
import { HouseComponent } from './canvas/HouseComponent';
import { ReferenceLineComponent } from './canvas/ReferenceLineComponent';
import { PavingAreaComponent } from './canvas/PavingAreaComponent';
import { GateComponent } from './canvas/GateComponent';
import { DecorationComponent, getDecorationDimensions } from './canvas/DecorationComponent';
import { HeightComponent } from './canvas/HeightComponent';
import { SatelliteLayer } from './canvas/SatelliteLayer';
import { validateBoundary } from '@/utils/pavingFill';
import { snapToGrid, smartSnap } from '@/utils/snap';
import { toast } from 'sonner';
import { PAVER_SIZES } from '@/constants/components';
import { PoolSelector } from './PoolSelector';
import { Pool } from '@/constants/pools';
import { lockToAxis, detectAxisLock, calculateDistance } from '@/utils/canvas';
import type { ToolType, Component } from '@/types';
import { WALL_MATERIALS, FENCE_TYPES, DRAINAGE_TYPES } from '@/constants/components';
import { sortComponentsByRenderOrder } from '@/constants/renderOrder';
import { ComponentContextMenu } from './ComponentContextMenu';
import type { ContextMenuAction } from '@/types/contextMenu';
import { useDesignStore as useStoreRef } from '@/store/designStore';
import { CompassRotator } from './CompassRotator';

export const Canvas = ({
  activeTool = 'select',
  selectedDecorationType = 'bush',
  selectedFenceType = 'glass',
  selectedAreaType = 'pavers',
  selectedDrainageType = 'rock',
  selectedWallMaterial = 'timber',
  onZoomChange,
  onZoomLockedChange,
  onDrawingStateChange,
  onToolChange,
}: {
  activeTool?: string;
  selectedDecorationType?: 'bush' | 'umbrella' | 'waterfeature' | 'deckchairs';
  selectedFenceType?: 'glass' | 'metal';
  selectedAreaType?: 'pavers' | 'concrete' | 'grass';
  selectedDrainageType?: 'rock' | 'ultradrain';
  selectedWallMaterial?: 'timber' | 'concrete' | 'concrete_sleeper' | 'sandstone';
  onZoomChange?: (zoom: number, locked: boolean, handlers: {
    zoomIn: () => void;
    zoomOut: () => void;
    fitView: () => void;
    toggleLock: () => void;
  }) => void;
  onZoomLockedChange?: (locked: boolean) => void;
  onDrawingStateChange?: (isDrawing: boolean, pointsCount: number, isMeasuring: boolean, shiftPressed: boolean, measureStart: any, measureEnd: any, ghostDistance: number | null) => void;
  onToolChange?: (tool: ToolType) => void;
}) => {
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [showPoolSelector, setShowPoolSelector] = useState(false);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [pendingPoolPosition, setPendingPoolPosition] = useState<{ x: number; y: number } | null>(null);

  // Pinch zoom state
  const lastPinchDistRef = useRef<number | null>(null);
  const lastPinchCenterRef = useRef<{ x: number; y: number } | null>(null);

  // Track active touch count to prevent component dragging during two-finger gestures
  const activeTouchCountRef = useRef<number>(0);
  
  // Drawing state for boundary, house, paving area, and linear tools (wall/fence/drainage)
  const [drawingPoints, setDrawingPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [ghostPoint, setGhostPoint] = useState<{ x: number; y: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Boundary extension state - allows extending an existing open boundary from its endpoints
  const [extensionState, setExtensionState] = useState<{
    componentId: string;
    endpoint: 'first' | 'last';
    originalPoints: Array<{ x: number; y: number }>;
  } | null>(null);

  // When extending, treat drawing as if boundary tool is active
  const effectiveDrawingTool = extensionState ? 'boundary' : activeTool;

  // Measurement tool states
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureEnd, setMeasureEnd] = useState<{ x: number; y: number } | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  // shiftPressed from store (for touch device toggle support - used for node editing)
  // keyboardShiftPressed is local state for canvas panning only (don't want touch toggle to enable pan)
  const [keyboardShiftPressed, setKeyboardShiftPressed] = useState(false);

  // Universal context menu state
  const [contextMenuState, setContextMenuState] = useState<{ open: boolean; x: number; y: number; component: Component | null }>({
    open: false,
    x: 0,
    y: 0,
    component: null
  });

  // Removed fence tool right-click menu; handled on TopBar now

  // Coping tile context menu (HTML overlay outside Stage)
  const [tileMenuState, setTileMenuState] = useState<{ open: boolean; x: number; y: number; component: Component | null; tileKey: string | null }>({
    open: false,
    x: 0,
    y: 0,
    component: null,
    tileKey: null,
  });
  
  const {
    zoom,
    setZoom,
    pan,
    setPan,
    gridVisible,
    satelliteVisible,
    satelliteRotation,
    setSatelliteRotation,
    zoomLocked,
    toggleZoomLock,
    components,
    selectedComponentId,
    selectComponent,
    addComponent,
    updateComponent,
    deleteComponent,
    currentProject,
    shiftPressed,
    setShiftPressed,
  } = useDesignStore();

  // Removed global clip wrapper; components render un-clipped

  // Zoom handlers - memoized to prevent infinite loops
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(zoom * 1.2, 4);
    setZoom(newZoom);
  }, [zoom, setZoom]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(zoom / 1.2, 0.1);
    setZoom(newZoom);
  }, [zoom, setZoom]);

  const handleFitView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [setZoom, setPan]);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateDimensions();
    
    // Watch for window resize
    window.addEventListener('resize', updateDimensions);
    
    // Watch for container size changes (e.g., when properties panel collapses)
    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
      resizeObserver.disconnect();
    };
  }, []);

  // Notify parent about zoom state and handlers
  useEffect(() => {
    if (onZoomChange) {
      onZoomChange(zoom, zoomLocked, {
        zoomIn: handleZoomIn,
        zoomOut: handleZoomOut,
        fitView: handleFitView,
        toggleLock: toggleZoomLock,
      });
    }
  }, [zoom, zoomLocked, handleZoomIn, handleZoomOut, handleFitView, toggleZoomLock, onZoomChange]);

  // Notify parent about drawing state
  useEffect(() => {
    if (onDrawingStateChange) {
      // Calculate ghost line distance for drawing tools
      let ghostDistance = null;
      if (isDrawing && drawingPoints.length > 0 && ghostPoint) {
        const lastPoint = drawingPoints[drawingPoints.length - 1];
        ghostDistance = calculateDistance(lastPoint, ghostPoint);
      }
      
      onDrawingStateChange(isDrawing, drawingPoints.length, isMeasuring, shiftPressed, measureStart, measureEnd, ghostDistance);
    }
  }, [isDrawing, drawingPoints.length, isMeasuring, shiftPressed, measureStart, measureEnd, ghostPoint, onDrawingStateChange]);

  const handleMouseMove = (e: any) => {
    const isPolylineTool =
      activeTool === 'boundary' ||
      activeTool === 'house' ||
      activeTool === 'paving_area' ||
      activeTool === 'area' ||
      activeTool === 'wall' ||
      activeTool === 'fence' ||
      activeTool === 'drainage' ||
      !!extensionState;

    if (isPolylineTool) {
      const pos = e.target.getStage().getPointerPosition();
      const canvasX = (pos.x - pan.x) / zoom;
      const canvasY = (pos.y - pan.y) / zoom;
      
      if (drawingPoints.length > 0) {
        const lastPoint = drawingPoints[drawingPoints.length - 1];
        let snappedPoint = smartSnap(
          { x: canvasX, y: canvasY },
          components
        );

        // Apply shift key axis locking if pressed
        if (shiftPressed && drawingPoints.length > 0) {
          snappedPoint = { ...lockToAxis(lastPoint, { x: snappedPoint.x, y: snappedPoint.y }), snappedTo: null };
        }

        setGhostPoint(snappedPoint);
      } else {
        setGhostPoint({ x: canvasX, y: canvasY });
      }
    }
    
    // Update measurement end point for measuring tools (no snapping)
    if (activeTool === 'quick_measure' && measureStart) {
      const pos = e.target.getStage().getPointerPosition();
      const canvasX = (pos.x - pan.x) / zoom;
      const canvasY = (pos.y - pan.y) / zoom;
      
      // Free measurement end point; only apply axis lock with Shift
      let endPoint = { x: canvasX, y: canvasY };
      
      // Apply shift key axis locking
      if (shiftPressed) {
        endPoint = lockToAxis(measureStart, endPoint);
      }
      
      setMeasureEnd(endPoint);
    }
  };

  // Check if point is near first point for auto-close
  const isNearFirstPoint = (point: { x: number; y: number }) => {
    if (drawingPoints.length === 0) return false;
    const first = drawingPoints[0];
    const distance = Math.sqrt(
      Math.pow(point.x - first.x, 2) + Math.pow(point.y - first.y, 2)
    );
    return distance < 15;
  };

  const handleStageClick = (e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;

    const canvasX = (pos.x - pan.x) / zoom;
    const canvasY = (pos.y - pan.y) / zoom;
    // Default grid snap
    const snapped = {
      x: snapToGrid(canvasX),
      y: snapToGrid(canvasY),
    };

    // Helper to handle clicks as if on empty background (used by overlay too)
    const handleBackgroundPrimaryClick = (x: number, y: number) => {
      // Handle drawing tools (polyline)
      const isPolylineTool =
        activeTool === 'boundary' ||
        activeTool === 'house' ||
        activeTool === 'paving_area' ||
        activeTool === 'wall' ||
        activeTool === 'fence' ||
        activeTool === 'drainage';

      if (isPolylineTool) {
        // Prevent starting a new boundary if one already exists
        if (activeTool === 'boundary' && drawingPoints.length === 0) {
          const alreadyHasBoundary = components.some(c => c.type === 'boundary');
          if (alreadyHasBoundary) {
            toast.error('Only one boundary is allowed');
            onToolChange?.('select');
            return;
          }
        }
        // Smart snap for all polyline tools
        const smart = smartSnap({ x, y }, components);
        let pointToAdd = { x: smart.x, y: smart.y };

        // Apply axis lock commit when Shift is pressed and we have a prior point
        if (shiftPressed && drawingPoints.length > 0) {
          const last = drawingPoints[drawingPoints.length - 1];
          const locked = lockToAxis(last, pointToAdd);
          pointToAdd = { x: locked.x, y: locked.y };
        }

        // Check if clicking near first point to close
        if (
          (activeTool === 'boundary' || activeTool === 'house' || activeTool === 'paving_area') &&
          drawingPoints.length >= 3 &&
          isNearFirstPoint(pointToAdd)
        ) {
          // Close the shape
          finishDrawing(true);
          return;
        }

        // Add point to drawing
        setDrawingPoints([...drawingPoints, pointToAdd]);
        setIsDrawing(true);
        return;
      }

      // Deselect in select mode
      if (activeTool === 'select') {
        selectComponent(null);
        return;
      }

      // Show pool selector for pool tool
      if (activeTool === 'pool') {
        setPendingPoolPosition({ x: snapToGrid(x), y: snapToGrid(y) });
        setShowPoolSelector(true);
        return;
      }

      // Place component for one-click tools (paver, gate, decoration, height)
      if (activeTool !== 'hand' && (activeTool === 'paver' || activeTool === 'gate' || activeTool === 'decoration' || activeTool === 'height')) {
        selectComponent(null);
        if (activeTool === 'paver' || activeTool === 'decoration' || activeTool === 'height') {
          handleToolPlace({ x: snapToGrid(x), y: snapToGrid(y) });
        } else if (activeTool === 'gate') {
          addComponent({
            type: 'gate',
            position: { x: snapToGrid(x), y: snapToGrid(y) },
            rotation: 0,
            dimensions: { width: 1000, height: 0 },
            properties: { length: 1000, gateType: 'glass' },
          });
          onToolChange?.('select');
        }
        return;
      }
    };

    // Always handle measurement tools regardless of click target (allow over shapes)
    if (activeTool === 'quick_measure') {
      if (!isMeasuring) {
        // Start measuring (no snap)
        setMeasureStart({ x: canvasX, y: canvasY });
        setMeasureEnd({ x: canvasX, y: canvasY });
        setIsMeasuring(true);
      } else {
        // Finish measuring
        if (measureStart && measureEnd) {
          let finalEnd = measureEnd;

          // Apply axis lock if Shift is pressed
          if (shiftPressed) {
            finalEnd = lockToAxis(measureStart, measureEnd);
          }

          const distance = calculateDistance(measureStart, finalEnd);
          const locked = shiftPressed ? detectAxisLock(measureStart, finalEnd) : null;

          // Create the component
          const component = {
            type: 'quick_measure' as const,
            position: { x: 0, y: 0 },
            rotation: 0,
            dimensions: { width: 0, height: 0 },
            properties: {
              points: [measureStart, finalEnd],
              measurement: distance,
              style: {
                color: '#dc2626',
                dashed: false,
                lineWidth: 2,
                arrowEnds: true,
              },
              locked,
              showMeasurement: true,
              exportToPDF: true,
              temporary: false,
              createdAt: Date.now(),
            },
          };

          addComponent(component);
        }

        setMeasureStart(null);
        setMeasureEnd(null);
        setIsMeasuring(false);
        onToolChange?.('select');
      }
      return;
    }

    // Handle clicks during boundary extension mode
    if (extensionState && isDrawing) {
      const smart = smartSnap({ x: canvasX, y: canvasY }, components);
      let pointToAdd = { x: smart.x, y: smart.y };

      if (shiftPressed && drawingPoints.length > 0) {
        const last = drawingPoints[drawingPoints.length - 1];
        const locked = lockToAxis(last, pointToAdd);
        pointToAdd = { x: locked.x, y: locked.y };
      }

      setDrawingPoints([...drawingPoints, pointToAdd]);
      return;
    }

    // For other tools, only handle clicks on empty canvas area
    if (e.target === stage) {
      handleBackgroundPrimaryClick(canvasX, canvasY);
    }
  };

  // Finish drawing and create component(s)
  const finishDrawing = (closed: boolean) => {
    if (drawingPoints.length < 2) {
      setDrawingPoints([]);
      setIsDrawing(false);
      return;
    }

    if (activeTool === 'paving_area') {
      // Simplified area-based system - no tile calculation needed
      addComponent({
        type: 'paving_area',
        position: { x: 0, y: 0 },
        rotation: 0,
        dimensions: { width: 0, height: 0 },
        properties: {
          boundary: drawingPoints,
          areaSurface: selectedAreaType, // 'pavers', 'concrete', or 'grass'
        },
      });
      setDrawingPoints([]);
      setIsDrawing(false);
      setGhostPoint(null);
      toast.success('Area created');
      onToolChange?.('select');
      return;
    }

    if (activeTool === 'house') {
      // Enforce closed polygons for house only
      if (!closed) {
        toast.error('House must be closed - click near the starting point to finish');
        return;
      }
    }

    if (activeTool === 'boundary' || activeTool === 'house') {
      // Only allow a single boundary component in the project
      if (activeTool === 'boundary') {
        const alreadyHasBoundary = components.some(c => c.type === 'boundary');
        if (alreadyHasBoundary) {
          toast.error('Only one boundary is allowed');
          setDrawingPoints([]);
          setIsDrawing(false);
          setGhostPoint(null);
          onToolChange?.('select');
          return;
        }
      }

      // Calculate area for house
      let area = 0;
      if (closed && activeTool === 'house' && drawingPoints.length >= 3) {
        // Shoelace formula
        for (let i = 0; i < drawingPoints.length; i++) {
          const j = (i + 1) % drawingPoints.length;
          area += drawingPoints[i].x * drawingPoints[j].y;
          area -= drawingPoints[j].x * drawingPoints[i].y;
        }
        area = Math.abs(area) / 2;
        // Convert to m² (10 pixels = 100mm = 0.1m, so 1 pixel² = 0.01m²)
        area = area * 0.01;
      }

      addComponent({
        type: activeTool as 'boundary' | 'house',
        position: { x: 0, y: 0 },
        rotation: 0,
        dimensions: { width: 0, height: 0 },
        properties: {
          points: drawingPoints,
          closed,
          ...(activeTool === 'house' && { area }),
        },
      });
    } else if (activeTool === 'wall' || activeTool === 'fence' || activeTool === 'drainage') {
      // Create a single polyline component for the entire drawing
      if (drawingPoints.length < 2) return;
      const baseProps: any = { points: drawingPoints };
      if (activeTool === 'wall') {
        addComponent({
          type: 'wall',
          position: { x: 0, y: 0 },
          rotation: 0,
          dimensions: { width: 0, height: 0 },
          properties: {
            wallMaterial: selectedWallMaterial,
            ...baseProps,
          },
        });
      } else if (activeTool === 'fence') {
        addComponent({
          type: 'fence',
          position: { x: 0, y: 0 },
          rotation: 0,
          dimensions: { width: 0, height: 0 },
          properties: {
            fenceType: selectedFenceType as 'glass' | 'metal',
            gates: [],
            ...baseProps,
          },
        });
      } else if (activeTool === 'drainage') {
        addComponent({
          type: 'drainage',
          position: { x: 0, y: 0 },
          rotation: 0,
          dimensions: { width: 0, height: 0 },
          properties: {
            drainageType: selectedDrainageType,
            length: 0,
            ...baseProps,
          },
        });
      }
    }

    setDrawingPoints([]);
    setIsDrawing(false);
    setGhostPoint(null);
    onToolChange?.('select');
  };

  // Finish boundary extension — merge new points into existing boundary
  const finishExtension = () => {
    if (!extensionState || drawingPoints.length < 2) {
      cancelExtension();
      return;
    }

    const comp = components.find(c => c.id === extensionState.componentId);
    if (!comp) {
      cancelExtension();
      return;
    }

    // drawingPoints[0] is the anchor (existing endpoint), so new points are slice(1)
    const newPoints = drawingPoints.slice(1);
    if (newPoints.length === 0) {
      cancelExtension();
      return;
    }

    const existingPoints = extensionState.originalPoints;
    let mergedPoints: Array<{ x: number; y: number }>;

    if (extensionState.endpoint === 'last') {
      mergedPoints = [...existingPoints, ...newPoints];
    } else {
      // Extending from first: new points were drawn outward from first point,
      // so reverse them and prepend
      mergedPoints = [...newPoints.reverse(), ...existingPoints];
    }

    updateComponent(extensionState.componentId, {
      properties: { ...comp.properties, points: mergedPoints },
    });

    // Clean up and re-select
    const compId = extensionState.componentId;
    setExtensionState(null);
    setDrawingPoints([]);
    setIsDrawing(false);
    setGhostPoint(null);
    selectComponent(compId);
  };

  // Cancel boundary extension without modifying the boundary
  const cancelExtension = () => {
    setExtensionState(null);
    setDrawingPoints([]);
    setIsDrawing(false);
    setGhostPoint(null);
  };

  // Keyboard shortcuts for drawing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }

      // Track Shift key - set both store (for node editing) and local (for panning)
      if (e.key === 'Shift') {
        setShiftPressed(true);
        setKeyboardShiftPressed(true);
      }

      // Arrow key movement for simple positioned objects only
      if (selectedComponentId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const selectedComponent = components.find(c => c.id === selectedComponentId);
        if (!selectedComponent) return;
        const hasPoints = selectedComponent.properties?.points && Array.isArray(selectedComponent.properties.points);
        const hasBoundary = selectedComponent.properties?.boundary && Array.isArray(selectedComponent.properties.boundary);
        if (hasPoints || hasBoundary) {
          // Let global keyboard hook handle polyline/paving movement
          return;
        }
        e.preventDefault();
        const moveAmount = e.shiftKey ? 25 : 2.5; // mm
        let dx = 0;
        let dy = 0;
        switch (e.key) {
          case 'ArrowUp': dy = -moveAmount; break;
          case 'ArrowDown': dy = moveAmount; break;
          case 'ArrowLeft': dx = -moveAmount; break;
          case 'ArrowRight': dx = moveAmount; break;
        }
        updateComponent(selectedComponentId, {
          position: { x: selectedComponent.position.x + dx, y: selectedComponent.position.y + dy },
        });
        return;
      }

      // Zoom lock toggle (L key)
      if (e.key === 'l' && !e.ctrlKey && !e.metaKey && !isDrawing && !isMeasuring) {
        e.preventDefault();
        toggleZoomLock();
      }

      // Extension mode shortcuts (takes priority over normal drawing shortcuts)
      if (extensionState && isDrawing) {
        if (e.key === 'Enter') {
          e.preventDefault();
          finishExtension();
          return;
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelExtension();
          return;
        } else if (e.key === 'z' && drawingPoints.length > 1) {
          // Undo last extension point but can't remove the anchor
          e.preventDefault();
          setDrawingPoints(drawingPoints.slice(0, -1));
          return;
        }
      }

      // Drawing shortcuts
      if (isDrawing && !extensionState) {
        if (e.key === 'Enter') {
          if (activeTool === 'boundary') {
            // Allow boundary to finish as open polyline (2+ points) or closed shape (3+ points near start)
            if (drawingPoints.length >= 2) {
              finishDrawing(false); // Finish as open polyline
            } else {
              toast.error('Add at least 2 points to create the boundary');
            }
            return;
          }
          // For paving areas, require minimum 3 points
          if (activeTool === 'paving_area' && drawingPoints.length < 3) {
            toast.error('Paving area requires at least 3 points');
            return;
          }
          finishDrawing(true);
        } else if (e.key === 'Escape') {
          setDrawingPoints([]);
          setIsDrawing(false);
          setGhostPoint(null);
        } else if (e.key === 'z' && drawingPoints.length > 0) {
          setDrawingPoints(drawingPoints.slice(0, -1));
        }
      }
      
      // Measurement shortcuts
      if (isMeasuring && e.key === 'Escape') {
        setMeasureStart(null);
        setMeasureEnd(null);
        setIsMeasuring(false);
      }

      // Escape always resets to select tool (handles stuck shift-pan, hand tool, etc.)
      if (e.key === 'Escape') {
        // Cancel extension if active
        if (extensionState) {
          cancelExtension();
        }
        // Clear any drawing/measuring state
        setDrawingPoints([]);
        setIsDrawing(false);
        setGhostPoint(null);
        setMeasureStart(null);
        setMeasureEnd(null);
        setIsMeasuring(false);
        // Always switch back to select tool
        onToolChange?.('select');
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setShiftPressed(false);
        setKeyboardShiftPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isDrawing, drawingPoints, isMeasuring, toggleZoomLock, selectedComponentId, components, updateComponent, extensionState]);

  // Reset drawing when tool changes
  useEffect(() => {
    // Cancel extension if tool changes away from select
    if (extensionState && activeTool !== 'select') {
      cancelExtension();
    }
    if (
      activeTool !== 'boundary' &&
      activeTool !== 'house' &&
      activeTool !== 'paving_area' &&
      activeTool !== 'area' &&
      activeTool !== 'wall' &&
      activeTool !== 'fence' &&
      activeTool !== 'drainage' &&
      !extensionState
    ) {
      setDrawingPoints([]);
      setIsDrawing(false);
      setGhostPoint(null);
    }
    if (activeTool !== 'quick_measure') {
      setMeasureStart(null);
      setMeasureEnd(null);
      setIsMeasuring(false);
    }
  }, [activeTool]);

  const handlePoolSelected = (pool: Pool, copingOptions: { showCoping: boolean; copingConfig?: any; copingCalculation?: any }) => {
    if (pendingPoolPosition) {
      addComponent({
        type: 'pool',
        position: pendingPoolPosition,
        rotation: 0,
        dimensions: { width: pool.length, height: pool.width },
        properties: {
          poolId: pool.id,
          pool, // embed full geometry to avoid library mismatch
          showCoping: copingOptions.showCoping,
          copingConfig: copingOptions.copingConfig,
          copingCalculation: copingOptions.copingCalculation,
        },
      });
      setPendingPoolPosition(null);
      onToolChange?.('select');
    }
  };

  // Removed pool right-click extend handler

  // Universal component context menu handler
  const handleComponentContextMenu = (component: Component, screenPos: { x: number; y: number }) => {
    setContextMenuState({
      open: true,
      x: screenPos.x,
      y: screenPos.y,
      component
    });
  };

  const handleContextMenuAction = (action: ContextMenuAction, data?: any) => {
    if (!contextMenuState.component) return;

    switch (action) {
      case 'delete':
        deleteComponent(contextMenuState.component.id);
        break;

      case 'add_annotation':
        updateComponent(contextMenuState.component.id, {
          properties: {
            ...contextMenuState.component.properties,
            annotation: data
          }
        });
        break;

      case 'duplicate':
        // TODO: Implement duplicate functionality
        toast.info('Duplicate feature coming soon');
        break;

      case 'bring_to_front':
        // TODO: Implement bring to front
        toast.info('Bring to front feature coming soon');
        break;

      case 'send_to_back':
        // TODO: Implement send to back
        toast.info('Send to back feature coming soon');
        break;
    }
  };

  const handleContextMenuClose = () => {
    setContextMenuState({ open: false, x: 0, y: 0, component: null });
  };

  // Removed extend-from-pool finalize

  const handleToolPlace = (pos: { x: number; y: number }) => {
    switch (activeTool) {
      // Pool is handled by selector, so skip here
      case 'pool':
        break;
        
      case 'paver':
        addComponent({
          type: 'paver',
          position: pos,
          rotation: 0,
          dimensions: { width: 400, height: 400 },
          properties: {
            paverSize: '400x400',
            paverCount: { rows: 1, cols: 1 },
          },
        });
        onToolChange?.('select');
        break;
        
      case 'drainage':
        addComponent({
          type: 'drainage',
          position: pos,
          rotation: 0,
          dimensions: { width: 1000, height: 100 },
          properties: {
            drainageType: selectedDrainageType,
            length: 1000,
          },
        });
        onToolChange?.('select');
        break;
        
      case 'fence':
        addComponent({
          type: 'fence',
          position: pos,
          rotation: 0,
          dimensions: { width: 100, height: 12 },
          properties: {
            fenceType: selectedFenceType as 'glass' | 'metal',
            gates: [],
          },
        });
        onToolChange?.('select');
        break;
        
      case 'wall':
        addComponent({
          type: 'wall',
          position: pos,
          rotation: 0,
          dimensions: { width: 100, height: 15 },
          properties: {
            wallMaterial: selectedWallMaterial,
          },
        });
        onToolChange?.('select');
        break;

      case 'decoration':
        // Apply 1:0.35 scale: 1px = 0.35mm (100px = 35mm)
        const decorationDimensions = getDecorationDimensions(selectedDecorationType);
        addComponent({
          type: 'decoration',
          position: pos,
          rotation: 0,
          dimensions: {
            width: decorationDimensions.width,
            height: decorationDimensions.height,
          },
          properties: {
            decorationType: selectedDecorationType,
          },
        });
        onToolChange?.('select');
        break;

      case 'height':
        addComponent({
          type: 'height',
          position: pos,
          rotation: 0,
          dimensions: { width: 0, height: 0 },
          properties: {
            heightValue: 100, // Default 100mm
            heightAnnotation: '',
          },
        });
        onToolChange?.('select');
        break;
    }
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();

    // Don't zoom if locked
    if (zoomLocked) return;

    const scaleBy = 1.05;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    const clampedScale = Math.max(0.1, Math.min(4, newScale));

    setZoom(clampedScale);

    const newPos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    };

    setPan(newPos);
  };

  // Two-finger gesture handlers for touch devices (pan + pinch zoom)
  const handleTouchMove = (e: any) => {
    const touches = e.evt.touches;
    activeTouchCountRef.current = touches?.length || 0;

    if (touches.length !== 2) return;

    e.evt.preventDefault();

    const touch1 = touches[0];
    const touch2 = touches[1];

    // Calculate distance between touches (for pinch zoom)
    const dist = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );

    // Calculate center point (for pan)
    const centerX = (touch1.clientX + touch2.clientX) / 2;
    const centerY = (touch1.clientY + touch2.clientY) / 2;

    if (lastPinchDistRef.current !== null && lastPinchCenterRef.current !== null) {
      const stage = stageRef.current;
      if (!stage) return;

      // Get container rect for proper coordinates
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Calculate pan delta from center point movement
      const panDeltaX = centerX - lastPinchCenterRef.current.x;
      const panDeltaY = centerY - lastPinchCenterRef.current.y;

      // Handle pinch zoom if not locked
      if (!zoomLocked) {
        const oldScale = zoom;
        const scaleBy = dist / lastPinchDistRef.current;
        const newScale = Math.max(0.1, Math.min(4, oldScale * scaleBy));

        const pointerX = centerX - rect.left;
        const pointerY = centerY - rect.top;

        const mousePointTo = {
          x: (pointerX - pan.x) / oldScale,
          y: (pointerY - pan.y) / oldScale,
        };

        setZoom(newScale);
        setPan({
          x: pointerX - mousePointTo.x * newScale + panDeltaX,
          y: pointerY - mousePointTo.y * newScale + panDeltaY,
        });
      } else {
        // Just pan if zoom is locked
        setPan({
          x: pan.x + panDeltaX,
          y: pan.y + panDeltaY,
        });
      }
    }

    lastPinchDistRef.current = dist;
    lastPinchCenterRef.current = { x: centerX, y: centerY };
  };

  // Touch start handler - track touch count and stop component drags on multi-touch
  const handleTouchStart = (e: any) => {
    const touchCount = e.evt.touches?.length || 0;
    activeTouchCountRef.current = touchCount;

    // If two or more touches, stop any ongoing component drag
    if (touchCount >= 2) {
      const stage = stageRef.current;
      if (stage) {
        // Find any dragging nodes and stop their drag
        const draggingNode = stage.findOne((node: any) => node.isDragging && node.isDragging());
        if (draggingNode) {
          draggingNode.stopDrag();
        }
      }
    }
  };

  const handleTouchEnd = (e: any) => {
    const touchCount = e.evt.touches?.length || 0;
    activeTouchCountRef.current = touchCount;

    // Reset pinch refs when all touches end
    if (touchCount === 0) {
      lastPinchDistRef.current = null;
      lastPinchCenterRef.current = null;
    }
  };

  const renderGrid = () => {
    if (!gridVisible) return null;

    const lines: JSX.Element[] = [];
    const gridSize = GRID_CONFIG.spacing;
    const viewW = dimensions.width / zoom;
    const viewH = dimensions.height / zoom;
    const offsetX = -pan.x / zoom; // visible content-space left
    const offsetY = -pan.y / zoom; // visible content-space top

    // Maximum grid extent (300m x 300m = 30000 x 30000 canvas units)
    // This ensures grid doesn't render infinitely at low zoom levels
    const MAX_GRID_EXTENT = 15000; // 150 meters from center in each direction

    // Compute grid-aligned start positions with maximum bounds
    const startX = Math.max(
      Math.floor(offsetX / gridSize) * gridSize,
      -MAX_GRID_EXTENT
    );
    const endX = Math.min(
      offsetX + viewW,
      MAX_GRID_EXTENT
    );
    const startY = Math.max(
      Math.floor(offsetY / gridSize) * gridSize,
      -MAX_GRID_EXTENT
    );
    const endY = Math.min(
      offsetY + viewH,
      MAX_GRID_EXTENT
    );

    const majorEvery = GRID_CONFIG.majorGridEvery;

    // Vertical lines across visible rect
    for (let x = startX; x <= endX; x += gridSize) {
      const index = Math.round(x / gridSize);
      const isMajor = ((index % majorEvery) + majorEvery) % majorEvery === 0;
      lines.push(
        <Line
          key={`v-${x}`}
          points={[x, offsetY, x, offsetY + viewH]}
          stroke={isMajor ? GRID_CONFIG.majorGridColor : GRID_CONFIG.color}
          strokeWidth={isMajor ? 1 : 0.5}
          listening={false}
        />
      );
    }

    // Horizontal lines across visible rect
    for (let y = startY; y <= endY; y += gridSize) {
      const index = Math.round(y / gridSize);
      const isMajor = ((index % majorEvery) + majorEvery) % majorEvery === 0;
      lines.push(
        <Line
          key={`h-${y}`}
          points={[offsetX, y, offsetX + viewW, y]}
          stroke={isMajor ? GRID_CONFIG.majorGridColor : GRID_CONFIG.color}
          strokeWidth={isMajor ? 1 : 0.5}
          listening={false}
        />
      );
    }

    return lines;
  };

  // Render styled ghost for a single segment depending on tool
  const renderSegmentGhost = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    tool: string,
    key?: string
  ) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 0.5) return null;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const label = (length / 100).toFixed(1) + 'm';

    // Defaults used for boundary/house/paving_area
    let content: JSX.Element | null = null;
    let color = tool === 'boundary' ? 'hsl(220, 80%, 30%)' : '#92400E';
    let labelColor = color;

    if (tool === 'wall') {
      const height = 15;
      const wallColor = WALL_MATERIALS.timber.color;
      content = (
        <Group x={start.x} y={start.y} rotation={angle} opacity={0.6} listening={false} key={key}>
          <Rect x={0} y={-height / 2} width={length} height={height} fill={wallColor} stroke={wallColor} strokeWidth={1} />
        </Group>
      );
      labelColor = wallColor;
    } else if (tool === 'fence') {
      const fenceColor = FENCE_TYPES[selectedFenceType as 'glass' | 'metal' | 'boundary'].color;
      content = (
        <Group x={start.x} y={start.y} rotation={angle} opacity={0.6} listening={false} key={key}>
          <Line points={[0, -6, length, -6]} stroke={fenceColor} strokeWidth={2} />
          <Line points={[0, 6, length, 6]} stroke={fenceColor} strokeWidth={2} />
        </Group>
      );
      labelColor = fenceColor;
    } else if (tool === 'drainage') {
      const pxPerMm = GRID_CONFIG.spacing / 100;
      const d = DRAINAGE_TYPES.rock;
      const widthPx = d.width * pxPerMm;
      content = (
        <Group x={start.x} y={start.y} rotation={angle} opacity={0.6} listening={false} key={key}>
          <Rect x={0} y={-widthPx / 2} width={length} height={widthPx} fill={d.color} stroke={d.color} strokeWidth={2} />
        </Group>
      );
      labelColor = d.color;
    } else {
      // boundary/house/paving_area default line
      content = (
        <Line
          points={[start.x, start.y, end.x, end.y]}
          stroke={color}
          strokeWidth={tool === 'boundary' ? 4 : 2}
          opacity={0.5}
          dash={[5, 5]}
          listening={false}
        />
      );
    }

    const wrapperKey = key || `seg-${start.x}-${start.y}-${end.x}-${end.y}-${tool}`;
    return (
      <Group key={wrapperKey} listening={false}>
        {content}
        {length > 10 && (
          <Label x={mid.x} y={mid.y - 20} listening={false}>
            <Tag fill="white" stroke={labelColor} strokeWidth={1} cornerRadius={3} pointerDirection="down" pointerWidth={6} pointerHeight={6} />
            <Text text={label} fontSize={14} fontStyle="bold" fill={labelColor} padding={4} align="center" />
          </Label>
        )}
      </Group>
    );
  };

  // Render ghost preview for drawing (all polyline tools)
  const renderDrawingPreview = () => {
    if (!isDrawing || !ghostPoint || drawingPoints.length === 0) return null;

    const lastPoint = drawingPoints[drawingPoints.length - 1];
    const isClosedCandidate = !extensionState && (activeTool === 'boundary' || activeTool === 'house' || activeTool === 'paving_area');

    return (
      <>
        {renderSegmentGhost(lastPoint, ghostPoint, effectiveDrawingTool)}
        {/* Snap indicator */}
        <Circle x={ghostPoint.x} y={ghostPoint.y} radius={5} fill="#3B82F6" opacity={0.6} listening={false} />

        {/* Close indicator if near first point (only for closeable tools, not during extension) */}
        {isClosedCandidate && drawingPoints.length >= 3 && isNearFirstPoint(ghostPoint) && (
          <Circle x={drawingPoints[0].x} y={drawingPoints[0].y} radius={20} stroke="#10B981" strokeWidth={2} opacity={0.5} listening={false} />
        )}
      </>
    );
  };

  // Render points and already-placed segments during drawing
  const renderDrawingPoints = () => {
    if (!isDrawing || drawingPoints.length === 0) return null;

    return (
      <>
        {/* Render segment ghosts */}
        {drawingPoints.slice(1).map((point, i) =>
          renderSegmentGhost(drawingPoints[i], point, effectiveDrawingTool, `sg-${i}`)
        )}

        {/* Points */}
        <Group key="drawing-points" listening={false}>
          {drawingPoints.map((point, index) => {
            const pointColor = effectiveDrawingTool === 'boundary' ? 'hsl(220, 80%, 30%)' : '#92400E';
            return (
              <Circle key={`drawing-point-${index}`} x={point.x} y={point.y} radius={5} fill={pointColor} stroke="#fff" strokeWidth={2} listening={false} />
            );
          })}
        </Group>
      </>
    );
  };

  
  // Render measurement preview line
  const renderMeasurementPreview = () => {
    if (!isMeasuring || !measureStart || !measureEnd) return null;

    const color = '#dc2626';

    return (
      <>
        {/* Measurement line */}
        <Line
          points={[measureStart.x, measureStart.y, measureEnd.x, measureEnd.y]}
          stroke={color}
          strokeWidth={2}
          dash={[]}
          opacity={0.7}
          listening={false}
        />
        {/* Measurement label */}
        {(() => {
          const mx = (measureStart.x + measureEnd.x) / 2;
          const my = (measureStart.y + measureEnd.y) / 2;
          const dx = measureEnd.x - measureStart.x;
          const dy = measureEnd.y - measureStart.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          // Show millimeters for finer feedback (1 unit = 10mm)
          const measurementMm = Math.round(distance * 10);
          return (
            <Label x={mx} y={my - 20} listening={false}>
              <Tag fill="white" stroke={color} strokeWidth={1} cornerRadius={3} pointerDirection="down" pointerWidth={6} pointerHeight={6} />
              <Text text={`${measurementMm}mm`} fontSize={14} fontStyle="bold" fill={color} padding={4} align="center" />
            </Label>
          );
        })()}
        
        {/* Start point */}
        <Circle
          x={measureStart.x}
          y={measureStart.y}
          radius={4}
          fill={color}
          listening={false}
        />
        
        {/* End point */}
        <Circle
          x={measureEnd.x}
          y={measureEnd.y}
          radius={4}
          fill={color}
          listening={false}
        />
      </>
    );
  };

  // Determine if stage should be draggable (hand tool OR select tool with KEYBOARD shift AND no object selected)
  // Note: Uses keyboardShiftPressed (not store shiftPressed) so touch toggle doesn't enable panning
  const isDraggable = activeTool === 'hand' || (activeTool === 'select' && keyboardShiftPressed && !selectedComponentId);

  // Disable selection/listening on components while drawing/placing/measuring for polyline tools
  // Also block selection when shift-panning
  const blockSelection = (() => {
    const polylineTools = new Set([
      'boundary', 'house', 'paving_area', 'area', 'wall', 'fence', 'drainage', 'quick_measure'
    ]);
    // Block selection when in shift-pan mode (select tool + keyboard shift + no selection)
    const isShiftPanning = activeTool === 'select' && keyboardShiftPressed && !selectedComponentId;
    return isDrawing || isMeasuring || polylineTools.has(activeTool) || isShiftPanning || !!extensionState;
  })();

  return (
    <div ref={containerRef} className="relative z-0 w-full h-full bg-canvas-bg">
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        scaleX={zoom}
        scaleY={zoom}
        x={pan.x}
        y={pan.y}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        draggable={isDraggable}
        style={{ cursor: isDraggable ? 'grab' : 'default', touchAction: 'none' }}
        onDragEnd={(e) => {
          if (isDraggable) {
            setPan({ x: e.target.x(), y: e.target.y() });
          }
        }}
      >
        <Layer listening={!blockSelection}>
          {/* Satellite layer - under everything */}
          <SatelliteLayer
            components={components}
            coordinates={currentProject?.coordinates}
            visible={satelliteVisible}
            rotation={satelliteRotation}
            stageZoom={zoom}
            viewportWidthPx={dimensions.width}
          />

          {renderGrid()}

          {/* Render all components in fixed type-based order */}
          {(() => {
            // Sort components by render order (pavers -> pools -> walls -> ... -> measurements)
            // Selected component is moved to top layer for easy editing
            const sortedComponents = sortComponentsByRenderOrder(components, selectedComponentId);

            return sortedComponents.map((component) => {
              const isSelected = component.id === selectedComponentId;
              
              switch (component.type) {
                case 'pool':
                  return (
                    <PoolComponent
                      key={component.id}
                      component={component}
                      isSelected={isSelected}
                      activeTool={activeTool}
                      onTileContextMenu={(comp, tileKey, screenPos) => setTileMenuState({ open: true, x: screenPos.x, y: screenPos.y, component: comp, tileKey })}
                      onSelect={() => selectComponent(component.id)}
                      onDragEnd={(pos) => {
                        const snapped = {
                          x: snapToGrid(pos.x),
                          y: snapToGrid(pos.y),
                        };
                        updateComponent(component.id, { position: snapped });
                      }}
                      onContextMenu={handleComponentContextMenu}
                    />
                  );
                  
                case 'paver':
                  return (
                    <PaverComponent
                      key={component.id}
                      component={component}
                      isSelected={isSelected}
                      activeTool={activeTool}
                      onSelect={() => selectComponent(component.id)}
                      onDragEnd={(pos) => {
                        const snapped = {
                          x: snapToGrid(pos.x),
                          y: snapToGrid(pos.y),
                        };
                        updateComponent(component.id, { position: snapped });
                      }}
                      onReplicateRight={(cols) => {
                        const base = component.properties.paverCount || { rows: 1, cols: 1 };
                        const safe = {
                          rows: Math.max(1, Number(base.rows) || 1),
                          cols: Math.max(1, Number(cols) || 1),
                        };
                        const sizeKey = (component.properties.paverSize || '400x400') as keyof typeof PAVER_SIZES;
                        const size = PAVER_SIZES[sizeKey];
                        updateComponent(component.id, {
                          properties: {
                            ...component.properties,
                            paverCount: safe,
                          },
                          dimensions: {
                            width: safe.cols * size.width,
                            height: safe.rows * size.height,
                          },
                        });
                      }}
                      onReplicateBottom={(rows) => {
                        const base = component.properties.paverCount || { rows: 1, cols: 1 };
                        const safe = {
                          rows: Math.max(1, Number(rows) || 1),
                          cols: Math.max(1, Number(base.cols) || 1),
                        };
                        const sizeKey = (component.properties.paverSize || '400x400') as keyof typeof PAVER_SIZES;
                        const size = PAVER_SIZES[sizeKey];
                        updateComponent(component.id, {
                          properties: {
                            ...component.properties,
                            paverCount: safe,
                          },
                          dimensions: {
                            width: safe.cols * size.width,
                            height: safe.rows * size.height,
                          },
                        });
                      }}
                      onReplicateLeft={(cols) => {
                        const base = component.properties.paverCount || { rows: 1, cols: 1 };
                        const safe = {
                          rows: Math.max(1, Number(base.rows) || 1),
                          cols: Math.max(1, Number(cols) || 1),
                        };
                        const sizeKey = (component.properties.paverSize || '400x400') as keyof typeof PAVER_SIZES;
                        const size = PAVER_SIZES[sizeKey];
                        const additionalCols = safe.cols - base.cols;
                        const scale = 0.1;
                        updateComponent(component.id, {
                          position: {
                            x: component.position.x - (additionalCols * size.width * scale),
                            y: component.position.y,
                          },
                          properties: {
                            ...component.properties,
                            paverCount: safe,
                          },
                          dimensions: {
                            width: safe.cols * size.width,
                            height: safe.rows * size.height,
                          },
                        });
                      }}
                      onReplicateTop={(rows) => {
                        const base = component.properties.paverCount || { rows: 1, cols: 1 };
                        const safe = {
                          rows: Math.max(1, Number(rows) || 1),
                          cols: Math.max(1, Number(base.cols) || 1),
                        };
                        const sizeKey = (component.properties.paverSize || '400x400') as keyof typeof PAVER_SIZES;
                        const size = PAVER_SIZES[sizeKey];
                        const additionalRows = safe.rows - base.rows;
                        const scale = 0.1;
                        updateComponent(component.id, {
                          position: {
                            x: component.position.x,
                            y: component.position.y - (additionalRows * size.height * scale),
                          },
                          properties: {
                            ...component.properties,
                            paverCount: safe,
                          },
                          dimensions: {
                            width: safe.cols * size.width,
                            height: safe.rows * size.height,
                          },
                        });
                      }}
                      onContextMenu={handleComponentContextMenu}
                    />
                  );

                case 'drainage':
                  return (
                    <DrainageComponent
                      key={component.id}
                      component={component}
                      isSelected={isSelected}
                      activeTool={activeTool}
                      onSelect={() => selectComponent(component.id)}
                      onDragEnd={(pos) => {
                        const snapped = {
                          x: snapToGrid(pos.x),
                          y: snapToGrid(pos.y),
                        };
                        updateComponent(component.id, { position: snapped });
                      }}
                      onExtend={(length) =>
                        updateComponent(component.id, {
                          properties: { ...component.properties, length },
                          dimensions: { ...component.dimensions, width: length },
                        })
                      }
                      onContextMenu={handleComponentContextMenu}
                    />
                  );
                  
                case 'fence':
                  return (
                    <FenceComponent
                      key={component.id}
                      component={component}
                      isSelected={isSelected}
                      activeTool={activeTool}
                      onSelect={() => selectComponent(component.id)}
                      onDragEnd={(pos) => {
                        const snapped = {
                          x: snapToGrid(pos.x),
                          y: snapToGrid(pos.y),
                        };
                        updateComponent(component.id, { position: snapped });
                      }}
                      onExtend={(length) =>
                        updateComponent(component.id, {
                          dimensions: { ...component.dimensions, width: length },
                        })
                      }
                      onContextMenu={handleComponentContextMenu}
                    />
                  );
                case 'gate':
                  return (
                    <GateComponent
                      key={component.id}
                      component={component}
                      isSelected={isSelected}
                      activeTool={activeTool}
                      onSelect={() => selectComponent(component.id)}
                      onDragEnd={(pos) => {
                        const snapped = { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };
                        updateComponent(component.id, { position: snapped });
                      }}
                    />
                  );
                  
                case 'wall':
                  return (
                    <WallComponent
                      key={component.id}
                      component={component}
                      isSelected={isSelected}
                      activeTool={activeTool}
                      onSelect={() => selectComponent(component.id)}
                      onDragEnd={(pos) => {
                        const snapped = {
                          x: snapToGrid(pos.x),
                          y: snapToGrid(pos.y),
                        };
                        updateComponent(component.id, { position: snapped });
                      }}
                      onExtend={(length) =>
                        updateComponent(component.id, {
                          dimensions: { ...component.dimensions, width: length },
                        })
                      }
                      onContextMenu={handleComponentContextMenu}
                    />
                  );
                  
                case 'boundary':
                  return (
                    <BoundaryComponent
                      key={component.id}
                      component={component}
                      isSelected={isSelected}
                      activeTool={activeTool}
                      onSelect={() => selectComponent(component.id)}
                      onDragEnd={(pos) => {
                        const snapped = {
                          x: snapToGrid(pos.x),
                          y: snapToGrid(pos.y),
                        };
                        updateComponent(component.id, { position: snapped });
                      }}
                      onContextMenu={handleComponentContextMenu}
                      onStartExtension={(componentId, endpoint) => {
                        const pts = component.properties.points || [];
                        if (pts.length < 2) return;

                        // The anchor is the endpoint the user clicked
                        const anchor = endpoint === 'last'
                          ? pts[pts.length - 1]
                          : pts[0];

                        setExtensionState({
                          componentId,
                          endpoint,
                          originalPoints: [...pts],
                        });
                        setDrawingPoints([{ x: anchor.x, y: anchor.y }]);
                        setIsDrawing(true);
                        setGhostPoint(null);
                      }}
                    />
                  );
                  
                case 'house':
                  return (
                    <HouseComponent
                      key={component.id}
                      component={component}
                      isSelected={isSelected}
                      activeTool={activeTool}
                      onSelect={() => selectComponent(component.id)}
                      onDragEnd={(pos) => {
                        const snapped = {
                          x: snapToGrid(pos.x),
                          y: snapToGrid(pos.y),
                        };
                        updateComponent(component.id, { position: snapped });
                      }}
                      onContextMenu={handleComponentContextMenu}
                    />
                  );
                
                case 'quick_measure':
                  return (
                    <ReferenceLineComponent
                      key={component.id}
                      component={component}
                      selected={isSelected}
                      activeTool={activeTool}
                      onSelect={() => selectComponent(component.id)}
                      onDelete={() => deleteComponent(component.id)}
                      onContextMenu={handleComponentContextMenu}
                    />
                  );
                
                case 'paving_area':
                  return (
                    <PavingAreaComponent
                      key={component.id}
                      component={component}
                      isSelected={isSelected}
                      activeTool={activeTool}
                      onSelect={() => selectComponent(component.id)}
                      onDelete={() => deleteComponent(component.id)}
                      onContextMenu={handleComponentContextMenu}
                    />
                  );


                case 'decoration':
                  return (
                    <DecorationComponent
                      key={component.id}
                      component={component}
                      isSelected={isSelected}
                      activeTool={activeTool}
                      onSelect={() => selectComponent(component.id)}
                      onDragEnd={(pos) => {
                        updateComponent(component.id, { position: pos });
                      }}
                      onContextMenu={handleComponentContextMenu}
                    />
                  );

                case 'height':
                  return (
                    <HeightComponent
                      key={component.id}
                      component={component}
                      isSelected={isSelected}
                      activeTool={activeTool}
                      onSelect={() => selectComponent(component.id)}
                      onDragEnd={(pos) => {
                        const snapped = { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };
                        updateComponent(component.id, { position: snapped });
                      }}
                    />
                  );

                default:
                  return null;
              }
            });
          })()}

          {/* Drawing preview - rendered AFTER all components so it's always on top */}
          {renderDrawingPoints()}
          {renderDrawingPreview()}
        </Layer>
        <Layer listening={false}>
          {renderMeasurementPreview()}
        </Layer>
      </Stage>

      {/* No fence tool context menu here; TopBar handles tool options */}

      {/* Coping tile context menu */}
      {tileMenuState.open && tileMenuState.component && tileMenuState.tileKey && (
        <div
          style={{ position: 'fixed', left: tileMenuState.x, top: tileMenuState.y, zIndex: 60 }}
          className="bg-popover border rounded-md shadow-md p-1 text-sm"
          onMouseLeave={() => setTileMenuState({ open: false, x: 0, y: 0, component: null, tileKey: null })}
        >
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-accent rounded"
            onClick={() => {
              const m = tileMenuState.tileKey!.match(/:ext:(\d+)$/);
              if (m) {
                const idx = parseInt(m[1], 10);
                const comp = tileMenuState.component!;
                const oldExt = (comp.properties.copingExtensions || []) as any[];
                const newExt = oldExt.filter((_, i) => i !== idx);
                updateComponent(comp.id, { properties: { ...comp.properties, copingExtensions: newExt } });
              }
              setTileMenuState({ open: false, x: 0, y: 0, component: null, tileKey: null });
            }}
          >
            Delete
          </button>
        </div>
      )}

      {/* Universal context menu for all components */}
      {contextMenuState.open && contextMenuState.component && (
        <ComponentContextMenu
          component={contextMenuState.component}
          position={{ x: contextMenuState.x, y: contextMenuState.y }}
          onAction={handleContextMenuAction}
          onClose={handleContextMenuClose}
        />
      )}

      {/* Pool Selector Modal */}
      {showPoolSelector && (
        <PoolSelector
          onSelect={handlePoolSelected}
          onClose={() => {
            setShowPoolSelector(false);
            setPendingPoolPosition(null);
          }}
        />
      )}

      {/* Compass Rotator - bottom left */}
      <CompassRotator
        rotation={satelliteRotation}
        onChange={setSatelliteRotation}
        visible={satelliteVisible}
      />
    </div>
  );
};

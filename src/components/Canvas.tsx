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
import { PavingAreaDialog, PavingConfig } from './PavingAreaDialog';
import { fillAreaWithPavers, calculateStatistics, validateBoundary } from '@/utils/pavingFill';
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

export const Canvas = ({
  activeTool = 'select',
  selectedDecorationType = 'bush',
  selectedFenceType = 'glass',
  selectedAreaType = 'pavers',
  onZoomChange,
  onZoomLockedChange,
  onDrawingStateChange,
  onToolChange,
}: {
  activeTool?: string;
  selectedDecorationType?: 'bush' | 'umbrella' | 'waterfeature' | 'deckchairs';
  selectedFenceType?: 'glass' | 'metal';
  selectedAreaType?: 'pavers' | 'concrete' | 'grass';
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
  
  // Drawing state for boundary, house, paving area, and linear tools (wall/fence/drainage)
  const [drawingPoints, setDrawingPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [ghostPoint, setGhostPoint] = useState<{ x: number; y: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Paving area dialog state
  const [showPavingDialog, setShowPavingDialog] = useState(false);
  const [pavingBoundary, setPavingBoundary] = useState<Array<{ x: number; y: number }>>([]);
  // Removed extend-from-pool right-click mode and context menu
  
  // Measurement tool states
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureEnd, setMeasureEnd] = useState<{ x: number; y: number } | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [shiftPressed, setShiftPressed] = useState(false);

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
    zoomLocked,
    toggleZoomLock,
    components,
    selectedComponentId,
    selectComponent,
    addComponent,
    updateComponent,
    deleteComponent,
  } = useDesignStore();

  // Zoom handlers - memoized to prevent infinite loops
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(zoom * 1.2, 4);
    setZoom(newZoom);
  }, [zoom, setZoom]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(zoom / 1.2, 0.25);
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
      activeTool === 'drainage';

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
    
    // Update measurement end point for measuring tools
    if (activeTool === 'quick_measure' && measureStart) {
      const pos = e.target.getStage().getPointerPosition();
      const canvasX = (pos.x - pan.x) / zoom;
      const canvasY = (pos.y - pan.y) / zoom;
      
      // Smart snap to nearby vertices, then allow axis lock with Shift
      let snappedPoint = smartSnap({ x: canvasX, y: canvasY }, components);
      let endPoint = { x: snappedPoint.x, y: snappedPoint.y };
      
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
          if (activeTool === 'paving_area') {
            // Show paving dialog instead of creating component directly
            if (selectedAreaType === 'pavers') {
              const validation = validateBoundary(drawingPoints);
              if (!validation.valid) {
                toast.error(validation.error || 'Invalid boundary');
                setDrawingPoints([]);
                setIsDrawing(false);
                setGhostPoint(null);
                return;
              }
              setPavingBoundary(drawingPoints);
              setShowPavingDialog(true);
              setDrawingPoints([]);
              setIsDrawing(false);
              setGhostPoint(null);
            } else {
              finishDrawing(true);
            }
          } else {
            finishDrawing(true);
          }
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

      // Place component for one-click tools (paver, gate, decoration)
      if (activeTool !== 'hand' && (activeTool === 'paver' || activeTool === 'gate' || activeTool === 'decoration')) {
        selectComponent(null);
        if (activeTool === 'paver' || activeTool === 'decoration') {
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
        // Start measuring (smart snap start point)
        const startSmart = smartSnap({ x: canvasX, y: canvasY }, components);
        setMeasureStart({ x: startSmart.x, y: startSmart.y });
        setMeasureEnd({ x: startSmart.x, y: startSmart.y });
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

    // For other tools, only handle clicks on empty canvas area
    if (e.target === stage) {
      handleBackgroundPrimaryClick(canvasX, canvasY);
    }
  };
  // Handle paving area configuration
  const handlePavingConfig = (config: PavingConfig) => {
    if (pavingBoundary.length < 3) return;

    // Initial tiling frame (square) anchored to the drawn boundary
    const xs = pavingBoundary.map(p => p.x);
    const ys = pavingBoundary.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = maxX - minX, h = maxY - minY;
    const baseSize = Math.max(w, h);
    const bufferMultiplier = 1.5;
    const side = baseSize * bufferMultiplier;
    const bufferOffset = (side - baseSize) / 2;
    const tilingFrame = { x: minX - bufferOffset, y: minY - bufferOffset, side };

    // Fill the area with pavers
    const pavers = fillAreaWithPavers(
      pavingBoundary,
      config.paverSize,
      config.paverOrientation,
      config.showEdgePavers
    );

    // Warn if no pavers were generated
    if (pavers.length === 0) {
      toast.error('Area is too small to fit any pavers. Please draw a larger area.');
      setPavingBoundary([]);
      return;
    }

    // Calculate statistics
    const statistics = calculateStatistics(pavers, config.wastagePercentage);
    
    // Debug info
    const edgePavers = pavers.filter(p => p.isEdgePaver);
    const fullPavers = pavers.filter(p => !p.isEdgePaver);
    console.log('Paving config:', {
      showEdgePavers: config.showEdgePavers,
      totalPavers: pavers.length,
      edgePavers: edgePavers.length,
      fullPavers: fullPavers.length,
      boundary: pavingBoundary
    });
    
    // Create the paving area component
    // Note: pavers will be recalculated dynamically in PavingAreaComponent based on pool positions
    addComponent({
      type: 'paving_area',
      position: { x: 0, y: 0 },
      rotation: 0,
      dimensions: { width: 0, height: 0 },
      properties: {
        boundary: pavingBoundary,
        paverSize: config.paverSize,
        paverOrientation: config.paverOrientation,
        showEdgePavers: config.showEdgePavers,
        wastagePercentage: config.wastagePercentage,
        tilingFrame,
        statistics, // Initial statistics, will be updated when pools change
      },
    });
    
    setPavingBoundary([]);
    
    if (edgePavers.length > 0) {
      toast.success(`Paving created: ${fullPavers.length} full + ${edgePavers.length} edge pavers`);
    } else {
      toast.success(`Paving created: ${pavers.length} full pavers (no cuts needed)`);
    }
    onToolChange?.('select');
  };

  // Finish drawing and create component(s)
  const finishDrawing = (closed: boolean) => {
    if (drawingPoints.length < 2) {
      setDrawingPoints([]);
      setIsDrawing(false);
      return;
    }

    if (activeTool === 'paving_area' && selectedAreaType !== 'pavers') {
      addComponent({
        type: 'paving_area',
        position: { x: 0, y: 0 },
        rotation: 0,
        dimensions: { width: 0, height: 0 },
        properties: {
          boundary: drawingPoints,
          areaSurface: selectedAreaType,
        },
      });
    } else if (activeTool === 'boundary' || activeTool === 'house') {
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
            wallMaterial: 'timber',
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
            drainageType: 'rock',
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

  // Keyboard shortcuts for drawing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Track Shift key
      if (e.key === 'Shift') {
        setShiftPressed(true);
      }
      
      // Zoom lock toggle (L key)
      if (e.key === 'l' && !e.ctrlKey && !e.metaKey && !isDrawing && !isMeasuring) {
        e.preventDefault();
        toggleZoomLock();
      }
      
      // Drawing shortcuts
      if (isDrawing) {
        if (e.key === 'Enter') {
          if (activeTool === 'paving_area' && drawingPoints.length >= 3) {
            if (selectedAreaType === 'pavers') {
              // Show paving dialog
              const validation = validateBoundary(drawingPoints);
              if (!validation.valid) {
                toast.error(validation.error || 'Invalid boundary');
                setDrawingPoints([]);
                setIsDrawing(false);
                setGhostPoint(null);
                return;
              }
              setPavingBoundary(drawingPoints);
              setShowPavingDialog(true);
              setDrawingPoints([]);
              setIsDrawing(false);
              setGhostPoint(null);
            } else {
              finishDrawing(false);
            }
          } else {
            finishDrawing(false);
          }
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
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setShiftPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isDrawing, drawingPoints, isMeasuring, toggleZoomLock]);

  // Reset drawing when tool changes
  useEffect(() => {
    if (
      activeTool !== 'boundary' &&
      activeTool !== 'house' &&
      activeTool !== 'paving_area' &&
      activeTool !== 'area' &&
      activeTool !== 'wall' &&
      activeTool !== 'fence' &&
      activeTool !== 'drainage'
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
            drainageType: 'rock',
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
            wallMaterial: 'timber',
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
    const clampedScale = Math.max(0.25, Math.min(4, newScale));

    setZoom(clampedScale);

    const newPos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    };

    setPan(newPos);
  };

  const renderGrid = () => {
    if (!gridVisible) return null;

    const lines: JSX.Element[] = [];
    const gridSize = GRID_CONFIG.spacing;
    const viewW = dimensions.width / zoom;
    const viewH = dimensions.height / zoom;
    const offsetX = -pan.x / zoom; // visible content-space left
    const offsetY = -pan.y / zoom; // visible content-space top

    // Compute grid-aligned start positions
    const startX = Math.floor(offsetX / gridSize) * gridSize;
    const endX = offsetX + viewW;
    const startY = Math.floor(offsetY / gridSize) * gridSize;
    const endY = offsetY + viewH;

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
          key={key}
          points={[start.x, start.y, end.x, end.y]}
          stroke={color}
          strokeWidth={tool === 'boundary' ? 4 : 2}
          opacity={0.5}
          dash={[5, 5]}
          listening={false}
        />
      );
    }

    return (
      <>
        {content}
        {length > 10 && (
          <Label x={mid.x} y={mid.y - 20} listening={false}>
            <Tag fill="white" stroke={labelColor} strokeWidth={1} cornerRadius={3} pointerDirection="down" pointerWidth={6} pointerHeight={6} />
            <Text text={label} fontSize={14} fontStyle="bold" fill={labelColor} padding={4} align="center" />
          </Label>
        )}
      </>
    );
  };

  // Render ghost preview for drawing (all polyline tools)
  const renderDrawingPreview = () => {
    if (!isDrawing || !ghostPoint || drawingPoints.length === 0) return null;

    const lastPoint = drawingPoints[drawingPoints.length - 1];
    const isClosedCandidate = (activeTool === 'boundary' || activeTool === 'house' || activeTool === 'paving_area');

    return (
      <>
        {renderSegmentGhost(lastPoint, ghostPoint, activeTool)}
        {/* Snap indicator */}
        <Circle x={ghostPoint.x} y={ghostPoint.y} radius={5} fill="#3B82F6" opacity={0.6} listening={false} />

        {/* Close indicator if near first point (only for closeable tools) */}
        {isClosedCandidate && drawingPoints.length >= 3 && isNearFirstPoint(ghostPoint) && (
          <Circle x={drawingPoints[0].x} y={drawingPoints[0].y} radius={20} stroke="#10B981" strokeWidth={2} opacity={0.5} listening={false} />
        )}
      </>
    );
  };

  // Render points and already-placed segments during drawing
  const renderDrawingPoints = () => {
    if (!isDrawing || drawingPoints.length === 0) return null;

    const items: JSX.Element[] = [];
    for (let i = 1; i < drawingPoints.length; i++) {
      items.push(
        renderSegmentGhost(drawingPoints[i - 1], drawingPoints[i], activeTool, `sg-${i}`) as any
      );
    }

    // Points
    const pointColor = activeTool === 'boundary' ? 'hsl(220, 80%, 30%)' : '#92400E';
    items.push(
      <Group key="drawing-points" listening={false}>
        {drawingPoints.map((point, index) => (
          <Circle key={`drawing-point-${index}`} x={point.x} y={point.y} radius={5} fill={pointColor} stroke="#fff" strokeWidth={2} listening={false} />
        ))}
      </Group>
    );

    return <>{items}</>;
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
          const measurementMeters = (distance / 100).toFixed(1);
          return (
            <Label x={mx} y={my - 20} listening={false}>
              <Tag fill="white" stroke={color} strokeWidth={1} cornerRadius={3} pointerDirection="down" pointerWidth={6} pointerHeight={6} />
              <Text text={`${measurementMeters}m`} fontSize={14} fontStyle="bold" fill={color} padding={4} align="center" />
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

  // Disable selection/listening on components while drawing/placing/measuring for polyline tools
  const blockSelection = (() => {
    const polylineTools = new Set([
      'boundary', 'house', 'paving_area', 'area', 'wall', 'fence', 'drainage', 'quick_measure'
    ]);
    return isDrawing || isMeasuring || polylineTools.has(activeTool);
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
        onMouseMove={handleMouseMove}
        draggable={activeTool === 'hand'}
        onDragEnd={(e) => {
          if (activeTool === 'hand') {
            setPan({ x: e.target.x(), y: e.target.y() });
          }
        }}
      >
        <Layer listening={!blockSelection}>
          {renderGrid()}
          
          {/* Drawing preview */}
          {renderDrawingPoints()}
          {renderDrawingPreview()}
          
          
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

                default:
                  return null;
              }
            });
          })()}
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
      
      {/* Paving Area Dialog */}
      {showPavingDialog && (
        <PavingAreaDialog
          open={showPavingDialog}
          onOpenChange={setShowPavingDialog}
          boundary={pavingBoundary}
          onConfirm={handlePavingConfig}
        />
      )}
    </div>
  );
};

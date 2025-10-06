import { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Line, Circle, Text, Label, Tag } from 'react-konva';
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
import { PavingAreaDialog, PavingConfig } from './PavingAreaDialog';
import { fillAreaWithPavers, calculateStatistics, validateBoundary } from '@/utils/pavingFill';
import { snapToGrid } from '@/utils/snap';
import { toast } from 'sonner';
import { PAVER_SIZES } from '@/constants/components';
import { PoolSelector } from './PoolSelector';
import { Pool } from '@/constants/pools';
import { lockToAxis, detectAxisLock, calculateDistance } from '@/utils/canvas';

export const Canvas = ({ activeTool = 'select' }: { activeTool?: string }) => {
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [showPoolSelector, setShowPoolSelector] = useState(false);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [pendingPoolPosition, setPendingPoolPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Drawing state for boundary, house, and paving area tools
  const [drawingPoints, setDrawingPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [ghostPoint, setGhostPoint] = useState<{ x: number; y: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Paving area dialog state
  const [showPavingDialog, setShowPavingDialog] = useState(false);
  const [pavingBoundary, setPavingBoundary] = useState<Array<{ x: number; y: number }>>([]);
  
  // Measurement tool states
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureEnd, setMeasureEnd] = useState<{ x: number; y: number } | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [shiftPressed, setShiftPressed] = useState(false);
  
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

  // Handle mouse move for drawing tools
  const handleMouseMove = (e: any) => {
    if (activeTool === 'boundary' || activeTool === 'house' || activeTool === 'paving_area') {
      const pos = e.target.getStage().getPointerPosition();
      const canvasX = (pos.x - pan.x) / zoom;
      const canvasY = (pos.y - pan.y) / zoom;
      const snapped = {
        x: snapToGrid(canvasX),
        y: snapToGrid(canvasY),
      };
      setGhostPoint(snapped);
    }
    // Handle measurement tools
    else if ((activeTool === 'quick_measure' || activeTool === 'reference_line') && isMeasuring && measureStart) {
      const pos = e.target.getStage().getPointerPosition();
      const canvasX = (pos.x - pan.x) / zoom;
      const canvasY = (pos.y - pan.y) / zoom;
      let snapped = {
        x: snapToGrid(canvasX),
        y: snapToGrid(canvasY),
      };
      
      // Apply axis lock if Shift is pressed
      if (shiftPressed) {
        snapped = lockToAxis(measureStart, snapped);
      }
      
      setMeasureEnd(snapped);
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
    // If clicked on empty canvas
    if (e.target === e.target.getStage()) {
      const pos = e.target.getStage().getPointerPosition();
      const canvasX = (pos.x - pan.x) / zoom;
      const canvasY = (pos.y - pan.y) / zoom;
      const snapped = {
        x: snapToGrid(canvasX),
        y: snapToGrid(canvasY),
      };

      // Handle measurement tools
      if (activeTool === 'quick_measure' || activeTool === 'reference_line') {
        if (!isMeasuring) {
          // Start measuring
          setMeasureStart(snapped);
          setMeasureEnd(snapped);
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
              type: activeTool as 'quick_measure' | 'reference_line',
              position: { x: 0, y: 0 },
              rotation: 0,
              dimensions: { width: 0, height: 0 },
              properties: {
                points: [measureStart, finalEnd],
                measurement: distance,
                style: {
                  color: activeTool === 'quick_measure' ? '#eab308' : '#dc2626',
                  dashed: activeTool === 'reference_line',
                  lineWidth: 2,
                  arrowEnds: true,
                },
                locked,
                showMeasurement: true,
                exportToPDF: activeTool === 'reference_line',
                temporary: activeTool === 'quick_measure',
                createdAt: Date.now(),
              },
            };
            
            addComponent(component);
            
            // Auto-delete quick measurements after 3 seconds
            if (activeTool === 'quick_measure') {
              const componentId = components.length > 0 ? components[components.length - 1].id : null;
              setTimeout(() => {
                if (componentId) {
                  const currentComponents = useDesignStore.getState().components;
                  const componentStillExists = currentComponents.find(c => c.id === componentId);
                  if (componentStillExists) {
                    useDesignStore.getState().deleteComponent(componentId);
                  }
                }
              }, 3000);
            }
          }
          
          setMeasureStart(null);
          setMeasureEnd(null);
          setIsMeasuring(false);
        }
        return;
      }

      // Handle drawing tools
      if (activeTool === 'boundary' || activeTool === 'house' || activeTool === 'paving_area') {
        // Check if clicking near first point to close
        if (drawingPoints.length >= 3 && isNearFirstPoint(snapped)) {
          // Close the shape
          if (activeTool === 'paving_area') {
            // Show paving dialog instead of creating component directly
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
          return;
        }
        
        // Add point to drawing
        setDrawingPoints([...drawingPoints, snapped]);
        setIsDrawing(true);
      }
      // Deselect in select mode
      else if (activeTool === 'select') {
        selectComponent(null);
      }
      // Show pool selector for pool tool
      else if (activeTool === 'pool') {
        setPendingPoolPosition(snapped);
        setShowPoolSelector(true);
      }
      // Place component if tool is active (not select, hand, or pool)
      else if (activeTool !== 'hand') {
        selectComponent(null);
        handleToolPlace(snapped);
      }
    }
  };

  // Handle paving area configuration
  const handlePavingConfig = (config: PavingConfig) => {
    if (pavingBoundary.length < 3) return;
    
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
    
    // Create the paving area component
    addComponent({
      type: 'paving_area',
      position: { x: 0, y: 0 },
      rotation: 0,
      dimensions: { width: 0, height: 0 },
      properties: {
        boundary: pavingBoundary,
        paverSize: config.paverSize,
        paverOrientation: config.paverOrientation,
        pavers,
        showEdgePavers: config.showEdgePavers,
        wastagePercentage: config.wastagePercentage,
        statistics,
      },
    });
    
    setPavingBoundary([]);
    toast.success(`Paving area created with ${pavers.length} pavers`);
  };

  // Finish drawing and create component
  const finishDrawing = (closed: boolean) => {
    if (drawingPoints.length < 2) {
      setDrawingPoints([]);
      setIsDrawing(false);
      return;
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

    setDrawingPoints([]);
    setIsDrawing(false);
    setGhostPoint(null);
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
    if (activeTool !== 'boundary' && activeTool !== 'house') {
      setDrawingPoints([]);
      setIsDrawing(false);
      setGhostPoint(null);
    }
    if (activeTool !== 'quick_measure' && activeTool !== 'reference_line') {
      setMeasureStart(null);
      setMeasureEnd(null);
      setIsMeasuring(false);
    }
  }, [activeTool]);

  const handlePoolSelected = (pool: Pool) => {
    if (pendingPoolPosition) {
      addComponent({
        type: 'pool',
        position: pendingPoolPosition,
        rotation: 0,
        dimensions: { width: pool.length, height: pool.width },
        properties: {
          poolId: pool.id,
        },
      });
      setPendingPoolPosition(null);
    }
  };

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
        break;
        
      case 'fence':
        addComponent({
          type: 'fence',
          position: pos,
          rotation: 0,
          dimensions: { width: 100, height: 12 },
          properties: {
            fenceType: 'glass',
            gates: [],
          },
        });
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

  const handleZoomIn = () => {
    const newZoom = Math.min(zoom * 1.2, 4);
    setZoom(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom / 1.2, 0.25);
    setZoom(newZoom);
  };

  const handleFitView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const renderGrid = () => {
    if (!gridVisible) return null;

    const lines: JSX.Element[] = [];
    const gridSize = GRID_CONFIG.spacing;
    const width = dimensions.width / zoom;
    const height = dimensions.height / zoom;

    // Vertical lines
    for (let i = 0; i < width; i += gridSize) {
      const isMajor = i % (gridSize * GRID_CONFIG.majorGridEvery) === 0;
      lines.push(
        <Line
          key={`v-${i}`}
          points={[i, 0, i, height]}
          stroke={isMajor ? GRID_CONFIG.majorGridColor : GRID_CONFIG.color}
          strokeWidth={isMajor ? 1 : 0.5}
        />
      );
    }

    // Horizontal lines
    for (let i = 0; i < height; i += gridSize) {
      const isMajor = i % (gridSize * GRID_CONFIG.majorGridEvery) === 0;
      lines.push(
        <Line
          key={`h-${i}`}
          points={[0, i, width, i]}
          stroke={isMajor ? GRID_CONFIG.majorGridColor : GRID_CONFIG.color}
          strokeWidth={isMajor ? 1 : 0.5}
        />
      );
    }

    return lines;
  };

  // Render ghost preview line for drawing
  const renderDrawingPreview = () => {
    if (!isDrawing || !ghostPoint || drawingPoints.length === 0) return null;

    const lastPoint = drawingPoints[drawingPoints.length - 1];
    const color = activeTool === 'boundary' ? 'hsl(220, 80%, 30%)' : '#92400E'; // Navy blue for boundary

    // Calculate distance for measurement
    const dx = ghostPoint.x - lastPoint.x;
    const dy = ghostPoint.y - lastPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const measurementMeters = (distance / 100).toFixed(1);
    
    const midPoint = {
      x: (lastPoint.x + ghostPoint.x) / 2,
      y: (lastPoint.y + ghostPoint.y) / 2,
    };

    return (
      <>
        {/* Ghost line */}
        <Line
          points={[lastPoint.x, lastPoint.y, ghostPoint.x, ghostPoint.y]}
          stroke={color}
          strokeWidth={activeTool === 'boundary' ? 4 : 2}
          opacity={0.5}
          dash={[5, 5]}
          listening={false}
        />
        
        {/* Measurement label for boundary */}
        {activeTool === 'boundary' && distance > 10 && (
          <Label x={midPoint.x} y={midPoint.y - 20}>
            <Tag
              fill="white"
              stroke={color}
              strokeWidth={1}
              cornerRadius={3}
              pointerDirection="down"
              pointerWidth={6}
              pointerHeight={6}
            />
            <Text
              text={`${measurementMeters}m`}
              fontSize={14}
              fontStyle="bold"
              fill={color}
              padding={4}
              align="center"
            />
          </Label>
        )}
        
        {/* Snap indicator */}
        <Circle
          x={ghostPoint.x}
          y={ghostPoint.y}
          radius={5}
          fill="#3B82F6"
          opacity={0.6}
          listening={false}
        />

        {/* Close indicator if near first point */}
        {drawingPoints.length >= 3 && isNearFirstPoint(ghostPoint) && (
          <Circle
            x={drawingPoints[0].x}
            y={drawingPoints[0].y}
            radius={20}
            stroke="#10B981"
            strokeWidth={2}
            opacity={0.5}
            listening={false}
          />
        )}
      </>
    );
  };

  // Render points being drawn
  const renderDrawingPoints = () => {
    if (!isDrawing || drawingPoints.length === 0) return null;

    const color = activeTool === 'boundary' ? 'hsl(220, 80%, 30%)' : '#92400E'; // Navy blue for boundary
    const flatPoints: number[] = [];
    drawingPoints.forEach(p => {
      flatPoints.push(p.x, p.y);
    });

    return (
      <>
        {/* Lines connecting points */}
        <Line
          points={flatPoints}
          stroke={color}
          strokeWidth={activeTool === 'boundary' ? 4 : 2}
          dash={activeTool === 'boundary' ? [10, 5] : undefined}
          listening={false}
        />
        
        {/* Segment measurements for boundary */}
        {activeTool === 'boundary' && drawingPoints.map((point, index) => {
          if (index === 0) return null;
          const prevPoint = drawingPoints[index - 1];
          const dx = point.x - prevPoint.x;
          const dy = point.y - prevPoint.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const measurementMeters = (distance / 100).toFixed(1);
          const midPoint = {
            x: (prevPoint.x + point.x) / 2,
            y: (prevPoint.y + point.y) / 2,
          };
          
          return (
            <Label key={`measurement-${index}`} x={midPoint.x} y={midPoint.y - 20}>
              <Tag
                fill="white"
                stroke={color}
                strokeWidth={1}
                cornerRadius={3}
                pointerDirection="down"
                pointerWidth={6}
                pointerHeight={6}
              />
              <Text
                text={`${measurementMeters}m`}
                fontSize={14}
                fontStyle="bold"
                fill={color}
                padding={4}
                align="center"
              />
            </Label>
          );
        })}
        
        {/* Points */}
        {drawingPoints.map((point, index) => (
          <Circle
            key={`drawing-point-${index}`}
            x={point.x}
            y={point.y}
            radius={5}
            fill={color}
            stroke="#fff"
            strokeWidth={2}
            listening={false}
          />
        ))}
      </>
    );
  };

  // Render status message
  const renderStatusMessage = () => {
    if (isDrawing) {
      let message = 'Click points to draw';
      if (drawingPoints.length >= 3) {
        message = 'Click first point to close or press Enter to finish';
      }

      return (
        <div className="absolute top-4 left-4 bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm text-foreground">ℹ️ {message}</p>
          <p className="text-xs text-muted-foreground mt-1">Press Escape to cancel • Z to undo last point</p>
        </div>
      );
    }
    
    if (isMeasuring && measureStart && measureEnd) {
      const distance = calculateDistance(measureStart, measureEnd);
      const measurementMeters = (distance / 100).toFixed(1);
      
      return (
        <div className="absolute top-4 left-4 bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm text-foreground">📏 {measurementMeters}m</p>
          <p className="text-xs text-muted-foreground mt-1">
            {shiftPressed ? '🔒 Axis locked • ' : 'Hold Shift to lock axis • '}
            Click to finish • Escape to cancel
          </p>
        </div>
      );
    }
    
    return null;
  };
  
  // Render measurement preview line
  const renderMeasurementPreview = () => {
    if (!isMeasuring || !measureStart || !measureEnd) return null;
    
    const color = activeTool === 'quick_measure' ? '#eab308' : '#dc2626';
    
    return (
      <>
        {/* Measurement line */}
        <Line
          points={[measureStart.x, measureStart.y, measureEnd.x, measureEnd.y]}
          stroke={color}
          strokeWidth={2}
          dash={activeTool === 'reference_line' ? [10, 5] : []}
          opacity={0.7}
          listening={false}
        />
        
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

  return (
    <div ref={containerRef} className="relative w-full h-full bg-canvas-bg">
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
        <Layer>
          {renderGrid()}
          
          {/* Drawing preview */}
          {renderDrawingPoints()}
          {renderDrawingPreview()}
          
          {/* Measurement preview */}
          {renderMeasurementPreview()}
          
          {/* Render all components */}
          {components.map((component) => {
            const isSelected = component.id === selectedComponentId;
            
            switch (component.type) {
              case 'pool':
                return (
                  <PoolComponent
                    key={component.id}
                    component={component}
                    isSelected={isSelected}
                    onSelect={() => selectComponent(component.id)}
                    onDragEnd={(pos) => {
                      const snapped = {
                        x: snapToGrid(pos.x),
                        y: snapToGrid(pos.y),
                      };
                      updateComponent(component.id, { position: snapped });
                    }}
                  />
                );
                
              case 'paver':
                return (
                  <PaverComponent
                    key={component.id}
                    component={component}
                    isSelected={isSelected}
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
                  />
                );
                
              case 'drainage':
                return (
                  <DrainageComponent
                    key={component.id}
                    component={component}
                    isSelected={isSelected}
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
                  />
                );
                
              case 'fence':
                return (
                  <FenceComponent
                    key={component.id}
                    component={component}
                    isSelected={isSelected}
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
                  />
                );
                
              case 'wall':
                return (
                  <WallComponent
                    key={component.id}
                    component={component}
                    isSelected={isSelected}
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
                  />
                );
                
              case 'boundary':
                return (
                  <BoundaryComponent
                    key={component.id}
                    component={component}
                    isSelected={isSelected}
                    onSelect={() => selectComponent(component.id)}
                    onDragEnd={(pos) => {
                      const snapped = {
                        x: snapToGrid(pos.x),
                        y: snapToGrid(pos.y),
                      };
                      updateComponent(component.id, { position: snapped });
                    }}
                  />
                );
                
              case 'house':
                return (
                  <HouseComponent
                    key={component.id}
                    component={component}
                    isSelected={isSelected}
                    onSelect={() => selectComponent(component.id)}
                    onDragEnd={(pos) => {
                      const snapped = {
                        x: snapToGrid(pos.x),
                        y: snapToGrid(pos.y),
                      };
                      updateComponent(component.id, { position: snapped });
                    }}
                  />
                );
              
              case 'reference_line':
              case 'quick_measure':
                return (
                  <ReferenceLineComponent
                    key={component.id}
                    component={component}
                    selected={isSelected}
                    onSelect={() => selectComponent(component.id)}
                    onDelete={() => deleteComponent(component.id)}
                  />
                );
              
              case 'paving_area':
                return (
                  <PavingAreaComponent
                    key={component.id}
                    component={component}
                    isSelected={isSelected}
                    onSelect={() => selectComponent(component.id)}
                  />
                );
                
              default:
                return null;
            }
          })}
        </Layer>
      </Stage>

      {/* Status message for drawing */}
      {renderStatusMessage()}

      {/* Zoom Controls */}
      <div className="absolute bottom-4 right-4 flex gap-2 bg-card border border-border rounded-lg p-2 shadow-lg">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleZoomLock} 
          title={zoomLocked ? "Unlock Zoom" : "Lock Zoom"}
          className={zoomLocked ? "text-primary" : ""}
        >
          {zoomLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={handleZoomOut} title="Zoom Out" disabled={zoomLocked}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={handleFitView} title="Fit to View">
          <Maximize className="h-4 w-4 mr-2" />
          {Math.round(zoom * 100)}%
        </Button>
        <Button variant="ghost" size="icon" onClick={handleZoomIn} title="Zoom In" disabled={zoomLocked}>
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

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

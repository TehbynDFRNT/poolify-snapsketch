import { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import { useDesignStore } from '@/store/designStore';
import { GRID_CONFIG } from '@/constants/grid';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { PoolComponent } from './canvas/PoolComponent';
import { PaverComponent } from './canvas/PaverComponent';
import { DrainageComponent } from './canvas/DrainageComponent';
import { FenceComponent } from './canvas/FenceComponent';
import { WallComponent } from './canvas/WallComponent';
import { snapToGrid } from '@/utils/snap';
import { PAVER_SIZES } from '@/constants/components';
import { PoolSelector } from './PoolSelector';
import { Pool } from '@/constants/pools';

export const Canvas = ({ activeTool = 'select' }: { activeTool?: string }) => {
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [showPoolSelector, setShowPoolSelector] = useState(false);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [pendingPoolPosition, setPendingPoolPosition] = useState<{ x: number; y: number } | null>(null);
  
  const {
    zoom,
    setZoom,
    pan,
    setPan,
    gridVisible,
    components,
    selectedComponentId,
    selectComponent,
    addComponent,
    updateComponent,
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
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const handleStageClick = (e: any) => {
    // If clicked on empty canvas
    if (e.target === e.target.getStage()) {
      // Deselect in select mode
      if (activeTool === 'select') {
        selectComponent(null);
      }
      // Show pool selector for pool tool
      else if (activeTool === 'pool') {
        const pos = e.target.getStage().getPointerPosition();
        const canvasX = (pos.x - pan.x) / zoom;
        const canvasY = (pos.y - pan.y) / zoom;
        const snapped = {
          x: snapToGrid(canvasX),
          y: snapToGrid(canvasY),
        };
        setPendingPoolPosition(snapped);
        setShowPoolSelector(true);
      }
      // Place component if tool is active (not select, hand, or pool)
      else if (activeTool !== 'hand') {
        selectComponent(null);
        const pos = e.target.getStage().getPointerPosition();
        const canvasX = (pos.x - pan.x) / zoom;
        const canvasY = (pos.y - pan.y) / zoom;
        const snapped = {
          x: snapToGrid(canvasX),
          y: snapToGrid(canvasY),
        };
        
        handleToolPlace(snapped);
      }
    }
  };

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
        draggable={activeTool === 'hand'}
        onDragEnd={(e) => {
          if (activeTool === 'hand') {
            setPan({ x: e.target.x(), y: e.target.y() });
          }
        }}
      >
        <Layer>
          {renderGrid()}
          
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
                
              default:
                return null;
            }
          })}
        </Layer>
      </Stage>

      {/* Zoom Controls */}
      <div className="absolute bottom-4 right-4 flex gap-2 bg-card border border-border rounded-lg p-2 shadow-lg">
        <Button variant="ghost" size="icon" onClick={handleZoomOut} title="Zoom Out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={handleFitView} title="Fit to View">
          <Maximize className="h-4 w-4 mr-2" />
          {Math.round(zoom * 100)}%
        </Button>
        <Button variant="ghost" size="icon" onClick={handleZoomIn} title="Zoom In">
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
    </div>
  );
};

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
import { snapToGrid } from '@/utils/snap';
import { EMPIRE_POOL } from '@/constants/components';

export const Canvas = () => {
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [activeTool, setActiveTool] = useState<string>('select');
  
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
    // If clicked on empty canvas, deselect
    if (e.target === e.target.getStage()) {
      selectComponent(null);
      
      // If a tool is active, place component
      if (activeTool !== 'select') {
        const pos = e.target.getStage().getPointerPosition();
        const snapped = {
          x: snapToGrid(pos.x / zoom - pan.x / zoom),
          y: snapToGrid(pos.y / zoom - pan.y / zoom),
        };
        
        handleToolPlace(snapped);
      }
    }
  };

  const handleToolPlace = (pos: { x: number; y: number }) => {
    switch (activeTool) {
      case 'pool':
        addComponent({
          type: 'pool',
          position: pos,
          rotation: 0,
          dimensions: { width: EMPIRE_POOL.length, height: EMPIRE_POOL.width },
          properties: {
            poolType: 'empire-6x3',
            showCoping: true,
            copingWidth: 400,
          },
        });
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
          dimensions: { width: 2400, height: 12 },
          properties: {
            fenceType: 'glass',
            gates: [],
          },
        });
        break;
    }
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    
    const scaleBy = 1.1;
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
        draggable
        onDragEnd={(e) => {
          setPan({ x: e.target.x(), y: e.target.y() });
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
                    onDragEnd={(pos) => updateComponent(component.id, { position: pos })}
                  />
                );
                
              case 'paver':
                return (
                  <PaverComponent
                    key={component.id}
                    component={component}
                    isSelected={isSelected}
                    onSelect={() => selectComponent(component.id)}
                    onDragEnd={(pos) => updateComponent(component.id, { position: pos })}
                    onReplicateRight={(cols) =>
                      updateComponent(component.id, {
                        properties: {
                          ...component.properties,
                          paverCount: { ...component.properties.paverCount, cols },
                        },
                      })
                    }
                    onReplicateBottom={(rows) =>
                      updateComponent(component.id, {
                        properties: {
                          ...component.properties,
                          paverCount: { ...component.properties.paverCount, rows },
                        },
                      })
                    }
                  />
                );
                
              case 'drainage':
                return (
                  <DrainageComponent
                    key={component.id}
                    component={component}
                    isSelected={isSelected}
                    onSelect={() => selectComponent(component.id)}
                    onDragEnd={(pos) => updateComponent(component.id, { position: pos })}
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
                    onDragEnd={(pos) => updateComponent(component.id, { position: pos })}
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
    </div>
  );
};

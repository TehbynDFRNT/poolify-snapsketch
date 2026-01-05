import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Stage, Layer, Line } from 'react-konva';
import { supabase } from '@/integrations/supabase/client';
import { PublicProjectResponse } from '@/types/publicLinks';
import { Component } from '@/types';
import { sortComponentsByRenderOrder } from '@/constants/renderOrder';
import { GRID_CONFIG } from '@/constants/grid';
import { useDesignStore } from '@/store/designStore';

// Import all component renderers
import { PoolComponent } from './canvas/PoolComponent';
import { PaverComponent } from './canvas/PaverComponent';
import { DrainageComponent } from './canvas/DrainageComponent';
import { FenceComponent } from './canvas/FenceComponent';
import { WallComponent } from './canvas/WallComponent';
import { BoundaryComponent } from './canvas/BoundaryComponent';
import { HouseComponent } from './canvas/HouseComponent';
import { ReferenceLineComponent } from './canvas/ReferenceLineComponent';
import { PavingAreaComponent } from './canvas/PavingAreaComponent';

// Import UI components
import { Button } from '@/components/ui/button';
import { Home, Grid3X3, Tag, FileText, ZoomIn, ZoomOut } from 'lucide-react';

const INITIAL_SCALE = 0.7;

export const PublicProjectView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectData, setProjectData] = useState<PublicProjectResponse | null>(null);
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Pan and zoom state - will be initialized properly once we have data
  const [zoom, setZoom] = useState(INITIAL_SCALE);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [initialized, setInitialized] = useState(false);

  // View options from store (components read these directly)
  const gridVisible = useDesignStore((s) => s.gridVisible);
  const annotationsVisible = useDesignStore((s) => s.annotationsVisible);
  const blueprintMode = useDesignStore((s) => s.blueprintMode);
  const toggleGrid = useDesignStore((s) => s.toggleGrid);
  const toggleAnnotations = useDesignStore((s) => s.toggleAnnotations);
  const toggleBlueprintMode = useDesignStore((s) => s.toggleBlueprintMode);

  useEffect(() => {
    loadPublicProject();
  }, [token]);

  // Track container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { offsetWidth, offsetHeight } = containerRef.current;
        if (offsetWidth > 0 && offsetHeight > 0) {
          setDimensions({ width: offsetWidth, height: offsetHeight });
        }
      }
    };

    // Use ResizeObserver for more reliable dimension tracking
    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // Also call once after a short delay to ensure layout is complete
    const timeoutId = setTimeout(updateDimensions, 50);

    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
    };
  }, [loading]);

  const loadPublicProject = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc('get_public_project', {
        p_token: token,
      });

      if (error) {
        console.error('Error loading public project:', error);
        setError('Failed to load project. The link may be invalid or expired.');
        return;
      }

      if (!data) {
        setError('Project not found or link has expired.');
        return;
      }

      setProjectData(data as PublicProjectResponse);
    } catch (err) {
      console.error('Error loading public project:', err);
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate and set initial camera position when data and dimensions are ready
  useEffect(() => {
    if (!projectData || initialized || dimensions.width === 0 || dimensions.height === 0) return;

    // Find the pool component
    const pool = projectData.project.components.find((c: Component) => c.type === 'pool');
    if (!pool || !pool.dimensions) {
      setInitialized(true);
      return;
    }

    // Calculate pool center - dimensions are in mm, convert to pixels (10px = 100mm, so divide by 10)
    const mmToPx = 0.1; // 1mm = 0.1px (10px = 100mm)
    const poolWidthPx = pool.dimensions.width * mmToPx;
    const poolHeightPx = pool.dimensions.height * mmToPx;
    const poolCenterX = pool.position.x + poolWidthPx / 2;
    const poolCenterY = pool.position.y + poolHeightPx / 2;

    // Calculate offset to center pool at initial scale
    const offsetX = dimensions.width / 2 - poolCenterX * INITIAL_SCALE;
    const offsetY = dimensions.height / 2 - poolCenterY * INITIAL_SCALE;

    setPan({ x: offsetX, y: offsetY });
    setZoom(INITIAL_SCALE);
    setInitialized(true);
  }, [projectData, dimensions, initialized]);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const scaleBy = 1.05;
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    const clampedScale = Math.max(0.1, Math.min(5, newScale));

    const newPos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    };

    setZoom(clampedScale);
    setPan(newPos);
  };

  const handleDragEnd = (e: any) => {
    setPan({
      x: e.target.x(),
      y: e.target.y(),
    });
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(5, zoom * 1.2);
    setZoom(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.1, zoom / 1.2);
    setZoom(newZoom);
  };

  const renderComponent = (component: Component) => {
    const commonProps = {
      component,
      isSelected: false,
      onSelect: () => {},
      onDragEnd: () => {},
      activeTool: 'hand' as const,
    };

    switch (component.type) {
      case 'pool':
        return <PoolComponent key={component.id} {...commonProps} />;
      case 'paver':
        return <PaverComponent key={component.id} {...commonProps} />;
      case 'drainage':
        return <DrainageComponent key={component.id} {...commonProps} />;
      case 'fence':
        return <FenceComponent key={component.id} {...commonProps} />;
      case 'wall':
        return <WallComponent key={component.id} {...commonProps} />;
      case 'boundary':
        return <BoundaryComponent key={component.id} {...commonProps} />;
      case 'house':
        return <HouseComponent key={component.id} {...commonProps} />;
      case 'reference_line':
        return <ReferenceLineComponent key={component.id} {...commonProps} />;
      case 'paving_area':
        return <PavingAreaComponent key={component.id} {...commonProps} />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Unable to Load Project</h2>
          <p className="text-gray-600">{error}</p>
          <Button
            onClick={() => window.location.href = '/'}
            className="mt-6"
            variant="outline"
          >
            <Home className="mr-2 h-4 w-4" />
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  if (!projectData) {
    return <Navigate to="/" />;
  }

  const sortedComponents = sortComponentsByRenderOrder(projectData.project.components);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div ref={containerRef} className="flex-1 relative overflow-hidden" style={{ cursor: 'grab' }}>
        {/* Floating controls - top right */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md px-3 py-2">
          <button
            onClick={toggleGrid}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors ${
              gridVisible ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="Toggle Grid"
          >
            <Grid3X3 className="h-4 w-4" />
            <span className="hidden sm:inline">Grid</span>
          </button>
          <button
            onClick={toggleAnnotations}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors ${
              annotationsVisible ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="Toggle Annotations"
          >
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Annotations</span>
          </button>
          <button
            onClick={toggleBlueprintMode}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors ${
              blueprintMode ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="Toggle Blueprint Mode"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Blueprint</span>
          </button>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <button
            onClick={handleZoomOut}
            className="flex items-center justify-center w-8 h-8 rounded text-gray-600 hover:bg-gray-100 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-xs text-gray-500 min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={handleZoomIn}
            className="flex items-center justify-center w-8 h-8 rounded text-gray-600 hover:bg-gray-100 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        {dimensions.width > 0 && dimensions.height > 0 && (
          <Stage
            ref={stageRef}
            width={dimensions.width}
            height={dimensions.height}
            scaleX={zoom}
            scaleY={zoom}
            x={pan.x}
            y={pan.y}
            draggable={true}
            onDragEnd={handleDragEnd}
            onWheel={handleWheel}
          >
            <Layer>
              {/* Grid - conditional, viewport-based like main Canvas */}
              {gridVisible && (() => {
                const lines: JSX.Element[] = [];
                const gridSize = GRID_CONFIG.spacing;
                const majorEvery = GRID_CONFIG.majorGridEvery;

                // Calculate visible area in content space
                const viewW = dimensions.width / zoom;
                const viewH = dimensions.height / zoom;
                const offsetX = -pan.x / zoom;
                const offsetY = -pan.y / zoom;

                // Max grid extent (150m in each direction)
                const MAX_GRID_EXTENT = 15000;

                // Grid-aligned start/end positions
                const startX = Math.max(Math.floor(offsetX / gridSize) * gridSize, -MAX_GRID_EXTENT);
                const endX = Math.min(offsetX + viewW, MAX_GRID_EXTENT);
                const startY = Math.max(Math.floor(offsetY / gridSize) * gridSize, -MAX_GRID_EXTENT);
                const endY = Math.min(offsetY + viewH, MAX_GRID_EXTENT);

                // Vertical lines
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

                // Horizontal lines
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
              })()}

              {/* Components */}
              {sortedComponents.map(renderComponent)}
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  );
};

import React, { useEffect, useState, useRef } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Stage, Layer } from 'react-konva';
import { supabase } from '@/integrations/supabase/client';
import { useDesignStore } from '@/store/designStore';
import { PublicProjectResponse } from '@/types/publicLinks';
import { Component } from '@/types';
import { sortComponentsByRenderOrder } from '@/constants/renderOrder';
import { GRID_CONFIG } from '@/constants/grid';

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
import { Badge } from '@/components/ui/badge';
import { Home } from 'lucide-react';

export const PublicProjectView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectData, setProjectData] = useState<PublicProjectResponse | null>(null);
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [initialOffset, setInitialOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    loadPublicProject();
  }, [token]);

  const loadPublicProject = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use the RPC function to get the project
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

      // Set initial offset after data loads
      setTimeout(() => {
        const offset = getViewOffset();
        setInitialOffset(offset);
        setStagePos(offset);
      }, 100);
    } catch (err) {
      console.error('Error loading public project:', err);
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };


  // Calculate view offset to center on pool
  const getViewOffset = () => {
    if (!projectData || !containerRef.current) return { x: 0, y: 0 };

    // Find the pool component
    const pool = projectData.project.components.find((c: Component) => c.type === 'pool');
    if (!pool) return { x: 0, y: 0 };

    // Calculate pool center
    const poolCenterX = pool.position.x + pool.width / 2;
    const poolCenterY = pool.position.y + pool.height / 2;

    // Calculate canvas center (no header now)
    const canvasWidth = containerRef.current.offsetWidth || window.innerWidth;
    const canvasHeight = containerRef.current.offsetHeight || window.innerHeight;

    // Return offset to center pool at 100% zoom
    return {
      x: canvasWidth / 2 - poolCenterX,
      y: canvasHeight / 2 - poolCenterY,
    };
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stageScale;
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };

    // Determine zoom direction and amount
    const scaleBy = 1.05;
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

    // Clamp scale between 0.1x and 5x
    const clampedScale = Math.max(0.1, Math.min(5, newScale));

    setStageScale(clampedScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  };

  const renderComponent = (component: Component) => {
    const commonProps = {
      key: component.id,
      id: component.id,
      component,
      isSelected: false,
      onSelect: () => {}, // No selection in public view
      onUpdate: () => {}, // No updates in public view
      onDragEnd: () => {}, // No dragging in public view
      showMeasurements: true, // Always show measurements
      isPreview: false,
      activeTool: 'hand', // Set to 'hand' to disable dragging (draggable={activeTool !== 'hand'})
    };

    switch (component.type) {
      case 'pool':
        return <PoolComponent {...commonProps} />;
      case 'paver':
        return <PaverComponent {...commonProps} />;
      case 'drainage':
        return <DrainageComponent {...commonProps} />;
      case 'fence':
        return <FenceComponent {...commonProps} />;
      case 'wall':
        return <WallComponent {...commonProps} />;
      case 'boundary':
        return <BoundaryComponent {...commonProps} />;
      case 'house':
        return <HouseComponent {...commonProps} />;
      case 'reference_line':
        return <ReferenceLineComponent {...commonProps} />;
      case 'paving_area':
        return <PavingAreaComponent {...commonProps} />;
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
    <div className="h-screen flex flex-col bg-gray-50" ref={containerRef}>
      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden" style={{ cursor: 'grab' }}>
        <Stage
          ref={stageRef}
          width={containerRef.current?.offsetWidth || window.innerWidth}
          height={containerRef.current?.offsetHeight || window.innerHeight}
          scaleX={stageScale}
          scaleY={stageScale}
          x={stagePos.x}
          y={stagePos.y}
          draggable={true}
          onDragEnd={(e) => {
            setStagePos({
              x: e.target.x(),
              y: e.target.y(),
            });
          }}
          onWheel={handleWheel}
        >
          <Layer>
            {/* Grid */}
            {(
              <>
                {Array.from(
                  { length: Math.ceil(10000 / GRID_CONFIG.MAJOR_SPACING) },
                  (_, i) => {
                    const pos = i * GRID_CONFIG.MAJOR_SPACING;
                    return (
                      <React.Fragment key={`grid-${i}`}>
                        <line
                          x1={pos}
                          y1={0}
                          x2={pos}
                          y2={10000}
                          stroke={GRID_CONFIG.MAJOR_COLOR}
                          strokeWidth={1}
                          opacity={0.3}
                        />
                        <line
                          x1={0}
                          y1={pos}
                          x2={10000}
                          y2={pos}
                          stroke={GRID_CONFIG.MAJOR_COLOR}
                          strokeWidth={1}
                          opacity={0.3}
                        />
                      </React.Fragment>
                    );
                  }
                )}
              </>
            )}

            {/* Components */}
            {sortedComponents.map(renderComponent)}
          </Layer>
        </Stage>
      </div>
    </div>
  );
};
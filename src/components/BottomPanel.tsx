import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, ZoomIn, ZoomOut, Maximize, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Component, Project } from '@/types';
import { useDesignStore } from '@/store/designStore';
import { fillAreaWithPavers, calculateStatistics } from '@/utils/pavingFill';
import { calculateMeasurements } from '@/utils/measurements';
import { POOL_LIBRARY } from '@/constants/pools';
import { toast } from 'sonner';
import { calculateDistance } from '@/utils/canvas';

interface BottomPanelProps {
  height: number;
  onHeightChange: (height: number) => void;
  selectedComponent: Component | null;
  project: Project;
  zoom: number;
  zoomLocked: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onToggleZoomLock: () => void;
  isDrawing: boolean;
  drawingPointsCount: number;
  isMeasuring: boolean;
  shiftPressed: boolean;
  measureStart: { x: number; y: number } | null;
  measureEnd: { x: number; y: number } | null;
  ghostDistance: number | null;
}

type TabType = 'properties' | 'materials' | 'notes';

export const BottomPanel = ({
  height,
  onHeightChange,
  selectedComponent,
  project,
  zoom,
  zoomLocked,
  onZoomIn,
  onZoomOut,
  onFitView,
  onToggleZoomLock,
  isDrawing,
  drawingPointsCount,
  isMeasuring,
  shiftPressed,
  measureStart,
  measureEnd,
  ghostDistance,
}: BottomPanelProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('properties');
  const [isResizing, setIsResizing] = useState(false);
  const [notes, setNotes] = useState(project.notes || '');
  const [hasUnsavedNotes, setHasUnsavedNotes] = useState(false);

  const { updateComponent, deleteComponent, duplicateComponent, components, updateCurrentProject } = useDesignStore();

  const handleMouseDown = () => setIsResizing(true);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newHeight = window.innerHeight - e.clientY - 60;
      onHeightChange(Math.max(40, Math.min(600, newHeight)));
    };

    const handleMouseUp = () => setIsResizing(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onHeightChange]);

  useEffect(() => {
    setNotes(project.notes || '');
    setHasUnsavedNotes(false);
  }, [project.notes]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    setHasUnsavedNotes(value !== (project.notes || ''));
  };

  const handleSaveNotes = () => {
    updateCurrentProject({ notes });
    setHasUnsavedNotes(false);
    toast.success('Notes saved');
  };

  const isCollapsed = height <= 100;

  const toggleCollapse = () => {
    onHeightChange(isCollapsed ? 350 : 40);
  };

  // Calculate materials summary using aggregated measurements
  const materialsSummary = calculateMeasurements(components);
  return (
    <div
      className="border-t bg-background flex flex-col flex-shrink-0"
      style={{ height: `${height}px` }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="h-2 bg-muted hover:bg-primary/40 cursor-ns-resize active:bg-primary/60 transition-colors"
      />

      {isCollapsed ? (
        // Collapsed state - show info, zoom controls, and expand button
        <div className="flex items-center justify-between px-4 h-10">
          {/* Show measurement info when drawing or measuring */}
          {(isDrawing && ghostDistance !== null) || (isMeasuring && measureStart && measureEnd) ? (
            <div className="bg-card border border-border rounded-lg px-3 py-1 shadow-sm">
              {isDrawing && ghostDistance !== null && (
                <span className="text-sm text-foreground">
                  📏 {(ghostDistance / 100).toFixed(1)}m
                  {shiftPressed && ' 🔒'}
                </span>
              )}
              {isMeasuring && measureStart && measureEnd && (
                <span className="text-sm text-foreground">
                  📏 {(calculateDistance(measureStart, measureEnd) / 100).toFixed(1)}m
                  {shiftPressed && ' 🔒'}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">
              {activeTab === 'properties' && selectedComponent
                ? `${selectedComponent.type} selected`
                : activeTab === 'materials'
                ? 'Materials Summary'
                : 'Project Notes'}
            </span>
          )}
          
          {/* Zoom Controls - Always visible */}
          <div className="ml-auto flex gap-1 items-center border-r pr-2 mr-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onToggleZoomLock} 
              title={zoomLocked ? "Unlock Zoom" : "Lock Zoom"}
              className={`min-w-[44px] min-h-[44px] ${zoomLocked ? "text-primary" : ""}`}
            >
              {zoomLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onZoomOut} 
              title="Zoom Out" 
              disabled={zoomLocked}
              className="min-w-[44px] min-h-[44px]"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onFitView} 
              title="Fit to View"
              className="min-h-[44px]"
            >
              <Maximize className="h-4 w-4 mr-1" />
              {Math.round(zoom * 100)}%
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onZoomIn} 
              title="Zoom In" 
              disabled={zoomLocked}
              className="min-w-[44px] min-h-[44px]"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="min-w-[44px] min-h-[44px]"
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex border-b items-center">
            <div className="flex">
              <button
                onClick={() => setActiveTab('properties')}
                className={`
                  px-4 py-2 font-medium text-sm transition-colors
                  ${activeTab === 'properties'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                Properties
                {selectedComponent && (
                  <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {selectedComponent.type}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('materials')}
                className={`
                  px-4 py-2 font-medium text-sm transition-colors
                  ${activeTab === 'materials'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                Materials Summary
              </button>

              <button
                onClick={() => setActiveTab('notes')}
                className={`
                  px-4 py-2 font-medium text-sm transition-colors
                  ${activeTab === 'notes'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                Notes
                {hasUnsavedNotes && (
                  <span className="ml-2 w-2 h-2 bg-orange-500 rounded-full inline-block" />
                )}
              </button>
            </div>

            {/* Drawing Status Message - Centered */}
            {(isDrawing || isMeasuring) && (
              <div className="flex-1 flex justify-center items-center px-4">
                <div className="bg-card border border-border rounded-lg px-3 py-1.5 shadow-md">
                  {isDrawing && (
                    <>
                      <p className="text-xs text-foreground">
                        {ghostDistance !== null && `📏 ${(ghostDistance / 100).toFixed(1)}m • `}
                        ℹ️ {drawingPointsCount >= 3
                          ? 'Click first point to close or press Enter to finish'
                          : 'Click points to draw'}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {shiftPressed && '🔒 Axis locked • '}
                        Press Escape to cancel • Z to undo last point
                      </p>
                    </>
                  )}
                  {isMeasuring && measureStart && measureEnd && (
                    <>
                      <p className="text-xs text-foreground">
                        📏 {(calculateDistance(measureStart, measureEnd) / 100).toFixed(1)}m
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {shiftPressed ? '🔒 Axis locked • ' : 'Hold Shift to lock axis • '}
                        Click to finish • Escape to cancel
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Zoom Controls */}
            <div className="ml-auto flex gap-1 items-center border-r pr-2 mr-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onToggleZoomLock} 
                title={zoomLocked ? "Unlock Zoom" : "Lock Zoom"}
                className={`min-w-[44px] min-h-[44px] ${zoomLocked ? "text-primary" : ""}`}
              >
                {zoomLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onZoomOut} 
                title="Zoom Out" 
                disabled={zoomLocked}
                className="min-w-[44px] min-h-[44px]"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onFitView} 
                title="Fit to View"
                className="min-h-[44px]"
              >
                <Maximize className="h-4 w-4 mr-1" />
                {Math.round(zoom * 100)}%
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onZoomIn} 
                title="Zoom In" 
                disabled={zoomLocked}
                className="min-w-[44px] min-h-[44px]"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Collapse button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCollapse}
              className="min-w-[44px] min-h-[44px]"
              title="Collapse panel"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>

          {/* Tab Content */}
          <ScrollArea className="flex-1">
            <div className="p-4">
              {activeTab === 'properties' && (
                <PropertiesContent 
                  component={selectedComponent}
                  onUpdate={updateComponent}
                  onDelete={deleteComponent}
                  onDuplicate={duplicateComponent}
                />
              )}

              {activeTab === 'materials' && (
                <MaterialsSummary summary={materialsSummary} />
              )}

              {activeTab === 'notes' && (
                <NotesEditor
                  notes={notes}
                  onChange={handleNotesChange}
                  onSave={handleSaveNotes}
                  hasUnsaved={hasUnsavedNotes}
                />
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
};

// Properties Tab Content
const PropertiesContent = ({
  component,
  onUpdate,
  onDelete,
  onDuplicate,
}: {
  component: Component | null;
  onUpdate: (id: string, updates: Partial<Component>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) => {
  if (!component) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>Select a component to view properties</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Component Properties</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Type</Label>
              <div className="text-sm font-medium capitalize">{component.type}</div>
            </div>
            <div>
              <Label className="text-xs">ID</Label>
              <div className="text-xs text-muted-foreground font-mono">{component.id.slice(0, 8)}</div>
            </div>
          </div>

          {component.type === 'pool' && component.properties.poolId && (
            <div>
              <Label className="text-xs">Pool Model</Label>
              <div className="text-sm font-medium">{component.properties.poolId}</div>
            </div>
          )}

          {component.type === 'wall' && (
            <>
              <div>
                <Label className="text-xs">Material Type</Label>
                <select
                  value={component.properties.wallMaterial || 'timber'}
                  onChange={(e) => onUpdate(component.id, {
                    properties: {
                      ...component.properties,
                      wallMaterial: e.target.value as 'timber' | 'concrete' | 'concrete_sleeper' | 'sandstone'
                    }
                  })}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm h-8"
                >
                  <option value="timber">Timber</option>
                  <option value="concrete">Concrete</option>
                  <option value="concrete_sleeper">Concrete Sleeper</option>
                  <option value="sandstone">Sandstone</option>
                </select>
              </div>

              <div>
                <Label htmlFor="wall-height" className="text-xs">Height (meters)</Label>
                <Input
                  id="wall-height"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={((component.properties.wallHeight || 1200) / 1000).toFixed(1)}
                  onChange={(e) => {
                    const heightInMeters = parseFloat(e.target.value);
                    if (!isNaN(heightInMeters) && heightInMeters > 0) {
                      onUpdate(component.id, {
                        properties: {
                          ...component.properties,
                          wallHeight: heightInMeters * 1000
                        }
                      });
                    }
                  }}
                  className="h-8"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {component.properties.wallHeight || 1200}mm
                </p>
              </div>

              <div>
                <Label className="text-xs">Status</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    variant={component.properties.wallStatus !== 'existing' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onUpdate(component.id, {
                      properties: {
                        ...component.properties,
                        wallStatus: 'proposed'
                      }
                    })}
                    className="flex-1"
                  >
                    Proposed
                  </Button>
                  <Button
                    variant={component.properties.wallStatus === 'existing' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onUpdate(component.id, {
                      properties: {
                        ...component.properties,
                        wallStatus: 'existing'
                      }
                    })}
                    className="flex-1"
                  >
                    Existing
                  </Button>
                </div>
              </div>
            </>
          )}

          {component.type === 'fence' && (
            <div>
              <Label className="text-xs">Fence Type</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  variant={component.properties.fenceType !== 'metal' && component.properties.fenceType !== 'boundary' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onUpdate(component.id, {
                    properties: {
                      ...component.properties,
                      fenceType: 'glass'
                    }
                  })}
                  className="flex-1"
                >
                  Glass
                </Button>
                <Button
                  variant={component.properties.fenceType === 'metal' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onUpdate(component.id, {
                    properties: {
                      ...component.properties,
                      fenceType: 'metal'
                    }
                  })}
                  className="flex-1"
                >
                  Metal
                </Button>
                <Button
                  variant={component.properties.fenceType === 'boundary' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onUpdate(component.id, {
                    properties: {
                      ...component.properties,
                      fenceType: 'boundary'
                    }
                  })}
                  className="flex-1"
                >
                  Boundary
                </Button>
              </div>
            </div>
          )}

          {component.type === 'paver' && (
            <div>
              <Label className="text-xs">Paver Size</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  variant={component.dimensions.width === 400 && component.dimensions.height === 400 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onUpdate(component.id, { 
                    dimensions: { width: 400, height: 400 },
                    properties: { ...component.properties, paverSize: '400x400' }
                  })}
                  className="flex-1"
                >
                  400 × 400
                </Button>
                <Button
                  variant={component.dimensions.width === 400 && component.dimensions.height === 600 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onUpdate(component.id, { 
                    dimensions: { width: 400, height: 600 },
                    properties: { ...component.properties, paverSize: '400x600' }
                  })}
                  className="flex-1"
                >
                  400 × 600
                </Button>
              </div>
            </div>
          )}

          {component.type === 'paving_area' && (
            <>
              <div>
                <Label className="text-xs">Paver Size</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    variant={component.properties.paverSize === '400x400' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const pavers = fillAreaWithPavers(
                        component.properties.boundary || [],
                        '400x400',
                        'vertical',
                        component.properties.showEdgePavers || true
                      );
                      const statistics = calculateStatistics(pavers, component.properties.wastagePercentage || 0);
                      onUpdate(component.id, {
                        properties: {
                          ...component.properties,
                          paverSize: '400x400',
                          pavers,
                          statistics,
                        }
                      });
                    }}
                    className="flex-1"
                  >
                    400 × 400
                  </Button>
                  <Button
                    variant={component.properties.paverSize === '400x600' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const pavers = fillAreaWithPavers(
                        component.properties.boundary || [],
                        '400x600',
                        component.properties.paverOrientation || 'vertical',
                        component.properties.showEdgePavers || true
                      );
                      const statistics = calculateStatistics(pavers, component.properties.wastagePercentage || 0);
                      onUpdate(component.id, {
                        properties: {
                          ...component.properties,
                          paverSize: '400x600',
                          pavers,
                          statistics,
                        }
                      });
                    }}
                    className="flex-1"
                  >
                    400 × 600
                  </Button>
                </div>
              </div>

              {component.properties.paverSize === '400x600' && (
                <div>
                  <Label className="text-xs">Orientation</Label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      variant={component.properties.paverOrientation === 'vertical' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        const pavers = fillAreaWithPavers(
                          component.properties.boundary || [],
                          '400x600',
                          'vertical',
                          component.properties.showEdgePavers || true
                        );
                        const statistics = calculateStatistics(pavers, component.properties.wastagePercentage || 0);
                        onUpdate(component.id, {
                          properties: {
                            ...component.properties,
                            paverOrientation: 'vertical',
                            pavers,
                            statistics,
                          }
                        });
                      }}
                      className="flex-1"
                    >
                      Vertical
                    </Button>
                    <Button
                      variant={component.properties.paverOrientation === 'horizontal' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        const pavers = fillAreaWithPavers(
                          component.properties.boundary || [],
                          '400x600',
                          'horizontal',
                          component.properties.showEdgePavers || true
                        );
                        const statistics = calculateStatistics(pavers, component.properties.wastagePercentage || 0);
                        onUpdate(component.id, {
                          properties: {
                            ...component.properties,
                            paverOrientation: 'horizontal',
                            pavers,
                            statistics,
                          }
                        });
                      }}
                      className="flex-1"
                    >
                      Horizontal
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="show-edge-pavers"
                    checked={component.properties.showEdgePavers ?? true}
                    onChange={(e) => {
                      const pavers = fillAreaWithPavers(
                        component.properties.boundary || [],
                        component.properties.paverSize || '400x400',
                        component.properties.paverOrientation || 'vertical',
                        e.target.checked
                      );
                      const statistics = calculateStatistics(pavers, component.properties.wastagePercentage || 0);
                      onUpdate(component.id, {
                        properties: {
                          ...component.properties,
                          showEdgePavers: e.target.checked,
                          pavers,
                          statistics,
                        }
                      });
                    }}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="show-edge-pavers" className="text-xs cursor-pointer">
                    Show edge pavers
                  </Label>
                </div>
              </div>

              <div className="bg-muted rounded-lg p-3 space-y-2">
                <h4 className="font-semibold text-sm">Material Count</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Full pavers:</span>
                    <span className="font-medium">{component.properties.statistics?.fullPavers || 0}</span>
                  </div>
                  {component.properties.showEdgePavers && (
                    <div className="flex justify-between text-orange-600">
                      <span>Edge pavers:</span>
                      <span className="font-medium">{component.properties.statistics?.edgePavers || 0}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 border-t">
                    <span>Total area:</span>
                    <span className="font-medium">{component.properties.statistics?.totalArea.toFixed(2) || 0} m²</span>
                  </div>
                  {(component.properties.wastagePercentage || 0) > 0 && (
                    <div className="flex justify-between text-primary pt-1 border-t font-semibold">
                      <span>Order Quantity:</span>
                      <span>{component.properties.statistics?.orderQuantity || 0} pavers</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="x" className="text-xs">X Position</Label>
              <Input
                id="x"
                type="number"
                value={Math.round(component.position.x)}
                onChange={(e) => onUpdate(component.id, { position: { ...component.position, x: Number(e.target.value) } })}
                className="h-8"
              />
            </div>
            <div>
              <Label htmlFor="y" className="text-xs">Y Position</Label>
              <Input
                id="y"
                type="number"
                value={Math.round(component.position.y)}
                onChange={(e) => onUpdate(component.id, { position: { ...component.position, y: Number(e.target.value) } })}
                className="h-8"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="width" className="text-xs">Width</Label>
              <Input
                id="width"
                type="number"
                value={Math.round(component.dimensions.width)}
                onChange={(e) => onUpdate(component.id, { dimensions: { ...component.dimensions, width: Number(e.target.value) } })}
                className="h-8"
              />
            </div>
            <div>
              <Label htmlFor="height" className="text-xs">Height</Label>
              <Input
                id="height"
                type="number"
                value={Math.round(component.dimensions.height)}
                onChange={(e) => onUpdate(component.id, { dimensions: { ...component.dimensions, height: Number(e.target.value) } })}
                className="h-8"
              />
            </div>
          </div>

          {component.rotation !== undefined && (
            <div>
              <Label htmlFor="rotation" className="text-xs">Rotation (degrees)</Label>
              <Input
                id="rotation"
                type="number"
                value={Math.round(component.rotation)}
                onChange={(e) => onUpdate(component.id, { rotation: Number(e.target.value) })}
                className="h-8"
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDuplicate(component.id)}
              className="flex-1"
            >
              Duplicate
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete(component.id)}
              className="flex-1"
            >
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Materials Summary Tab Content
const MaterialsSummary = ({
  summary,
}: {
  summary: ReturnType<typeof calculateMeasurements>;
}) => {
  const formatLength = (mm: number): string => {
    if (mm >= 1000) {
      return `${(mm / 1000).toFixed(1)}m`;
    }
    return `${mm}mm`;
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-foreground">Project Materials</h3>

      {summary.pools.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pools ({summary.pools.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {summary.pools.map((pool, i) => (
                <li key={i} className="text-sm">
                  <div className="font-medium">• {pool.type}</div>
                  <div className="text-xs text-muted-foreground ml-4 mt-1">
                    Dimensions: {pool.dimensions}
                  </div>
                  {pool.coping && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 ml-4 mt-1 space-y-0.5">
                      <div className="font-medium">Coping: {pool.coping.totalPavers} pavers (400×400mm)</div>
                      <div>
                        {pool.coping.fullPavers} full + {pool.coping.partialPavers} partial
                      </div>
                      <div>Total area: {pool.coping.area.toFixed(2)} m²</div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {summary.paving.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Paving</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {summary.paving.map((paving, i) => (
                <li key={i} className="text-sm">
                  <div className="font-medium">• {paving.size}</div>
                  <div className="text-xs text-muted-foreground ml-4 mt-1">
                    Count: {paving.count} pavers
                  </div>
                  <div className="text-xs text-muted-foreground ml-4">
                    Total area: {paving.area.toFixed(2)} m²
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {summary.drainage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Drainage</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {summary.drainage.map((drain, i) => (
                <li key={i} className="text-sm">
                  <div className="font-medium">• {drain.type}</div>
                  <div className="text-xs text-muted-foreground ml-4 mt-1">
                    Length: {formatLength(drain.length)}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {summary.fencing.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Fencing ({summary.fencing.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Group by type and show total per type with section breakdowns */}
            {Object.entries(
              summary.fencing.reduce((acc: Record<string, { total: number; items: typeof summary.fencing }>, f) => {
                if (!acc[f.type]) acc[f.type] = { total: 0, items: [] as any };
                acc[f.type].total += f.length;
                (acc[f.type].items as any).push(f);
                return acc;
              }, {})
            ).map(([type, group]) => (
              <div key={type} className="mb-3">
                <div className="text-sm font-medium">• {type}</div>
                <div className="text-xs text-muted-foreground ml-4">Total: {(group.total / 1000).toFixed(2)}m</div>
                <ul className="text-xs text-muted-foreground ml-4 mt-1 space-y-1">
                  {(group.items as any).map((f: any, i: number) => (
                    <li key={i}>
                      Section {i + 1}: {(f.length / 1000).toFixed(2)}m{f.gates > 0 ? ` • Gates: ${f.gates}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {summary.walls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Walls ({summary.walls.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {summary.walls.map((wall, i) => (
                <li key={i} className="text-sm">
                  <div className="font-medium">• {wall.material}</div>
                  <div className="text-xs text-muted-foreground ml-4 mt-1">
                    Length: {formatLength(wall.length)}
                  </div>
                  <div className="text-xs text-muted-foreground ml-4">
                    Height: {formatLength(wall.height)}
                  </div>
                  <div className="text-xs text-muted-foreground ml-4">
                    Status: {wall.status}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {summary.pools.length === 0 && summary.paving.length === 0 && summary.drainage.length === 0 && summary.fencing.length === 0 && summary.walls.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          <p>No components added yet</p>
        </div>
      )}
    </div>
  );
};

// Notes Tab Content
const NotesEditor = ({
  notes,
  onChange,
  onSave,
  hasUnsaved,
}: {
  notes: string;
  onChange: (value: string) => void;
  onSave: () => void;
  hasUnsaved: boolean;
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Project Notes</h3>
        {hasUnsaved && (
          <span className="text-xs text-orange-600">Unsaved changes</span>
        )}
      </div>
      <Textarea
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Add notes about this project..."
        className="min-h-[200px] resize-none"
      />
      <Button
        onClick={onSave}
        disabled={!hasUnsaved}
        className="w-full"
      >
        Save Notes
      </Button>
    </div>
  );
};

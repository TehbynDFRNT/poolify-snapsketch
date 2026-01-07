import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, ZoomIn, ZoomOut, Maximize, Lock, Unlock, Undo2, Redo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Project } from '@/types';
import { useDesignStore } from '@/store/designStore';
import { calculateMeasurements } from '@/utils/measurements';
import { toast } from 'sonner';
import { calculateDistance } from '@/utils/canvas';


interface BottomPanelProps {
  height: number;
  onHeightChange: (height: number) => void;
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
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

type TabType = 'materials' | 'notes';

export const BottomPanel = ({
  height,
  onHeightChange,
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
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: BottomPanelProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('materials');
  const [isResizing, setIsResizing] = useState(false);
  const [notes, setNotes] = useState(project.notes || '');
  const [hasUnsavedNotes, setHasUnsavedNotes] = useState(false);

  const { components, updateCurrentProject } = useDesignStore();

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
      className="border-t bg-background flex flex-col flex-shrink-0 relative z-20"
      style={{ height: `${height}px`, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
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
              {activeTab === 'materials' ? 'Materials Summary' : 'Project Notes'}
            </span>
          )}
          
          {/* Undo/Redo */}
          {onUndo && onRedo && (
            <div className="ml-auto flex gap-1 items-center border-r pr-2 mr-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onUndo}
                disabled={!canUndo}
                className="min-w-[44px] min-h-[44px]"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onRedo}
                disabled={!canRedo}
                className="min-w-[44px] min-h-[44px]"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Zoom Controls - Always visible */}
          <div className={`${onUndo ? '' : 'ml-auto'} flex gap-1 items-center border-r pr-2 mr-2`}>
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

            {/* Undo/Redo */}
            {onUndo && onRedo && (
              <div className="ml-auto flex gap-1 items-center border-r pr-2 mr-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onUndo}
                  disabled={!canUndo}
                  className="min-w-[44px] min-h-[44px]"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRedo}
                  disabled={!canRedo}
                  className="min-w-[44px] min-h-[44px]"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Zoom Controls */}
            <div className={`${onUndo ? '' : 'ml-auto'} flex gap-1 items-center border-r pr-2 mr-2`}>
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
                      <div className="font-medium">Coping: {pool.coping.paverSize}</div>
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
            <ul className="space-y-3">
              {summary.paving.map((paving, i) => (
                <li key={i} className="text-sm">
                  <div className="font-medium">• {paving.size}</div>
                  <div className="text-xs text-muted-foreground ml-4 mt-1 space-y-0.5">
                    {paving.count > 0 && (
                      <>
                        <div>Count: {paving.count} pavers</div>
                        <div className="ml-4">{paving.fullPavers} full + {paving.partialPavers} partial</div>
                      </>
                    )}
                    <div>Total area: {paving.area.toFixed(2)} m²</div>
                    <div>Wastage: {paving.wastage}%</div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {summary.concrete.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Concrete ({summary.concrete.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {summary.concrete.map((c, i) => (
                <li key={i} className="text-sm">
                  <div className="font-medium">• Concrete Area {i + 1}</div>
                  <div className="text-xs text-muted-foreground ml-4 mt-1">
                    Area: {c.area.toFixed(2)} m²
                  </div>
                </li>
              ))}
              {summary.concrete.length > 1 && (
                <li className="text-sm border-t pt-2 mt-2">
                  <div className="font-medium">Total Concrete</div>
                  <div className="text-xs text-muted-foreground ml-4">
                    {summary.concrete.reduce((sum, c) => sum + c.area, 0).toFixed(2)} m²
                  </div>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {(summary.gates.glass > 0 || summary.gates.metal > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Gates ({summary.gates.glass + summary.gates.metal})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {summary.gates.glass > 0 && (
                <li>• Glass Gates: {summary.gates.glass}</li>
              )}
              {summary.gates.metal > 0 && (
                <li>• Metal Gates: {summary.gates.metal}</li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {summary.drainage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Drainage ({summary.drainage.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {summary.drainage.map((drain, i) => (
                <li key={i} className="text-sm">
                  <div className="font-medium">• {drain.type} Drainage</div>
                  <div className="text-xs text-muted-foreground ml-4 mt-1 space-y-0.5">
                    <div>Length: {formatLength(drain.length)}</div>
                    <div>Width: {drain.width}mm</div>
                    <div>Volume: {((drain.length / 1000) * (drain.width / 1000)).toFixed(2)} m³</div>
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
            <ul className="space-y-3">
              {summary.walls.map((wall, i) => {
                const hasNodeHeights = wall.nodeHeights && Object.keys(wall.nodeHeights).length > 0;
                return (
                  <li key={i} className="text-sm">
                    <div className="font-medium">
                      • Wall {i + 1}: {wall.material} {wall.status === 'existing' && <span className="text-orange-500">(Existing)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground ml-4 mt-1 space-y-0.5">
                      <div>Length: {formatLength(wall.length)}</div>
                      {hasNodeHeights ? (
                        <div>
                          Node Heights: {Object.entries(wall.nodeHeights!)
                            .sort(([a], [b]) => Number(a) - Number(b))
                            .map(([idx, h]) => `${String.fromCharCode(65 + Number(idx))}: ${formatLength(h)}`)
                            .join(', ')}
                        </div>
                      ) : (
                        <div>Height: {formatLength(wall.height)}</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {summary.pools.length === 0 && summary.paving.length === 0 && summary.concrete.length === 0 && (summary.gates.glass + summary.gates.metal) === 0 && summary.drainage.length === 0 && summary.fencing.length === 0 && summary.walls.length === 0 && (
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

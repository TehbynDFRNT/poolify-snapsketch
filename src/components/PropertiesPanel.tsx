import { useDesignStore } from '@/store/designStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatLength, formatArea } from '@/utils/measurements';
import { ScrollArea } from '@/components/ui/scroll-area';
import { POOL_LIBRARY } from '@/constants/pools';
import { RotateCw, Copy, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { calculatePoolCoping } from '@/utils/copingCalculation';

export const PropertiesPanel = () => {
  const { selectedComponentId, components, getMeasurements, updateComponent, deleteComponent, duplicateComponent } = useDesignStore();
  const selectedComponent = components.find(c => c.id === selectedComponentId);
  const measurements = getMeasurements();

  const handleRotate = (angle: number) => {
    if (selectedComponent) {
      updateComponent(selectedComponent.id, { rotation: angle });
    }
  };

  const handleDuplicate = () => {
    if (selectedComponent) {
      duplicateComponent(selectedComponent.id);
    }
  };

  const handleDelete = () => {
    if (selectedComponent) {
      deleteComponent(selectedComponent.id);
    }
  };

  // Handle segment length updates for boundary/house
  const handleSegmentLengthUpdate = (segmentIndex: number, newLengthMeters: number) => {
    if (!selectedComponent || (!selectedComponent.type.includes('boundary') && !selectedComponent.type.includes('house'))) return;
    
    const points = selectedComponent.properties.points || [];
    const closed = selectedComponent.properties.closed || false;
    if (points.length < 2 || segmentIndex >= points.length) return;

    const newPoints = [...points];
    const startPoint = newPoints[segmentIndex];
    const endIndex = (segmentIndex + 1) % points.length;
    const endPoint = newPoints[endIndex];

    // Calculate current segment
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const currentLength = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    // Calculate new end point based on desired length (convert meters to pixels: 1m = 100 pixels at 1:100 scale)
    const newLengthPixels = newLengthMeters * 100;
    const deltaLength = newLengthPixels - currentLength;
    
    const newEndPoint = {
      x: startPoint.x + Math.cos(angle) * newLengthPixels,
      y: startPoint.y + Math.sin(angle) * newLengthPixels,
    };

    // Calculate the displacement
    const displacement = {
      x: newEndPoint.x - endPoint.x,
      y: newEndPoint.y - endPoint.y,
    };

    // Update the end point
    newPoints[endIndex] = newEndPoint;

    // For non-closed shapes or when editing the last segment of a closed shape,
    // move all subsequent points by the same displacement to maintain the shape
    if (!closed || segmentIndex < points.length - 1) {
      for (let i = endIndex + 1; i < newPoints.length; i++) {
        newPoints[i] = {
          x: newPoints[i].x + displacement.x,
          y: newPoints[i].y + displacement.y,
        };
      }
    }

    // Recalculate area for house
    let area = undefined;
    if (selectedComponent.type === 'house' && selectedComponent.properties.closed && newPoints.length >= 3) {
      area = 0;
      for (let i = 0; i < newPoints.length; i++) {
        const j = (i + 1) % newPoints.length;
        area += newPoints[i].x * newPoints[j].y;
        area -= newPoints[j].x * newPoints[i].y;
      }
      area = Math.abs(area) / 2;
      area = area * 0.01; // Convert to m²
    }

    updateComponent(selectedComponent.id, {
      properties: {
        ...selectedComponent.properties,
        points: newPoints,
        ...(area !== undefined && { area }),
      },
    });
  };

  // Calculate segment data for boundary/house
  const getSegmentData = () => {
    if (!selectedComponent || (selectedComponent.type !== 'boundary' && selectedComponent.type !== 'house')) return [];
    
    const points = selectedComponent.properties.points || [];
    const closed = selectedComponent.properties.closed || false;
    const segments = [];

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const lengthInPixels = Math.sqrt(dx * dx + dy * dy);
      const lengthInMeters = (lengthInPixels * 10) / 1000; // 10 pixels = 1000mm = 1m at 1:100 scale

      segments.push({
        index: i,
        label: `Segment ${i + 1}`,
        length: lengthInMeters,
      });
    }

    // Add closing segment if closed
    if (closed && points.length > 2) {
      const p1 = points[points.length - 1];
      const p2 = points[0];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const lengthInPixels = Math.sqrt(dx * dx + dy * dy);
      const lengthInMeters = (lengthInPixels * 10) / 1000;

      segments.push({
        index: points.length - 1,
        label: `Segment ${points.length}`,
        length: lengthInMeters,
      });
    }

    return segments;
  };

  // Get pool data if selected component is a pool
  const poolData = selectedComponent?.type === 'pool' 
    ? POOL_LIBRARY.find(p => p.id === selectedComponent.properties.poolId)
    : null;

  // Calculate live coping for display
  const currentCopingCalc = selectedComponent?.type === 'pool' && selectedComponent.properties.showCoping && poolData
    ? calculatePoolCoping(poolData, selectedComponent.properties.copingConfig)
    : undefined;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {selectedComponent ? (
          <Card>
            <CardHeader>
              <CardTitle>
                {poolData ? poolData.name : 
                 selectedComponent.type === 'wall' ? 'Retaining Wall' :
                 selectedComponent.type.charAt(0).toUpperCase() + selectedComponent.type.slice(1)}
              </CardTitle>
              <CardDescription>
                {selectedComponent.type === 'wall' ? 'Retaining Wall' : 
                 selectedComponent.type.charAt(0).toUpperCase() + selectedComponent.type.slice(1)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Reference Line / Quick Measure Properties */}
                {(selectedComponent.type === 'reference_line' || selectedComponent.type === 'quick_measure') && (
                  <>
                    <div>
                      <Label className="text-sm font-medium">Length</Label>
                      <div className="font-mono text-lg">
                        {((selectedComponent.properties.measurement || 0) / 100).toFixed(1)}m
                        <span className="text-muted-foreground text-sm ml-2">
                          ({selectedComponent.properties.measurement || 0}mm)
                        </span>
                      </div>
                    </div>

                    {selectedComponent.type === 'reference_line' && (
                      <>
                        <div>
                          <Label className="text-sm font-medium mb-2">Label (optional)</Label>
                          <Input
                            type="text"
                            value={selectedComponent.properties.label || ''}
                            onChange={(e) => updateComponent(selectedComponent.id, {
                              properties: {
                                ...selectedComponent.properties,
                                label: e.target.value
                              }
                            })}
                            placeholder="e.g., 3m clearance"
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-medium mb-2">Line Style</Label>
                          <div className="flex gap-2">
                            <Button
                              variant={selectedComponent.properties.style?.dashed ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => updateComponent(selectedComponent.id, {
                                properties: {
                                  ...selectedComponent.properties,
                                  style: {
                                    ...selectedComponent.properties.style!,
                                    dashed: true
                                  }
                                }
                              })}
                            >
                              Dashed
                            </Button>
                            <Button
                              variant={!selectedComponent.properties.style?.dashed ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => updateComponent(selectedComponent.id, {
                                properties: {
                                  ...selectedComponent.properties,
                                  style: {
                                    ...selectedComponent.properties.style!,
                                    dashed: false
                                  }
                                }
                              })}
                            >
                              Solid
                            </Button>
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium mb-2">Color</Label>
                          <div className="flex gap-2 flex-wrap">
                            {['#dc2626', '#ea580c', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'].map(color => (
                              <button
                                key={color}
                                className="w-8 h-8 rounded border-2 hover:scale-110 transition-transform"
                                style={{ 
                                  backgroundColor: color,
                                  borderColor: selectedComponent.properties.style?.color === color ? '#000' : '#ccc'
                                }}
                                onClick={() => updateComponent(selectedComponent.id, {
                                  properties: {
                                    ...selectedComponent.properties,
                                    style: {
                                      ...selectedComponent.properties.style!,
                                      color
                                    }
                                  }
                                })}
                              />
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium mb-2">Axis Lock</Label>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="radio"
                                checked={!selectedComponent.properties.locked}
                                onChange={() => updateComponent(selectedComponent.id, {
                                  properties: {
                                    ...selectedComponent.properties,
                                    locked: null
                                  }
                                })}
                              />
                              <span>Free</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="radio"
                                checked={selectedComponent.properties.locked === 'horizontal'}
                                onChange={() => updateComponent(selectedComponent.id, {
                                  properties: {
                                    ...selectedComponent.properties,
                                    locked: 'horizontal'
                                  }
                                })}
                              />
                              <span>Horizontal</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="radio"
                                checked={selectedComponent.properties.locked === 'vertical'}
                                onChange={() => updateComponent(selectedComponent.id, {
                                  properties: {
                                    ...selectedComponent.properties,
                                    locked: 'vertical'
                                  }
                                })}
                              />
                              <span>Vertical</span>
                            </label>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selectedComponent.properties.showMeasurement !== false}
                              onChange={(e) => updateComponent(selectedComponent.id, {
                                properties: {
                                  ...selectedComponent.properties,
                                  showMeasurement: e.target.checked
                                }
                              })}
                            />
                            <span>Show measurement</span>
                          </label>
                          
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selectedComponent.properties.exportToPDF !== false}
                              onChange={(e) => updateComponent(selectedComponent.id, {
                                properties: {
                                  ...selectedComponent.properties,
                                  exportToPDF: e.target.checked
                                }
                              })}
                            />
                            <span>Include in PDF export</span>
                          </label>
                        </div>

                        <Separator />
                      </>
                    )}

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      className="w-full"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete {selectedComponent.type === 'quick_measure' ? 'Quick Measure' : 'Reference Line'}
                    </Button>
                  </>
                )}
                
                {/* Wall Properties */}
                {selectedComponent.type === 'wall' && (
                  <>
                    <div>
                      <Label className="text-sm font-medium mb-2">Material Type</Label>
                      <select
                        value={selectedComponent.properties.wallMaterial || 'timber'}
                        onChange={(e) => updateComponent(selectedComponent.id, {
                          properties: {
                            ...selectedComponent.properties,
                            wallMaterial: e.target.value as 'timber' | 'concrete' | 'concrete_sleeper' | 'sandstone'
                          }
                        })}
                        className="w-full px-3 py-2 border rounded-md bg-background"
                      >
                        <option value="timber">Timber</option>
                        <option value="concrete">Concrete</option>
                        <option value="concrete_sleeper">Concrete Sleeper</option>
                        <option value="sandstone">Sandstone</option>
                      </select>
                    </div>

                    <div>
                      <Label className="text-sm font-medium mb-2">Height (meters)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={((selectedComponent.properties.wallHeight || 1200) / 1000).toFixed(1)}
                        onChange={(e) => {
                          const heightInMeters = parseFloat(e.target.value);
                          if (!isNaN(heightInMeters) && heightInMeters > 0) {
                            updateComponent(selectedComponent.id, {
                              properties: {
                                ...selectedComponent.properties,
                                wallHeight: heightInMeters * 1000 // Store in mm
                              }
                            });
                          }
                        }}
                        placeholder="1.2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedComponent.properties.wallHeight || 1200}mm
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium mb-2">Status</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={selectedComponent.properties.wallStatus !== 'existing' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateComponent(selectedComponent.id, {
                            properties: {
                              ...selectedComponent.properties,
                              wallStatus: 'proposed'
                            }
                          })}
                          className="flex-1"
                        >
                          Proposed
                        </Button>
                        <Button
                          variant={selectedComponent.properties.wallStatus === 'existing' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateComponent(selectedComponent.id, {
                            properties: {
                              ...selectedComponent.properties,
                              wallStatus: 'existing'
                            }
                          })}
                          className="flex-1"
                        >
                          Existing
                        </Button>
                      </div>
                    </div>

                    <Separator />
                  </>
                )}
                
                {selectedComponent.type !== 'reference_line' && selectedComponent.type !== 'quick_measure' && (
                  <>
                    {poolData && (
                      <div>
                        <p className="text-sm font-medium mb-1">Waterline Dimensions</p>
                        <p className="text-sm text-muted-foreground">
                          {poolData.length}mm × {poolData.width}mm
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ({poolData.length / 1000}m × {poolData.width / 1000}m)
                        </p>
                      </div>
                    )}

                    {/* Pool Coping Section */}
                    {poolData && (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Pool Coping</Label>
                          <Switch
                            checked={selectedComponent.properties.showCoping ?? false}
                            onCheckedChange={(checked) => {
                              const copingCalculation = checked ? calculatePoolCoping(poolData) : undefined;
                              updateComponent(selectedComponent.id, {
                                properties: {
                                  ...selectedComponent.properties,
                                  showCoping: checked,
                                  copingCalculation,
                                },
                              });
                            }}
                          />
                        </div>
                        
                        {currentCopingCalc && selectedComponent.properties.copingMode !== 'extensible' && (
                          <div className="text-xs space-y-1 bg-muted p-3 rounded-lg">
                            <div className="font-medium mb-2">
                              Coping Details ({selectedComponent.properties.copingConfig?.tile.along || 400}×{selectedComponent.properties.copingConfig?.tile.inward || 400}mm pavers):
                            </div>
                            <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
                              <div>Deep End (2 rows):</div>
                              <div className="text-right font-mono">
                                {currentCopingCalc.deepEnd.fullPavers} full
                                {currentCopingCalc.deepEnd.partialPaver && 
                                  ` + 2×${currentCopingCalc.deepEnd.partialPaver}mm`
                                }
                              </div>
                              
                              <div>Shallow End:</div>
                              <div className="text-right font-mono">
                                {currentCopingCalc.shallowEnd.fullPavers} full
                                {currentCopingCalc.shallowEnd.partialPaver && 
                                  ` + ${currentCopingCalc.shallowEnd.partialPaver}mm`
                                }
                              </div>
                              
                              <div>Left Side:</div>
                              <div className="text-right font-mono">
                                {currentCopingCalc.leftSide.fullPavers} full
                                {currentCopingCalc.leftSide.partialPaver && 
                                  ` + ${currentCopingCalc.leftSide.partialPaver}mm`
                                }
                              </div>
                              
                              <div>Right Side:</div>
                              <div className="text-right font-mono">
                                {currentCopingCalc.rightSide.fullPavers} full
                                {currentCopingCalc.rightSide.partialPaver && 
                                  ` + ${currentCopingCalc.rightSide.partialPaver}mm`
                                }
                              </div>
                              
                              <div className="font-semibold pt-2 border-t mt-1">Total:</div>
                              <div className="text-right font-mono font-semibold pt-2 border-t mt-1">
                                {currentCopingCalc.totalPavers} pavers
                              </div>
                              
                              <div className="text-muted-foreground">({currentCopingCalc.totalFullPavers} full + {currentCopingCalc.totalPartialPavers} partial)</div>
                              <div className="text-right font-mono col-start-2">
                                {currentCopingCalc.totalArea.toFixed(2)} m²
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Coping Mode Toggle */}
                        {selectedComponent.properties.showCoping && (
                          <>
                            <Separator />
                            <div className="space-y-4">
                              <Label className="text-sm font-medium">Coping Mode</Label>
                              <div className="flex gap-2">
                                <Button
                                  variant={selectedComponent.properties.copingMode !== 'extensible' ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => updateComponent(selectedComponent.id, {
                                    properties: {
                                      ...selectedComponent.properties,
                                      copingMode: 'fixed',
                                      copingExtensions: undefined
                                    }
                                  })}
                                >
                                  Fixed Width
                                </Button>
                                <Button
                                  variant={selectedComponent.properties.copingMode === 'extensible' ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => updateComponent(selectedComponent.id, {
                                    properties: {
                                      ...selectedComponent.properties,
                                      copingMode: 'extensible',
                                      copingExtensions: {
                                        deepEnd: { enabled: false, maxDistance: null, targetBoundaryId: null },
                                        shallowEnd: { enabled: false, maxDistance: null, targetBoundaryId: null },
                                        leftSide: { enabled: false, maxDistance: null, targetBoundaryId: null },
                                        rightSide: { enabled: false, maxDistance: null, targetBoundaryId: null },
                                      }
                                    }
                                  })}
                                >
                                  Extensible
                                </Button>
                              </div>
                              
                              {/* Extension controls */}
                              {selectedComponent.properties.copingMode === 'extensible' && (
                                <div className="space-y-3 pt-2">
                                  <p className="text-sm text-muted-foreground">
                                    Enable extensions to fill coping to boundaries. Each edge can be extended independently.
                                  </p>
                                  
                                  {/* Per-edge extension status */}
                                  {(['deepEnd', 'shallowEnd', 'leftSide', 'rightSide'] as const).map(direction => {
                                    const extension = selectedComponent.properties.copingExtensions?.[direction];
                                    const enabled = extension?.enabled ?? false;
                                    const stats = extension?.statistics;
                                    
                                    return (
                                      <div key={direction} className="border rounded p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <Label className="text-sm font-medium">
                                            {direction === 'deepEnd' ? 'Deep End' :
                                             direction === 'shallowEnd' ? 'Shallow End' :
                                             direction === 'leftSide' ? 'Left Side' : 'Right Side'}
                                          </Label>
                                          <Switch
                                            checked={enabled}
                                            onCheckedChange={(checked) => {
                                              updateComponent(selectedComponent.id, {
                                                properties: {
                                                  ...selectedComponent.properties,
                                                  copingExtensions: {
                                                    ...selectedComponent.properties.copingExtensions,
                                                    [direction]: {
                                                      enabled: checked,
                                                      maxDistance: checked ? null : null,
                                                      targetBoundaryId: null
                                                    }
                                                  }
                                                }
                                              });
                                            }}
                                          />
                                        </div>
                                        
                                        {enabled && stats && (
                                          <div className="text-xs space-y-1 text-muted-foreground">
                                            <div>Full: {stats.fullPavers}</div>
                                            <div>Edge: {stats.edgePavers}</div>
                                            <div>Area: {(stats.totalArea).toFixed(2)}m²</div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                
                <div>
                  <p className="text-sm font-medium mb-1">Position</p>
                  <p className="text-sm text-muted-foreground">
                    X: {Math.round(selectedComponent.position.x * 100)}mm, Y: {Math.round(selectedComponent.position.y * 100)}mm
                  </p>
                </div>
                
                {!poolData && (
                  <div>
                    <p className="text-sm font-medium mb-1">Dimensions</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedComponent.dimensions.width}mm × {selectedComponent.dimensions.height}mm
                    </p>
                  </div>
                )}

                {/* Boundary/House Segment Lengths */}
                {(selectedComponent.type === 'boundary' || selectedComponent.type === 'house') && (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      {selectedComponent.type === 'boundary' ? 'Segments' : 'Walls'}
                    </p>
                    <div className="space-y-2">
                      {getSegmentData().map((segment) => (
                        <div key={segment.index} className="flex items-center gap-2">
                          <Label className="text-xs w-20">{segment.label}</Label>
                          <Input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={segment.length.toFixed(1)}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value) && value > 0) {
                                handleSegmentLengthUpdate(segment.index, value);
                              }
                            }}
                            className="h-8 text-sm"
                          />
                          <span className="text-xs text-muted-foreground">m</span>
                        </div>
                      ))}
                    </div>
                    {selectedComponent.type === 'house' && selectedComponent.properties.area && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Total area: {selectedComponent.properties.area.toFixed(1)} m²
                      </p>
                    )}
                    {selectedComponent.properties.closed === false && (
                      <p className="text-xs text-amber-600 mt-2">
                        ⚠️ Shape is not closed
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium mb-2">Rotation</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 90, 180, 270].map(angle => (
                      <Button
                        key={angle}
                        variant={selectedComponent.rotation === angle ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleRotate(angle)}
                        className="text-xs"
                      >
                        {angle}°
                      </Button>
                    ))}
                  </div>
                </div>

                {poolData && (
                  <div>
                    <p className="text-sm font-medium mb-1">Pool Ends</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Shallow End (SE): Bottom-left</li>
                      <li>• Deep End (DE): Top-right</li>
                    </ul>
                    <p className="text-xs text-muted-foreground mt-1">
                      (Updates when rotated)
                    </p>
                  </div>
                )}

                <Separator />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDuplicate}
                    className="flex-1"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    className="flex-1"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Select a component to view properties
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Project Summary</CardTitle>
            <CardDescription>Measurements and counts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {measurements.pools.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">Pools</p>
                {measurements.pools.map((pool, i) => (
                  <div key={i} className="text-sm text-muted-foreground mb-1">
                    • {pool.type}
                  </div>
                ))}
              </div>
            )}

            {measurements.paving.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-semibold mb-2">Paving</p>
                  {measurements.paving.map((paving, i) => (
                    <div key={i} className="text-sm text-muted-foreground mb-1">
                      • {paving.count}× {paving.size}
                      <div className="ml-4">Total: {formatArea(paving.area)}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {measurements.drainage.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-semibold mb-2">Drainage</p>
                  {measurements.drainage.map((drain, i) => (
                    <div key={i} className="text-sm text-muted-foreground mb-1">
                      • {drain.type}: {formatLength(drain.length)}
                    </div>
                  ))}
                </div>
              </>
            )}

            {measurements.fencing.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-semibold mb-2">Fencing</p>
                  {measurements.fencing.map((fence, i) => (
                    <div key={i} className="text-sm text-muted-foreground mb-1">
                      • {fence.type}: {formatLength(fence.length)}
                      {fence.gates > 0 && (
                        <div className="ml-4">{fence.gates} gate(s)</div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {measurements.walls.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-semibold mb-2">Retaining Walls</p>
                  {measurements.walls.map((wall, i) => (
                    <div key={i} className="text-sm text-muted-foreground mb-1">
                      • {wall.material}: {formatLength(wall.length)}
                      <div className="ml-4">Height: {formatLength(wall.height)}</div>
                      {wall.status && (
                        <div className="ml-4 text-xs">({wall.status})</div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {components.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No components added yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
};

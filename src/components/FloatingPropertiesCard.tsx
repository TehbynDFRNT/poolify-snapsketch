import { Component } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDesignStore } from '@/store/designStore';
import { fillAreaWithPavers, calculateStatistics } from '@/utils/pavingFill';
import { POOL_LIBRARY } from '@/constants/pools';
import { GRID_CONFIG } from '@/constants/grid';
import { calculatePoolCoping, DEFAULT_COPING_OPTIONS } from '@/utils/copingCalculation';

interface FloatingPropertiesCardProps {
  component: Component | null;
}

export const FloatingPropertiesCard = ({ component }: FloatingPropertiesCardProps) => {
  const { updateComponent, deleteComponent, duplicateComponent, tileSelection } = useDesignStore();

  if (!component) {
    return null; // Don't show the card when nothing is selected
  }

  const isPaverSelectionActive = (
    component.type === 'pool' &&
    !!tileSelection &&
    tileSelection.scope === 'paver' &&
    tileSelection.componentId === component.id
  );

  return (
    <div className="absolute bottom-4 right-4 z-30 w-80 max-h-[calc(100vh-200px)] overflow-y-auto">
      <Card className="shadow-lg border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Properties</span>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {isPaverSelectionActive
                ? 'paver_selection'
                : (component.type === 'paving_area'
                    ? (component.properties.areaSurface === 'concrete' ? 'concrete_area'
                      : component.properties.areaSurface === 'grass' ? 'grass_area'
                      : 'paving_area')
                    : component.type)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <Label className="text-xs">Type</Label>
            <div className="text-sm font-medium capitalize">
              {isPaverSelectionActive
                ? 'Paver Selection'
                : (component.type === 'paving_area'
                    ? (component.properties.areaSurface === 'concrete' ? 'Concrete Area'
                      : component.properties.areaSurface === 'grass' ? 'Grass Area'
                      : 'Paving Area')
                    : component.type.replace('_', ' '))}
            </div>
          </div>

          {/* Paver Selection Card */}
          {isPaverSelectionActive && (
            (() => {
              const sel = tileSelection!;
              const areaM2 = (sel.widthMm * sel.heightMm) / 1_000_000;
              return (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Tile Size</Label>
                    <div className="text-sm font-medium">{sel.tileWidthMm} × {sel.tileHeightMm} mm</div>
                  </div>
                  <div>
                    <Label className="text-xs">Selection</Label>
                    <div className="text-sm text-muted-foreground">{sel.widthMm} × {sel.heightMm} mm · {sel.count} tile{sel.count === 1 ? '' : 's'}</div>
                  </div>
                  <div>
                    <Label className="text-xs">Selection Area</Label>
                    <div className="text-sm font-medium">{areaM2.toFixed(2)} m²</div>
                  </div>
                </div>
              );
            })()
          )}

          {/* Pool card (no paver selection) */}
          {!isPaverSelectionActive && component.type === 'pool' && component.properties.poolId && (
            <>
              <div>
                <Label className="text-xs">Pool Model</Label>
                <div className="text-sm font-medium">
                  {component.properties.pool?.name ||
                   POOL_LIBRARY.find(p => p.id === component.properties.poolId)?.name ||
                   component.properties.poolId}
                </div>
              </div>
              {/* Pool Coping Tile Dimensions */}
              <div className="space-y-2 pt-2 border-t">
                <div>
                  <Label className="text-xs font-medium">Coping Tile Dimensions</Label>
                  {(() => {
                    const hasExtensions = (component.properties.copingTiles && component.properties.copingTiles.length > 0)
                      || ((component.properties as any).copingExtensions && (component.properties as any).copingExtensions.length > 0);
                    return (
                      <>
                        <div className="flex gap-2 mt-1">
                        {['coping-400x400','coping-600x400','coping-400x600'].map(id => (
                          <Button
                            key={id}
                            variant={(component.properties.copingConfig?.id || 'none') === id ? 'default' : 'outline'}
                            size="sm"
                            disabled={hasExtensions}
                            onClick={() => {
                              if (hasExtensions) return;
                              const cfg = DEFAULT_COPING_OPTIONS.find(o => o.id === id)!;
                              const poolData = component.properties.pool || POOL_LIBRARY.find(p => p.id === component.properties.poolId);
                              if (!poolData) return;
                              const calc = calculatePoolCoping(poolData, cfg);
                              updateComponent(component.id, {
                                properties: {
                                  ...component.properties,
                                  showCoping: true,
                                  copingConfig: cfg,
                                  copingCalculation: calc,
                                }
                              });
                            }}
                            className="flex-1"
                          >
                            {id === 'coping-400x400' ? '400×400' : id === 'coping-600x400' ? '600×400' : '400×600'}
                          </Button>
                        ))}
                        </div>
                        {hasExtensions && (
                          <div className="text-xs text-amber-600 mt-1">
                            Delete extended coping tiles before changing tile dimensions.
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {component.properties.copingCalculation && (() => {
                  // Use copingStatistics if available (includes auto-tiles from boundary extensions)
                  // Otherwise fall back to manual calculation from base tiles
                  if (component.properties.copingStatistics) {
                    const stats = component.properties.copingStatistics;
                    return (
                      <div className="text-xs bg-muted p-2 rounded space-y-1">
                        <div className="font-medium">
                          Coping: {stats.total || 0} pavers
                        </div>
                        <div className="text-muted-foreground">
                          {stats.full || 0} full + {stats.partial || 0} partial
                        </div>
                        <div className="text-muted-foreground">
                          Area: {(stats.areaM2 || 0).toFixed(2)} m²
                        </div>
                      </div>
                    );
                  }

                  // Fallback: calculate from base tiles only (no auto-tiles)
                  const calc = component.properties.copingCalculation;
                  const baseTiles = [
                    ...(calc.deepEnd?.paverPositions || []),
                    ...(calc.shallowEnd?.paverPositions || []),
                    ...(calc.leftSide?.paverPositions || []),
                    ...(calc.rightSide?.paverPositions || []),
                  ];
                  const userTiles = component.properties.copingTiles || [];
                  const allTiles = [...baseTiles, ...userTiles];

                  const fullPavers = allTiles.filter(t => !t.isPartial).length;
                  const partialPavers = allTiles.filter(t => t.isPartial).length;
                  const totalPavers = allTiles.length;
                  const totalArea = allTiles.reduce((sum, t) => sum + (t.width * t.height), 0) / 1000000;

                  return (
                    <div className="text-xs bg-muted p-2 rounded space-y-1">
                      <div className="font-medium">
                        Coping: {totalPavers} pavers
                      </div>
                      <div className="text-muted-foreground">
                        {fullPavers} full + {partialPavers} partial
                      </div>
                      <div className="text-muted-foreground">
                        Area: {totalArea.toFixed(2)} m²
                      </div>
                    </div>
                  );
                })()}
              </div>
            </>
          )}

          {component.type === 'wall' && (
            <>
              <div>
                <Label className="text-xs">Material Type</Label>
                <select
                  value={component.properties.wallMaterial || 'timber'}
                  onChange={(e) => {
                    const newMaterial = e.target.value as 'timber' | 'concrete' | 'concrete_sleeper' | 'sandstone';
                    // Force non-concrete materials to 'existing'
                    const newStatus = newMaterial === 'concrete' ? component.properties.wallStatus : 'existing';
                    updateComponent(component.id, {
                      properties: {
                        ...component.properties,
                        wallMaterial: newMaterial,
                        wallStatus: newStatus
                      }
                    });
                  }}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm h-8"
                >
                  <option value="timber">Timber</option>
                  <option value="concrete">Drop Edge</option>
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
                      updateComponent(component.id, {
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
                    disabled={component.properties.wallMaterial !== 'concrete'}
                    onClick={() => updateComponent(component.id, {
                      properties: {
                        ...component.properties,
                        wallStatus: 'proposed'
                      }
                    })}
                    className="flex-1"
                  >
                    To Build
                  </Button>
                  <Button
                    variant={component.properties.wallStatus === 'existing' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateComponent(component.id, {
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

              {/* Node Heights */}
              {component.properties.points && component.properties.points.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-xs font-medium">Node Heights</Label>
                  {component.properties.points.map((_, idx) => {
                    const nodeHeights = component.properties.nodeHeights || {};
                    const label = String.fromCharCode(65 + idx); // A, B, C, ...
                    return (
                      <div key={`node-${idx}`} className="flex items-center gap-2">
                        <Label className="text-xs w-8">{label}:</Label>
                        <Input
                          type="number"
                          step="100"
                          min="0"
                          placeholder="Height"
                          value={nodeHeights[idx] || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            const newNodeHeights = { ...nodeHeights };
                            if (value === '') {
                              delete newNodeHeights[idx];
                            } else {
                              const heightInMM = parseInt(value);
                              if (!isNaN(heightInMM) && heightInMM >= 0) {
                                newNodeHeights[idx] = heightInMM;
                              }
                            }
                            updateComponent(component.id, {
                              properties: {
                                ...component.properties,
                                nodeHeights: newNodeHeights
                              }
                            });
                          }}
                          className="h-8 flex-1"
                        />
                        <span className="text-xs text-muted-foreground">mm</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {component.type === 'fence' && (
            <div>
              <Label className="text-xs">Fence Type</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  variant={component.properties.fenceType !== 'metal' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateComponent(component.id, {
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
                  onClick={() => updateComponent(component.id, {
                    properties: {
                      ...component.properties,
                      fenceType: 'metal'
                    }
                  })}
                  className="flex-1"
                >
                  Metal
                </Button>
              </div>
            </div>
          )}

          {component.type === 'gate' && (
            <div>
              <Label className="text-xs">Gate Type</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  variant={(component.properties as any).gateType !== 'metal' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateComponent(component.id, {
                    properties: {
                      ...component.properties,
                      gateType: 'glass'
                    }
                  })}
                  className="flex-1"
                >
                  Glass
                </Button>
                <Button
                  variant={(component.properties as any).gateType === 'metal' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateComponent(component.id, {
                    properties: {
                      ...component.properties,
                      gateType: 'metal'
                    }
                  })}
                  className="flex-1"
                >
                  Flat-top Metal
                </Button>
              </div>
            </div>
          )}

          {component.type === 'drainage' && (
            <div>
              <Label className="text-xs">Drainage Type</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  variant={component.properties.drainageType !== 'rock' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateComponent(component.id, {
                    properties: {
                      ...component.properties,
                      drainageType: 'ultradrain'
                    }
                  })}
                  className="flex-1"
                >
                  Ultra Drain
                </Button>
                <Button
                  variant={component.properties.drainageType === 'rock' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateComponent(component.id, {
                    properties: {
                      ...component.properties,
                      drainageType: 'rock'
                    }
                  })}
                  className="flex-1"
                >
                  Rock Drain
                </Button>
              </div>
            </div>
          )}

          {component.type === 'quick_measure' && (
            <div>
              <Label htmlFor="annotation" className="text-xs">Annotation</Label>
              <Input
                id="annotation"
                type="text"
                placeholder="Add annotation..."
                value={component.properties.annotation || ''}
                onChange={(e) => {
                  updateComponent(component.id, {
                    properties: {
                      ...component.properties,
                      annotation: e.target.value
                    }
                  });
                }}
                className="h-8"
              />
            </div>
          )}

          {component.type === 'height' && (
            <>
              <div>
                <Label htmlFor="heightValue" className="text-xs">Height (mm)</Label>
                <Input
                  id="heightValue"
                  type="number"
                  placeholder="100"
                  value={component.properties.heightValue ?? ''}
                  onChange={(e) => {
                    const txt = e.target.value;
                    const value = txt === '' ? undefined : Number(txt);
                    if (txt !== '' && Number.isNaN(value)) return; // ignore invalid
                    updateComponent(component.id, {
                      properties: {
                        ...component.properties,
                        heightValue: value as any,
                      }
                    });
                  }}
                  className="h-8"
                />
              </div>
              <div>
                <Label htmlFor="heightAnnotation" className="text-xs">Annotation (Optional)</Label>
                <Input
                  id="heightAnnotation"
                  type="text"
                  placeholder="Add annotation..."
                  value={component.properties.heightAnnotation || ''}
                  onChange={(e) => {
                    updateComponent(component.id, {
                      properties: {
                        ...component.properties,
                        heightAnnotation: e.target.value
                      }
                    });
                  }}
                  className="h-8"
                />
              </div>
            </>
          )}

          {component.type === 'paver' && (
            <div>
              <Label className="text-xs">Paver Size</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  variant={component.dimensions.width === 400 && component.dimensions.height === 400 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateComponent(component.id, {
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
                  onClick={() => updateComponent(component.id, {
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
              {/* Surface Type Selection */}
              <div>
                <Label className="text-xs">Surface Type</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    variant={(!component.properties.areaSurface || component.properties.areaSurface === 'pavers') ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      updateComponent(component.id, {
                        properties: {
                          ...component.properties,
                          areaSurface: 'pavers'
                        }
                      });
                    }}
                    className="flex-1"
                  >
                    Pavers
                  </Button>
                  <Button
                    variant={component.properties.areaSurface === 'concrete' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      updateComponent(component.id, {
                        properties: {
                          ...component.properties,
                          areaSurface: 'concrete'
                        }
                      });
                    }}
                    className="flex-1"
                  >
                    Concrete
                  </Button>
                  <Button
                    variant={component.properties.areaSurface === 'grass' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      updateComponent(component.id, {
                        properties: {
                          ...component.properties,
                          areaSurface: 'grass'
                        }
                      });
                    }}
                    className="flex-1"
                  >
                    Grass
                  </Button>
                </div>
              </div>

              {/* Only show paver options when surface type is pavers */}
              {(!component.properties.areaSurface || component.properties.areaSurface === 'pavers') && (
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
                          updateComponent(component.id, {
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
                          updateComponent(component.id, {
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
                            updateComponent(component.id, {
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
                            updateComponent(component.id, {
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

                  <div className="bg-muted rounded-lg p-3 space-y-2">
                    <h4 className="font-semibold text-sm">Material Count</h4>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>Full pavers:</span>
                        <span className="font-medium">{component.properties.statistics?.fullPavers || 0}</span>
                      </div>
                      <div className="flex justify-between text-orange-600">
                        <span>Edge pavers:</span>
                        <span className="font-medium">{component.properties.statistics?.edgePavers || 0}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t">
                        <span>Total area:</span>
                        <span className="font-medium">
                          {(() => {
                            const boundary = component.properties.boundary || [];
                            if (boundary.length < 3) return '0.00';
                            let area = 0;
                            for (let i = 0; i < boundary.length; i++) {
                              const j = (i + 1) % boundary.length;
                              area += boundary[i].x * boundary[j].y;
                              area -= boundary[j].x * boundary[i].y;
                            }
                            area = Math.abs(area / 2); // px²
                            const pxPerMm = GRID_CONFIG.spacing / 100;
                            const mmPerPx = 1 / pxPerMm;
                            const areaInM2 = (area * mmPerPx * mmPerPx) / 1_000_000;
                            return areaInM2.toFixed(2);
                          })()} m²
                        </span>
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

              {/* Show area summary for concrete/grass surfaces */}
              {component.properties.areaSurface && component.properties.areaSurface !== 'pavers' && (
                <div className="bg-muted rounded-lg p-3 space-y-2">
                  <h4 className="font-semibold text-sm">
                    {component.properties.areaSurface === 'concrete' ? 'Concrete Area' : 'Grass Area'}
                  </h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Total area:</span>
                      <span className="font-medium">
                        {(() => {
                          const boundary = component.properties.boundary || [];
                          if (boundary.length < 3) return '0';
                          let area = 0;
                          for (let i = 0; i < boundary.length; i++) {
                            const j = (i + 1) % boundary.length;
                            area += boundary[i].x * boundary[j].y;
                            area -= boundary[j].x * boundary[i].y;
                          }
                          area = Math.abs(area / 2);
                          // Convert from canvas px² to m²
                          // pxPerMm = GRID_CONFIG.spacing / 100 (px per mm)
                          // mmPerPx = 1 / pxPerMm; area_mm2 = area_px2 * (mmPerPx^2)
                          const pxPerMm = GRID_CONFIG.spacing / 100;
                          const mmPerPx = 1 / pxPerMm;
                          const areaInM2 = (area * mmPerPx * mmPerPx) / 1_000_000;
                          return areaInM2.toFixed(2);
                        })()} m²
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex gap-2 pt-2 border-t">
            {!isPaverSelectionActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => duplicateComponent(component.id)}
              className="flex-1"
            >
              Duplicate
            </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                // If a paver selection is active for this component, delete selection only
                if (tileSelection && tileSelection.scope === 'paver' && tileSelection.componentId === component.id) {
                  try {
                    const evt = new KeyboardEvent('keydown', { key: 'Delete' });
                    window.dispatchEvent(evt);
                    return;
                  } catch (_) {
                    // Fallback to component delete if dispatch fails
                  }
                }
                deleteComponent(component.id);
              }}
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

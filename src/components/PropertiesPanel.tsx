import { useDesignStore } from '@/store/designStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { formatLength, formatArea } from '@/utils/measurements';
import { ScrollArea } from '@/components/ui/scroll-area';
import { POOL_LIBRARY } from '@/constants/pools';
import { RotateCw, Copy, Trash2 } from 'lucide-react';

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

  // Get pool data if selected component is a pool
  const poolData = selectedComponent?.type === 'pool' 
    ? POOL_LIBRARY.find(p => p.id === selectedComponent.properties.poolId)
    : null;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {selectedComponent ? (
          <Card>
            <CardHeader>
              <CardTitle>
                {poolData ? poolData.name : selectedComponent.type.charAt(0).toUpperCase() + selectedComponent.type.slice(1)}
              </CardTitle>
              <CardDescription>
                {selectedComponent.type.charAt(0).toUpperCase() + selectedComponent.type.slice(1)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
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

import { useDesignStore } from '@/store/designStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatLength, formatArea } from '@/utils/measurements';
import { ScrollArea } from '@/components/ui/scroll-area';

export const PropertiesPanel = () => {
  const { selectedComponentId, components, getMeasurements } = useDesignStore();
  const selectedComponent = components.find(c => c.id === selectedComponentId);
  const measurements = getMeasurements();

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {selectedComponent ? (
          <Card>
            <CardHeader>
              <CardTitle>Selected Component</CardTitle>
              <CardDescription>
                {selectedComponent.type.charAt(0).toUpperCase() + selectedComponent.type.slice(1)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-1">Position</p>
                  <p className="text-sm text-muted-foreground">
                    X: {selectedComponent.position.x}mm, Y: {selectedComponent.position.y}mm
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-1">Dimensions</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedComponent.dimensions.width}mm × {selectedComponent.dimensions.height}mm
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium mb-1">Rotation</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedComponent.rotation}°
                  </p>
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
                    {pool.coping && (
                      <div className="ml-4">Coping: {pool.coping}</div>
                    )}
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

            {measurements.garden.area > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-semibold mb-2">Garden</p>
                  <p className="text-sm text-muted-foreground">
                    • Total area: {formatArea(measurements.garden.area)}
                  </p>
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

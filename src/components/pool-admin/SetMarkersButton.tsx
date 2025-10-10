import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Stage, Layer, Line, Circle, Text } from 'react-konva';
import { supabase } from '@/integrations/supabase/client';
import { MapPin } from 'lucide-react';

interface SetMarkersButtonProps {
  pool: any;
  onSuccess: () => void;
}

export function SetMarkersButton({ pool, onSuccess }: SetMarkersButtonProps) {
  const [open, setOpen] = useState(false);
  const [shallowEnd, setShallowEnd] = useState(pool.shallow_end_position);
  const [deepEnd, setDeepEnd] = useState(pool.deep_end_position);
  const [saving, setSaving] = useState(false);

  const handleCanvasClick = (e: any) => {
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;

    const point = { x: pos.x * 10, y: pos.y * 10 }; // Scale to mm

    if (!shallowEnd) {
      setShallowEnd(point);
    } else if (!deepEnd) {
      setDeepEnd(point);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('pool_variants')
      .update({
        shallow_end_position: shallowEnd,
        deep_end_position: deepEnd,
        updated_at: new Date().toISOString()
      })
      .eq('id', pool.id);

    setSaving(false);
    if (!error) {
      setOpen(false);
      onSuccess();
    }
  };

  const handleReset = () => {
    setShallowEnd(null);
    setDeepEnd(null);
  };

  const outline = pool.outline || [];

  return (
    <>
      <Button 
        size="sm" 
        variant="outline" 
        onClick={() => setOpen(true)}
        disabled={!outline || outline.length === 0}
      >
        <MapPin className="w-4 h-4 mr-1" />
        Set SE/DE
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <h2 className="text-xl font-bold mb-4">Set Shallow & Deep Ends</h2>
          
          <p className="text-sm text-muted-foreground mb-4">
            Click on the pool outline to mark: 
            {!shallowEnd && <strong> 1) Shallow End (SE)</strong>}
            {shallowEnd && !deepEnd && <strong> 2) Deep End (DE)</strong>}
            {shallowEnd && deepEnd && <strong className="text-green-600"> ✓ Both markers set</strong>}
          </p>

          <div className="border rounded bg-background">
            <Stage width={800} height={600} onClick={handleCanvasClick}>
              <Layer>
                {/* Pool outline */}
                {outline.length > 2 && (
                  <Line
                    points={outline.flatMap((p: any) => [p.x / 10, p.y / 10])}
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    closed={true}
                    fill="hsl(var(--primary))"
                    opacity={0.2}
                  />
                )}

                {/* SE marker */}
                {shallowEnd && (
                  <>
                    <Circle
                      x={shallowEnd.x / 10}
                      y={shallowEnd.y / 10}
                      radius={20}
                      fill="#10B981"
                      opacity={0.8}
                    />
                    <Text
                      x={shallowEnd.x / 10 - 12}
                      y={shallowEnd.y / 10 - 10}
                      text="SE"
                      fontSize={16}
                      fontStyle="bold"
                      fill="white"
                    />
                  </>
                )}

                {/* DE marker */}
                {deepEnd && (
                  <>
                    <Circle
                      x={deepEnd.x / 10}
                      y={deepEnd.y / 10}
                      radius={20}
                      fill="#EF4444"
                      opacity={0.8}
                    />
                    <Text
                      x={deepEnd.x / 10 - 12}
                      y={deepEnd.y / 10 - 10}
                      text="DE"
                      fontSize={16}
                      fontStyle="bold"
                      fill="white"
                    />
                  </>
                )}
              </Layer>
            </Stage>
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={handleReset} disabled={saving}>
              Reset
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!shallowEnd || !deepEnd || saving}
            >
              {saving ? 'Saving...' : 'Save Markers'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

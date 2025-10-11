import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Stage, Layer, Line, Circle, Text } from 'react-konva';

export default function PoolEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: variant, isLoading } = useQuery({
    queryKey: ['pool-variant', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pool_variants')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as any; // Cast to any to work with actual database schema
    }
  });

  const [points, setPoints] = useState<Array<{x: number, y: number}>>([]);
  const [shallowEnd, setShallowEnd] = useState<{x: number, y: number} | null>(null);
  const [deepEnd, setDeepEnd] = useState<{x: number, y: number} | null>(null);
  const [mode, setMode] = useState<'edit' | 'set-se' | 'set-de'>('edit');

  // Initialize points when variant loads
  useEffect(() => {
    if (variant?.outline) {
      const outlineData = variant.outline as any;
      setPoints(Array.isArray(outlineData) ? outlineData : []);
      setShallowEnd((variant.shallow_end_position as any) || null);
      setDeepEnd((variant.deep_end_position as any) || null);
    }
  }, [variant]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from('pool_variants')
        .update({
          outline: points,
          shallow_end_position: shallowEnd,
          deep_end_position: deepEnd,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pool-variants'] });
      toast.success('Pool updated!');
      navigate('/admin/pool-library');
    },
    onError: (error) => {
      toast.error('Failed to save: ' + error.message);
    }
  });

  const handleStageClick = (e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    
    if (mode === 'set-se') {
      setShallowEnd({ x: pos.x, y: pos.y });
      setMode('edit');
    } else if (mode === 'set-de') {
      setDeepEnd({ x: pos.x, y: pos.y });
      setMode('edit');
    }
  };

  const handlePointDrag = (index: number, e: any) => {
    const newPoints = [...points];
    newPoints[index] = {
      x: e.target.x(),
      y: e.target.y()
    };
    setPoints(newPoints);
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/admin/pool-library')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">Edit: {variant?.display_name}</h1>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>

        <div className="grid grid-cols-[1fr_300px] gap-6">
          <div className="bg-card rounded-lg shadow p-4">
            <div className="mb-4 flex gap-2">
              <Button
                variant={mode === 'edit' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('edit')}
              >
                Edit Points
              </Button>
              <Button
                variant={mode === 'set-se' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('set-se')}
              >
                Set Shallow End
              </Button>
              <Button
                variant={mode === 'set-de' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('set-de')}
              >
                Set Deep End
              </Button>
            </div>

            <Stage
              width={800}
              height={600}
              onClick={handleStageClick}
              className="border rounded bg-background"
            >
              <Layer>
                {/* Pool outline */}
                <Line
                  points={points.flatMap(p => [p.x, p.y])}
                  closed
                  fill="#3B82F6"
                  opacity={0.3}
                  stroke="#3B82F6"
                  strokeWidth={2}
                />

                {/* Editable points */}
                {points.map((point, i) => (
                  <Circle
                    key={i}
                    x={point.x}
                    y={point.y}
                    radius={8}
                    fill="#EF4444"
                    draggable
                    onDragEnd={(e) => handlePointDrag(i, e)}
                  />
                ))}

                {/* Shallow End */}
                {shallowEnd && (
                  <>
                    <Circle x={shallowEnd.x} y={shallowEnd.y} radius={12} fill="#10B981" />
                    <Text x={shallowEnd.x + 15} y={shallowEnd.y - 8} text="SE" fontSize={16} />
                  </>
                )}

                {/* Deep End */}
                {deepEnd && (
                  <>
                    <Circle x={deepEnd.x} y={deepEnd.y} radius={12} fill="#F59E0B" />
                    <Text x={deepEnd.x + 15} y={deepEnd.y - 8} text="DE" fontSize={16} />
                  </>
                )}
              </Layer>
            </Stage>
          </div>

          <div className="bg-card rounded-lg shadow p-4">
            <h3 className="font-semibold mb-4">Instructions</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong>Edit Points:</strong> Drag red circles to adjust pool shape</p>
              <p><strong>Set SE:</strong> Click button, then click canvas to place Shallow End marker</p>
              <p><strong>Set DE:</strong> Click button, then click canvas to place Deep End marker</p>
              <p className="pt-4 text-xs">After saving, use "Generate Coping" to create variants</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

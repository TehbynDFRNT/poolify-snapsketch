import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { X } from 'lucide-react';
import { calculatePoolCoping } from '@/utils/copingCalculation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Pool {
  id: string;
  name: string;
  length: number;
  width: number;
  outline: Array<{x: number, y: number}>;
  shallowEnd: {x: number, y: number, label: string};
  deepEnd: {x: number, y: number, label: string};
  color: string;
}

interface PoolSelectorProps {
  onSelect: (pool: Pool, copingOptions: { showCoping: boolean; copingCalculation?: any }) => void;
  onClose: () => void;
}

export const PoolSelector = ({ onSelect, onClose }: PoolSelectorProps) => {
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [enableCoping, setEnableCoping] = useState(true);

  // Fetch published pool variants from database
  const { data: poolVariants, isLoading } = useQuery({
    queryKey: ['pool-variants-published'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pool_variants')
        .select('*')
        .eq('status', 'published')
        .order('sort_order');
      
      if (error) throw error;
      return data;
    }
  });

  // Convert database pools to Pool interface format
  const allPools: Pool[] = (poolVariants || []).map((variant: any) => {
    const outline: Array<{x:number;y:number}> = variant.outline || [];
    const minX = Math.min(...outline.map(p => p.x), 0);
    const maxX = Math.max(...outline.map(p => p.x), 0);
    const minY = Math.min(...outline.map(p => p.y), 0);
    const maxY = Math.max(...outline.map(p => p.y), 0);

    return {
      id: variant.id,
      name: variant.pool_name,
      length: maxX - minX,
      width: maxY - minY,
      outline,
      shallowEnd: variant.shallow_end_position
        ? { ...(variant.shallow_end_position as any) }
        : { x: 150, y: (maxY - minY) / 2, label: 'SE' },
      deepEnd: variant.deep_end_position
        ? { ...(variant.deep_end_position as any) }
        : { x: (maxX - minX) - 150, y: (maxY - minY) / 2, label: 'DE' },
      color: '#3B82F6'
    };
  });

  const handleSelect = () => {
    if (selectedPoolId) {
      const pool = allPools.find(p => p.id === selectedPoolId);
      if (pool) {
        const copingCalculation = enableCoping ? calculatePoolCoping(pool) : undefined;
        onSelect(pool, {
          showCoping: enableCoping,
          copingCalculation,
        });
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-xl border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Select Pool Shape</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading pools...</div>
        ) : allPools.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No pools available</div>
        ) : (
          <RadioGroup value={selectedPoolId || ''} onValueChange={setSelectedPoolId}>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {allPools.map(pool => (
                <div
                  key={pool.id}
                  className="flex items-center gap-3 p-3 border rounded hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => setSelectedPoolId(pool.id)}
                >
                  <RadioGroupItem value={pool.id} id={pool.id} />
                  <Label htmlFor={pool.id} className="font-medium cursor-pointer flex-1">
                    {pool.name}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        )}

        <div className="flex items-center gap-2 mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
          <Checkbox
            id="enableCoping"
            checked={enableCoping}
            onCheckedChange={(checked) => setEnableCoping(checked as boolean)}
          />
          <label htmlFor="enableCoping" className="text-sm cursor-pointer flex-1">
            Add pool coping (400×400mm pavers)
            <div className="text-xs text-muted-foreground mt-0.5">
              1 row on SE + sides, 2 rows on DE
            </div>
          </label>
        </div>

        <div className="flex gap-3 mt-6">
          <Button 
            onClick={onClose}
            variant="outline"
            className="flex-1"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSelect}
            disabled={!selectedPoolId}
            className="flex-1"
          >
            Select
          </Button>
        </div>
      </div>
    </div>
  );
};

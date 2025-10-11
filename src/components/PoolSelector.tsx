import { useState } from 'react';
import { Pool, POOL_LIBRARY } from '@/constants/pools';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { X } from 'lucide-react';
import { calculatePoolCoping } from '@/utils/copingCalculation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PoolSelectorProps {
  onSelect: (pool: Pool, copingOptions: { showCoping: boolean; copingCalculation?: any }) => void;
  onClose: () => void;
}

export const PoolSelector = ({ onSelect, onClose }: PoolSelectorProps) => {
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [enableCoping, setEnableCoping] = useState(true);

  // Fetch published pool variants from database
  const { data: cloudPools } = useQuery({
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

  // Combine hardcoded pools with published cloud pools
  const allPools = POOL_LIBRARY;

  const handleSelect = () => {
    if (selectedPoolId) {
      const pool = POOL_LIBRARY.find(p => p.id === selectedPoolId);
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

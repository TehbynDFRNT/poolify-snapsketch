import { useState } from 'react';
import { Pool } from '@/constants/pools';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Loader2 } from 'lucide-react';
import { calculatePoolCoping, CopingConfig } from '@/utils/copingCalculation';
import { usePublishedPools } from '@/hooks/usePoolVariants';

interface PoolSelectorProps {
  onSelect: (pool: Pool, copingOptions: { showCoping: boolean; copingConfig?: CopingConfig; copingCalculation?: any }) => void;
  onClose: () => void;
}

export const PoolSelector = ({ onSelect, onClose }: PoolSelectorProps) => {
  const { data: publishedPools, isLoading } = usePublishedPools();
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [selectedCopingId, setSelectedCopingId] = useState<string>('none');

  const selectedPool = publishedPools?.find(p => p.id === selectedPoolId);
  const copingOptions = (selectedPool?.coping_options as CopingConfig[]) || [];
  const selectedCoping = copingOptions.find(opt => opt.id === selectedCopingId);

  const handleSelect = () => {
    if (selectedPoolId && publishedPools) {
      const dbPool = publishedPools.find(p => p.id === selectedPoolId);
      if (dbPool) {
        // Convert database pool to Pool interface
        const pool: Pool = {
          id: dbPool.id,
          name: dbPool.pool_name,
          length: Math.max(...dbPool.outline.map(p => p.x)) - Math.min(...dbPool.outline.map(p => p.x)),
          width: Math.max(...dbPool.outline.map(p => p.y)) - Math.min(...dbPool.outline.map(p => p.y)),
          outline: dbPool.outline,
          shallowEnd: dbPool.shallow_end_position 
            ? { ...dbPool.shallow_end_position, label: 'SE' }
            : { x: 150, y: 1500, label: 'SE' },
          deepEnd: dbPool.deep_end_position
            ? { ...dbPool.deep_end_position, label: 'DE' }
            : { x: 6850, y: 1500, label: 'DE' },
          color: '#3B82F6'
        };
        
        const showCoping = selectedCopingId !== 'none';
        const copingCalculation = showCoping && selectedCoping 
          ? calculatePoolCoping(pool, selectedCoping) 
          : undefined;
        
        onSelect(pool, {
          showCoping,
          copingConfig: selectedCoping,
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
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading pools...</span>
          </div>
        ) : !publishedPools || publishedPools.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No pools available</p>
            <p className="text-sm text-muted-foreground mt-1">
              Contact your administrator to add pools
            </p>
          </div>
        ) : (
          <>
            <RadioGroup value={selectedPoolId || ''} onValueChange={setSelectedPoolId}>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {publishedPools.map(pool => (
                  <div
                    key={pool.id}
                    className="flex items-center gap-3 p-3 border rounded hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => setSelectedPoolId(pool.id)}
                  >
                    <RadioGroupItem value={pool.id} id={pool.id} />
                    <Label htmlFor={pool.id} className="font-medium cursor-pointer flex-1">
                      {pool.pool_name}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>

            {selectedPool && copingOptions.length > 0 && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <Label htmlFor="coping-type" className="text-sm font-medium mb-2 block">
                  Coping Type
                </Label>
                <Select value={selectedCopingId} onValueChange={setSelectedCopingId}>
                  <SelectTrigger id="coping-type" className="w-full bg-background">
                    <SelectValue placeholder="Select coping type" />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="none">No Coping</SelectItem>
                    {copingOptions.map(opt => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {selectedCoping && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Tile: {selectedCoping.tile.along}×{selectedCoping.tile.inward}mm | 
                    Rows: SE={selectedCoping.rows.shallow}, Sides={selectedCoping.rows.sides}, DE={selectedCoping.rows.deep}
                  </div>
                )}
              </div>
            )}
          </>
        )}

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
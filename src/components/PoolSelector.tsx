import { useState } from 'react';
import { Pool, POOL_LIBRARY } from '@/constants/pools';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

interface PoolSelectorProps {
  onSelect: (pool: Pool) => void;
  onClose: () => void;
}

export const PoolSelector = ({ onSelect, onClose }: PoolSelectorProps) => {
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);

  const handleSelect = () => {
    if (selectedPoolId) {
      const pool = POOL_LIBRARY.find(p => p.id === selectedPoolId);
      if (pool) {
        onSelect(pool);
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
            {POOL_LIBRARY.map(pool => (
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

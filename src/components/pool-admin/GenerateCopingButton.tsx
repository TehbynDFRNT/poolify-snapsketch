import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { generateCopingLayout } from '@/utils/copingAlgorithm';
import { Sparkles, Loader2 } from 'lucide-react';

const PAVER_SIZES = [
  { value: '400×400', label: '400×400 mm', width: 400, height: 400 },
  { value: '400×600', label: '400×600 mm', width: 400, height: 600 },
  { value: '600×400', label: '600×400 mm', width: 600, height: 400 },
];

interface GenerateCopingButtonProps {
  pool: any;
  onSuccess: () => void;
}

export function GenerateCopingButton({ pool, onSuccess }: GenerateCopingButtonProps) {
  const [open, setOpen] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState(['400×400', '400×600']);
  const [generating, setGenerating] = useState(false);

  const toggleSize = (size: string) => {
    setSelectedSizes(prev =>
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    );
  };

  const handleGenerate = async () => {
    if (!pool.shallow_end_position || !pool.deep_end_position) {
      alert('Please set SE/DE markers first!');
      return;
    }

    setGenerating(true);

    try {
      // Generate variants
      const variants = selectedSizes.map(sizeStr => {
        const paverConfig = PAVER_SIZES.find(s => s.value === sizeStr)!;
        const paverSize = { width: paverConfig.width, height: paverConfig.height };
        
        // Corner pavers are always 400x400, full pavers use selected size
        const cornerSize = { width: 400, height: 400 };
        const copingLayout = generateCopingLayout(pool.outline, cornerSize, paverSize) as any;

        return {
          pool_name: `${pool.pool_name} - ${sizeStr}`,
          outline: pool.outline,
          shallow_end_position: pool.shallow_end_position,
          deep_end_position: pool.deep_end_position,
          coping_layout: copingLayout,
          paver_size: sizeStr,
          status: 'draft',
        };
      });

      // Insert variants
      const { error } = await supabase
        .from('pool_variants')
        .insert(variants);

      if (error) throw error;

      // Delete the unconfigured base pool
      await supabase
        .from('pool_variants')
        .delete()
        .eq('id', pool.id);

      setOpen(false);
      onSuccess();

    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const hasMarkers = pool.shallow_end_position && pool.deep_end_position;

  return (
    <>
      <Button 
        size="sm" 
        onClick={() => setOpen(true)}
        disabled={!hasMarkers}
      >
        <Sparkles className="w-4 h-4 mr-1" />
        Generate Coping
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <h2 className="text-xl font-bold mb-4">Generate Coping Options</h2>

          <p className="text-sm text-muted-foreground mb-4">
            Select which paver sizes to generate coping layouts for:
          </p>

          <div className="space-y-2">
            {PAVER_SIZES.map(size => (
              <label key={size.value} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-accent">
                <Checkbox
                  checked={selectedSizes.includes(size.value)}
                  onCheckedChange={() => toggleSize(size.value)}
                  disabled={generating}
                />
                <span>{size.label}</span>
              </label>
            ))}
          </div>

          <div className="bg-primary/10 border border-primary/20 rounded p-3 text-sm mt-4">
            Will create <strong>{selectedSizes.length}</strong> variant(s). 
            Each uses one paver size throughout (cuts where needed).
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={generating}>
              Cancel
            </Button>
            <Button 
              onClick={handleGenerate}
              disabled={selectedSizes.length === 0 || generating}
            >
              {generating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {generating ? 'Generating...' : 'Generate'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

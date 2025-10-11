import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { generateCopingForOption, type CopingOption } from '@/utils/copingAlgorithm';
import type { PoolVariant } from '@/types/poolVariant';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  variant: PoolVariant;
}

export const CopingGeneratorDialog = ({ open, onClose, variant }: Props) => {
  const [selectedOption, setSelectedOption] = useState<CopingOption>('400x400');
  const [groutWidth, setGroutWidth] = useState(5);
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: async () => {
      // Generate coping layout
      const copingLayout = generateCopingForOption(
        variant.outline_points,
        selectedOption,
        groutWidth
      );

      // Determine variant suffix
      let suffix = '';
      switch (selectedOption) {
        case 'none': suffix = 'No Coping'; break;
        case '400x400': suffix = '400×400'; break;
        case '400x600': suffix = '400×600'; break;
        case '600x400': suffix = '600×400'; break;
      }

      // Create NEW variant (don't modify existing) - using any to bypass type mismatch
      const { error } = await (supabase as any)
        .from('pool_variants')
        .insert({
          pool_name: variant.pool_name,
          outline: variant.outline_points,
          shallow_end_position: variant.shallow_end,
          deep_end_position: variant.deep_end,
          features: variant.features,
          paver_size: selectedOption === 'none' ? null : selectedOption,
          coping_layout: copingLayout,
          coping_width: 400,
          grout_width: groutWidth,
          status: 'draft',
          notes: `Generated from ${variant.id}`,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pool-variants'] });
      toast.success('New coping variant created!');
      onClose();
    },
    onError: (error) => {
      toast.error('Failed: ' + error.message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Coping Variant</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            This will create a NEW variant with the selected coping configuration.
            All options use 400×400mm corner pavers.
          </p>

          <RadioGroup value={selectedOption} onValueChange={(v) => setSelectedOption(v as CopingOption)}>
            <div className="space-y-2">
              <div className="flex items-center space-x-2 border rounded p-3">
                <RadioGroupItem value="none" id="none" />
                <Label htmlFor="none" className="flex-1 cursor-pointer">
                  <div className="font-medium">No Coping</div>
                  <div className="text-xs text-muted-foreground">Pool only</div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 border rounded p-3">
                <RadioGroupItem value="400x400" id="400x400" />
                <Label htmlFor="400x400" className="flex-1 cursor-pointer">
                  <div className="font-medium">400×400</div>
                  <div className="text-xs text-muted-foreground">400×400 corners + 400×400 full</div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 border rounded p-3">
                <RadioGroupItem value="400x600" id="400x600" />
                <Label htmlFor="400x600" className="flex-1 cursor-pointer">
                  <div className="font-medium">400×600</div>
                  <div className="text-xs text-muted-foreground">400×400 corners + 400×600 full</div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 border rounded p-3">
                <RadioGroupItem value="600x400" id="600x400" />
                <Label htmlFor="600x400" className="flex-1 cursor-pointer">
                  <div className="font-medium">600×400</div>
                  <div className="text-xs text-muted-foreground">400×400 corners + 600×400 full</div>
                </Label>
              </div>
            </div>
          </RadioGroup>

          <div>
            <Label htmlFor="grout">Grout Width (mm)</Label>
            <input
              id="grout"
              type="number"
              min="1"
              max="10"
              value={groutWidth}
              onChange={(e) => setGroutWidth(Number(e.target.value))}
              className="mt-2 w-full px-3 py-2 border rounded"
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
            {generateMutation.isPending ? 'Creating...' : 'Create Variant'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

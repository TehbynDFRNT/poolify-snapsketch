import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { parseDxfFile } from '@/utils/dxfParser';
import { generateCopingLayout } from '@/utils/copingAlgorithm';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

const PAVER_CONFIGS = [
  { corner: { width: 400, height: 400 }, full: { width: 400, height: 400 }, name: '400×400 Corner + 400×400 Full' },
  { corner: { width: 400, height: 400 }, full: { width: 600, height: 400 }, name: '400×400 Corner + 600×400 Full' },
  { corner: { width: 400, height: 600 }, full: { width: 400, height: 400 }, name: '400×600 Corner + 400×400 Full' },
  { corner: { width: 600, height: 400 }, full: { width: 400, height: 400 }, name: '600×400 Corner + 400×400 Full' },
];

interface BulkImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkImportModal({ open, onClose, onSuccess }: BulkImportModalProps) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setProgress(0);
    setStatusText('Reading DXF file...');

    try {
      const text = await file.text();
      setProgress(10);
      setStatusText('Parsing pool outlines...');

      const pools = parseDxfFile(text);
      if (pools.length === 0) {
        throw new Error('No pool outlines found in DXF file');
      }

      setStatusText(`Found ${pools.length} pools. Generating coping variants...`);
      setProgress(20);

      const allVariants = [];
      const nameCounts: Record<string, number> = {};
      const progressPerPool = 70 / pools.length;

      // Generate 4 variants for each pool
      for (let poolIndex = 0; poolIndex < pools.length; poolIndex++) {
        const pool = pools[poolIndex];
        const poolName = pool.name;

        // Ensure unique variant names if DXF contains duplicate pool names
        const count = (nameCounts[poolName] ?? 0) + 1;
        nameCounts[poolName] = count;
        const variantPrefix = count > 1 ? `${poolName} (${count})` : poolName;

        for (let configIndex = 0; configIndex < PAVER_CONFIGS.length; configIndex++) {
          const config = PAVER_CONFIGS[configIndex];
          
          const copingLayout = generateCopingLayout(
            pool.outlinePoints,
            config.corner,
            config.full
          );

          allVariants.push({
            pool_name: `${poolName} - ${config.name}`,
            outline: pool.outlinePoints,
            shallow_end_position: null,
            deep_end_position: null,
            paver_size: config.name,
            coping_width: 400,
            grout_width: 5,
            coping_layout: {
              pavers: [
                ...copingLayout.cornerPavers.map(p => ({
                  id: p.id,
                  position: p.position,
                  dimensions: p.size,
                  rotation: p.rotation,
                  type: 'corner' as const,
                  original_size: `${config.corner.width}x${config.corner.height}` as const,
                })),
                ...copingLayout.fullPavers.map(p => ({
                  id: p.id,
                  position: p.position,
                  dimensions: p.size,
                  rotation: p.rotation,
                  type: 'full' as const,
                  original_size: `${config.full.width}x${config.full.height}` as const,
                })),
                ...copingLayout.stripePavers.map(p => ({
                  id: p.id,
                  position: p.position,
                  dimensions: { width: p.cutWidth || p.size.width, height: p.size.height },
                  rotation: p.rotation,
                  type: 'stripe_cut' as const,
                  original_size: `${config.full.width}x${config.full.height}` as const,
                  cut_width: p.cutWidth,
                })),
              ],
              metadata: {
                total_pavers: copingLayout.measurements.totalPavers,
                corner_pavers: 4,
                full_pavers: copingLayout.measurements.fullPavers,
                stripe_pavers: copingLayout.measurements.stripePavers,
                total_area_m2: copingLayout.measurements.totalArea,
                grout_width_mm: 5,
              },
              validation: {
                is_valid: true,
                errors: [],
                warnings: [],
              },
              generated_at: new Date().toISOString(),
            },
            features: [],
            status: 'draft' as const,
            sort_order: poolIndex * 10 + configIndex,
          });
        }

        setProgress(20 + (poolIndex + 1) * progressPerPool);
        setStatusText(`Generated variants for ${poolName}...`);
      }

      setStatusText('Checking for duplicates...');
      setProgress(90);

      // Get unique pool names to check for existing variants
      const uniquePoolNames = [...new Set(allVariants.map(v => v.pool_name))];
      
      // Delete existing variants for these pools to allow re-import
      const { error: deleteError } = await supabase
        .from('pool_variants')
        .delete()
        .in('pool_name', uniquePoolNames);

      if (deleteError) throw deleteError;

      setStatusText('Saving to database...');
      
      const { error } = await supabase
        .from('pool_variants')
        .insert(allVariants as any);

      if (error) throw error;

      setProgress(100);
      setStatusText(`✓ Successfully imported ${pools.length} pools with ${allVariants.length} total variants!`);
      toast.success(`Imported ${pools.length} pools (${allVariants.length} variants)`);

      setTimeout(() => {
        setProgress(0);
        setStatusText('');
        onSuccess();
        onClose();
      }, 2000);

    } catch (error: any) {
      console.error('Bulk import error:', error);
      setStatusText('');
      setProgress(0);
      toast.error(`Bulk import failed: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (!importing) {
      setProgress(0);
      setStatusText('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Import Pools from DXF</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a DXF file containing multiple pool outlines. Each pool will automatically 
            generate 4 coping variants (36 variants total for 9 pools).
          </p>

          <div className="border-2 border-dashed rounded-lg p-12 text-center bg-muted/30">
            <input
              type="file"
              accept=".dxf"
              onChange={handleBulkImport}
              disabled={importing}
              className="hidden"
              id="dxf-bulk-import"
            />
            <label 
              htmlFor="dxf-bulk-import" 
              className={importing ? 'cursor-not-allowed' : 'cursor-pointer'}
            >
              {importing ? (
                <div className="space-y-4">
                  <div className="animate-spin text-4xl mb-4">⏳</div>
                  <div className="font-medium text-sm">{statusText}</div>
                  <Progress value={progress} className="w-full" />
                  <div className="text-xs text-muted-foreground">{progress}%</div>
                </div>
              ) : (
                <div>
                  <div className="text-6xl mb-4">📁</div>
                  <div className="text-lg font-medium mb-2">
                    Click to upload DXF file
                  </div>
                  <div className="text-sm text-muted-foreground">
                    All pools will be imported with 4 coping variants each
                  </div>
                </div>
              )}
            </label>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-900 dark:text-blue-100">
              <strong>Tip:</strong> Each pool in the DXF will generate 4 variants with different 
              paver combinations. All will be saved as drafts for review.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

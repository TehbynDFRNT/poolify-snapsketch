import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { parseDxfFile } from '@/utils/dxfParser';
import { generateCopingLayout } from '@/utils/copingAlgorithm';
import { toast } from 'sonner';

const PAVER_CONFIGS = [
  { corner: { width: 400, height: 400 }, full: { width: 400, height: 400 }, name: '400×400 Corner + 400×400 Full' },
  { corner: { width: 400, height: 400 }, full: { width: 600, height: 400 }, name: '400×400 Corner + 600×400 Full' },
  { corner: { width: 400, height: 600 }, full: { width: 400, height: 400 }, name: '400×600 Corner + 400×400 Full' },
  { corner: { width: 600, height: 400 }, full: { width: 400, height: 400 }, name: '600×400 Corner + 400×400 Full' },
];

interface ImportPoolModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportPoolModal({ open, onClose, onSuccess }: ImportPoolModalProps) {
  const [poolName, setPoolName] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !poolName.trim()) return;

    setImporting(true);
    setProgress('Reading DXF file...');

    try {
      const text = await file.text();
      setProgress('Parsing pool outline...');

      const pools = parseDxfFile(text);
      if (pools.length === 0) {
        throw new Error('No pool outlines found in DXF file');
      }

      // Use first pool from DXF
      const pool = pools[0];
      const outline = pool.outlinePoints;

      setProgress('Generating 4 coping variants...');

      // Generate 4 coping variants
      const variants = PAVER_CONFIGS.map((config, index) => {
        const copingLayout = generateCopingLayout(
          outline,
          config.corner,
          config.full
        );

        return {
          pool_name: poolName.trim(),
          variant_name: `${poolName.trim()} - ${config.name}`,
          length: pool.dimensions.length,
          width: pool.dimensions.width,
          outline_points: outline,
          has_coping: true,
          coping_type: `${config.corner.width}x${config.corner.height}_${config.full.width}x${config.full.height}`,
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
          sort_order: index,
        };
      });

      setProgress('Checking for duplicates...');

      // Delete existing variants for this pool name to allow re-import
      const { error: deleteError } = await supabase
        .from('pool_variants')
        .delete()
        .eq('pool_name', poolName.trim());

      if (deleteError) throw deleteError;

      setProgress('Saving to database...');

      const { error } = await supabase
        .from('pool_variants')
        .insert(variants as any);

      if (error) throw error;

      setProgress('✓ Successfully imported pool with 4 coping variants!');
      toast.success(`Created ${variants.length} variants for ${poolName}`);

      setTimeout(() => {
        setPoolName('');
        setProgress('');
        onSuccess();
        onClose();
      }, 1500);

    } catch (error: any) {
      console.error('Import error:', error);
      setProgress('');
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (!importing) {
      setPoolName('');
      setProgress('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Pool from DXF</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Pool Name *</label>
            <Input
              placeholder="e.g., Empire 6×3"
              value={poolName}
              onChange={(e) => setPoolName(e.target.value)}
              disabled={importing}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">DXF File *</label>
            <div className="border-2 border-dashed rounded-lg p-8 text-center bg-muted/30">
              <input
                type="file"
                accept=".dxf"
                onChange={handleImport}
                disabled={importing || !poolName.trim()}
                className="hidden"
                id="dxf-single-import"
              />
              <label 
                htmlFor="dxf-single-import" 
                className={!poolName.trim() || importing ? 'cursor-not-allowed' : 'cursor-pointer'}
              >
                {importing ? (
                  <div>
                    <div className="animate-spin text-4xl mb-2">⏳</div>
                    <div className="font-medium text-sm">{progress}</div>
                  </div>
                ) : (
                  <div>
                    <div className="text-4xl mb-2">📁</div>
                    <div className="font-medium">Click to upload DXF</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Will generate 4 coping variants automatically
                    </div>
                  </div>
                )}
              </label>
            </div>
          </div>

          {!poolName.trim() && !importing && (
            <p className="text-sm text-orange-600">
              ⚠️ Enter a pool name before uploading
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

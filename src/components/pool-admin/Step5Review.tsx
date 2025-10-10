import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CopingPreview from './CopingPreview';
import PublishConfirmDialog from './PublishConfirmDialog';
import { useToast } from '@/hooks/use-toast';

interface Step5Props {
  poolData: any;
  setPoolData: (data: any) => void;
  onBack: () => void;
}

export default function Step5Review({ poolData, onBack }: Step5Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [showPublishDialog, setShowPublishDialog] = useState(false);

  const variants = poolData.generatedVariants || [];
  const currentVariant = variants[selectedVariantIndex];

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      
      const insertData = variants.map((variant: any) => ({
        pool_name: variant.pool_name,
        variant_name: variant.variant_name,
        length: variant.length,
        width: variant.width,
        outline_points: variant.outline_points,
        shallow_end: variant.shallow_end,
        deep_end: variant.deep_end,
        features: variant.features || [],
        has_coping: variant.has_coping,
        coping_type: variant.coping_type,
        coping_width: variant.has_coping ? (variant.coping_width || 400) : null,
        grout_width: variant.has_coping ? 5 : null,
        coping_layout: variant.coping_layout,
        notes: variant.notes || '',
        status: 'draft',
        created_by: user?.id,
        updated_at: new Date().toISOString()
      }));
      
      const { data, error } = await supabase
        .from('pool_variants')
        .insert(insertData)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pool-variants-admin'] });
      toast({
        title: "Success",
        description: `${data.length} variant(s) saved as draft`,
      });
      navigate('/admin/pool-library');
    },
    onError: (error) => {
      console.error('Save failed:', error);
      toast({
        title: "Error",
        description: "Failed to save drafts",
        variant: "destructive",
      });
    }
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      
      const insertData = variants.map((variant: any) => ({
        pool_name: variant.pool_name,
        variant_name: variant.variant_name,
        length: variant.length,
        width: variant.width,
        outline_points: variant.outline_points,
        shallow_end: variant.shallow_end,
        deep_end: variant.deep_end,
        features: variant.features || [],
        has_coping: variant.has_coping,
        coping_type: variant.coping_type,
        coping_width: variant.has_coping ? (variant.coping_width || 400) : null,
        grout_width: variant.has_coping ? 5 : null,
        coping_layout: variant.coping_layout,
        notes: variant.notes || '',
        status: 'published',
        published_at: new Date().toISOString(),
        published_by: user?.id,
        created_by: user?.id,
        updated_at: new Date().toISOString()
      }));
      
      const { data, error } = await supabase
        .from('pool_variants')
        .insert(insertData)
        .select();
      
      if (error) throw error;

      await Promise.all(
        data.map((variant: any) =>
          supabase.from('pool_activity_log').insert({
            pool_variant_id: variant.id,
            action: 'published',
            user_id: user?.id,
            changes: { status: 'draft → published' }
          })
        )
      );
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pool-variants-admin'] });
      toast({
        title: "Success",
        description: `${data.length} variant(s) published successfully!`,
      });
      navigate('/admin/pool-library');
    },
    onError: (error) => {
      console.error('Publish failed:', error);
      toast({
        title: "Error",
        description: "Failed to publish variants",
        variant: "destructive",
      });
    }
  });

  const handlePublish = () => {
    const allValid = variants.every((v: any) => 
      !v.has_coping || v.coping_layout?.validation?.is_valid !== false
    );
    
    if (!allValid) {
      toast({
        title: "Validation Error",
        description: "Some variants have validation errors. Please fix before publishing.",
        variant: "destructive",
      });
      return;
    }
    
    setShowPublishDialog(true);
  };

  if (!currentVariant) {
    return (
      <div className="bg-card rounded-lg shadow p-8">
        <p className="text-destructive">No variants generated. Please go back and generate coping layouts.</p>
        <Button onClick={onBack} className="mt-4">← Back to Generate Coping</Button>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow">
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-2">Step 5: Review & Publish</h2>
        <p className="text-muted-foreground mb-6">
          Review all generated variants and publish them to the pool library
        </p>

        <Tabs value={selectedVariantIndex.toString()} onValueChange={(val) => setSelectedVariantIndex(parseInt(val))}>
          <TabsList className="mb-6">
            {variants.map((variant: any, idx: number) => (
              <TabsTrigger key={idx} value={idx.toString()}>
                {variant.variant_name}
              </TabsTrigger>
            ))}
          </TabsList>

          {variants.map((variant: any, idx: number) => (
            <TabsContent key={idx} value={idx.toString()}>
              <div className="space-y-6">
                <div className="bg-muted p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Pool Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Pool Name:</span>
                      <span className="ml-2 font-medium">{variant.pool_name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Variant:</span>
                      <span className="ml-2 font-medium">{variant.variant_name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Dimensions:</span>
                      <span className="ml-2 font-medium">
                        {variant.length}mm × {variant.width}mm
                        ({(variant.length / 1000).toFixed(1)}m × {(variant.width / 1000).toFixed(1)}m)
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Outline Points:</span>
                      <span className="ml-2 font-medium">{variant.outline_points.length}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Visual Preview</h3>
                  <div className="border rounded-lg p-4 bg-muted">
                    <CopingPreview 
                      poolOutline={variant.outline_points}
                      copingLayout={variant.coping_layout}
                      width={900}
                      height={600}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    🔵 Blue = Pool outline | 🟤 Tan = Coping pavers | Grid spacing = 100mm
                  </p>
                </div>

                {variant.has_coping && variant.coping_layout && (
                  <div>
                    <h3 className="font-semibold mb-3">Paver Breakdown</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="text-sm text-muted-foreground">Corner Pavers</div>
                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                          {variant.coping_layout.metadata.corner_pavers}
                        </div>
                      </div>
                      <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="text-sm text-muted-foreground">Full Pavers</div>
                        <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                          {variant.coping_layout.metadata.full_pavers}
                        </div>
                      </div>
                      <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                        <div className="text-sm text-muted-foreground">Stripe Pavers</div>
                        <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                          {variant.coping_layout.metadata.stripe_pavers}
                        </div>
                      </div>
                      <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                        <div className="text-sm text-muted-foreground">Total Area</div>
                        <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                          {variant.coping_layout.metadata.total_area_m2}
                        </div>
                        <div className="text-xs text-muted-foreground">m²</div>
                      </div>
                    </div>

                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      <div className="text-sm">
                        <span className="font-medium">Total Pavers:</span> {variant.coping_layout.metadata.total_pavers} pcs
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Grout Width:</span> {variant.coping_layout.metadata.grout_width_mm}mm
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Coping Width:</span> {variant.coping_width || 400}mm from pool edge
                      </div>
                    </div>
                  </div>
                )}

                {variant.has_coping && variant.coping_layout?.validation && (
                  <div>
                    <h3 className="font-semibold mb-3">Validation Status</h3>
                    {variant.coping_layout.validation.is_valid ? (
                      <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                          <span className="text-xl">✓</span>
                          <span className="font-medium">Layout validated - ready to publish</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {variant.coping_layout.validation.errors.map((error: string, i: number) => (
                          <div key={i} className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-700 dark:text-red-300">
                            <div className="flex items-start gap-2">
                              <span className="text-lg">❌</span>
                              <span>{error}</span>
                            </div>
                          </div>
                        ))}
                        {variant.coping_layout.validation.warnings.map((warning: string, i: number) => (
                          <div key={i} className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-yellow-700 dark:text-yellow-300">
                            <div className="flex items-start gap-2">
                              <span className="text-lg">⚠️</span>
                              <span>{warning}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {variant.notes && (
                  <div>
                    <h3 className="font-semibold mb-2">Notes</h3>
                    <div className="bg-muted p-4 rounded-lg text-sm">
                      {variant.notes}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <div className="flex justify-between p-6 border-t bg-muted">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => saveDraftMutation.mutate()}
            disabled={saveDraftMutation.isPending || publishMutation.isPending}
          >
            💾 Save as Draft
          </Button>
          <Button 
            onClick={handlePublish}
            disabled={saveDraftMutation.isPending || publishMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            ✓ Publish All {variants.length} Variant{variants.length > 1 ? 's' : ''}
          </Button>
        </div>
      </div>

      <PublishConfirmDialog
        open={showPublishDialog}
        onClose={() => setShowPublishDialog(false)}
        onConfirm={() => {
          setShowPublishDialog(false);
          publishMutation.mutate();
        }}
        variantCount={variants.length}
        poolName={poolData.pool_name}
      />
    </div>
  );
}

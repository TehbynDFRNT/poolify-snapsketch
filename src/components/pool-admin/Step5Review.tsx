import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface Step5Props {
  poolData: any;
  setPoolData: (data: any) => void;
  onBack: () => void;
}

export default function Step5Review({ poolData, onBack }: Step5Props) {
  const navigate = useNavigate();
  const [publishing, setPublishing] = useState(false);

  const handlePublishAll = async () => {
    setPublishing(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      
      for (const variant of poolData.generatedVariants) {
        await supabase.from('pool_variants').insert({
          pool_name: variant.pool_name,
          variant_name: variant.variant_name,
          length: variant.length,
          width: variant.width,
          outline_points: variant.outline_points,
          shallow_end: variant.shallow_end,
          deep_end: variant.deep_end,
          features: variant.features,
          has_coping: variant.has_coping,
          coping_type: variant.coping_type,
          coping_width: variant.coping_width,
          grout_width: variant.grout_width,
          coping_layout: variant.coping_layout,
          notes: variant.notes,
          status: 'published',
          published_at: new Date().toISOString(),
          published_by: user?.id,
          created_by: user?.id
        });
      }

      toast.success(`Published ${poolData.generatedVariants.length} pool variants!`);
      navigate('/admin/pool-library');
    } catch (error) {
      console.error('Publishing failed:', error);
      toast.error('Failed to publish variants');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="bg-card rounded-lg shadow p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Step 5: Review & Publish</h2>
      <p className="text-muted-foreground mb-6">
        Review your pool variants before publishing
      </p>

      <div className="space-y-4 mb-8">
        {poolData.generatedVariants.map((variant: any, index: number) => (
          <div key={index} className="p-4 border rounded">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">
                  {variant.pool_name} - {variant.variant_name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {variant.length} × {variant.width}mm
                  {variant.has_coping && ` • ${variant.coping_type} coping`}
                </p>
                {variant.coping_layout && (
                  <p className="text-sm text-muted-foreground">
                    {variant.coping_layout.metadata.total_pavers} pavers • 
                    {variant.coping_layout.metadata.total_area_m2}m²
                  </p>
                )}
              </div>
              <div className="text-green-600">✓</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded p-4 mb-6">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          ⚠️ Publishing will make these pools immediately available to all users.
        </p>
      </div>

      <div className="flex justify-between pt-6 border-t">
        <Button variant="outline" onClick={onBack} disabled={publishing}>
          ← Back
        </Button>
        <Button onClick={handlePublishAll} disabled={publishing}>
          {publishing ? 'Publishing...' : '🚀 Publish All Variants'}
        </Button>
      </div>
    </div>
  );
}

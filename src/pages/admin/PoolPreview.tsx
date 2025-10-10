import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import CopingPreview from '@/components/pool-admin/CopingPreview';

export default function PoolPreview() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: pool, isLoading, error } = useQuery({
    queryKey: ['pool-variant-preview', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pool_variants')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) {
        console.error('Error loading pool:', error);
        throw error;
      }
      return data;
    }
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">Loading pool preview...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-destructive">Error loading pool: {error.message}</div>
        <Button onClick={() => navigate('/admin/pool-library')} className="mt-4">
          ← Back to Library
        </Button>
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="p-6">
        <div className="text-destructive">Pool not found</div>
        <Button onClick={() => navigate('/admin/pool-library')} className="mt-4">
          ← Back to Library
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/admin/pool-library')}
            className="mb-4"
          >
            ← Back to Pool Library
          </Button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold">{pool.pool_name}</h1>
              <p className="text-xl text-muted-foreground">{pool.variant_name}</p>
              <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                <span>
                  {pool.length}mm × {pool.width}mm 
                  ({(pool.length / 1000).toFixed(1)}m × {(pool.width / 1000).toFixed(1)}m)
                </span>
                <span>•</span>
                <span className={
                  pool.status === 'published' ? 'text-green-600' :
                  pool.status === 'draft' ? 'text-yellow-600' :
                  'text-red-600'
                }>
                  {pool.status === 'published' ? '✓ Published' :
                   pool.status === 'draft' ? '📝 Draft' :
                   '📦 Archived'}
                </span>
              </div>
            </div>
            <Button 
              variant="outline"
              onClick={() => navigate(`/admin/pool-library/${id}/edit`)}
            >
              Edit Pool
            </Button>
          </div>
        </div>

        <div className="bg-card rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Visual Preview</h2>
          <CopingPreview 
            poolOutline={pool.outline_points as any}
            copingLayout={pool.coping_layout as any}
            width={1000}
            height={700}
          />
        </div>

        {pool.has_coping && pool.coping_layout && (
          <div className="bg-card rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Paver Breakdown</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Corner Pavers</div>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {(pool.coping_layout as any).metadata.corner_pavers}
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Full Pavers</div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {(pool.coping_layout as any).metadata.full_pavers}
                </div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Stripe Pavers</div>
                <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {(pool.coping_layout as any).metadata.stripe_pavers}
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Total Area</div>
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {(pool.coping_layout as any).metadata.total_area_m2}
                </div>
                <div className="text-xs text-muted-foreground">m²</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-muted rounded">
                <span className="font-medium">Total Pavers:</span> {(pool.coping_layout as any).metadata.total_pavers} pcs
              </div>
              <div className="p-3 bg-muted rounded">
                <span className="font-medium">Grout Width:</span> {(pool.coping_layout as any).metadata.grout_width_mm}mm
              </div>
              <div className="p-3 bg-muted rounded">
                <span className="font-medium">Coping Width:</span> {pool.coping_width}mm
              </div>
              <div className="p-3 bg-muted rounded">
                <span className="font-medium">Coping Type:</span> {pool.coping_type || 'None'}
              </div>
            </div>
          </div>
        )}

        <div className="bg-card rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Pool Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Outline Points:</span>
              <span className="ml-2 font-medium">{(pool.outline_points as any)?.length || 0}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Has Coping:</span>
              <span className="ml-2 font-medium">{pool.has_coping ? 'Yes' : 'No'}</span>
            </div>
            {pool.features && (pool.features as any[]).length > 0 && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Features:</span>
                <span className="ml-2 font-medium">{(pool.features as any[]).length} feature(s)</span>
              </div>
            )}
            {pool.notes && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Notes:</span>
                <div className="mt-1 p-3 bg-muted rounded">{pool.notes}</div>
              </div>
            )}
            {pool.published_at && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Published:</span>
                <span className="ml-2 font-medium">
                  {new Date(pool.published_at).toLocaleDateString()} at{' '}
                  {new Date(pool.published_at).toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PoolVariant } from '@/types/poolVariant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown, ChevronRight, Plus, Edit2, Eye, Copy, Archive, Trash2, Layers, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { CopingGeneratorDialog } from '@/components/pool-admin/CopingGeneratorDialog';
import { seedPoolsIfEmpty } from '@/utils/seedPools';

export default function PoolLibrary() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'archived'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'updated' | 'created'>('name');
  const [generatingVariant, setGeneratingVariant] = useState<PoolVariant | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Fetch pool variants
  const { data: poolVariants, isLoading, refetch } = useQuery({
    queryKey: ['pool-variants', statusFilter, sortBy],
    queryFn: async () => {
      let query = supabase
        .from('pool_variants')
        .select('*');

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const orderColumn = sortBy === 'name' ? 'pool_name' : sortBy === 'updated' ? 'updated_at' : 'created_at';
      query = query.order(orderColumn, { ascending: sortBy === 'name' });

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as PoolVariant[];
    },
  });

  // Seed database from POOL_LIBRARY if empty (admin only UI)
  useEffect(() => {
    if (!isLoading && (poolVariants?.length ?? 0) === 0) {
      seedPoolsIfEmpty().then(({ seeded }) => {
        if (seeded) {
          toast.success('Seeded base pool library');
          refetch();
        }
      });
    }
  }, [isLoading, poolVariants, refetch]);

  // Group variants by pool name
  const groupedPools = poolVariants?.reduce((acc, variant) => {
    if (!acc[variant.pool_name]) {
      acc[variant.pool_name] = [];
    }
    acc[variant.pool_name].push(variant);
    return acc;
  }, {} as Record<string, PoolVariant[]>) || {};

  // Convert to array for filtering
  const allPoolGroups = Object.entries(groupedPools).map(([name, variants]) => ({
    pool_name: name,
    variants
  }));

  // Filter by search
  const filteredPoolGroups = allPoolGroups.filter(group =>
    group.pool_name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handlePublish = async (id: string) => {
    const { error } = await supabase
      .from('pool_variants')
      .update({ 
        status: 'published', 
        published_at: new Date().toISOString(),
        published_by: user?.id 
      })
      .eq('id', id);

    if (error) {
      toast.error('Failed to publish pool variant');
    } else {
      toast.success('Pool variant published');
      refetch();
    }
  };

  const handleUnpublish = async (id: string) => {
    const { error } = await supabase
      .from('pool_variants')
      .update({ status: 'draft' })
      .eq('id', id);

    if (error) {
      toast.error('Failed to unpublish pool variant');
    } else {
      toast.success('Pool variant unpublished');
      refetch();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pool variant?')) return;

    const { error } = await supabase
      .from('pool_variants')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete pool variant');
    } else {
      toast.success('Pool variant deleted');
      refetch();
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">🏊 Pool Library Management</h1>
            <p className="text-muted-foreground">Create and manage pool variants for the design tool</p>
          </div>
          <Button onClick={() => toast.info('Pool creation coming soon')} size="lg" disabled>
            <Plus className="w-4 h-4 mr-2" />
            New Pool
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <Input
                placeholder="Search pools..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="draft">📝 Draft</SelectItem>
                  <SelectItem value="published">✓ Published</SelectItem>
                  <SelectItem value="archived">📦 Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Sort By</label>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="updated">Last Updated</SelectItem>
                  <SelectItem value="created">Date Created</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Pool Groups */}
        {isLoading ? (
          <div className="text-center py-12">Loading pools...</div>
        ) : filteredPoolGroups.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No pools found matching your search.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredPoolGroups.map(group => {
              const isOpen = openGroups[group.pool_name] ?? true;

              return (
                <Collapsible key={group.pool_name} open={isOpen} onOpenChange={(v) => setOpenGroups(prev => ({ ...prev, [group.pool_name]: v }))}>
                  <Card className="overflow-hidden">
                    <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3">
                        {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        <h3 className="text-lg font-semibold">{group.pool_name}</h3>
                        <Badge variant="secondary">{group.variants.length} variants</Badge>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="p-4 space-y-3 bg-muted/30">
                        {group.variants.map(variant => (
                          <Card key={variant.id} className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h4 className="font-semibold">{(variant as any).display_name || variant.pool_name}</h4>
                                  <Badge variant={
                                    variant.status === 'published' ? 'default' :
                                    variant.status === 'draft' ? 'secondary' : 'outline'
                                  }>
                                    {variant.status === 'published' && '🟢'}
                                    {variant.status === 'draft' && '🟡'}
                                    {variant.status === 'archived' && '🔴'}
                                    {' '}{variant.status}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {(() => {
                                    const o = (variant as any).outline || [];
                                    if (!o.length) return 'Size N/A';
                                    const minX = Math.min(...o.map((p:any) => p.x));
                                    const maxX = Math.max(...o.map((p:any) => p.x));
                                    const minY = Math.min(...o.map((p:any) => p.y));
                                    const maxY = Math.max(...o.map((p:any) => p.y));
                                    return `${maxX - minX} × ${maxY - minY}mm`;
                                  })()}
                                  {variant.coping_layout && ` • ${variant.coping_layout.metadata.total_pavers} pavers`}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {variant.status === 'published' 
                                    ? `Published ${new Date(variant.published_at!).toLocaleDateString()}`
                                    : `Last edited ${new Date(variant.updated_at).toLocaleDateString()}`
                                  }
                                </p>
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigate(`/admin/pool-library/${variant.id}/edit`)}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigate(`/admin/pool-library/${variant.id}/preview`)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setGeneratingVariant(variant)}
                                  title="Generate new coping variant"
                                >
                                  <Layers className="h-4 w-4 mr-2" />
                                  Coping
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toast.info('Pool duplication coming soon')}
                                  disabled
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                                {variant.status === 'draft' && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handlePublish(variant.id)}
                                    >
                                      Publish
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDelete(variant.id)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </>
                                )}
                                {variant.status === 'published' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleUnpublish(variant.id)}
                                  >
                                    Unpublish
                                  </Button>
                                )}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>

      {generatingVariant && (
        <CopingGeneratorDialog
          open={!!generatingVariant}
          onClose={() => setGeneratingVariant(null)}
          variant={generatingVariant}
        />
      )}
    </div>
  );
}

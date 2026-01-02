import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, Search, Edit, Trash2, Plus } from 'lucide-react';
import { usePoolVariants, useTogglePoolStatus, useDeletePoolVariant, PoolVariant } from '@/hooks/usePoolVariants';
import { PoolEditorDialog } from '@/components/PoolEditorDialog';
import { CSVImportDialog } from '@/components/CSVImportDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function PoolManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [userRole, setUserRole] = useState<string>('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPool, setEditingPool] = useState<PoolVariant | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [poolToDelete, setPoolToDelete] = useState<string | null>(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);

  const { data: pools, isLoading } = usePoolVariants();
  const toggleStatus = useTogglePoolStatus();
  const deletePool = useDeletePoolVariant();

  useEffect(() => {
    checkUserRole();
  }, [user]);

  const checkUserRole = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      setUserRole(data.role);
      if (data.role !== 'admin') {
        toast({
          title: 'Access denied',
          description: 'You must be an admin to access pool management',
          variant: 'destructive',
        });
        navigate('/projects');
      }
    }
  };

  const filterPools = (pools: PoolVariant[]) => {
    if (!searchQuery) return pools;
    return pools.filter((p) =>
      p.pool_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const handleToggleStatus = (pool: PoolVariant) => {
    toggleStatus.mutate({
      id: pool.id,
      currentStatus: pool.status || 'draft',
    });
  };

  const handleEdit = (pool: PoolVariant) => {
    setEditingPool(pool);
    setEditorOpen(true);
  };

  const handleDelete = (poolId: string) => {
    setPoolToDelete(poolId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (poolToDelete) {
      deletePool.mutate(poolToDelete);
      setDeleteDialogOpen(false);
      setPoolToDelete(null);
    }
  };

  const handleAddPool = () => {
    setEditingPool(undefined);
    setEditorOpen(true);
  };

  if (userRole !== 'admin') {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading pools...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/projects')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Pool Management</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCsvImportOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
            <Button onClick={handleAddPool}>
              <Plus className="w-4 h-4 mr-2" />
              Add Pool
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search pools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Pools ({pools?.length || 0})</h2>

          {!pools || filterPools(pools).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? 'No pools found matching your search' : 'No pools yet. Create your first pool.'}
                </p>
                {!searchQuery && (
                  <Button onClick={handleAddPool}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Pool
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filterPools(pools).map((pool) => (
                <Card key={pool.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{pool.pool_name}</CardTitle>
                        <CardDescription className="mt-1">
                          {pool.updated_at && (
                            <span className="text-sm">Updated: {new Date(pool.updated_at).toLocaleDateString()}</span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={pool.status === 'published' ? 'default' : 'secondary'}>
                          {pool.status === 'published' ? 'Published' : 'Draft'}
                        </Badge>
                        <Switch
                          checked={pool.status === 'published'}
                          onCheckedChange={() => handleToggleStatus(pool)}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(pool)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(pool.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <PoolEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        pool={editingPool}
      />

      <CSVImportDialog
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pool</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this pool? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

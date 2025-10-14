import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface PoolVariant {
  id: string;
  pool_name: string;
  outline: Array<{x: number, y: number}>;
  shallow_end_position: {x: number, y: number} | null;
  deep_end_position: {x: number, y: number} | null;
  features: any[] | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  sort_order: number | null;
  zone_of_influence: Array<{x: number, y: number}> | null;
}

export const usePoolVariants = () => {
  return useQuery({
    queryKey: ['pool-variants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pool_variants')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as PoolVariant[];
    },
  });
};

export const usePublishedPools = () => {
  return useQuery({
    queryKey: ['published-pools'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pool_variants')
        .select('*')
        .eq('status', 'published')
        .order('sort_order', { ascending: true })
        .order('pool_name', { ascending: true });

      if (error) throw error;
      return data as unknown as PoolVariant[];
    },
  });
};

export const usePoolVariant = (id: string) => {
  return useQuery({
    queryKey: ['pool-variant', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pool_variants')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as unknown as PoolVariant;
    },
    enabled: !!id,
  });
};

export const useCreatePoolVariant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pool: Omit<PoolVariant, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('pool_variants')
        .insert({
          ...pool,
          created_by: user?.id,
          status: pool.status || 'draft',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pool-variants'] });
      queryClient.invalidateQueries({ queryKey: ['published-pools'] });
      toast({
        title: 'Pool created',
        description: 'The pool has been successfully created.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error creating pool',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdatePoolVariant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...pool }: Partial<PoolVariant> & { id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updates: any = {
        ...pool,
        updated_at: new Date().toISOString(),
      };

      // Set published_at and published_by when publishing
      if (pool.status === 'published') {
        const { data: existing } = await supabase
          .from('pool_variants')
          .select('published_at')
          .eq('id', id)
          .single();

        if (!existing?.published_at) {
          updates.published_at = new Date().toISOString();
          updates.published_by = user?.id;
        }
      } else if (pool.status === 'draft') {
        updates.published_at = null;
        updates.published_by = null;
      }

      const { data, error } = await supabase
        .from('pool_variants')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pool-variants'] });
      queryClient.invalidateQueries({ queryKey: ['published-pools'] });
      toast({
        title: 'Pool updated',
        description: 'The pool has been successfully updated.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating pool',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useDeletePoolVariant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pool_variants')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pool-variants'] });
      queryClient.invalidateQueries({ queryKey: ['published-pools'] });
      toast({
        title: 'Pool deleted',
        description: 'The pool has been successfully deleted.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error deleting pool',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useTogglePoolStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const newStatus = currentStatus === 'published' ? 'draft' : 'published';
      
      const updates: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'published') {
        updates.published_at = new Date().toISOString();
        updates.published_by = user?.id;
      } else {
        updates.published_at = null;
        updates.published_by = null;
      }

      const { error } = await supabase
        .from('pool_variants')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pool-variants'] });
      queryClient.invalidateQueries({ queryKey: ['published-pools'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error toggling pool status',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

import { useState, useCallback } from 'react';
import { PoolifyProject, PoolifySearchResponse, PoolifyLinkRequest, PoolifyLinkStatus } from '@/types/poolify';

const SNAPSKETCH_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const POOLIFY_PROXY_URL = SNAPSKETCH_SUPABASE_URL
  ? `${SNAPSKETCH_SUPABASE_URL}/functions/v1/poolify-proxy`
  : '';

async function callPoolifyProxy<T>(action: string, payload: unknown): Promise<T> {
  const response = await fetch(POOLIFY_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, payload }),
  });

  const data = (await response.json()) as T & { success?: boolean; error?: string };

  if (!response.ok || data.success === false) {
    throw new Error(data.error || 'Poolify request failed');
  }

  return data;
}

export const usePoolifyIntegration = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchProjects = useCallback(async (searchTerm: string): Promise<PoolifyProject[]> => {
    if (!searchTerm || searchTerm.length < 2) return [];
    if (!POOLIFY_PROXY_URL) {
      console.warn('Poolify proxy configuration missing');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const data = await callPoolifyProxy<PoolifySearchResponse>('searchProjects', { search: searchTerm });
      return data.results;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Search failed';
      setError(message);
      console.error('Poolify search error:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const linkToPoolify = useCallback(async (request: PoolifyLinkRequest): Promise<boolean> => {
    if (!POOLIFY_PROXY_URL) {
      console.warn('Poolify proxy configuration missing');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      await callPoolifyProxy('linkProject', request);
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Link failed';
      setError(message);
      console.error('Poolify link error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkLink = useCallback(async (snapsketchId: string): Promise<PoolifyLinkStatus | null> => {
    if (!snapsketchId) return null;
    if (!POOLIFY_PROXY_URL) {
      console.warn('Poolify proxy configuration missing');
      return null;
    }

    try {
      return await callPoolifyProxy<PoolifyLinkStatus>('checkLink', { snapsketchId });
    } catch (err: unknown) {
      console.error('Poolify check link error:', err);
      return null;
    }
  }, []);

  return {
    searchProjects,
    linkToPoolify,
    checkLink,
    loading,
    error,
  };
};

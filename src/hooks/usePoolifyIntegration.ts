import { useState, useCallback } from 'react';
import { PoolifyProject, PoolifySearchResponse, PoolifyLinkRequest, PoolifyLinkStatus } from '@/types/poolify';

const POOLIFY_API_URL = import.meta.env.VITE_POOLIFY_API_URL;
const POOLIFY_API_KEY = import.meta.env.VITE_POOLIFY_API_KEY;

export const usePoolifyIntegration = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchProjects = useCallback(async (searchTerm: string): Promise<PoolifyProject[]> => {
    if (!searchTerm || searchTerm.length < 2) return [];
    if (!POOLIFY_API_URL || !POOLIFY_API_KEY) {
      console.warn('Poolify API configuration missing');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${POOLIFY_API_URL}/search-pool-projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${POOLIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ search: searchTerm }),
      });

      const data: PoolifySearchResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Search failed');
      }

      return data.results;
    } catch (err: any) {
      setError(err.message);
      console.error('Poolify search error:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const linkToPoolify = useCallback(async (request: PoolifyLinkRequest): Promise<boolean> => {
    if (!POOLIFY_API_URL || !POOLIFY_API_KEY) {
      console.warn('Poolify API configuration missing');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${POOLIFY_API_URL}/link-snapsketch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${POOLIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Link failed');
      }

      return true;
    } catch (err: any) {
      setError(err.message);
      console.error('Poolify link error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkLink = useCallback(async (snapsketchId: string): Promise<PoolifyLinkStatus | null> => {
    if (!snapsketchId) return null;
    if (!POOLIFY_API_URL || !POOLIFY_API_KEY) {
      console.warn('Poolify API configuration missing');
      return null;
    }

    try {
      const response = await fetch(`${POOLIFY_API_URL}/check-snapsketch-link`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${POOLIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ snapsketchId }),
      });

      const data: PoolifyLinkStatus = await response.json();

      if (!response.ok || !data.success) {
        return null;
      }

      return data;
    } catch (err: any) {
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

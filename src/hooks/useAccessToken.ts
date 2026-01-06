import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { verifyAccessToken, storeAccessToken, hasValidStoredToken } from '@/utils/accessToken';

/**
 * Hook to verify access token for protected auth pages.
 * Checks URL parameter first, then falls back to sessionStorage.
 *
 * @returns {object} { verified, accessToken, isLoading }
 * - verified: true if access is granted, false if denied, null while checking
 * - accessToken: the current valid access token (from URL or storage)
 * - isLoading: true while verification is in progress
 */
export function useAccessToken() {
  const [verified, setVerified] = useState<boolean | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const checkAccess = async () => {
      const urlToken = searchParams.get('access');

      // First, check URL token
      if (urlToken) {
        const isValid = await verifyAccessToken(urlToken);
        if (isValid) {
          storeAccessToken(urlToken);
          setAccessToken(urlToken);
          setVerified(true);
          return;
        }
      }

      // Fall back to stored token
      const hasStored = await hasValidStoredToken();
      if (hasStored) {
        // Get the stored token for link generation
        const storedToken = sessionStorage.getItem('snapsketch_access');
        setAccessToken(storedToken);
      }
      setVerified(hasStored);
    };

    checkAccess();
  }, [searchParams]);

  return {
    verified,
    accessToken,
    isLoading: verified === null,
  };
}

/**
 * Helper to build a URL with the access token preserved
 */
export function buildAuthUrl(path: string, accessToken: string | null): string {
  if (accessToken) {
    return `${path}?access=${accessToken}`;
  }
  return path;
}

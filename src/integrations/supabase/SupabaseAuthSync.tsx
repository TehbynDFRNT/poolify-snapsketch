import { useEffect, useRef } from 'react';
import { useSession, useUser } from '@clerk/clerk-react';
import { setTokenGetter } from './client';
import { supabase } from './client';

/**
 * Wires Clerk session tokens into the Supabase client.
 * Also ensures a profiles row exists for the current user.
 * Mount once near the app root, inside <ClerkProvider>.
 */
export function SupabaseAuthSync() {
  const { session } = useSession();
  const { user } = useUser();
  const profileEnsured = useRef(false);

  useEffect(() => {
    setTokenGetter(async () => session?.getToken() ?? null);
  }, [session]);

  // Auto-create profile row on first sign-in
  useEffect(() => {
    if (!session || !user || profileEnsured.current) return;

    const ensureProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!data) {
        await supabase.from('profiles').insert({
          id: user.id,
          full_name: user.fullName || user.firstName || 'User',
          role: 'sales_rep',
        });
      }
      profileEnsured.current = true;
    };

    ensureProfile();
  }, [session, user]);

  return null;
}

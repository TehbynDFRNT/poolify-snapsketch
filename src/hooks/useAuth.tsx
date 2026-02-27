import { useMemo, useCallback } from 'react';
import { useUser, useClerk, useAuth as useClerkAuth, useOrganization } from '@clerk/clerk-react';

interface AuthUser {
  id: string;
  email: string;
  orgId: string | null;
  orgRole: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthContextType {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { organization, membership } = useOrganization();

  const user: AuthUser | null = useMemo(() => {
    if (!clerkUser) return null;
    return {
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
      orgId: organization?.id ?? null,
      orgRole: membership?.role ?? null,
    };
  }, [clerkUser?.id, clerkUser?.primaryEmailAddress?.emailAddress, organization?.id, membership?.role]);

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  return {
    user,
    loading: !isLoaded,
    signOut: handleSignOut,
  };
}

export { useClerkAuth as useClerkAuthRaw };

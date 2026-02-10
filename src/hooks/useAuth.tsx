import { useMemo, useCallback } from 'react';
import { useUser, useClerk, useAuth as useClerkAuth } from '@clerk/clerk-react';

interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthContextType {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut } = useClerk();

  const user: AuthUser | null = useMemo(() => {
    if (!clerkUser) return null;
    return {
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
    };
  }, [clerkUser?.id, clerkUser?.primaryEmailAddress?.emailAddress]);

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

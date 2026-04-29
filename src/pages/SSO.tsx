import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { verifySSOToken, SSOPayload } from '@/utils/ssoVerify';

const SSO_REDIRECT_KEY = 'sso_redirect_project';
const SSO_EMAIL_KEY = 'sso_email';

// Store SSO redirect target for after login
export function getSSORediect(): string | null {
  return sessionStorage.getItem(SSO_REDIRECT_KEY);
}

export function clearSSORedirect(): void {
  sessionStorage.removeItem(SSO_REDIRECT_KEY);
  sessionStorage.removeItem(SSO_EMAIL_KEY);
}

export function getSSOEmail(): string | null {
  return sessionStorage.getItem(SSO_EMAIL_KEY);
}

export function SSO() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const [payload, setPayload] = useState<SSOPayload | null>(null);

  useEffect(() => {
    const handleSSO = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setStatus('error');
        setErrorMessage('No SSO token provided');
        return;
      }

      try {
        const verifiedPayload = await verifySSOToken(token);

        setPayload(verifiedPayload);
        setStatus('success');

        // Store redirect target and email for after login
        sessionStorage.setItem(SSO_REDIRECT_KEY, `/project/${verifiedPayload.snapsketchProjectId}`);
        sessionStorage.setItem(SSO_EMAIL_KEY, verifiedPayload.email);
      } catch (error) {
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Invalid SSO token');
      }
    };

    handleSSO();
  }, [searchParams]);

  // Once auth is loaded, check if user is logged in
  useEffect(() => {
    if (authLoading || status !== 'success' || !payload) return;

    if (user) {
      // User is already logged in - redirect directly to project
      clearSSORedirect();
      navigate(`/project/${payload.snapsketchProjectId}`, { replace: true });
    } else {
      // User not logged in - redirect to sign-in
      navigate('/sign-in', { replace: true });
    }
  }, [authLoading, user, status, payload, navigate]);

  if (status === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Verifying SSO token...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <h1 className="text-3xl font-bold">Pool Design Tool</h1>
          <div className="mt-8 p-6 border rounded-lg bg-destructive/10">
            <h2 className="text-xl font-semibold text-destructive">SSO Error</h2>
            <p className="mt-2 text-muted-foreground">{errorMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  // Success state - will redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  );
}

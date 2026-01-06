import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { verifyJWT, decodeJWT, isTokenExpired, SSOPayload } from '@/utils/ssoVerify';
import { storeAccessToken } from '@/utils/accessToken';

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

      // Verify JWT signature
      const isValid = await verifyJWT(token);
      if (!isValid) {
        setStatus('error');
        setErrorMessage('Invalid SSO token');
        return;
      }

      // Decode payload
      const decoded = decodeJWT(token);
      if (!decoded) {
        setStatus('error');
        setErrorMessage('Failed to decode token');
        return;
      }

      // Check expiry
      if (isTokenExpired(decoded)) {
        setStatus('error');
        setErrorMessage('SSO token has expired');
        return;
      }

      setPayload(decoded);
      setStatus('success');

      // Store the access token so they can access login page
      // Generate from the CPQ key (same as the access token logic)
      const CPQ_API_KEY = import.meta.env.VITE_CPQ_API_KEY;
      if (CPQ_API_KEY) {
        const encoder = new TextEncoder();
        const data = encoder.encode(CPQ_API_KEY);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        storeAccessToken(hashHex.substring(0, 16));
      }

      // Store redirect target and email for after login
      sessionStorage.setItem(SSO_REDIRECT_KEY, `/project/${decoded.snapsketchProjectId}`);
      sessionStorage.setItem(SSO_EMAIL_KEY, decoded.email);
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
      // User not logged in - redirect to login
      // The login page will use the stored SSO redirect after successful login
      navigate('/login', { replace: true });
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
          <h1 className="text-3xl font-bold">🏊 Pool Design Tool</h1>
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

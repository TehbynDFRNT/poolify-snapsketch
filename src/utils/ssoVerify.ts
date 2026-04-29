export interface SSOPayload {
  email: string;
  name: string;
  snapsketchProjectId: string;
  iat: number;
  exp: number;
}

interface VerifySSOResponse {
  success: boolean;
  payload?: SSOPayload;
  error?: string;
}

const verifySsoEndpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-sso`;

export async function verifySSOToken(token: string): Promise<SSOPayload> {
  const response = await fetch(verifySsoEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });

  const data = (await response.json()) as VerifySSOResponse;

  if (!response.ok || !data.success || !data.payload) {
    throw new Error(data.error || 'Invalid SSO token');
  }

  return data.payload;
}

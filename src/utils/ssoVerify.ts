const SSO_SECRET = import.meta.env.VITE_CPQ_API_KEY;

export interface SSOPayload {
  email: string;
  name: string;
  snapsketchProjectId: string;
  iat: number;
  exp: number;
}

export async function verifyJWT(token: string): Promise<boolean> {
  if (!SSO_SECRET || !token) return false;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const [header, payload, signature] = parts;
    const message = `${header}.${payload}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(SSO_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Decode signature from base64url
    const sigBytes = Uint8Array.from(
      atob(signature.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );

    return crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(message));
  } catch (error) {
    console.error('JWT verification error:', error);
    return false;
  }
}

export function decodeJWT(token: string): SSOPayload | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;

    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as SSOPayload;
  } catch (error) {
    console.error('JWT decode error:', error);
    return null;
  }
}

export function isTokenExpired(payload: SSOPayload): boolean {
  return payload.exp < Date.now() / 1000;
}

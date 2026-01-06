const CPQ_API_KEY = import.meta.env.VITE_CPQ_API_KEY;

const ACCESS_TOKEN_KEY = 'snapsketch_access';

export async function verifyAccessToken(token: string): Promise<boolean> {
  if (!CPQ_API_KEY || !token) return false;

  const encoder = new TextEncoder();
  const data = encoder.encode(CPQ_API_KEY);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex.substring(0, 16) === token;
}

export async function generateAccessToken(): Promise<string> {
  if (!CPQ_API_KEY) return '';

  const encoder = new TextEncoder();
  const data = encoder.encode(CPQ_API_KEY);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 16);
}

export function storeAccessToken(token: string): void {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getStoredAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function hasValidStoredToken(): Promise<boolean> {
  const token = getStoredAccessToken();
  if (!token) return Promise.resolve(false);
  return verifyAccessToken(token);
}

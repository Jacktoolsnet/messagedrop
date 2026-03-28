export const ADMIN_TOKEN_STORAGE_KEY = 'admin_token';
export const ADMIN_SESSION_CHANGED_EVENT = 'admin-session-changed';
const TOKEN_EXPIRY_SKEW_MS = 5_000;

export interface AdminTokenPayload {
  exp?: number;
  iat?: number;
  sub?: string;
  username?: string;
  role?: string;
  roles?: string[];
}

function getStorage(): Storage | null {
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

export function dispatchAdminSessionChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ADMIN_SESSION_CHANGED_EVENT));
  }
}

export function getStoredAdminToken(): string | null {
  return getStorage()?.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? null;
}

export function setStoredAdminToken(token: string): void {
  getStorage()?.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  dispatchAdminSessionChanged();
}

export function removeStoredAdminToken(): void {
  getStorage()?.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  dispatchAdminSessionChanged();
}

export function decodeAdminToken(token: string): AdminTokenPayload | null {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) {
      return null;
    }

    const normalized = payloadPart
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(payloadPart.length / 4) * 4, '=');

    const payload = JSON.parse(globalThis.atob(normalized)) as AdminTokenPayload;
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

export function isAdminTokenExpired(token: string, skewMs = TOKEN_EXPIRY_SKEW_MS): boolean {
  const payload = decodeAdminToken(token);
  if (!payload || typeof payload.exp !== 'number') {
    return true;
  }

  return Date.now() >= payload.exp * 1000 - skewMs;
}

export function getValidStoredAdminToken(skewMs = TOKEN_EXPIRY_SKEW_MS): string | null {
  const token = getStoredAdminToken();
  if (!token) {
    return null;
  }

  return isAdminTokenExpired(token, skewMs) ? null : token;
}

export function isAdminSessionErrorResponse(status: number, body: unknown): boolean {
  if (status !== 401 || !body || typeof body !== 'object') {
    return false;
  }

  const candidate = body as { message?: unknown; error?: unknown };
  return candidate.message === 'missing_admin_token'
    || candidate.message === 'invalid_admin_token'
    || candidate.error === 'missing_admin_token'
    || candidate.error === 'invalid_admin_token';
}

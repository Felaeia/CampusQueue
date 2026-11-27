/**
 * Pure-JS JWT payload decoding utilities (works on Hermes, JSC, and Web
 * without relying on `atob` or external dependencies).
 *
 * `campusqueue-api` issues RS256-signed Firebase ID Token JWTs via
 * `POST /api/auth` and refreshes them via `POST /api/session`.
 */

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64Url(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLength);

    if (typeof globalThis.atob === 'function') {
      const binary = globalThis.atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder('utf-8').decode(bytes);
      }
      return binary;
    }

    const output: number[] = [];
    let buffer = 0;
    let bits = 0;
    for (let i = 0; i < padded.length; i++) {
      const char = padded[i];
      if (char === '=') break;
      const value = BASE64_CHARS.indexOf(char);
      if (value === -1) return null;
      buffer = (buffer << 6) | value;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        output.push((buffer >> bits) & 0xff);
      }
    }
    return String.fromCharCode(...output);
  } catch {
    return null;
  }
}

export interface JwtClaims {
  exp?: number;
  iat?: number;
  sub?: string;
  user_id?: string;
  [key: string]: unknown;
}

export function decodeJwtPayload(token?: string | null): JwtClaims | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const decoded = decodeBase64Url(parts[1]);
  if (!decoded) return null;
  try {
    const parsed: unknown = JSON.parse(decoded);
    return parsed && typeof parsed === 'object' ? (parsed as JwtClaims) : null;
  } catch {
    return null;
  }
}

/**
 * Returns the JWT expiration timestamp in epoch milliseconds by inspecting the
 * signed `exp` claim first, falling back to `expiresIn` seconds if absent.
 */
export function getJwtExpiryMs(
  idToken?: string | null,
  fallbackExpiresIn?: string | number
): number {
  const claims = decodeJwtPayload(idToken);
  if (claims && typeof claims.exp === 'number' && Number.isFinite(claims.exp)) {
    return claims.exp * 1000;
  }
  const seconds = Number(fallbackExpiresIn);
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 3600;
  return Date.now() + safeSeconds * 1000;
}

export function isJwtExpiringSoon(expiresAtMs: number, bufferMs = 90_000): boolean {
  if (!Number.isFinite(expiresAtMs)) return true;
  return Date.now() >= expiresAtMs - bufferMs;
}

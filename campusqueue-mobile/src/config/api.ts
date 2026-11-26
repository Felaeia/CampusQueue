/**
 * Centralized CampusQueue API configuration.
 *
 * Switch between the deployed Vercel API and a local campusqueue-api server
 * by setting EXPO_PUBLIC_CAMPUSQUEUE_API_URL in `campusqueue-mobile/.env`:
 *   - Production: https://campusqueue-api.vercel.app
 *   - Local web:  http://localhost:3000
 *   - Local LAN:  http://<your-machine-ip>:3000
 */

export const PRODUCTION_API_URL = 'https://campusqueue-api.vercel.app';
export const LOCAL_API_URL = 'http://localhost:3000';

function normalizeBaseUrl(raw?: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/\/api\/?$/i, '')
    .replace(/\/+$/, '');
}

const configuredUrl = normalizeBaseUrl(
  process.env.EXPO_PUBLIC_CAMPUSQUEUE_API_URL ?? process.env.EXPO_PUBLIC_API_URL
);

export const API_BASE_URL = configuredUrl || PRODUCTION_API_URL;

export const API_POLLING_INTERVAL_MS = 4000;
export const ADMIN_POLLING_INTERVAL_MS = 10000;
export const REQUEST_TIMEOUT_MS = 15000;

export function apiUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, '').replace(/^api\//i, '');
  return `${API_BASE_URL}/api/${cleanPath}`;
}

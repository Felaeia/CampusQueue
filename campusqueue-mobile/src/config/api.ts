/**
 * Centralized CampusQueue API configuration.
 *
 * Switch between the deployed Vercel API and a local campusqueue-api server
 * by setting EXPO_PUBLIC_CAMPUSQUEUE_API_URL in `campusqueue-mobile/.env`:
 *   - Production: https://campusqueue-api.vercel.app
 *   - Local web:  http://localhost:3000
 *   - Local LAN:  http://<your-machine-ip>:3000
 */

export const configuredApiUrl =
  process.env.EXPO_PUBLIC_CAMPUSQUEUE_API_URL ?? process.env.EXPO_PUBLIC_API_URL;

export const API_MAX_BACKOFF_MS = 60_000;
export const ADMIN_POLLING_INTERVAL_MS = 30_000;

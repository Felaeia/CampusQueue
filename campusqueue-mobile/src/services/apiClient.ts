import { API_BASE_URL, REQUEST_TIMEOUT_MS, apiUrl } from '../config/api';

export class ApiResponseError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly endpoint: string,
    readonly responseBody?: string,
    readonly isTimeout = false
  ) {
    super(message);
    this.name = 'ApiResponseError';
  }
}

export function isAbortOrTimeoutError(error: unknown): boolean {
  if (error instanceof ApiResponseError) return error.isTimeout;
  if (!(error instanceof Error)) return false;
  return (
    error.name === 'AbortError' ||
    /aborted|timed out|timeout/i.test(error.message)
  );
}

export function getFriendlyApiError(error: unknown): string {
  if (error instanceof ApiResponseError) return error.message;
  if (error instanceof Error) {
    if (isAbortOrTimeoutError(error)) {
      return `Request timed out while contacting ${API_BASE_URL}. Please check your connection and try again.`;
    }
    if (/network request failed|failed to fetch|load failed/i.test(error.message)) {
      return `Could not reach ${API_BASE_URL}. Check that the server is running and reachable.`;
    }
    return error.message;
  }
  return 'CampusQueue request failed.';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function apiFetchJson<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH';
    data?: object;
    token?: string;
    timeoutMs?: number;
    /** When true (e.g. background polling), transient network/timeout logs use console.warn instead of console.error so Expo LogBox doesn't flood the UI. */
    silent?: boolean;
    /** Automatic retry count on transient network/timeout errors (defaults to 1 for non-silent GET, 0 otherwise). */
    retries?: number;
  } = {}
): Promise<T> {
  const url = apiUrl(path);
  const method = options.method ?? (options.data ? 'POST' : 'GET');
  const maxRetries = options.retries ?? (method === 'GET' && !options.silent ? 1 : 0);
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    let didTimeout = false;
    const timeout = setTimeout(() => {
      didTimeout = true;
      try {
        controller.abort();
      } catch {
        // Ignore engine-specific abort errors
      }
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          ...(options.data ? { 'Content-Type': 'application/json' } : {}),
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        },
        body: options.data ? JSON.stringify(options.data) : undefined,
        signal: controller.signal,
      });

      const rawText = await response.text();
      let parsed: unknown = null;
      if (rawText) {
        try {
          parsed = JSON.parse(rawText);
        } catch {
          parsed = null;
        }
      }

      if (!response.ok) {
        console.error('[CampusQueue API Error]', {
          method,
          endpoint: url,
          status: response.status,
          responseBody: rawText.slice(0, 500),
        });

        const apiMessage =
          parsed &&
          typeof parsed === 'object' &&
          'error' in parsed &&
          typeof (parsed as { error?: unknown }).error === 'string'
            ? (parsed as { error: string }).error
            : rawText && rawText.length < 180
              ? rawText.trim()
              : `CampusQueue request failed (${response.status}).`;

        throw new ApiResponseError(apiMessage, response.status, url, rawText);
      }

      if (parsed === null) {
        console.error('[CampusQueue API Error]', {
          method,
          endpoint: url,
          status: response.status,
          responseBody: rawText.slice(0, 500),
        });
        throw new ApiResponseError(
          'Unexpected non-JSON response from CampusQueue server.',
          response.status,
          url,
          rawText
        );
      }

      return parsed as T;
    } catch (error) {
      if (error instanceof ApiResponseError) throw error;

      const timedOut = didTimeout || isAbortOrTimeoutError(error);
      if (attempt < maxRetries) {
        await delay(600 * (attempt + 1));
        continue;
      }

      const message = timedOut
        ? `Request timed out while contacting ${API_BASE_URL}. Please check your connection and try again.`
        : getFriendlyApiError(error);
      const logPayload = {
        method,
        endpoint: url,
        timedOut,
        error: error instanceof Error ? error.message : String(error),
      };

      if (options.silent) {
        console.warn('[CampusQueue API Background Sync Warning]', logPayload);
      } else {
        console.error('[CampusQueue API Network Error]', logPayload);
      }

      throw new ApiResponseError(message, 0, url, undefined, timedOut);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new ApiResponseError('CampusQueue request failed.', 0, url);
}

export async function apiDownloadFile(
  path: string,
  token: string,
  fallbackSummaryLabel: string
): Promise<string> {
  const url = apiUrl(path);
  const controller = new AbortController();
  let didTimeout = false;
  const timeout = setTimeout(() => {
    didTimeout = true;
    try {
      controller.abort();
    } catch {
      // Ignore engine-specific abort errors
    }
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });

    if (!response.ok) {
      const rawText = await response.text().catch(() => '');
      console.error('[CampusQueue API Download Error]', {
        method: 'GET',
        endpoint: url,
        status: response.status,
        responseBody: rawText.slice(0, 500),
      });
      let message = `Report download failed (${response.status}).`;
      try {
        const parsed = JSON.parse(rawText);
        if (parsed && typeof parsed.error === 'string') message = parsed.error;
      } catch {
        if (rawText && rawText.length < 180) message = rawText.trim();
      }
      throw new ApiResponseError(message, response.status, url, rawText);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/pdf')) {
      const blob = await response.blob();
      return `${fallbackSummaryLabel} PDF generated (${blob.size.toLocaleString()} bytes).`;
    }
    return response.text();
  } catch (error) {
    if (error instanceof ApiResponseError) throw error;
    const timedOut = didTimeout || isAbortOrTimeoutError(error);
    const message = timedOut
      ? `Download timed out while contacting ${API_BASE_URL}. Please try again.`
      : getFriendlyApiError(error);
    console.error('[CampusQueue API Download Network Error]', {
      method: 'GET',
      endpoint: url,
      timedOut,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new ApiResponseError(message, 0, url, undefined, timedOut);
  } finally {
    clearTimeout(timeout);
  }
}

import { REQUEST_TIMEOUT_MS, apiUrl } from '../config/api';

export class ApiResponseError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly endpoint: string,
    readonly responseBody?: string
  ) {
    super(message);
    this.name = 'ApiResponseError';
  }
}

export function getFriendlyApiError(error: unknown): string {
  if (error instanceof ApiResponseError) return error.message;
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return 'Request timed out. Please check your connection and try again.';
    }
    if (/network request failed|failed to fetch|load failed/i.test(error.message)) {
      return 'Could not reach the CampusQueue server. Check your internet connection or API URL.';
    }
    return error.message;
  }
  return 'CampusQueue request failed.';
}

export async function apiFetchJson<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH';
    data?: object;
    token?: string;
    timeoutMs?: number;
  } = {}
): Promise<T> {
  const url = apiUrl(path);
  const method = options.method ?? (options.data ? 'POST' : 'GET');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);

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
    const message = getFriendlyApiError(error);
    console.error('[CampusQueue API Network Error]', {
      method,
      endpoint: url,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new ApiResponseError(message, 0, url);
  } finally {
    clearTimeout(timeout);
  }
}

export async function apiDownloadFile(
  path: string,
  token: string,
  fallbackSummaryLabel: string
): Promise<string> {
  const url = apiUrl(path);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
    const message = getFriendlyApiError(error);
    console.error('[CampusQueue API Download Network Error]', {
      method: 'GET',
      endpoint: url,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new ApiResponseError(message, 0, url);
  } finally {
    clearTimeout(timeout);
  }
}
export class ApiResponseError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiResponseError';
    this.status = status;
  }
}

const timeoutMs = 12000;
const allowedServerError = new Set([400, 401, 403, 404, 409, 422, 429]);

export function apiOrigin(value: string | undefined, allowHttp = false): string {
  try {
    const url = new URL(value?.trim() ?? '');
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:'))) {
      throw new Error();
    }
    return url.origin;
  } catch {
    throw new ApiResponseError('CampusQueue’s API address is missing or invalid. Check the app configuration.', 0);
  }
}

export function createApiClient(
  value: string | undefined,
  allowHttp = false,
  transport: typeof fetch = fetch,
  timeout = timeoutMs,
) {
  return async function request<T>(
    path: string,
    options: { data?: object; token?: string; method?: 'GET' | 'POST' | 'PATCH'; download?: boolean } = {},
  ): Promise<T> {
    const origin = apiOrigin(value, allowHttp);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await transport(origin + '/api/' + path, {
        method: options.method ?? (options.data ? 'POST' : 'GET'),
        headers: {
          Accept: options.download ? 'text/csv, application/pdf, application/json' : 'application/json',
          ...(options.data ? { 'Content-Type': 'application/json' } : {}),
          ...(options.token ? { Authorization: 'Bearer ' + options.token } : {}),
        },
        body: options.data ? JSON.stringify(options.data) : undefined,
        signal: controller.signal,
      });
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      if (response.ok && options.download && /^(text\/csv|application\/pdf)\b/i.test(contentType)) {
        return {
          bytes: new Uint8Array(await response.arrayBuffer()),
          contentType: contentType.split(';')[0],
          filename: response.headers.get('content-disposition')?.match(/filename="([a-z\d._-]+)"/i)?.[1],
        } as T;
      }

      const result: unknown = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : null;
      if (controller.signal.aborted) throw new Error();
      if (!response.ok) {
        const detail = result && typeof result === 'object' && 'error' in result ? result.error : undefined;
        const message = allowedServerError.has(response.status) && typeof detail === 'string' && detail.length <= 240
          ? detail
          : response.status >= 500
            ? 'CampusQueue is temporarily unavailable. Try again shortly.'
            : 'CampusQueue could not complete this request.';
        throw new ApiResponseError(message, response.status);
      }
      if (options.download || !result || typeof result !== 'object' || Array.isArray(result)) {
        throw new ApiResponseError('CampusQueue returned an unexpected response. Try again shortly.', response.status);
      }
      return result as T;
    } catch (error) {
      if (error instanceof ApiResponseError) throw error;
      throw new ApiResponseError(controller.signal.aborted
        ? 'The request timed out. Check your connection and try again.'
        : 'Could not reach CampusQueue. Check your connection and try again.', 0);
    } finally {
      clearTimeout(timer);
    }
  };
}

export interface ApiDownload {
  bytes: Uint8Array;
  contentType: string;
  filename?: string;
}

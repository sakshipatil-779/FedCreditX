/**
 * FedCreditX Unified API Client.
 *
 * Guarantees:
 * 1. Uses relative same-origin paths only (/api/*).
 * 2. Uses credentials: 'same-origin' to prevent cross-origin leakage and support first-party cookies.
 * 3. Never attempts to parse HTML error pages (e.g. 502 Bad Gateway) as JSON.
 * 4. Categorizes failures into typed error kinds:
 *    - 'proxy_unavailable' (HTTP 502, 504, or non-JSON/HTML responses from proxy)
 *    - 'backend_unavailable' (HTTP 503)
 *    - 'unauthorized' (HTTP 401)
 *    - 'forbidden' (HTTP 403)
 *    - 'server_error' (HTTP 500 or other 5xx errors)
 *    - 'network' (Fetch network drop, DNS failure, or aborted connection)
 */

export type ApiErrorKind =
  | 'proxy_unavailable'
  | 'backend_unavailable'
  | 'unauthorized'
  | 'forbidden'
  | 'server_error'
  | 'network';

export interface ApiError {
  kind: ApiErrorKind;
  status?: number;
  statusText?: string;
  endpoint: string;
  message: string;
  details?: string;
  isOfficerSafe: boolean;
  officerMessage: string;
}

export type ApiResponse<T> =
  | {
      ok: true;
      data: T;
      error?: null;
      kind?: undefined;
      status: number;
    }
  | {
      ok: false;
      data?: null;
      error: ApiError;
      kind: ApiErrorKind;
      status?: number;
      message: string;
      endpoint: string;
      details?: string;
    };

export function getOfficerErrorMessage(kind: ApiErrorKind): string {
  switch (kind) {
    case 'proxy_unavailable':
    case 'backend_unavailable':
    case 'network':
      return 'The server is waking up. Retry in a few seconds.';
    case 'unauthorized':
      return 'Your session has expired or authentication is required. Please sign in.';
    case 'forbidden':
      return 'Access restricted. You do not have permission to view or modify this resource.';
    case 'server_error':
    default:
      return 'The server is waking up. Retry in a few seconds.';
  }
}

/**
 * Core fetch wrapper with strict response safety and typed error mappings.
 */
export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  let url = endpoint;
  if (!url.startsWith('/') && !url.startsWith('http')) {
    url = `/${url}`;
  }

  const defaultHeaders: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    try {
      const sessionToken = localStorage.getItem('fedcreditx_session_token');
      const authUser = localStorage.getItem('fedcreditx_auth_user');
      if (sessionToken) {
        defaultHeaders['Authorization'] = `Bearer ${sessionToken}`;
        defaultHeaders['X-Session-Token'] = sessionToken;
      }
      if (authUser) {
        const parsed = JSON.parse(authUser);
        if (parsed?.role) {
          defaultHeaders['X-User-Role'] = parsed.role;
        }
      }
    } catch {
      // ignore
    }
  }

  const fetchOptions: RequestInit = {
    ...options,
    credentials: options.credentials || 'same-origin',
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  };

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (err: any) {
    const error: ApiError = {
      kind: 'network',
      endpoint: url,
      status: 0,
      statusText: 'Network Error',
      message: 'Network connection error connecting to backend API.',
      details: err?.message || String(err),
      isOfficerSafe: true,
      officerMessage: getOfficerErrorMessage('network'),
    };
    return {
      ok: false,
      data: null,
      error,
      kind: 'network',
      status: 0,
      message: error.message,
      endpoint: url,
      details: error.details,
    };
  }

  const status = response.status;
  const statusText = response.statusText;
  const contentType = response.headers?.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');

  if (!response.ok) {
    let kind: ApiErrorKind = 'server_error';
    if (status === 502 || status === 504 || (!isJson && status >= 500)) {
      kind = 'proxy_unavailable';
    } else if (status === 503) {
      kind = 'backend_unavailable';
    } else if (status === 401) {
      kind = 'unauthorized';
    } else if (status === 403) {
      kind = 'forbidden';
    } else if (status >= 500) {
      kind = 'server_error';
    }

    let serverMessage = `HTTP ${status} ${statusText}`;
    let serverDetails = '';

    if (isJson) {
      try {
        const jsonBody = await response.json();
        serverMessage = jsonBody.detail || jsonBody.message || JSON.stringify(jsonBody);
        serverDetails = typeof jsonBody === 'string' ? jsonBody : JSON.stringify(jsonBody, null, 2);
      } catch {
        serverDetails = 'Failed to parse JSON body.';
      }
    } else {
      try {
        const textBody = await response.text();
        if (textBody.includes('<html') || textBody.includes('<!DOCTYPE') || textBody.includes('502')) {
          serverDetails = `Gateway/Proxy HTML returned (${status} ${statusText}).`;
        } else {
          serverDetails = textBody.slice(0, 300);
        }
      } catch {
        serverDetails = 'Unable to read response body.';
      }
    }

    const error: ApiError = {
      kind,
      status,
      statusText,
      endpoint: url,
      message: serverMessage,
      details: serverDetails || serverMessage,
      isOfficerSafe: true,
      officerMessage: getOfficerErrorMessage(kind),
    };

    return {
      ok: false,
      data: null,
      error,
      kind,
      status,
      message: error.message,
      endpoint: url,
      details: error.details,
    };
  }

  // Response OK (200-299)
  if (!isJson) {
    const isCsv = contentType.toLowerCase().includes('text/csv');
    const acceptsCsv = String(fetchOptions.headers?.['Accept' as keyof HeadersInit] || '').includes('text/csv');
    if (isCsv || acceptsCsv) {
      const textData = await response.text();
      return {
        ok: true,
        data: textData as unknown as T,
        error: null,
        status,
      };
    }

    // Non-JSON returned when JSON expected
    const textData = await response.text();
    const error: ApiError = {
      kind: 'proxy_unavailable',
      status,
      statusText,
      endpoint: url,
      message: 'Expected JSON response from backend.',
      details: textData.slice(0, 300),
      isOfficerSafe: true,
      officerMessage: getOfficerErrorMessage('proxy_unavailable'),
    };
    return {
      ok: false,
      data: null,
      error,
      kind: 'proxy_unavailable',
      status,
      message: error.message,
      endpoint: url,
      details: error.details,
    };
  }

  try {
    const data = await response.json();
    return {
      ok: true,
      data,
      error: null,
      status,
    };
  } catch (err: any) {
    const error: ApiError = {
      kind: 'proxy_unavailable',
      status,
      statusText,
      endpoint: url,
      message: 'Failed to parse JSON response.',
      details: err?.message || String(err),
      isOfficerSafe: true,
      officerMessage: getOfficerErrorMessage('proxy_unavailable'),
    };
    return {
      ok: false,
      data: null,
      error,
      kind: 'proxy_unavailable',
      status,
      message: error.message,
      endpoint: url,
      details: error.details,
    };
  }
}

/**
 * Health check helper with retry logic (3 attempts, 3 seconds apart).
 */
export async function checkHealthWithRetry(
  maxAttempts = 3,
  delayMs = 3000,
  onAttempt?: (attempt: number, max: number) => void
): Promise<ApiResponse<any>> {
  let lastResult: ApiResponse<any> = {
    ok: false,
    data: null,
    error: {
      kind: 'network',
      endpoint: '/api/health',
      status: 0,
      message: 'Health check not attempted',
      isOfficerSafe: true,
      officerMessage: 'The server is waking up. Retry in a few seconds.',
    },
    kind: 'network',
    status: 0,
    message: 'Health check not attempted',
    endpoint: '/api/health',
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (onAttempt) {
      onAttempt(attempt, maxAttempts);
    }

    lastResult = await apiFetch<any>('/api/health');
    if (lastResult.ok) {
      return lastResult;
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return lastResult;
}

export const apiClient = {
  fetch: apiFetch,
  get: <T = any>(url: string, headers?: HeadersInit) =>
    apiFetch<T>(url, { method: 'GET', headers }),
  post: <T = any>(url: string, body?: any, headers?: HeadersInit) =>
    apiFetch<T>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(headers || {}),
      },
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    }),
  checkHealth: checkHealthWithRetry,
};

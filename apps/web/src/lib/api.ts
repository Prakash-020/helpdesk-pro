import type { ApiErrorBody } from '@helpdesk/shared';

/**
 * Typed API client — the single place raw fetch is allowed.
 * Session cookie travels automatically via credentials: 'include';
 * no token is ever stored in JS-accessible storage.
 */

export const BASE = import.meta.env.VITE_API_URL ?? '';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'Cannot reach the server. Is the API running?');
  }

  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const err = (data as ApiErrorBody | undefined)?.error;
    throw new ApiRequestError(
      res.status,
      err?.code ?? 'UNKNOWN_ERROR',
      err?.message ?? res.statusText,
      err?.details,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

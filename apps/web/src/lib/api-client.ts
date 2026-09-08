import { getAccessToken, setAccessToken } from "./auth-token";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const REFRESH_PATH = "/api/v1/auth/refresh";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function rawRequest(path: string, init?: RequestInit): Promise<Response> {
  const token = getAccessToken();
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include", // sends/receives the httpOnly refresh_token cookie (13-Authentication.md §13.6)
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await rawRequest(REFRESH_PATH, { method: "POST" });
        if (!response.ok) {
          setAccessToken(null);
          return false;
        }
        const body = (await response.json()) as { access_token: string };
        setAccessToken(body.access_token);
        return true;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => null);
  const code = body?.error?.code ?? "UNKNOWN_ERROR";
  const message = body?.error?.message ?? response.statusText;
  return new ApiError(response.status, code, message);
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response = await rawRequest(path, init);

  // A 401 (AuthenticationError, 06-Backend-Architecture.md §6.7) means the access
  // token is missing/expired - worth exactly one silent refresh-and-retry. A 403
  // (PermissionDeniedError) means the session is valid but not authorized; retrying
  // would never help, so it's surfaced as-is.
  if (response.status === 401 && path !== REFRESH_PATH) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await rawRequest(path, init);
    }
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function apiFetchBlob(path: string, init?: RequestInit): Promise<Blob> {
  let response = await rawRequest(path, init);
  if (response.status === 401 && path !== REFRESH_PATH) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await rawRequest(path, init);
  }
  if (!response.ok) throw await toApiError(response);
  return response.blob();
}

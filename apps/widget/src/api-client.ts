const DEFAULT_API_BASE_URL = "http://localhost:8000";

export class WidgetApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function createApiClient(apiBaseUrl: string = DEFAULT_API_BASE_URL) {
  async function request<T>(
    path: string,
    init: RequestInit & { guestToken?: string } = {},
  ): Promise<T> {
    const { guestToken, ...rest } = init;
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(guestToken ? { "X-Guest-Session": guestToken } : {}),
        ...rest.headers,
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new WidgetApiError(
        response.status,
        body?.error?.code ?? "UNKNOWN_ERROR",
        body?.error?.message ?? response.statusText,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }
    return response.json() as Promise<T>;
  }

  return { request };
}

export type ApiClient = ReturnType<typeof createApiClient>;

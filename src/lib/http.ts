type ApiErrorPayload = {
  error?: unknown;
};

function isJsonResponse(response: Response) {
  return response.headers.get("content-type")?.toLowerCase().includes("json");
}

export async function readJsonResponse<T>(response: Response): Promise<T | null> {
  if (!isJsonResponse(response)) return null;

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getApiResponseError(
  response: Response,
  fallbackMessage: string,
) {
  const payload = await readJsonResponse<ApiErrorPayload>(response);

  if (typeof payload?.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  if (response.status === 401) {
    return "Your session has expired. Sign in again, then retry.";
  }

  if (response.status >= 500) {
    return "The app server ran into a temporary problem. Refresh and try again.";
  }

  return fallbackMessage;
}

export const GENERIC_ERROR_MESSAGE = "Something went wrong";

export function unexpectedErrorMessage(error: unknown, fallback = GENERIC_ERROR_MESSAGE): string {
  if (process.env.NODE_ENV === "production") return GENERIC_ERROR_MESSAGE;
  return error instanceof Error ? error.message : fallback;
}

// Check status before reading JSON: reverse proxies can return HTML for 5xx errors.
export async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (process.env.NODE_ENV === "production" && response.status >= 500) {
    return new Response(JSON.stringify({ message: GENERIC_ERROR_MESSAGE }), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  return response;
}

import "server-only";
import { GENERIC_ERROR_MESSAGE } from "@/lib/errors";

const LARAVEL_API_URL = process.env.LARAVEL_API_URL?.replace(/\/$/, "");

export class LaravelApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(process.env.NODE_ENV === "production" && status >= 500 ? GENERIC_ERROR_MESSAGE : message);
    this.name = "LaravelApiError";
    this.status = status;
    this.payload = process.env.NODE_ENV === "production" && status >= 500
      ? { message: GENERIC_ERROR_MESSAGE }
      : payload;
  }
}

type LaravelRequestOptions = RequestInit & {
  token?: string | null;
};

// Only fixed route families and known transport codes belong in server logs.
// Never log URLs, query values, bodies, headers, raw exceptions or API payloads.
function logFailure(path: string, method: string | undefined, startedAt: number,
  kind: "network_error" | "http_error" | "invalid_json", response?: Response, error?: unknown, requestId?: string) {
  const endpoint = path.match(/^\/(app|candidates)\/(me|login|logout|register|forgot-password|reset-password|dashboard|my-work|notifications|settings|jobs|job-options|applications|candidates|users|roles|scorecards|billing|search|invitations)(?=[/?#]|$)/)?.[0] ?? "other";
  const verb = method?.toUpperCase() ?? "GET";
  const cause = error instanceof Error && error.cause && typeof error.cause === "object"
    ? error.cause as { code?: unknown } : undefined;
  const code = cause?.code;
  const knownCode = typeof code === "string" && /^(ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|UND_ERR_CONNECT_TIMEOUT|UND_ERR_HEADERS_TIMEOUT|UND_ERR_BODY_TIMEOUT|UND_ERR_SOCKET|CERT_HAS_EXPIRED|DEPTH_ZERO_SELF_SIGNED_CERT|UNABLE_TO_VERIFY_LEAF_SIGNATURE)$/.test(code) ? code : undefined;
  const ray = response?.headers.get("cf-ray");
  console.error("[laravel-api]", JSON.stringify({
    timestamp: new Date().toISOString(), kind, endpoint, request_id: requestId,
    method: /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(verb) ? verb : "OTHER",
    duration_ms: Math.max(0, Date.now() - startedAt),
    status: response?.status,
    transport_code: knownCode,
    timeout: error instanceof Error && error.name === "TimeoutError" || undefined,
    aborted: error instanceof Error && error.name === "AbortError" || undefined,
    cf_ray: ray && /^[a-f0-9]{16,32}-[A-Z]{3}$/i.test(ray) ? ray : undefined,
  }));
}

export async function laravelFetch<T>(path: string, options: LaravelRequestOptions = {}): Promise<T> {
  if (!LARAVEL_API_URL) {
    throw new Error("LARAVEL_API_URL is not configured.");
  }

  const { token, headers, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);

  requestHeaders.set("Accept", "application/json");

  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const configuredTimeout = Number(process.env.LARAVEL_API_TIMEOUT_MS ?? 30_000);
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout >= 100 && configuredTimeout <= 120_000
    ? configuredTimeout : 30_000;
  const deadline = AbortSignal.timeout(timeoutMs);
  const signal = requestOptions.signal ? AbortSignal.any([requestOptions.signal, deadline]) : deadline;
  const requestId = crypto.randomUUID();
  requestHeaders.set("X-Request-ID", requestId);
  const startedAt = Date.now();
  const timedOut = (error: unknown) => deadline.aborted || error instanceof Error && error.name === "TimeoutError";
  let response: Response;
  try {
    response = await fetch(`${LARAVEL_API_URL}${path}`, {
      ...requestOptions,
      headers: requestHeaders,
      signal,
      cache: "no-store",
      redirect: "error",
    });
  } catch (error) {
    logFailure(path, requestOptions.method, startedAt, "network_error", undefined, error, requestId);
    if (timedOut(error)) throw new LaravelApiError("Upstream request timed out.", 504, null);
    throw error;
  }

  if (response.ok && (response.status === 204 || response.status === 205 || requestOptions.method?.toUpperCase() === "HEAD")) {
    return null as T;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (signal.aborted || timedOut(error)) {
      logFailure(path, requestOptions.method, startedAt, "network_error", response, error, requestId);
      if (timedOut(error)) throw new LaravelApiError("Upstream request timed out.", 504, null);
      throw error;
    }
    if (response.ok) {
      logFailure(path, requestOptions.method, startedAt, "invalid_json", response, error, requestId);
      throw new LaravelApiError("Laravel API returned an invalid JSON response.", 502, null);
    }
    payload = null;
  }

  if (!response.ok) {
    logFailure(path, requestOptions.method, startedAt, "http_error", response, undefined, requestId);
    const message =
      payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : `Laravel API request failed (${response.status}).`;

    throw new LaravelApiError(message, response.status, payload);
  }

  return payload as T;
}

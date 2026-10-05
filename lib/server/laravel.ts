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

  const response = await fetch(`${LARAVEL_API_URL}${path}`, {
    ...requestOptions,
    headers: requestHeaders,
    cache: "no-store",
    redirect: "error",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : `Laravel API request failed (${response.status}).`;

    throw new LaravelApiError(message, response.status, payload);
  }

  return payload as T;
}

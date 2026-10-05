import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveIntakeRoute } from "@/lib/intake";
import { unexpectedErrorMessage } from "@/lib/errors";
import { LaravelApiError, laravelFetch } from "@/lib/server/laravel";
import { hasTrustedRequestOrigin } from "@/lib/server/request-origin";

export const runtime = "nodejs";

async function limitedBody(request: Request, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    length += result.value.byteLength;
    if (length > limit) { await reader.cancel(); throw new LaravelApiError("This request is too large.", 413, null); }
    chunks.push(result.value);
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

async function handler(request: Request, context: { params: Promise<{ job: string; path?: string[] }> }) {
  const { job, path: parts = [] } = await context.params;
  const path = resolveIntakeRoute(job, parts, request.method);
  const finish = (response: NextResponse) => {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
  if (!path) return finish(NextResponse.json({ message: "Not found." }, { status: 404 }));
  if (!hasTrustedRequestOrigin(request)) {
    return finish(NextResponse.json({ message: "Invalid request origin." }, { status: 403 }));
  }
  const action = parts[0];
  const jar = await cookies();
  const tokenName = `recruiterz_careers_intake_${job}`;
  const challengeName = `recruiterz_careers_intake_challenge_${job}`;
  const recoveryName = `recruiterz_careers_intake_recovery_${job}`;
  const token = jar.get(tokenName)?.value;
  const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: `/api/intake/${job}/` };
  if (action === "verify" && !jar.get(challengeName)?.value) {
    const message = "Your verification code has expired. Request a new code and try again.";
    return finish(NextResponse.json({ message, errors: { code: [message] } }, { status: 422 }));
  }
  if (["session", "progress"].includes(action) && !token && jar.get(challengeName)?.value) {
    return finish(NextResponse.json({ data: { verification_pending: true } }));
  }
  if (action && !["start", "access", "verify"].includes(action) && !token) return finish(NextResponse.json({ message: "Verify your email to continue." }, { status: 401 }));
  try {
    let body: BodyInit | undefined;
    const headers = new Headers();
    if (request.method === "POST") {
      const bytes = await limitedBody(request, action === "documents" ? 11 * 1024 * 1024 : 512 * 1024);
      if (action === "documents") {
        const contentType = request.headers.get("content-type") ?? "";
        if (!contentType.startsWith("multipart/form-data;")) return finish(NextResponse.json({ message: "Select a file to upload." }, { status: 400 }));
        headers.set("Content-Type", contentType);
        body = bytes;
      } else {
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(new TextDecoder().decode(bytes));
          if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error();
        } catch { return finish(NextResponse.json({ message: "Invalid request." }, { status: 400 })); }
        body = JSON.stringify(action === "verify" ? { code: payload.code, challenge: jar.get(challengeName)?.value, recovery_key: jar.get(recoveryName)?.value } : payload);
        headers.set("Content-Type", "application/json");
      }
    }
    const payload = await laravelFetch<{ token?: string; challenge?: string; data?: unknown; message?: string }>(path, { method: request.method, body, headers, signal: AbortSignal.timeout(30_000), token: ["start", "access", "verify"].includes(action) ? undefined : token });
    // Secret values cross only the server boundary and HttpOnly cookies.
    const { token: nextToken, challenge, ...visible } = payload;
    const response = NextResponse.json(visible, { status: request.method === "POST" && ["start", "access", "documents"].includes(action) ? 201 : 200 });
    if (["start", "access"].includes(action) && challenge) {
      response.cookies.set(challengeName, challenge, { ...cookieOptions, maxAge: 600 });
      response.cookies.set(tokenName, "", { ...cookieOptions, maxAge: 0 });
      response.cookies.set(recoveryName, randomBytes(32).toString("hex"), { ...cookieOptions, maxAge: 600 });
    }
    if (action === "verify" && nextToken) {
      response.cookies.set(tokenName, nextToken, { ...cookieOptions, maxAge: 86400 });
      response.cookies.set(challengeName, "", { ...cookieOptions, maxAge: 0 });
      response.cookies.set(recoveryName, "", { ...cookieOptions, maxAge: 0 });
    }
    return finish(response);
  } catch (error) {
    if (error instanceof LaravelApiError) {
      const payload = error.status === 429 ? { message: "Too many attempts. Please wait before trying again." } : error.payload ?? { message: error.message };
      const response = NextResponse.json(payload, { status: error.status });
      if (error.status === 401) response.cookies.set(tokenName, "", { ...cookieOptions, maxAge: 0 });
      return finish(response);
    }
    return finish(NextResponse.json({ message: unexpectedErrorMessage(error) }, { status: 500 }));
  }
}

export { handler as GET, handler as POST, handler as DELETE };

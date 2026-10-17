import { IntakeError, intakeRequest, type IntakeFile } from "./intake";

type UploadGrant =
  | { transport: "proxy"; max_size?: number }
  | { transport: "complete"; document: IntakeFile }
  | { transport: "direct"; id: string; url: string; headers: Record<string, string>; expires_at: string };

// Retain only retry identifiers in memory. File bytes, grants and applicant
// credentials never enter browser storage. Re-selecting the same file can retry.
export function createIntakeUploader() {
  const attempts = new Map<string, { id: string; expires: number }>();
  return async (job: string, key: string, file: File, session: string): Promise<IntakeFile> => {
    if (!file.size || file.size > 10 * 1024 * 1024) {
      throw new IntakeError("Select a non-empty file no larger than 10 MB.", 422);
    }
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    const fingerprint = JSON.stringify([job, session, key, file.name, sha256]);
    for (const [fingerprint, attempt] of attempts) if (attempt.expires <= Date.now()) attempts.delete(fingerprint);
    let attempt = attempts.get(fingerprint);
    if (!attempt) {
      attempt = { id: crypto.randomUUID(), expires: Date.now() + 5 * 60_000 };
      attempts.set(fingerprint, attempt);
    }
    let grant: UploadGrant;
    try {
      grant = (await intakeRequest<{ data: UploadGrant }>(job, "/document-uploads", {
        method: "POST", body: JSON.stringify({ request_id: attempt.id, key, name: file.name, size: file.size, sha256 }),
      })).data;
    } catch (error) {
      // Small files remain usable during the backend-first rollout. Never send
      // a large multipart body to Vercel when an older backend lacks the endpoint.
      if (error instanceof IntakeError && error.status === 404 && file.size <= 4 * 1024 * 1024) grant = { transport: "proxy" };
      else {
        if (error instanceof IntakeError && error.status === 410) attempts.delete(fingerprint);
        if (error instanceof IntakeError && error.status === 404) throw new IntakeError("File uploads are temporarily unavailable. Please try again later.", 503);
        throw error;
      }
    }
    if (grant.transport === "complete") {
      attempts.delete(fingerprint);
      return grant.document;
    }
    if (grant.transport === "proxy") {
      if (grant.max_size && file.size > grant.max_size) throw new IntakeError("File uploads are temporarily unavailable. Please try again later.", 503);
      const body = new FormData(); body.set("key", key); body.set("file", file);
      const result = await intakeRequest<{ data: IntakeFile }>(job, "/documents", { method: "POST", body });
      attempts.delete(fingerprint);
      return result.data;
    }
    const url = new URL(grant.url);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Something went wrong");
    attempt.expires = Date.parse(grant.expires_at);
    // Only the binary body goes to private object storage. No application cookies,
    // bearer token, or referrer accompanies this narrowly scoped PUT capability.
    const response = await fetch(url, {
      method: "PUT", body: file, headers: grant.headers, credentials: "omit",
      redirect: "error", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new IntakeError("The file could not be uploaded. Select it again to retry.", 502);
    try {
      const result = await intakeRequest<{ data: IntakeFile }>(job, `/document-uploads/${grant.id}/complete`, {
        method: "POST", body: "{}",
      });
      attempts.delete(fingerprint);
      return result.data;
    } catch (error) {
      if (error instanceof IntakeError && error.status === 410) attempts.delete(fingerprint);
      throw error;
    }
  };
}

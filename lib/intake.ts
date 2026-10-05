import { safeFetch } from "./errors";

export type IntakeQuestion = { key: string; label: string; type: "text" | "yes_no"; required: boolean; expected_answer?: boolean | null };
export type DocumentRequirement = { key: string; label: string; required: boolean; allowed_extensions: string[]; max_size_mb: number; max_files: number };
export type IntakeProcess = { slug: string; name: string; fields: Record<string, boolean> | null; documents: DocumentRequirement[]; questions: IntakeQuestion[] };
export type IntakeFile = { id: string; key: string; name: string; size: number };
export type PublicJob = {
  id: number; title: string; company: string | null; location?: string | null;
  workplace_type?: string | null; employment_type?: string | null; position_summary?: string | null;
  department?: string | null; company_overview?: string | null; responsibilities?: string | null;
  qualifications?: string | null; benefits?: string | null; equal_opportunity_statement?: string | null;
  skills?: string[] | null; languages?: string[] | null; years_of_experience?: string | number | null;
  education_level?: string | null; expiration_date?: string | null;
  salary?: { min: number | string | null; max: number | string | null; currency: string | null };
};
export type IntakeConfiguration = { job: PublicJob; processes: IntakeProcess[] };
export type IntakeReceipt = { submitted: true; submitted_at: string; reference: string; job: PublicJob };
export type IntakePending = { verification_pending: true };
export type IntakeSession = IntakeConfiguration & { submitted: false; email: string; expires_at: string; documents: IntakeFile[] };
export type ProfileValues = Record<string, string | Record<string, string>[]>;
export type QuestionAnswers = Record<string, string | boolean | null>;

export class IntakeError extends Error {
  constructor(message: string, public status: number, public errors: Record<string, string[]> = {}) { super(message); }
}

// Candidate authentication is independent of the recruiter's signed-in session.
export async function intakeRequest<T>(job: string, path = "", options: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(40_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const response = await safeFetch(`/api/intake/${job}${path}`, { ...options, signal, cache: "no-store", headers: options.body instanceof FormData ? options.headers : { "Content-Type": "application/json", ...options.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new IntakeError(body?.message ?? "Something went wrong", response.status, body?.errors ?? {});
  if (!body) throw new Error("Something went wrong");
  return body as T;
}

export function resolveIntakeRoute(job: string, parts: string[], method: string) {
  if (!/^[1-9]\d*$/.test(job)) return null;
  const path = parts.join("/");
  if ((method === "GET" && ["", "session"].includes(path)) ||
    (method === "POST" && ["start", "verify", "documents", "submit"].includes(path)) ||
    (method === "DELETE" && parts.length === 2 && parts[0] === "documents" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parts[1]))) {
    return `/candidates/jobs/${job}/intake${path ? `/${path}` : ""}`;
  }
  return null;
}

import type { IntakeSession, ProfileValues, QuestionAnswers } from "./intake";

type Draft = { profile: ProfileValues; answers: Record<string, QuestionAnswers> };
type StoredDraft = Draft & { email: string; expires: string; form: string };
const key = (job: string) => `recruiterz:application-draft:${job}`;

// Form values only: credentials and codes never enter browser storage.
export function readDraft(storage: Storage, job: string, session: IntakeSession): Draft | null {
  try {
    const raw = storage.getItem(key(job));
    if (!raw) return null;
    const draft: StoredDraft = JSON.parse(raw);
    if (draft.email !== session.email || draft.expires !== session.expires_at ||
      !Number.isFinite(Date.parse(draft.expires)) || Date.parse(draft.expires) <= Date.now() || draft.form !== JSON.stringify(session.processes) ||
      !draft.profile || typeof draft.profile !== "object" || Array.isArray(draft.profile) ||
      !draft.answers || typeof draft.answers !== "object" || Array.isArray(draft.answers)) {
      storage.removeItem(key(job));
      return null;
    }
    return { profile: draft.profile, answers: draft.answers };
  } catch { return null; }
}

export function saveDraft(storage: Storage, job: string, session: IntakeSession, draft: Draft): boolean {
  try {
    storage.setItem(key(job), JSON.stringify({ ...draft, email: session.email, expires: session.expires_at, form: JSON.stringify(session.processes) }));
    return true;
  } catch { return false; }
}

export function clearDraft(storage: Storage, job: string) {
  try { storage.removeItem(key(job)); } catch { /* Storage may be disabled. */ }
}

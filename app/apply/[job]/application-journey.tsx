"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { readDraft, saveDraft, clearDraft } from "@/lib/intake-draft";
import CareersShell from "@/components/careers-shell";
import ApplicationReceipt from "@/components/application-receipt";
import MessagePopup from "@/components/ui/message-popup";
import { ProfileFields, QuestionFields } from "@/components/applications/intake-fields";
import { IntakeError, intakeRequest, type IntakeConfiguration, type IntakeFile, type IntakeReceipt, type IntakeSession, type IntakePending, type ProfileValues, type QuestionAnswers } from "@/lib/intake";
import { unexpectedErrorMessage } from "@/lib/errors";

const button = "rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50";
const secondary = "rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:border-brand-300 disabled:opacity-50";
const input = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

export default function ApplicationJourney({ jobId }: { jobId: string }) {
  const [configuration, setConfiguration] = useState<IntakeConfiguration | null>(null);
  const [session, setSession] = useState<IntakeSession | null>(null);
  const [receipt, setReceipt] = useState<IntakeReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [profile, setProfile] = useState<ProfileValues>({});
  const [answers, setAnswers] = useState<Record<string, QuestionAnswers>>({});

  const [draftAvailable, setDraftAvailable] = useState(true);

  const acceptSession = useCallback((data: IntakeSession | IntakeReceipt, restoreDraft = true) => {
    if (data.submitted) {
      setReceipt(data); setSession(null); setProfile({}); setAnswers({}); setCode("");
      try { clearDraft(window.sessionStorage, jobId); } catch { /* Storage may be disabled. */ }
    } else {
      setSession(data); setConfiguration(data); setEmail(data.email); setCode("");
      if (restoreDraft) {
        try {
          const draft = readDraft(window.sessionStorage, jobId, data);
          setProfile(draft?.profile ?? {}); setAnswers(draft?.answers ?? {});
        } catch { setDraftAvailable(false); }
      }
    }
  }, [jobId]);

  function updateDraft(nextProfile: ProfileValues, nextAnswers: Record<string, QuestionAnswers>) {
    setProfile(nextProfile); setAnswers(nextAnswers);
    if (!session) return;
    try { setDraftAvailable(saveDraft(window.sessionStorage, jobId, session, { profile: nextProfile, answers: nextAnswers })); }
    catch { setDraftAvailable(false); }
  }

  const load = useCallback((signal?: AbortSignal) => {
    return intakeRequest<{ data: IntakeSession | IntakeReceipt | IntakeConfiguration | IntakePending }>(jobId, "/session", { signal })
      .catch(err => {
        if (!(err instanceof IntakeError) || ![401, 409].includes(err.status)) throw err;
        if (!signal?.aborted) { setSession(null); setCodeSent(false); }
        return intakeRequest<{ data: IntakeConfiguration }>(jobId, "", { signal });
      })
      .then(async ({ data }) => {
        if ("verification_pending" in data) {
          const configuration = (await intakeRequest<{ data: IntakeConfiguration }>(jobId, "", { signal })).data;
          if (!signal?.aborted) { setConfiguration(configuration); setCodeSent(true); }
        } else if (!signal?.aborted) {
          if ("submitted" in data) acceptSession(data);
          else setConfiguration(data);
        }
      })
      .catch(err => { if (!signal?.aborted) setLoadError(err instanceof IntakeError ? err.message : unexpectedErrorMessage(err)); })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [jobId, acceptSession]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function run(work: () => Promise<void>, verifying = false) {
    if (working.current) return;
    working.current = true;
    setBusy(true); setError([]);
    try { await work(); }
    catch (err) {
      // Read authoritative state after a lost response; never blindly re-upload.
      if (!(err instanceof IntakeError) || err.status >= 500 || err.status === 409) {
        try {
          const { data } = await intakeRequest<{ data: IntakeSession | IntakeReceipt | IntakePending }>(jobId, "/session");
          if ("submitted" in data) {
            acceptSession(data, verifying);
            if (data.submitted || verifying) return;
          }
        } catch { /* Preserve the original error and the unsent draft. */ }
      }
      setError(err instanceof IntakeError ? Object.values(err.errors).flat().length ? Object.values(err.errors).flat() : [err.message] : [unexpectedErrorMessage(err)]);
      if (err instanceof IntakeError && [401, 409].includes(err.status)) { setSession(null); setCodeSent(false); setCode(""); }
    } finally { working.current = false; setBusy(false); }
  }

  async function upload(key: string, file: File) {
    await run(async () => {
      const body = new FormData(); body.set("key", key); body.set("file", file);
      const result = await intakeRequest<{ data: IntakeFile }>(jobId, "/documents", { method: "POST", body });
      setSession(current => current && { ...current, documents: [...current.documents, result.data] });
    });
  }

  const job = receipt?.job ?? configuration?.job;
  const step = receipt ? 3 : session ? 2 : 1;
  return <CareersShell company={job?.company}>
    <main id="main-content" className="mx-auto w-full max-w-4xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <Link href={`/jobs/${jobId}`} className="mb-6 inline-block text-sm font-semibold text-brand-600">← Job details</Link>
      <div className="mb-8"><p className="text-sm font-semibold text-brand-600">{job?.company ?? "Your next opportunity"}</p><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{receipt ? "Application received" : job?.title ?? "Apply for this role"}</h1>{job && <p className="mt-3 text-sm text-slate-500">{[job.employment_type, job.workplace_type, job.location].filter(Boolean).join(" · ")}</p>}</div>
      <ol aria-label="Application progress" className="mb-8 grid grid-cols-3 gap-3">{["Verify email", "Your application", "Submitted"].map((name, i) => <li key={name} aria-current={step === i + 1 ? "step" : undefined} className={`border-t-2 pt-3 text-xs font-semibold sm:text-sm ${step >= i + 1 ? "border-brand-600 text-brand-700" : "border-slate-200 text-slate-400"}`}><span className="mr-2">{i + 1}.</span>{name}</li>)}</ol>
      {loading ? <div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading application…</div>
        : loadError ? <section className="rounded-2xl border border-slate-200 bg-white p-8"><h2 className="text-lg font-bold">Could not load this application</h2><p role="alert" className="my-4 text-sm text-slate-600">{loadError}</p><button className={secondary} onClick={() => { setLoading(true); setLoadError(""); void load(); }}>Try again</button></section>
        : receipt ? <ApplicationReceipt receipt={receipt} />
        : !session ? <section className="rounded-2xl border border-slate-200 bg-white p-7 sm:p-10">
          <h2 className="text-xl font-bold">{codeSent ? "Check your inbox" : "Let’s start with your email"}</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">{codeSent ? `Enter the six-digit code sent to ${email || "your email address"}. It expires in 10 minutes.` : "We’ll send you a verification code so your application is connected to the right email address."}</p>
          <form noValidate className="mt-6 max-w-md" onSubmit={event => { event.preventDefault(); void run(async () => {
            if (codeSent) acceptSession((await intakeRequest<{ data: IntakeSession | IntakeReceipt }>(jobId, "/verify", { method: "POST", body: JSON.stringify({ code }) })).data);
            else { await intakeRequest(jobId, "/start", { method: "POST", body: JSON.stringify({ email: email.trim() }) }); setCodeSent(true); }
          }, codeSent); }}><fieldset disabled={busy}><label className="text-sm font-semibold text-slate-600">{codeSent ? "Verification code" : "Email address"}<input className={input} type={codeSent ? "text" : "email"} autoComplete={codeSent ? "one-time-code" : "email"} inputMode={codeSent ? "numeric" : "email"} maxLength={codeSent ? 6 : 254} value={codeSent ? code : email} onChange={event => codeSent ? setCode(event.target.value.replace(/\D/g, "")) : setEmail(event.target.value)} required /></label><div className="mt-5 flex flex-wrap gap-3"><button className={button} type="submit">{busy ? "Please wait…" : codeSent ? "Verify and continue" : "Send verification code"}</button>{codeSent && <button className={secondary} type="button" onClick={() => { setCodeSent(false); setCode(""); }}>Change email / resend</button>}</div></fieldset></form>
        </section> : <form noValidate onSubmit={event => { event.preventDefault(); void run(async () => {
          acceptSession((await intakeRequest<{ data: IntakeReceipt }>(jobId, "/submit", { method: "POST", body: JSON.stringify({ profile: { ...profile, email: session.email }, answers }) })).data);
        }); }}><fieldset disabled={busy} className="space-y-6"><legend className="sr-only">Application details</legend>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4"><p className="break-all text-sm text-emerald-800">Email verified · <strong>{session.email}</strong></p><span className="text-xs text-emerald-700">Required fields are marked *</span></div>
          {session.processes.map(process => {
            if (process.slug.includes("questions") || process.slug === "applying.questionnaire") {
              if (!process.questions.length) return null;
              return <section key={process.slug} className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"><h2 className="mb-6 text-lg font-bold">{process.slug === "applying.knockout-questions" ? "Application questions" : "Additional questions"}</h2><QuestionFields questions={process.questions} value={answers[process.slug] ?? {}} onChange={value => updateDraft(profile, { ...answers, [process.slug]: value })} /></section>;
            }
            if (process.slug === "applying.application-form") return <section key={process.slug} className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"><h2 className="mb-6 text-lg font-bold">Your information</h2><ProfileFields fields={process.fields} value={profile} onChange={value => updateDraft(value, answers)} verifiedEmail={session.email} /></section>;
            if (!process.documents.length) return null;
            return <section key={process.slug} className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"><h2 className="text-lg font-bold">Documents</h2><p className="mt-2 text-sm text-slate-500">Uploaded files are shared privately with the hiring team.</p><div className="mt-6 space-y-6">{process.documents.map(slot => {
              const files = session.documents.filter(file => file.key === slot.key);
              return <div key={slot.key}><label className="block text-sm font-semibold text-slate-700">{slot.label} {slot.required ? <span className="text-brand-600">*</span> : <span className="text-xs font-normal text-slate-400">(optional)</span>}<span className="mt-1 block text-xs font-normal text-slate-400">{slot.allowed_extensions.join(", ").toUpperCase()} · Up to {slot.max_size_mb} MB each · {slot.max_files} {slot.max_files === 1 ? "file" : "files"}</span><input type="file" accept={slot.allowed_extensions.map(ext => `.${ext}`).join(",")} disabled={busy || files.length >= slot.max_files} className="mt-3 block w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-2 file:font-semibold file:text-brand-700 disabled:opacity-40" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(slot.key, file); event.target.value = ""; }} /></label>
                {files.map(file => <div key={file.id} className="mt-3 flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-4 py-3"><span className="min-w-0 break-all text-sm text-slate-600">{file.name}<span className="ml-2 text-xs text-slate-400">{Math.ceil(file.size / 1024)} KB</span></span><button className="shrink-0 text-xs font-semibold text-rose-600" type="button" aria-label={`Remove ${file.name}`} onClick={() => void run(async () => { await intakeRequest(jobId, `/documents/${file.id}`, { method: "DELETE" }); setSession(current => current && { ...current, documents: current.documents.filter(item => item.id !== file.id) }); })}>Remove</button></div>)}
              </div>;
            })}</div></section>;
          })}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"><h2 className="text-lg font-bold">Ready to apply?</h2><p className="mt-2 text-sm leading-6 text-slate-500">Review your information before submitting. You won’t be able to edit it after submission.</p><p className="mt-2 text-xs leading-5 text-slate-400">{draftAvailable ? "Your answers are saved in this tab for refresh recovery until your 24-hour session expires. Uploaded files are retained during that time." : "Your browser could not save a draft. Keep this page open until you submit; refreshing may lose your answers."}</p><button className={`${button} mt-5`} type="submit">{busy ? "Please wait…" : "Submit application"}</button></div>
        </fieldset></form>}
    </main>
    {error.length > 0 && <MessagePopup type="error" duration={0} message={<div><strong>Could not continue</strong><ul className="mt-1 list-disc space-y-1 pl-4">{error.map((message, index) => <li key={index}>{message}</li>)}</ul></div>} onDismiss={() => setError([])} />}
  </CareersShell>;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import CareersShell from "@/components/careers-shell";
import MessagePopup from "@/components/ui/message-popup";
import { IntakeError, intakeRequest, type IntakePending } from "@/lib/intake";
import { progressDescription, type ApplicationProgress } from "@/lib/application-progress";
import { unexpectedErrorMessage } from "@/lib/errors";

const button = "rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50";
const secondary = "rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 disabled:opacity-50";
const input = "mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-400";

export default function ApplicationProgressPage({ jobId }: { jobId: string }) {
  const [application, setApplication] = useState<ApplicationProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pendingCode, setPendingCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [confirm, setConfirm] = useState(false);
  const [unsubmitted, setUnsubmitted] = useState(false);
  const accept = useCallback((data: ApplicationProgress | IntakePending) => {
    if ("verification_pending" in data) { setApplication(null); setPendingCode(true); setUnsubmitted(false); }
    else { setApplication(data); setPendingCode(false); setCode(""); setUnsubmitted(false); }
  }, []);
  const load = useCallback((signal?: AbortSignal) => {
    return intakeRequest<{ data: ApplicationProgress | IntakePending }>(jobId, "/progress", { signal })
      .then(({ data }) => { if (!signal?.aborted) accept(data); })
      .catch(error => {
        if (signal?.aborted) return;
        if (error instanceof IntakeError && error.status === 401) {
          setApplication(null); setPendingCode(false); setUnsubmitted(false);
        } else if (error instanceof IntakeError && error.status === 409) {
          setApplication(null); setUnsubmitted(true);
        } else setLoadError(error instanceof IntakeError ? error.message : unexpectedErrorMessage(error));
      })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [jobId, accept]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);

  async function run(action: "access" | "verify" | "withdraw") {
    if (working.current) return;
    working.current = true; setBusy(true); setMessage([]);
    try {
      if (action === "access") {
        await intakeRequest(jobId, "/access", { method: "POST", body: JSON.stringify({ email: email.trim() }) });
        setPendingCode(true); setCode("");
      } else if (action === "verify") {
        await intakeRequest(jobId, "/verify", { method: "POST", body: JSON.stringify({ code }) });
        accept((await intakeRequest<{ data: ApplicationProgress }>(jobId, "/progress")).data);
      } else if (application) {
        accept((await intakeRequest<{ data: ApplicationProgress }>(jobId, "/withdraw", { method: "POST", body: JSON.stringify({ expected_version: application.version }) })).data);
        setConfirm(false);
      }
    } catch (error) {
      if (!(error instanceof IntakeError) || error.status >= 500 || error.status === 409 || (action === "withdraw" && error.status === 422)) {
        try {
          const { data } = await intakeRequest<{ data: ApplicationProgress | IntakePending }>(jobId, "/progress");
          accept(data);
          if (action === "access" && "verification_pending" in data) return;
          if (!("verification_pending" in data) && !data.can_withdraw) setConfirm(false);
          if (!("verification_pending" in data) && (action === "verify" || data.status === "withdrawn")) { setConfirm(false); return; }
        } catch { /* Keep the original error and offer a deliberate retry. */ }
      }
      if (error instanceof IntakeError && error.status === 401) { setApplication(null); setPendingCode(false); setConfirm(false); }
      if (error instanceof IntakeError && error.status === 409) {
        setConfirm(false);
        if (action === "verify") { setApplication(null); setUnsubmitted(true); return; }
      }
      const fields = error instanceof IntakeError ? Object.values(error.errors).flat() : [];
      setMessage(fields.length ? fields : [error instanceof IntakeError ? error.message : unexpectedErrorMessage(error)]);
    } finally { working.current = false; setBusy(false); }
  }

  return <CareersShell company={application?.job.company}>
    <main id="main-content" className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-sm font-semibold text-brand-600">{application?.job.company ?? "Recruiterz Careers"}</p>
      <h1 className="mt-3 text-3xl font-bold">Your application</h1>
      {loading ? <p role="status" className="mt-8">Loading application…</p> : loadError ? <section className="mt-8 rounded-2xl border bg-white p-7"><h2 className="font-bold">Could not load your application</h2><p role="alert" className="my-4">{loadError}</p><button className={secondary} onClick={() => { setLoadError(""); setLoading(true); void load(); }}>Try again</button></section>
        : unsubmitted ? <section className="mt-8 rounded-2xl border bg-white p-7"><h2 className="font-bold">Finish your application</h2><p className="my-4">Your application has not been submitted yet.</p><Link className={button} href={`/apply/${jobId}`}>Continue application</Link></section>
        : application ? <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-7 sm:p-10" aria-label="Application progress">
          <h2 className="break-words text-2xl font-bold">{application.job.title}</h2>
          <p className="mt-6 inline-block rounded-full bg-brand-50 px-4 py-2 text-sm font-bold text-brand-700" role="status">{application.status_label}</p>
          <p className="mt-5 leading-7 text-slate-600">{progressDescription(application.status)}</p>
          <dl className="mt-7 grid gap-5 rounded-xl bg-slate-50 p-5 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Application reference</dt><dd className="mt-1 break-all font-mono text-xs">{application.reference}</dd></div><div><dt className="text-slate-500">Submitted</dt><dd className="mt-1">{application.submitted_at ? new Date(application.submitted_at).toLocaleString() : "Unavailable"}</dd></div></dl>
          <div className="mt-7 flex flex-wrap gap-3"><button disabled={busy} className={secondary} onClick={() => { setLoading(true); setLoadError(""); void load(); }}>Refresh status</button>{application.can_withdraw && <button disabled={busy} className={`${secondary} text-rose-700`} onClick={() => setConfirm(true)}>Withdraw application</button>}</div>
          <p className="mt-5 text-xs leading-5 text-slate-500">Keep this page link. You can verify your email again to return, even if the job is no longer open.</p>
        </section> : <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-7 sm:p-10">
          <h2 className="text-xl font-bold">{pendingCode ? "Check your inbox" : "View your application securely"}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{pendingCode ? "If an application matches this email, we’ll send a six-digit code. The code expires in 10 minutes." : "Enter the email address you used to apply. Your application link alone does not grant access."}</p>
          <form noValidate className="mt-6" onSubmit={event => { event.preventDefault(); void run(pendingCode ? "verify" : "access"); }}><fieldset disabled={busy}><label className="text-sm font-semibold">{pendingCode ? "Verification code" : "Email address"}<input className={input} type={pendingCode ? "text" : "email"} inputMode={pendingCode ? "numeric" : "email"} autoComplete={pendingCode ? "one-time-code" : "email"} maxLength={pendingCode ? 6 : 254} value={pendingCode ? code : email} onChange={event => pendingCode ? setCode(event.target.value.replace(/\D/g, "")) : setEmail(event.target.value)} /></label><div className="mt-5 flex flex-wrap gap-3"><button type="submit" className={button}>{busy ? "Please wait…" : pendingCode ? "Verify and view" : "Send verification code"}</button>{pendingCode && <button type="button" className={secondary} onClick={() => { setPendingCode(false); setCode(""); setMessage([]); }}>Change email / resend</button>}</div></fieldset></form>
        </section>}
    </main>
    <Dialog.Root open={confirm} onOpenChange={value => { if (!busy) setConfirm(value); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40" /><Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6"><Dialog.Title className="text-xl font-bold">Withdraw this application?</Dialog.Title><Dialog.Description className="mt-4 text-sm leading-6 text-slate-600">The hiring team will stop considering your application. Your submitted information will remain in their records. You cannot undo this here.</Dialog.Description><div className="mt-6 flex flex-wrap justify-end gap-3"><Dialog.Close asChild><button disabled={busy} className={secondary}>Keep application</button></Dialog.Close><button disabled={busy} className={`${button} bg-rose-600 hover:bg-rose-700`} onClick={() => void run("withdraw")}>{busy ? "Please wait…" : "Confirm withdrawal"}</button></div></Dialog.Content></Dialog.Portal></Dialog.Root>
    {message.length > 0 && <MessagePopup type="error" duration={0} message={<div><strong>Could not continue</strong><ul className="mt-1 list-disc pl-4">{message.map((text, index) => <li key={index}>{text}</li>)}</ul></div>} onDismiss={() => setMessage([])} />}
  </CareersShell>;
}

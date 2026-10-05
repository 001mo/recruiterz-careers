import type { IntakeReceipt } from "@/lib/intake";

export default function ApplicationReceipt({ receipt }: { receipt: IntakeReceipt }) {
  return <section aria-label="Application receipt" className="rounded-2xl border border-emerald-200 bg-white p-7 sm:p-10">
    <span aria-hidden="true" className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600">✓</span>
    <h2 className="text-xl font-bold">Thank you for applying</h2>
    <p className="mt-3 leading-7 text-slate-600">Your application for <strong className="font-semibold text-slate-800">{receipt.job.title}</strong>{receipt.job.company ? <> at <strong className="font-semibold text-slate-800">{receipt.job.company}</strong></> : null} has been received. The hiring team can now review your information.</p>
    <dl className="mt-6 grid gap-5 rounded-xl bg-slate-50 p-5 text-sm sm:grid-cols-2">
      <div><dt className="text-slate-500">Role</dt><dd className="mt-1 break-words font-semibold text-slate-800">{receipt.job.title}</dd></div>
      {receipt.job.company && <div><dt className="text-slate-500">Employer</dt><dd className="mt-1 break-words font-semibold text-slate-800">{receipt.job.company}</dd></div>}
      <div><dt className="text-slate-500">Received</dt><dd className="mt-1 text-slate-800"><time dateTime={receipt.submitted_at}>{new Date(receipt.submitted_at).toLocaleString()}</time></dd></div>
      <div><dt className="text-slate-500">Application reference</dt><dd className="mt-1 break-all font-mono text-xs text-slate-700">{receipt.reference}</dd></div>
    </dl>
    <p className="mt-6 text-sm leading-6 text-slate-500">Keep this reference for your records. You can safely close this page; there is no need to submit your application again.</p>
  </section>;
}

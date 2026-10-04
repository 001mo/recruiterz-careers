"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import CareersShell from "@/components/careers-shell";
import { IntakeError, intakeRequest, type IntakeConfiguration } from "@/lib/intake";
import { unexpectedErrorMessage } from "@/lib/errors";

const button = "inline-flex justify-center rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white hover:bg-brand-700";

export default function JobDetails({ jobId }: { jobId: string }) {
  const query = useQuery({ queryKey: ["public-job", jobId], queryFn: () => intakeRequest<{ data: IntakeConfiguration }>(jobId), retry: false });
  const job = query.data?.data.job;
  const sections = job ? [["About the company", job.company_overview], ["About the role", job.position_summary],
    ["Responsibilities", job.responsibilities], ["Qualifications", job.qualifications], ["Benefits", job.benefits],
    ["Equal opportunity", job.equal_opportunity_statement]] : [];
  const salary = job?.salary;
  const amounts = salary ? [salary.min, salary.max].filter(value => value !== null && value !== "").map(value => Number(value).toLocaleString()) : [];
  const unavailable = query.error instanceof IntakeError && query.error.status === 404;
  return <CareersShell company={job?.company}>
    <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      {query.isPending ? <p role="status">Loading job details…</p> : query.error ?
        <section className="rounded-2xl border border-slate-200 bg-white p-8"><h1 className="text-2xl font-bold">{unavailable ? "This job is unavailable" : "Could not load this job"}</h1>
          <p role="alert" className="mt-4 text-slate-600">{unavailable ? "This role may have closed or stopped accepting applications." : unexpectedErrorMessage(query.error)}</p>
          <button className={`${button} mt-6`} onClick={() => void query.refetch()}>Try again</button></section> : job && <>
          <header className="rounded-2xl border border-slate-200 bg-white p-7 sm:p-10">
            <p className="text-sm font-semibold text-brand-600">{job.company}</p>
            <h1 className="mt-3 break-words text-3xl font-bold tracking-tight sm:text-4xl">{job.title}</h1>
            <p className="mt-4 text-sm leading-6 text-slate-500">{[job.department, job.location, job.workplace_type, job.employment_type].filter(Boolean).join(" · ")}</p>
            {amounts.length > 0 && <p className="mt-3 text-sm font-semibold text-slate-700">{salary?.currency} {amounts.join(" – ")}</p>}
            {job.expiration_date && <p className="mt-3 text-sm text-slate-500">Apply by {job.expiration_date.slice(0, 10)}</p>}
            <Link className={`${button} mt-6 w-full sm:w-auto`} href={`/apply/${jobId}`}>Apply for this role</Link>
          </header>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_260px]">
            <div className="min-w-0 space-y-6">{sections.filter(([, text]) => text).map(([title, text]) =>
              <section key={title} className="rounded-2xl border border-slate-200 bg-white p-7 sm:p-8"><h2 className="text-lg font-bold">{title}</h2><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">{text}</p></section>)}
              {(job.skills?.length || job.languages?.length || job.years_of_experience != null || job.education_level) ? <section className="rounded-2xl border border-slate-200 bg-white p-7"><h2 className="text-lg font-bold">Role requirements</h2><dl className="mt-4 space-y-4 text-sm text-slate-600">
                {[["Skills", job.skills?.join(", ")], ["Languages", job.languages?.join(", ")], ["Experience (years)", job.years_of_experience], ["Education", job.education_level]].filter(([, value]) => value !== null && value !== undefined && value !== "").map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}
              </dl></section> : null}
            </div>
            <aside className="h-fit rounded-2xl border border-brand-100 bg-brand-50 p-6"><h2 className="font-bold">Your application</h2><p className="mt-3 text-sm leading-6 text-slate-600">Verify your email, complete the requested information, and submit it to the hiring team.</p>
              {query.data?.data.processes.some(process => process.documents.some(slot => slot.required)) && <p className="mt-3 text-sm leading-6 text-slate-600">Have your requested documents ready before submitting.</p>}
              <Link className={`${button} mt-5 w-full`} href={`/apply/${jobId}`}>Apply now</Link></aside>
          </div>
        </>}
    </main>
  </CareersShell>;
}

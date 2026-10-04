import CareersShell from "@/components/careers-shell";

const steps = [
  { number: "01", title: "Open your job link", description: "Follow the application link shared by the company or included in its job posting." },
  { number: "02", title: "Make your introduction", description: "Verify your email, tell the team about yourself, and add the documents they request." },
  { number: "03", title: "Apply with confidence", description: "Review your details and receive a confirmation when your application is submitted." },
];

export default function Home() {
  return (
    <CareersShell>
      <main id="main-content" className="mx-auto w-full max-w-5xl px-6 py-14 sm:px-10 sm:py-24">
        <section aria-labelledby="welcome-title" className="max-w-3xl">
          <p className="text-xs font-bold tracking-[0.18em] text-brand-700 uppercase">Your next chapter</p>
          <h1 id="welcome-title" className="mt-5 max-w-2xl text-4xl leading-[1.12] font-bold tracking-tight text-slate-900 sm:text-6xl">A new opportunity.<br /><span className="text-brand-700">A simpler first step.</span></h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">Introduce yourself to your next team. Recruiterz Careers connects your application directly with the company that’s hiring.</p>
          <div className="mt-9 flex max-w-xl items-start gap-4 rounded-2xl border border-brand-200 bg-white p-5 sm:p-6">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7 .2l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.2l-3 3a5 5 0 0 0 7 7l2-2" /></svg>
            </span>
            <div><h2 className="text-sm font-bold text-slate-900">Have an opportunity in mind?</h2><p className="mt-1 text-sm leading-6 text-slate-600">Open the company’s application link to get started. You’ll find the role details and everything you need to apply there.</p></div>
          </div>
        </section>
        <section aria-labelledby="how-it-works" className="mt-16 border-t border-slate-200 pt-10 sm:mt-20">
          <h2 id="how-it-works" className="text-lg font-bold text-slate-900">From opportunity to introduction</h2>
          <ol className="mt-7 grid gap-8 sm:grid-cols-3">
            {steps.map(step => <li key={step.number}><span aria-hidden="true" className="text-xs font-bold tracking-wider text-brand-700">{step.number}</span><h3 className="mt-3 text-base font-bold text-slate-900">{step.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p></li>)}
          </ol>
        </section>
      </main>
    </CareersShell>
  );
}

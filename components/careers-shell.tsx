import Link from "next/link";
import type { ReactNode } from "react";

export default function CareersShell({ children, company }: { children: ReactNode; company?: string | null }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a href="#main-content" className="sr-only z-50 rounded-lg bg-white p-3 text-sm font-semibold focus:not-sr-only focus:absolute focus:left-4 focus:top-4">Skip to content</a>
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex min-h-20 max-w-5xl items-center justify-between gap-5 px-6 sm:px-10">
          {company ? <span className="min-w-0 break-words text-lg font-bold tracking-tight text-slate-900">{company}</span>
            : <Link href="/" aria-label="Recruiterz Careers home" className="text-xl font-extrabold tracking-tight text-brand-700">Recruiterz<span className="text-brand-400">.</span></Link>}
          <span className="shrink-0 border-l border-slate-200 pl-5 text-sm font-medium text-slate-500">Careers</span>
        </div>
      </header>
      {children}
      <footer className="mt-auto border-t border-slate-200/80 bg-white px-6 py-6 text-center text-xs text-slate-500">
        Hiring powered by <Link href="/" className="font-semibold text-brand-700 hover:underline">Recruiterz</Link>
      </footer>
    </div>
  );
}

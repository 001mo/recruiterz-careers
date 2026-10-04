"use client";

import CareersShell from "@/components/careers-shell";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <CareersShell><main id="main-content" className="mx-auto w-full max-w-2xl px-6 py-24 text-center"><h1 className="text-2xl font-bold text-slate-900">Something went wrong</h1><p className="mt-4 text-slate-600">Please try loading this page again.</p><button type="button" className="mt-8 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700" onClick={retry}>Try again</button></main></CareersShell>;
}

import Link from "next/link";
import CareersShell from "@/components/careers-shell";

export default function NotFound() {
  return <CareersShell><main id="main-content" className="mx-auto w-full max-w-2xl px-6 py-24 text-center"><p className="text-sm font-semibold text-brand-700">Page unavailable</p><h1 className="mt-4 text-3xl font-bold text-slate-900">We couldn’t find that page</h1><p className="mt-4 leading-7 text-slate-600">Check the link shared by the company and try opening it again.</p><Link href="/" className="mt-8 inline-flex rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700">Return to Careers</Link></main></CareersShell>;
}

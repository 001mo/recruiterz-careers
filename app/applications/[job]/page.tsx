import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ApplicationProgressPage from "./application-progress";

export const metadata: Metadata = { title: "Your application", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function Page({ params }: { params: Promise<{ job: string }> }) {
  const { job } = await params;
  if (!/^[1-9]\d*$/.test(job)) notFound();
  return <ApplicationProgressPage key={job} jobId={job} />;
}

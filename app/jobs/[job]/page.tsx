import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JobDetails from "./job-details";

export const metadata: Metadata = { title: "Job details", robots: { index: false, follow: false } };

export default async function JobPage({ params }: { params: Promise<{ job: string }> }) {
  const { job } = await params;
  if (!/^[1-9]\d*$/.test(job)) notFound();
  return <JobDetails key={job} jobId={job} />;
}

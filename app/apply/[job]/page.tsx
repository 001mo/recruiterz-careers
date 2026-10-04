import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ApplicationJourney from "./application-journey";

export const metadata: Metadata = { title: "Apply", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function ApplyPage({ params }: { params: Promise<{ job: string }> }) {
  const { job } = await params;
  if (!/^[1-9]\d*$/.test(job)) notFound();
  return <ApplicationJourney key={job} jobId={job} />;
}

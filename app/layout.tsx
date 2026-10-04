import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Recruiterz Careers", template: "%s | Recruiterz Careers" },
  description: "A simpler way to take your next career step. Apply directly to employers with Recruiterz Careers.",
  referrer: "no-referrer",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <Providers>{children}<SpeedInsights /></Providers>
      </body>
    </html>
  );
}

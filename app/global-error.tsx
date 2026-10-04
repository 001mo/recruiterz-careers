"use client";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <html lang="en"><body><main style={{ padding: 40, textAlign: "center", fontFamily: "Arial, sans-serif" }}><h1>Something went wrong</h1><p>Please try loading this page again.</p><button type="button" onClick={retry}>Try again</button></main></body></html>;
}

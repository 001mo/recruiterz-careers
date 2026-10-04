import "server-only";

function normalizeOrigin(value: string): string | null {
  if (!/^https?:\/\/[^/\\?#\s]+\/?$/i.test(value)) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function hasTrustedRequestOrigin(request: Request): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;

  const header = request.headers.get("origin");
  // Preserve non-browser clients without Origin; browser cross-site writes are
  // rejected above even if their Origin header is absent.
  if (header === null) return true;
  const origin = normalizeOrigin(header);
  if (!origin) return false;

  // Pin the browser-facing origin when TLS or the host changes at a proxy.
  // Invalid configuration fails closed; forwarded headers cannot override it.
  const configuredOrigin = process.env.APP_ORIGIN?.trim();
  if (configuredOrigin) return origin === normalizeOrigin(configuredOrigin);

  // Next may construct request.url using its internal listener. Host preserves
  // the browser target on direct connections and host-preserving proxies.
  const target = new URL(request.url);
  const host = request.headers.get("host");
  if (host === null) return origin === target.origin;
  if (!host || /[\/\\?#@,\s]/.test(host)) return false;
  return origin === normalizeOrigin(`${target.protocol}//${host}`);
}

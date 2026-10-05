# Recruiterz Careers

Candidate-facing Next.js app. Work on `main` unless the user requests another branch.

- Match the framework choices in `001mo/recruiterz-app`: App Router, React, TypeScript, Tailwind CSS 4, TanStack Query, and Radix UI. Use npm and commit the lockfile.
- Keep employer/candidate layouts separate from the recruiter dashboard. Reuse design conventions and small UI primitives, not recruiter authentication or navigation.
- Laravel owns application validation, availability, uploads, and transitions. Browser requests go through the allowlisted Next.js BFF.
- Applicant secrets belong only in job-scoped HttpOnly cookies. Never use a recruiter token, public environment variable, localStorage, or URL for an applicant token.
- Preserve the explicit APP_ORIGIN policy for writes, including HTTPS tunnels. Never trust arbitrary forwarded headers.
- Return "Something went wrong" for unexpected production failures. Show validation feedback through MessagePopup and offer retries where appropriate.
- Do not invent employers, jobs, application states, or backend endpoints. Company careers pages and later-stage candidate tasks are follow-up work. Post-submission progress uses the explicit backend public projection.
- Run `npm run check` and `npm run build` before publishing changes. Keep Windows-compatible npm scripts.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

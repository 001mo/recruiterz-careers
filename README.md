# Recruiterz Careers

The candidate-facing Recruiterz application. This repository uses `main` and the same framework stack and dependency versions as `001mo/recruiterz-app`.

## Stack

- Next.js 16.3.4 with the App Router and React 19.2.8
- TypeScript 5 and Tailwind CSS 4
- TanStack Query 5 and Radix UI 1
- ESLint 9 with the matching Next.js configuration
- Vercel Speed Insights, matching the recruiter app
- npm with a committed lockfile; Node.js 24 recommended (minimum 20.9)

## Run locally

```sh
npm ci
```

Copy `.env.example` to `.env.local` and edit the values. On Windows Command Prompt:

```bat
copy .env.example .env.local
```

On macOS/Linux:

```sh
cp .env.example .env.local
```

```sh
npm run dev
```

Open `http://localhost:3001`. The separate port lets the recruiter app continue running on port 3000. To override it, use `npx next dev --port 3002` and update `APP_ORIGIN` to match.

| Variable | Purpose | Local value |
| --- | --- | --- |
| `LARAVEL_API_URL` | Server-only base URL of the existing Laravel backend | `http://127.0.0.1:8000` |
| `APP_ORIGIN` | Exact origin used by the browser, including scheme and port, without a path | `http://localhost:3001` |

The current backend routes have no `/api` prefix. Do not add one to `LARAVEL_API_URL` unless the backend configuration changes. Neither setting needs a `NEXT_PUBLIC_` prefix.

For a Cloudflare tunnel, point the tunnel to port 3001 and set `APP_ORIGIN` to its actual public HTTPS origin. Restart Next.js after changing environment variables. This prevents the internal HTTP listener from being mistaken for the public request origin. Do not change the Laravel `FRONTEND_URL` for recruiter invitations/password resets to the careers origin.

## Available now

| Route | Behavior |
| --- | --- |
| `/` | Responsive Careers entry page explaining how to apply through an employer's job link |
| `/apply/[job]` | Existing verified candidate application journey for a positive numeric job ID |
| `/api/intake/[job]/...` | Allowlisted BFF for the existing Laravel candidate-intake endpoints |

The application flow supports email verification, configured profile fields, questions, private document upload/removal, submission, and a submission receipt. Open `/apply/123` with an actual eligible job ID from your backend; the app does not include sample employers or jobs.

The intake journey was adapted from `recruiterz-app` commit `c468153c11dda61ca7c9cd29197d67349c966a19`. It calls `/candidates/jobs/{job}/intake` and its existing `start`, `verify`, `session`, `documents`, and `submit` actions. Laravel remains responsible for job eligibility, validation, rate limits, duplicate prevention, and pipeline processing. Run the existing Laravel app with its database migrations and working Mailgun configuration to use the flow end to end.

## Boundaries and conventions

- Candidate authentication is independent of recruiter authentication. The app never reads `recruiterz_token` and has no recruiter login or dashboard guard.
- Intake tokens and verification challenges stay in HttpOnly, SameSite=Strict, host-only cookies scoped to `/api/intake/{job}/`. Careers-specific names avoid collisions when both frontends run on localhost. Cookies are Secure in production; deploy over HTTPS.
- The BFF rejects untrusted write origins, strips token/challenge values from JSON responses, bounds upload sizes, and disables caching. Existing sessions on the recruiter origin do not transfer to this app.
- Production server failures display `Something went wrong`. Validation feedback uses the shared MessagePopup component.
- Application pages use `noindex` metadata and are excluded by robots rules. These directives do not replace backend authorization.
- The application header uses the employer name when available. `components/careers-shell.tsx` and the `--brand-*` CSS variables provide the visual foundation for future employer branding. Tenant branding settings are not implemented yet.
- Text answers currently stay in page memory until submission; uploads and the verified session can be recovered while the intake remains valid. Draft autosave is not implemented.
- The old recruiter app's application route remains untouched. Update generated/shared application links when the careers deployment is ready; this initialization does not cut over production traffic.

## Commands

```sh
npm run lint
npm run typecheck
npm test
npm run check
npm run build
npm start
```

`check` runs lint, Next.js type generation, TypeScript, and the focused intake/origin/error regressions. Run the production build separately. The scripts work in Windows shells without POSIX environment assignments.

## Next increments

1. Employer careers pages and public job details, backed by explicit public visibility rules.
2. Candidate application progress and tasks, with a separate public view of the internal pipeline.
3. Employer branding settings, draft recovery, and deployment/link cutover.

There is no cross-company marketplace, global candidate account, public company-directory endpoint, or post-submission tracking API in this initialization.

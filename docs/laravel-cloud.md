# Careers on Laravel Cloud

Create a Next.js application from `001mo/recruiterz-careers`, branch `main`, with
a `staging` environment. Select Node.js 24 and one replica initially. Keep Scale
to Zero off during hosted recovery verification. This app needs a Node server for
its intake BFF; it is not a static export.

Build commands:

```sh
npm ci --include=dev
npm run build
```

Start command: `npm start`. It respects Cloud's injected `PORT`. Do not use
`npm run start:local` in Cloud: that separate command deliberately uses port 3001
for local production testing, matching `npm run dev` and the local env example.

Set these server-only environment variables before deployment:

```dotenv
LARAVEL_API_URL=https://your-api-origin.example.com
APP_ORIGIN=https://your-careers-origin.example.com
LARAVEL_API_TIMEOUT_MS=30000
```

Replace these examples with assigned Cloud domains or configured custom domains.
The API URL has no `/api` suffix. `APP_ORIGIN` is the exact HTTPS origin candidates
open, with no path; never set it to the dashboard or backend origin. Cloud supplies
production Node behavior. No database, bucket, Mailgun secrets, recruiter token,
worker or scheduler belongs in this frontend's environment.

Set backend `CAREERS_URL` to this origin, leaving backend `FRONTEND_URL` pointed to
the recruiter dashboard. Deploy both settings before generating job links or status
emails. Preserve the BFF's explicit origin checks and job-scoped HttpOnly cookies;
do not trust arbitrary forwarded headers to resolve a domain mismatch.

After deployment, use a real staging job link copied from the recruiter dashboard.
With a controlled email address, verify the code, upload a test PDF, submit, refresh
the receipt, and re-verify access to progress. Confirm the submitted document is
available only to an authorized recruiter after a backend redeploy. Verify browser
cookies are Secure and that the flow works while the laptop/tunnel is off. Domain
changes require updating these settings and backend `CAREERS_URL`, then redeploying.

Before publishing code, run `npm run check` and `npm run build`. The backend
[Cloud guide](https://github.com/001mo/Recruiterz-backend/blob/main/docs/laravel-cloud.md)
owns resource provisioning, private storage and hosted recovery acceptance.
Cloud's [Next.js reference](https://laravel.com/cloud/docs/deploy-guides/nextjs)
describes the runtime and deployment controls.

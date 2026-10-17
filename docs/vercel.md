# Vercel Careers with Laravel Cloud

Keep the recruiter dashboard and Careers projects on Vercel. The API, database,
private storage, workers and scheduler stay in the existing Laravel Cloud environment.

## Deploy this upload change

1. Deploy the updated backend `main` on Laravel Cloud. Its existing deploy command
   must run `php artisan migrate --force`; this adds `intake_document_uploads`.
   Keep `CANDIDATE_DOCUMENTS_DISK=recruiterz_private` pointing to the private bucket.
2. In Laravel Cloud, open **Org → Resources → Object storage → … → Edit settings**
   for `recruiterz-production-private`. Add the **exact Careers browser origin**
   under **Allowed origins**, including `https://` and no path. For example, use
   `https://careers.recruiterz.io` if that is the domain actually serving Careers.
   Preserve existing origins; add a Vercel preview origin only when deliberately
   testing that deployment. Keep the bucket private. CORS must allow `PUT` and
   `Content-Type` (Cloud's default methods and headers already do).
3. Deploy this Careers revision on Vercel. Set its server-only `LARAVEL_API_URL`
   to `https://api.recruiterz.io` with no `/api` suffix and `APP_ORIGIN` to that same
   exact Careers browser origin. Existing correct values need no change. Environment
   changes require a new Vercel deployment. No bucket credentials belong in Vercel
   or a `NEXT_PUBLIC_` variable.
4. Use a controlled applicant account and a job whose document limit is 10 MB.
   Verify email, upload a valid PDF larger than 4.5 MB, submit, and download it as
   an authorized recruiter. Also check a small file, rejection above the job's
   limit, a disguised HTML file, and retry after a connection interruption.

The backend is backward compatible with the old Careers multipart endpoint.
During an out-of-order rollout, the new frontend can fall back to multipart for
files up to 4 MiB when the backend lacks the new routes. Larger files require the
backend migration and the bucket CORS setting. A local filesystem still supports
the original 10 MiB multipart flow in local development; on Vercel that fallback
is capped below the platform limit.

## Upload boundary

The authenticated BFF sends small JSON requests to prepare and complete an upload.
Laravel reserves the document slot and application quota, then issues a five-minute
presigned PUT URL for one random temporary object. Its signature binds the HTTP
method, object and exact Content-Length. The browser supplies that length from the
File body; JavaScript must not set a Content-Length header. The applicant token
remains in a job-scoped HttpOnly cookie. The PUT omits application credentials and
referrers, rejects redirects, and has a two-minute timeout.

Completion checks the current session, job, form, file size, SHA-256, actual MIME,
extension and quota. Laravel accepts a bounded snapshot into a separate private
document path. Reusing the PUT URL cannot overwrite an accepted document. Prepare
and completion retries are idempotent; reselecting the same file in the same page
reuses its retry identifier. Identifiers stay in memory, never browser storage.

Unfinished uploads reserve capacity for five minutes. An interrupted upload can
be retried by selecting the same file; a different file may need to wait until
the reservation expires. The existing hourly `intakes:prune` task deletes tracked
temporary objects after expiry plus one hour, repeats cleanup until session pruning,
and retains accepted documents attached to submitted applications. Keep the scheduler
running. For an additional provider cleanup backstop, an optional lifecycle rule
may expire only the `intake-uploads/` prefix after two days; never expire `intakes/`
or other document/export prefixes.

Automated checks use a real Laravel/Flysystem/AWS adapter with an in-memory object
transport and mocked browser requests. They do not prove live R2 CORS/signature
acceptance; complete step 4 on the deployed domains before marking the fix live.

References: [Vercel Function limits](https://vercel.com/docs/functions/limitations),
[Laravel Cloud object storage](https://laravel.com/cloud/docs/resources/object-storage),
[R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).

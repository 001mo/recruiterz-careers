const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)(name => { if (!(name in mocks)) throw new Error(name); return mocks[name]; }, module, module.exports);
  return module.exports;
}
const requestOrigin = load('lib/server/request-origin.ts', { 'server-only': {} });
const intake = load('lib/intake.ts', { './errors': { safeFetch: fetch } });
class LaravelApiError extends Error {
  constructor(message, status, payload) { super(message); this.status = status; this.payload = payload; }
}
function route(jar = {}, fetchBackend = async () => ({})) {
  return load('app/api/intake/[job]/[[...path]]/route.ts', {
    'next/headers': { cookies: async () => ({ get: name => jar[name] ? { value: jar[name] } : undefined }) },
    'next/server': { NextResponse: { json: (data, options) => { const response = Response.json(data, options); response.cookieWrites = []; response.cookies = { set: (...args) => response.cookieWrites.push(args) }; return response; } } },
    '@/lib/intake': intake,
    '@/lib/server/request-origin': requestOrigin,
    '@/lib/errors': { unexpectedErrorMessage: () => 'Something went wrong' },
    '@/lib/server/laravel': { LaravelApiError, laravelFetch: fetchBackend },
  });
}
const request = (suffix, data = {}, origin = 'https://app.example.com') => new Request(`https://app.example.com/api/intake/5/${suffix}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
const context = (...parts) => ({ params: Promise.resolve({ job: '5', path: parts }) });

test('candidate route allowlist rejects arbitrary paths, IDs and methods', () => {
  assert.equal(intake.resolveIntakeRoute('5', ['submit'], 'POST'), '/candidates/jobs/5/intake/submit');
  for (const args of [['../app', [], 'GET'], ['5', ['../applications'], 'GET'], ['5', ['session'], 'POST'], ['5', ['documents', '2'], 'DELETE'], ['5', ['submit', 'extra'], 'POST']]) assert.equal(intake.resolveIntakeRoute(...args), null);
});
test('verification uses the server challenge and strips secrets into HttpOnly job-scoped cookies', async () => {
  const handlers = route({ recruiterz_careers_intake_challenge_5: 'trusted-challenge' }, async (url, options) => {
    assert.equal(url, '/candidates/jobs/5/intake/verify');
    assert.deepEqual(JSON.parse(options.body), { code: '123456', challenge: 'trusted-challenge' });
    assert.equal(options.token, undefined);
    return { token: 'private-token', data: { email: 'candidate@example.com' } };
  });
  const response = await handlers.POST(request('verify', { code: '123456', challenge: 'injected-challenge' }), context('verify'));
  assert.deepEqual(await response.json(), { data: { email: 'candidate@example.com' } });
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(response.cookieWrites[0][0], 'recruiterz_careers_intake_5');
  assert.equal(response.cookieWrites[0][2].httpOnly, true);
  assert.equal(response.cookieWrites[0][2].sameSite, 'strict');
  assert.equal(response.cookieWrites[0][2].path, '/api/intake/5/');
});
test('starting verification never exposes the challenge and clears only the candidate session', async () => {
  const response = await route({}, async () => ({ challenge: 'secret-challenge', message: 'Check email' })).POST(request('start', { email: 'candidate@example.com' }), context('start'));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { message: 'Check email' });
  assert.deepEqual(response.cookieWrites.map(write => write[0]), ['recruiterz_careers_intake_challenge_5', 'recruiterz_careers_intake_5']);
});
test('candidate expiry never clears the recruiter authentication cookie', async () => {
  const response = await route({ recruiterz_careers_intake_5: 'expired', recruiterz_token: 'staff-secret' }, async () => { throw new LaravelApiError('Expired', 401, { message: 'Expired' }); }).GET(new Request('https://app.example.com/api/intake/5/session'), context('session'));
  assert.equal(response.status, 401);
  assert.deepEqual(response.cookieWrites.map(write => write[0]), ['recruiterz_careers_intake_5']);
});
test('cross-origin and unauthenticated writes never reach Laravel', async () => {
  const handlers = route({}, async () => { throw new Error('Should not proxy'); });
  assert.equal((await handlers.POST(request('start', {}, 'https://evil.example'), context('start'))).status, 403);
  assert.equal((await handlers.POST(request('submit'), context('submit'))).status, 401);
});
test('origin checks use the browser target host when Next constructs an internal URL', async () => {
  const handlers = route({}, async () => ({ challenge: 'secret-challenge' }));
  const proxied = new Request('https://internal:3000/api/intake/5/start', {
    method: 'POST', headers: { Host: 'app.example.com', Origin: 'https://app.example.com', 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal((await handlers.POST(proxied, context('start'))).status, 201);
  const forged = new Request('https://internal:3000/api/intake/5/start', {
    method: 'POST', headers: { Host: 'app.example.com', Origin: 'https://evil.example', 'X-Forwarded-Host': 'evil.example', 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal((await handlers.POST(forged, context('start'))).status, 403);
});
test('multipart body is forwarded with only the candidate token and a bounded payload', async () => {
  const form = new FormData(); form.set('key', 'resume'); form.set('file', new Blob(['%PDF-1.4']), 'resume.pdf');
  const handlers = route({ recruiterz_careers_intake_5: 'candidate-token', recruiterz_token: 'staff-token' }, async (url, options) => {
    assert.equal(url, '/candidates/jobs/5/intake/documents'); assert.equal(options.token, 'candidate-token');
    const forwarded = await new Response(options.body, { headers: options.headers }).formData();
    assert.equal(forwarded.get('file').name, 'resume.pdf'); assert.equal(forwarded.get('key'), 'resume');
    return { data: { id: 'upload' } };
  });
  const response = await handlers.POST(new Request('https://app.example.com/api/intake/5/documents', { method: 'POST', body: form }), context('documents'));
  assert.equal(response.status, 201);
  const oversized = await handlers.POST(request('submit', { text: 'a'.repeat(513 * 1024) }), context('submit'));
  assert.equal(oversized.status, 413);
});
test('candidate client preserves field errors without invoking staff authentication handling', async () => {
  const api = load('lib/intake.ts', { './errors': { safeFetch: async () => Response.json({ message: 'Invalid', errors: { code: ['Invalid code'] } }, { status: 422 }) } });
  await assert.rejects(api.intakeRequest('5', '/verify'), error => error instanceof api.IntakeError && error.errors.code[0] === 'Invalid code');
});

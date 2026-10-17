const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const ts = require('typescript');
const { createHash } = require('node:crypto');
class IntakeError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
const id = '11111111-2222-3333-4444-555555555555';
const document = { id, key: 'resume', name: 'resume.pdf', size: 10 * 1024 * 1024 };
const grant = () => ({ transport: 'direct', id, url: 'https://objects.example.test/private/intake-uploads/one?signature=test', headers: { 'Content-Type': 'application/octet-stream' }, expires_at: new Date(Date.now() + 300_000).toISOString() });
function uploader(intakeRequest) {
  const source = ts.transpileModule(readFileSync(join(__dirname, '../lib/intake-upload.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)(name => {
    assert.equal(name, './intake'); return { intakeRequest, IntakeError };
  }, module, module.exports);
  return module.exports.createIntakeUploader();
}
test('a 10 MB document sends only JSON through the BFF and bytes directly to private storage', async t => {
  const bytes = Buffer.alloc(10 * 1024 * 1024, 'x');
  const file = new File([bytes], 'resume.pdf', { type: 'application/pdf' });
  const paths = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.hostname, 'objects.example.test');
    assert.equal(options.method, 'PUT'); assert.equal(options.body, file);
    assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
    assert.equal(options.referrerPolicy, 'no-referrer'); assert.ok(options.signal);
    assert.deepEqual(options.headers, { 'Content-Type': 'application/octet-stream' });
    return new Response(null, { status: 200 });
  });
  const upload = uploader(async (job, path, options) => {
    assert.equal(job, '5'); paths.push(path);
    assert.equal(typeof options.body, 'string'); assert.ok(options.body.length < 1024);
    if (path === '/document-uploads') {
      const data = JSON.parse(options.body);
      assert.equal(data.size, file.size); assert.equal(data.name, file.name);
      assert.equal(data.sha256, createHash('sha256').update(bytes).digest('hex'));
      assert.match(data.request_id, /^[0-9a-f-]{36}$/);
      return { data: grant() };
    }
    assert.equal(options.body, '{}'); return { data: document };
  });
  assert.deepEqual(await upload('5', 'resume', file, 'session'), document);
  assert.deepEqual(paths, ['/document-uploads', `/document-uploads/${id}/complete`]);
});
test('lost completion response reuses the request ID and recovers a receipt without another PUT', async t => {
  let prepareCount = 0, firstId, putCount = 0;
  t.mock.method(globalThis, 'fetch', async () => { putCount++; return new Response(null, { status: 200 }); });
  const upload = uploader(async (job, path, options) => {
    if (path === '/document-uploads') {
      const data = JSON.parse(options.body);
      if (++prepareCount === 1) { firstId = data.request_id; return { data: grant() }; }
      assert.equal(data.request_id, firstId); return { data: { transport: 'complete', document } };
    }
    throw new Error('Connection interrupted');
  });
  await assert.rejects(upload('5', 'resume', new File(['contents'], 'resume.pdf'), 'session'));
  assert.deepEqual(await upload('5', 'resume', new File(['contents'], 'resume.pdf'), 'session'), document);
  assert.equal(putCount, 1);
});
test('lost prepare response preserves retry identity and failed PUT never calls complete', async t => {
  let requestId, prepares = 0;
  t.mock.method(globalThis, 'fetch', async () => new Response('Denied', { status: 403 }));
  const upload = uploader(async (job, path, options) => {
    assert.equal(path, '/document-uploads');
    const data = JSON.parse(options.body);
    if (++prepares === 1) { requestId = data.request_id; throw new Error('Lost response'); }
    assert.equal(data.request_id, requestId); return { data: grant() };
  });
  const file = new File(['contents'], 'resume.pdf');
  await assert.rejects(upload('5', 'resume', file, 'session'));
  await assert.rejects(upload('5', 'resume', file, 'session'), error => error.status === 502 && /retry/.test(error.message));
});
test('old backends get small multipart fallback but never receive a large binary request', async () => {
  let multipart = 0;
  const upload = uploader(async (job, path, options) => {
    if (path === '/document-uploads') throw new IntakeError('Not found', 404);
    assert.equal(path, '/documents'); assert.ok(options.body instanceof FormData); multipart++;
    return { data: document };
  });
  await upload('5', 'resume', new File(['contents'], 'resume.pdf'), 'session');
  await assert.rejects(upload('5', 'resume', new File([new Uint8Array(5 * 1024 * 1024)], 'resume.pdf'), 'session'), error => error.status === 503);
  assert.equal(multipart, 1);
});
test('local disk supports 10 MB while a Vercel proxy cap prevents an oversized body', async () => {
  let vercel = false, multipart = 0;
  const upload = uploader(async (job, path, options) => {
    if (path === '/document-uploads') return { data: { transport: 'proxy', ...(vercel && { max_size: 4 * 1024 * 1024 }) } };
    assert.ok(options.body instanceof FormData); multipart++; return { data: document };
  });
  const file = new File([new Uint8Array(10 * 1024 * 1024)], 'resume.pdf');
  await upload('5', 'resume', file, 'session');
  vercel = true;
  await assert.rejects(upload('5', 'resume', file, 'session'), error => error.status === 503);
  assert.equal(multipart, 1);
});
test('invalid and oversized files stop before hashing or requesting a grant', async () => {
  const upload = uploader(async () => { assert.fail('Unexpected request'); });
  for (const file of [new File([], 'empty.pdf'), new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.pdf')]) {
    await assert.rejects(upload('5', 'resume', file, 'session'), error => error.status === 422);
  }
});
test('expired grants get a fresh identity on explicit retry, and insecure storage URLs are rejected', async t => {
  let firstId, attempts = 0;
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Must not upload'));
  const upload = uploader(async (job, path, options) => {
    const data = JSON.parse(options.body);
    if (++attempts === 1) { firstId = data.request_id; throw new IntakeError('Expired', 410); }
    assert.notEqual(data.request_id, firstId);
    return { data: { ...grant(), url: 'http://objects.example.test/private' } };
  });
  const file = new File(['contents'], 'resume.pdf');
  await assert.rejects(upload('5', 'resume', file, 'session'), error => error.status === 410);
  await assert.rejects(upload('5', 'resume', file, 'session'), /Something went wrong/);
});

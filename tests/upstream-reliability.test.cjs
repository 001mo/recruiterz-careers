const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const http = require('node:http');

function load(relative, mocks = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiled = { exports: {} };
  new Function('require', 'module', 'exports', source)(name => {
    if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`);
    return mocks[name];
  }, compiled, compiled.exports);
  return compiled.exports;
}

test('real stalled upstream headers and bodies time out without retrying writes; the next request recovers', async t => {
  const previous = { url: process.env.LARAVEL_API_URL, timeout: process.env.LARAVEL_API_TIMEOUT_MS, env: process.env.NODE_ENV };
  const counts = new Map();
  const ids = [];
  const server = http.createServer((req, res) => {
    counts.set(req.url, (counts.get(req.url) ?? 0) + 1);
    ids.push(req.headers['x-request-id']);
    if (req.url.includes('stall-headers')) return;
    if (req.url.includes('stall-body')) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  process.env.LARAVEL_API_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.LARAVEL_API_TIMEOUT_MS = '150'; process.env.NODE_ENV = 'production';
  t.after(() => {
    server.closeAllConnections(); server.close();
    for (const [key, value] of Object.entries({ LARAVEL_API_URL: previous.url, LARAVEL_API_TIMEOUT_MS: previous.timeout, NODE_ENV: previous.env })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  t.mock.method(console, 'error', () => {});
  const api = load('lib/server/laravel.ts', { 'server-only': {}, '@/lib/errors': load('lib/errors.ts') });
  for (const [endpoint, method] of [['stall-headers', 'GET'], ['stall-body', 'POST']]) {
    const started = performance.now();
    await assert.rejects(api.laravelFetch(`/candidates/${endpoint}`, { method }), error => error.status === 504 && error.message === 'Something went wrong');
    assert.ok(performance.now() - started < 2000);
    assert.equal(counts.get(`/candidates/${endpoint}`), 1);
  }
  assert.deepEqual(await api.laravelFetch('/candidates/recovered'), { ok: true });
  for (const id of ids) assert.match(id, /^[a-f0-9-]{36}$/);
  assert.equal(new Set(ids).size, ids.length);
});

test('caller cancellation stays cancelled and malformed successful JSON is rejected', async t => {
  const previous = process.env.LARAVEL_API_URL;
  process.env.LARAVEL_API_URL = 'https://api.example.test';
  t.after(() => { if (previous === undefined) delete process.env.LARAVEL_API_URL; else process.env.LARAVEL_API_URL = previous; });
  t.mock.method(console, 'error', () => {});
  const api = load('lib/server/laravel.ts', { 'server-only': {}, '@/lib/errors': load('lib/errors.ts') });
  const controller = new AbortController(); controller.abort();
  let calls = 0;
  t.mock.method(global, 'fetch', async (url, options) => { calls++; options.signal.throwIfAborted(); throw new Error('Unreachable'); });
  await assert.rejects(api.laravelFetch('/candidates/cancelled', { signal: controller.signal }), error => error.name === 'AbortError');
  assert.equal(calls, 1);
  global.fetch.mock.restore();
  t.mock.method(global, 'fetch', async () => new Response('<html>outage</html>', { status: 200 }));
  await assert.rejects(api.laravelFetch('/candidates/malformed'), error => error.status === 502);
});

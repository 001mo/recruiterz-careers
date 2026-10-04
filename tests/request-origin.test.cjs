const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks = {}, appOrigin) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'process', source)(name => {
    if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`);
    return mocks[name];
  }, module, module.exports, { env: { APP_ORIGIN: appOrigin } });
  return module.exports;
}
const publicOrigin = 'https://dev-careers.recruiterz.io';
const guard = appOrigin => load('lib/server/request-origin.ts', { 'server-only': {} }, appOrigin);
const write = (origin = publicOrigin, headers = {}, url = 'http://localhost:3001/api/intake/5/start') => new Request(url, {
  method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json', ...(origin === null ? {} : { Origin: origin }), ...headers },
});

test('configured public origin permits HTTPS browser requests forwarded over internal HTTP', () => {
  const { hasTrustedRequestOrigin: allowed } = guard(publicOrigin);
  assert.equal(allowed(write(publicOrigin, { Host: '127.0.0.1:3001', 'Sec-Fetch-Site': 'same-origin' })), true);
  assert.equal(allowed(write(publicOrigin, { Host: 'internal:3000', 'X-Forwarded-Host': 'ignored.example' })), true);
  assert.equal(guard(`${publicOrigin}/`).hasTrustedRequestOrigin(write()), true);
});

test('configured origin pins scheme, host and port, including against forged proxy headers', () => {
  const { hasTrustedRequestOrigin: allowed } = guard(publicOrigin);
  for (const origin of ['http://dev-careers.recruiterz.io', 'https://dev-careers.recruiterz.io:8443', 'https://dev-careers.recruiterz.io.evil.test', 'https://other.recruiterz.io', 'http://localhost:3001']) {
    assert.equal(allowed(write(origin, { Host: new URL(origin).host, 'X-Forwarded-Host': new URL(origin).host, 'X-Forwarded-Proto': new URL(origin).protocol.slice(0, -1) })), false, origin);
  }
  assert.equal(guard(`${publicOrigin}:8443`).hasTrustedRequestOrigin(write(`${publicOrigin}:8443`)), true);
});

test('malformed and opaque Origin values and invalid configuration fail closed', () => {
  for (const value of ['null', '', 'not a URL', 'https:dev-careers.recruiterz.io', `${publicOrigin}/path`, `${publicOrigin}?q=1`, `${publicOrigin}#`, 'https://user@dev-careers.recruiterz.io', `${publicOrigin},https://evil.test`, '*', 'file://dev-careers.recruiterz.io']) {
    assert.equal(guard(publicOrigin).hasTrustedRequestOrigin(write(value)), false, value);
    if (value !== '') assert.equal(guard(value).hasTrustedRequestOrigin(write()), false, `configuration: ${value}`);
  }
});

test('without configuration, direct localhost and preserved Host work without trusting forwarded headers', () => {
  const { hasTrustedRequestOrigin: allowed } = guard();
  assert.equal(allowed(write('http://localhost:3001')), true);
  assert.equal(allowed(write('http://127.0.0.1:3001', { Host: '127.0.0.1:3001' })), true);
  assert.equal(allowed(write(publicOrigin, { Host: 'dev-careers.recruiterz.io' }, 'https://internal:3000/api/intake/5/start')), true);
  assert.equal(allowed(write(publicOrigin, { 'X-Forwarded-Host': 'dev-careers.recruiterz.io', 'X-Forwarded-Proto': 'https' })), false);
  assert.equal(allowed(write('https://evil.test', { Host: 'dev-careers.recruiterz.io', 'X-Forwarded-Host': 'evil.test' }, 'https://internal:3000/api/intake/5/start')), false);
  for (const host of ['dev-careers.recruiterz.io/evil', 'user@dev-careers.recruiterz.io', 'dev-careers.recruiterz.io,evil.test', '[broken', '']) {
    assert.equal(allowed(write(publicOrigin, { Host: host })), false, host);
  }
});

test('cross-site writes are blocked even without Origin, while safe reads and non-browser clients work', () => {
  const { hasTrustedRequestOrigin: allowed } = guard(publicOrigin);
  assert.equal(allowed(write(publicOrigin, { 'Sec-Fetch-Site': 'cross-site' })), false);
  assert.equal(allowed(write(null, { 'Sec-Fetch-Site': 'cross-site' })), false);
  assert.equal(allowed(write('https://other.recruiterz.io', { 'Sec-Fetch-Site': 'same-site' })), false);
  assert.equal(allowed(write(null)), true);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(allowed(new Request('http://localhost:3001/api/intake/5/submit', { method, headers: { Origin: 'https://evil.test' } })), false, method);
  }
  for (const method of ['GET', 'HEAD', 'OPTIONS']) {
    assert.equal(allowed(new Request('http://localhost:3001', { method, headers: { Origin: 'https://email.test', 'Sec-Fetch-Site': 'cross-site' } })), true, method);
  }
});

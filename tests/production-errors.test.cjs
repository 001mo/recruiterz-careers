const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiled = { exports: {} };
  new Function('require', 'module', 'exports', source)(name => {
    if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`);
    return mocks[name];
  }, compiled, compiled.exports);
  return compiled.exports;
}

test('production redacts server failures while preserving candidate validation feedback', async t => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  t.after(() => { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; });
  const errors = load('lib/errors.ts');
  const { LaravelApiError } = load('lib/server/laravel.ts', { 'server-only': {}, '@/lib/errors': errors });
  for (const status of [500, 502, 503]) {
    const error = new LaravelApiError('SQL secret', status, { message: 'SQL secret', trace: ['internal'] });
    assert.equal(error.message, 'Something went wrong');
    assert.deepEqual(error.payload, { message: 'Something went wrong' });
    t.mock.method(global, 'fetch', async () => new Response('<html>SQL secret</html>', { status }));
    const response = await errors.safeFetch('/api/intake/5/session');
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { message: 'Something went wrong' });
  }
  const validation = { message: 'Invalid input', errors: { email: ['Enter a valid email.'] } };
  assert.deepEqual(new LaravelApiError(validation.message, 422, validation).payload, validation);
  assert.equal(errors.unexpectedErrorMessage(new Error('internal path')), 'Something went wrong');
  t.mock.method(global, 'fetch', async () => Response.json(validation, { status: 422 }));
  assert.deepEqual(await (await errors.safeFetch('/api/intake/5/start')).json(), validation);
  process.env.NODE_ENV = 'development';
  assert.equal(new LaravelApiError('Development detail', 500, null).message, 'Development detail');
});

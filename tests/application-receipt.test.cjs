const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/application-receipt.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const loaded = { exports: {} };
new Function('require', 'module', 'exports', source)(require, loaded, loaded.exports);
const Receipt = loaded.exports.default;

test('the receipt names the exact role and employer and preserves the server reference and timestamp', () => {
  const receipt = { submitted: true, job: { id: 7, title: 'Product Designer', company: 'Example Employer' }, reference: 'A1B2C3D4', submitted_at: '2026-10-05T12:30:00+00:00' };
  const render = () => renderToStaticMarkup(React.createElement(Receipt, { receipt }));
  const html = render();
  assert.match(html, /Product Designer/);
  assert.match(html, /Example Employer/);
  assert.match(html, /A1B2C3D4/);
  assert.match(html, /href="\/applications\/7"/);
  assert.match(html, /dateTime="2026-10-05T12:30:00\+00:00"/);
  assert.match(html, /no need to submit your application again/);
  assert.equal(render(), html);
});

test('receipt content is escaped and an absent employer does not invent a company', () => {
  const html = renderToStaticMarkup(React.createElement(Receipt, { receipt: {
    submitted: true, job: { id: 7, title: '<script>injected()</script>', company: null }, reference: 'ABC', submitted_at: '2026-10-05T12:30:00Z',
  } }));
  assert.doesNotMatch(html, /<script>|>Employer<|null|undefined/);
  assert.match(html, /&lt;script&gt;/);
});

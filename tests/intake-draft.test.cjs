const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const output = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../lib/intake-draft.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const draft = { exports: {} };
new Function('module', 'exports', output)(draft, draft.exports);
const { readDraft, saveDraft, clearDraft } = draft.exports;
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
const session = () => ({ email: 'applicant@example.test', expires_at: new Date(Date.now() + 3600000).toISOString(), processes: [{ slug: 'applying.questionnaire', questions: [{ key: 'start', required: true }] }] });
test('refresh restores only the matching verified session and preserves false answers', () => {
  const store = storage(), current = session(), values = { profile: { first_name: 'Maya' }, answers: { 'applying.questionnaire': { start: false } } };
  assert.equal(saveDraft(store, '5', current, values), true);
  assert.deepEqual(readDraft(store, '5', current), values);
  assert.equal(readDraft(store, '6', current), null);
  assert.equal(readDraft(store, '5', { ...current, email: 'other@example.test' }), null);
  assert.equal(readDraft(store, '5', current), null);
});
test('expired, replaced and changed-form sessions cannot restore a stale draft', () => {
  for (const changed of [s => ({ ...s, expires_at: new Date(Date.now() - 1000).toISOString() }), s => ({ ...s, expires_at: new Date(Date.now() + 7200000).toISOString() }), s => ({ ...s, processes: [] })]) {
    const store = storage(), current = session();
    saveDraft(store, '5', current, { profile: { first_name: 'Maya' }, answers: {} });
    assert.equal(readDraft(store, '5', changed(current)), null);
  }
});
test('receipt cleanup and disabled storage do not break application submission', () => {
  const store = storage(), current = session();
  saveDraft(store, '5', current, { profile: {}, answers: {} });
  clearDraft(store, '5');
  assert.equal(readDraft(store, '5', current), null);
  assert.equal(saveDraft({ setItem() { throw new Error('Quota exceeded'); } }, '5', current, { profile: {}, answers: {} }), false);
});

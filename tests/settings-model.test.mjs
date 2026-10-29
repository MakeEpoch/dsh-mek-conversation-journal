import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults } from '../host/config.js';
import { CONFIG_KEYS, normalizeDraft, configPatch, isDirty, dirty, validateDraft, validNotionParent, errorGuide } from '../client/settings-model.js';

const pageId = '11111111-2222-3333-4444-555555555555';
const ready = (extra = {}) => ({ ...normalizeDraft(), provider: 'test-provider', model: 'test-model', ...extra });

test('editable fields and frontend defaults match the host contract without exposing secrets', () => {
  assert.deepEqual([...CONFIG_KEYS].sort(), Object.keys(defaults).sort());
  const draft = normalizeDraft({ notionToken: 'must-never-appear', notionTokenConfigured: true, revision: 99, generateDay: '2026-10-22' });
  assert.equal(draft.notionToken, '');
  assert.equal(draft.notionTokenConfigured, true);
  assert.equal(draft.revision, undefined);
  assert.equal(draft.generateDay, undefined);
  assert.deepEqual(normalizeDraft(), { ...defaults, notionTokenConfigured: false });
  draft.sources.pop();
  assert.deepEqual(normalizeDraft().sources, ['dsh', 'codex']);
});

test('saving emits only changed allowed fields and never a blank secret or UI state', () => {
  const base = ready({ notionTokenConfigured: true });
  const draft = { ...base, timeZone: ' UTC ', notionToken: '   ', revision: 10, generateDay: '2026-10-21', unknown: true };
  assert.deepEqual(configPatch(base, draft), { timeZone: 'UTC' });
  assert.deepEqual(configPatch(base, { ...base, notionToken: '  test-replacement  ' }), { notionToken: 'test-replacement' });
  assert.deepEqual(configPatch(base, { ...base, excludedProjects: [' /one ', '', '/one', '/two'] }), { excludedProjects: ['/one', '/two'] });
  assert.deepEqual(configPatch(base, { ...base, maxOutputTokens: '6000' }), {});
  assert.deepEqual(configPatch(base, { notionTokenConfigured: false }), {});
  assert.deepEqual(configPatch(null, draft), {});
});

test('draft and saved arrays are independent and partial patches preserve unrelated fields', () => {
  const config = ready(); const draft = normalizeDraft(config);
  draft.sources.pop();
  assert.deepEqual(config.sources, ['dsh', 'codex']);
  assert.deepEqual(configPatch(config, draft), { sources: ['dsh'] });
  assert.deepEqual(configPatch(config, { model: 'other-model' }), { model: 'other-model' });
});

test('dirty state tracks persisted edits and secret replacement only', () => {
  const base = ready({ notionTokenConfigured: true });
  assert.equal(isDirty(base, { ...base, notionToken: '', notionTokenConfigured: false }), false);
  assert.equal(dirty(base, { ...base, notionToken: 'replacement' }), true);
  assert.equal(isDirty(base, { ...base, provider: ' other ' }), true);
  assert.equal(isDirty(base, { ...base, excludedSessions: ['session-1'] }), true);
  assert.equal(isDirty(base, null), false);
});

test('enabled collection requires at least one supported source and a model', () => {
  assert.deepEqual(validateDraft(ready()), {});
  const errors = validateDraft(ready({ sources: [], provider: '', model: '' }));
  assert.ok(errors.sources); assert.ok(errors.provider); assert.ok(errors.model);
  assert.deepEqual(validateDraft(ready({ enabled: false, sources: [], provider: '', model: '' })), {});
  assert.ok(validateDraft(ready({ enabled: false, sources: ['other'] })).sources);
  for (const key of ['sources', 'excludedProjects', 'excludedSessions']) {
    assert.ok(validateDraft(ready({ [key]: ['valid', 42] }))[key]);
    assert.ok(validateDraft(ready({ [key]: 'bad' }))[key]);
  }
  assert.ok(validateDraft(ready({ enabled: 'true' })).enabled);
});

test('time, timezone and source-specific Codex directory errors have field targets', () => {
  for (const dailyTime of ['24:00', '12:60', '9:00', '']) assert.ok(validateDraft(ready({ dailyTime })).dailyTime);
  assert.equal(validateDraft(ready({ dailyTime: '00:00', timeZone: 'UTC' })).dailyTime, undefined);
  for (const timeZone of ['Invalid/Timezone', '']) assert.ok(validateDraft(ready({ timeZone })).timeZone);
  assert.ok(validateDraft(ready({ codexHome: ' ' })).codexHome);
  assert.equal(validateDraft(ready({ sources: ['dsh'], codexHome: '' })).codexHome, undefined);
  assert.ok(validateDraft(ready({ model: 'm'.repeat(4097) })).model);
});

test('budget bounds match host integer ranges, including numeric form inputs', () => {
  for (const [key, min, max] of [['maxInputChars', 8000, 200000], ['maxOutputTokens', 1000, 16000]]) {
    for (const value of [min - 1, max + 1, min + 0.5, '', 'invalid', NaN, Infinity]) assert.ok(validateDraft(ready({ [key]: value }))[key]);
    for (const value of [min, max, String(min)]) assert.equal(validateDraft(ready({ [key]: value }))[key], undefined);
  }
});

test('Notion setup is optional, preserves a saved token, and checks newly entered credentials', () => {
  assert.deepEqual(validateDraft(ready({ notionEnabled: false, notionParent: 'unfinished page' })), {});
  const errors = validateDraft(ready({ notionEnabled: true }));
  assert.ok(errors.notionToken); assert.ok(errors.notionParent);
  assert.deepEqual(validateDraft(ready({ notionEnabled: true, notionTokenConfigured: true, notionParent: pageId })), {});
  assert.deepEqual(validateDraft(ready({ notionEnabled: true, notionToken: 'test-credential', notionParent: pageId })), {});
  assert.ok(validateDraft(ready({ notionEnabled: true, notionToken: 'contains\nnewline', notionParent: pageId })).notionToken);
});

test('Notion parents accept exact UUIDs or safe page URLs, never arbitrary matching text', () => {
  for (const value of [pageId, pageId.replaceAll('-', ''), `https://www.notion.so/Work-${pageId}?v=11111111111111111111111111111111`, `https://team.notion.site/${pageId}/`]) assert.equal(validNotionParent(value), true, value);
  for (const value of [`text-${pageId}`, `http://notion.so/${pageId}`, `https://notion.so.attacker.example/${pageId}`, `https://attacker.example/${pageId}`, `https://notion.so/?page=${pageId}`, `https://name:pass@notion.so/${pageId}`, `https://notion.so:444/${pageId}`, 'https://notion.so/no-page-id']) assert.equal(validNotionParent(value), false, value);
});

test('error guidance respects stable codes and distinguishes budget tokens from authorization', () => {
  const cases = [
    [{ code: 'journal/conflict', message: 'changed' }, /其他窗口/],
    ['设置已在其他窗口更新，请重新读取后再保存', /其他窗口/],
    [{ code: 'journal/model', message: 'HTTP 401' }, /模型/],
    ['模型提供商 HTTP 403', /模型/],
    ['maxOutputTokens 必须在 1000 到 16000 之间', /预算/],
    [{ code: 'journal/notion-auth', message: 'maxOutputTokens 必须在 1000 到 16000 之间' }, /预算/],
    ['模型输出 Token 上限不足', /预算/],
    [{ code: 'journal/budget', message: 'oversized' }, /预算/],
    [{ code: 'journal/source', message: 'unavailable' }, /来源/],
    ['DSH sessionQuery 未启用', /来源/],
    [{ code: 'journal/notion-auth', message: 'HTTP 401' }, /Notion 授权/],
    ['Notion 请求失败（HTTP 404），请检查 Token 与目标页面授权', /父页面/],
    ['Notion 自动整理区域已被人工修改，停止覆盖', /核对/],
  ];
  for (const [error, title] of cases) {
    const guide = errorGuide(error);
    assert.match(guide.title, title, JSON.stringify(error));
    assert.deepEqual(Object.keys(guide).sort(), ['hint', 'level', 'title']);
  }
  assert.match(errorGuide('arbitrary', 'journal/model').title, /模型/);
});

test('error guides never reflect secrets or unsafe server output', () => {
  const secret = 'ntn_test-private-value';
  const guide = errorGuide({ code: 'journal/notion-auth', message: `<script>${secret}</script>` });
  assert.equal(JSON.stringify(guide).includes(secret), false);
  assert.equal(JSON.stringify(guide).includes('<script>'), false);
  guide.title = 'mutated';
  assert.notEqual(errorGuide({ code: 'journal/notion-auth' }).title, 'mutated');
});

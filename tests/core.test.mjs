import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, appendFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Storage } from '../host/storage.js';
import { dayAt, errorCode, redact, normalRecord } from '../host/common.js';
import { Config, readConfig, publicConfig } from '../host/config.js';
import { CodexSource, DshSource, dshRecords, SourceRegistry } from '../host/sources.js';
import { batches, modelJson, validateAnalysis, knowledgeKey } from '../host/analyzer.js';
import { JournalService } from '../host/service.js';
import { registerRpc, apply } from '../host/index.js';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'journal-test-'));
  const store = new Storage(root);
  t.after(async () => { store.close(); await rm(root, { recursive: true, force: true }); });
  return { root, store };
}
const record = (overrides = {}) => normalRecord({ source: 'chat', sessionId: 'chat-1', messageId: 'message-1', time: '2026-10-21T17:00:00Z', role: 'user', text: '讨论咖啡的冲泡方法', ...overrides });
const output = (input) => ({ daily: '讨论了冲泡方法，尚未实际尝试。', sources: [input[0].id], knowledge: [{ title: '手冲咖啡水温', project: '', tags: ['咖啡'], body: '根据烘焙度调整水温，当前仅为讨论建议。', sources: [input[0].id] }] });

test('Shanghai day boundaries, invalid time zones, secret redaction and configuration projection', () => {
  assert.equal(dayAt('2026-10-21T16:00:00Z'), '2026-10-22');
  assert.equal(dayAt('2026-10-21T15:59:59Z'), '2026-10-21');
  assert.throws(() => readConfig({ timeZone: 'bad/zone' }));
  assert.throws(() => readConfig({ dailyTime: '24:00' }));
  assert.throws(() => readConfig({ sources: ['other'] }));
  const clean = redact('api_key="fake-credential" Authorization: Bearer abcdefghijklmnop https://name:pass@example.com');
  assert.ok(!clean.includes('fake-credential')); assert.ok(!clean.includes('abcdefghijklmnop')); assert.ok(!clean.includes('name:pass'));
  const json = Config.toJSON(), node = json.refs[json.refs[json.uid].dict.notionToken];
  assert.equal(node.meta.role, 'secret'); assert.equal(node.meta.volatile, true);
  assert.equal(publicConfig({ notionToken: 'test-only' }).notionToken, undefined);
  assert.equal(publicConfig({ notionToken: 'test-only' }).notionTokenConfigured, true);
  assert.deepEqual(readConfig(Config({})).sources, ['dsh', 'codex']);
});

test('SQLite transaction rollback, exclusive owner and restart persistence', async (t) => {
  const { root, store } = await fixture(t);
  assert.throws(() => new Storage(root), /另一个/);
  assert.throws(() => store.transaction(() => { store.set('x', 1); throw new Error('failure'); }));
  assert.equal(store.get('x'), null);
  store.putMessages([record(), record()]);
  assert.equal([...store.messages(0, Date.now() + 86400000)].length, 1);
  store.set('checkpoint', 7); store.close();
  const reopened = new Storage(root); assert.equal(reopened.get('checkpoint'), 7); reopened.close();
  assert.equal((await stat(join(root, 'journal.sqlite'))).mode & 0o777, 0o600);
});

test('Codex incremental index reads old directories, partial tails and archived moves once', async (t) => {
  const { root, store } = await fixture(t);
  const source = new CodexSource(), home = join(root, 'codex');
  await mkdir(join(home, 'sessions/2026/10/01'), { recursive: true }); await mkdir(join(home, 'archived_sessions'), { recursive: true });
  const path = join(home, 'sessions/2026/10/01/rollout.jsonl');
  const meta = JSON.stringify({ type: 'session_meta', payload: { id: 'codex-1', cwd: '/project', base_instructions: 'NEVER STORE THIS' } });
  const message = JSON.stringify({ type: 'response_item', timestamp: '2026-10-21T17:00:00Z', payload: { type: 'message', role: 'user', id: 'message-id', content: [{ type: 'input_text', text: 'hello' }] } });
  await writeFile(path, meta + '\n' + message.slice(0, 30));
  const config = readConfig({ codexHome: home }); const warnings = [];
  const scan = () => source.scan({ store, config, warn: (x) => warnings.push(x) });
  await scan(); assert.equal([...store.messages(0, Date.now() + 86400000)].length, 0);
  await appendFile(path, message.slice(30) + '\n'); await scan(); await scan();
  assert.equal([...store.messages(0, Date.now() + 86400000)].length, 1);
  await writeFile(join(home, 'archived_sessions/copy.jsonl'), meta + '\n' + message + '\n'); await scan();
  assert.equal([...store.messages(0, Date.now() + 86400000)].length, 1);
  const cursor = store.db.prepare('SELECT value FROM kv').all().map((r) => r.value).join(''); assert.ok(!cursor.includes('NEVER STORE THIS'));
});

test('Codex malformed rows and excluded projects can be enabled later', async (t) => {
  const { root, store } = await fixture(t); const home = join(root, 'source'); await mkdir(join(home, 'sessions'), { recursive: true });
  const records = [
    { type: 'session_meta', payload: { id: 's', cwd: '/excluded' } },
    { type: 'response_item', timestamp: '2026-10-22T01:00:00Z', payload: { type: 'message', role: 'assistant', id: 'a', content: [{ type: 'output_text', text: '结果' }] } },
  ];
  await writeFile(join(home, 'sessions/a.jsonl'), records.map(JSON.stringify).join('\n') + '\nBROKEN\n');
  const adapter = new CodexSource(), warn = () => {};
  await adapter.scan({ store, config: readConfig({ codexHome: home, excludedProjects: ['/excluded'] }), warn });
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM messages').get().n, 0);
  await adapter.scan({ store, config: readConfig({ codexHome: home }), warn });
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM messages').get().n, 1);
});

test('Codex hidden reasoning channels never enter the index or analyzer payload', async (t) => {
  const { root, store } = await fixture(t); const home = join(root, 'codex');
  await mkdir(join(home, 'sessions'), { recursive: true });
  const message = (id, role, text, channel) => ({ type: 'response_item', timestamp: '2026-10-22T01:00:00Z',
    payload: { type: 'message', id, role, ...(channel === undefined ? {} : { channel }), content: [{ type: 'output_text', text }] } });
  const events = [
    { type: 'session_meta', payload: { id: 'visibility-fixture', cwd: '/fixture' } },
    message('user', 'user', 'USER_VISIBLE'), message('analysis', 'assistant', 'PRIVATE_ANALYSIS_SENTINEL', 'analysis'),
    message('unknown', 'assistant', 'PRIVATE_UNKNOWN_CHANNEL', 'confidence'),
    message('system', 'system', 'PRIVATE_SYSTEM_SENTINEL'),
    message('commentary', 'assistant', 'COMMENTARY_VISIBLE', 'commentary'),
    message('final', 'assistant', 'FINAL_VISIBLE', 'final'), message('legacy', 'assistant', 'LEGACY_VISIBLE'),
  ];
  await writeFile(join(home, 'sessions/visibility.jsonl'), events.map(JSON.stringify).join('\n') + '\n');
  let payload;
  const service = new JournalService({ store, config: readConfig({ sources: ['codex'], codexHome: home, provider: 'p', model: 'm' }), ctx: {},
    analyze: async (_llm, _config, value) => { payload = value; return { daily: '整理用户可见对话', knowledge: [], sources: value.records.map((r) => r.id) }; } });
  t.after(() => service.dispose()); service.startGenerate('2026-10-22'); await service.active;
  assert.equal(service.job.state, 'done');
  const records = [...store.messages(0, Date.now() + 86400000)].map((r) => JSON.parse(r.value));
  assert.deepEqual(records.map((r) => r.text).sort(), ['USER_VISIBLE', 'COMMENTARY_VISIBLE', 'FINAL_VISIBLE', 'LEGACY_VISIBLE'].sort());
  assert.equal(records.find((r) => r.messageId === 'final').metadata.channel, 'final');
  assert.ok(!JSON.stringify(payload).includes('PRIVATE_')); assert.equal(payload.records.length, 4);
  assert.ok(!JSON.stringify(store.db.prepare('SELECT value FROM messages').all()).includes('PRIVATE_'));
});

test('DSH-only settings do not require an unused Codex directory', async (t) => {
  const config = readConfig({ sources: ['dsh'], codexHome: '', provider: 'p', model: 'm' });
  assert.equal(config.codexHome, '');
  assert.throws(() => readConfig({ sources: ['codex'], codexHome: '' }), /Codex 数据目录不能为空/);
  const { store } = await fixture(t); let patch;
  const settings = { describe: () => [{ ns: 'conversation-journal', revision: 1 }], update: async (_ns, value) => { patch = value; Object.assign(config, value); } };
  const service = new JournalService({ store, config, ctx: { get: (name) => name === 'settings' ? settings : null } }); t.after(() => service.dispose());
  await service.save({ timeZone: 'UTC' }, 1);
  assert.deepEqual(patch, { timeZone: 'UTC' }); assert.equal(service.settings().config.codexHome, '');
});

test('Codex detects same-inode tail rewrites and retains records also present in archives', async (t) => {
  const { root, store } = await fixture(t); const home = join(root, 'home');
  await mkdir(join(home, 'sessions'), { recursive: true }); await mkdir(join(home, 'archived_sessions'), { recursive: true });
  const file = join(home, 'sessions/a.jsonl');
  const meta = { type: 'session_meta', payload: { id: 'rewrite-session', cwd: '/project', unusedPadding: 'x'.repeat(800) } };
  const message = (id, text) => JSON.stringify({ type: 'response_item', timestamp: '2026-10-22T01:00:00Z', payload: { type: 'message', role: 'user', id, content: [{ type: 'input_text', text }] } });
  const original = JSON.stringify(meta) + '\n' + message('before', '原始记录') + '\n';
  await writeFile(file, original); await writeFile(join(home, 'archived_sessions/a.jsonl'), original);
  const adapter = new CodexSource(), options = { store, config: readConfig({ codexHome: home }), warn: () => {} };
  await adapter.scan(options);
  await writeFile(file, JSON.stringify(meta) + '\n' + message('after!', '替换记录') + '\n');
  await adapter.scan(options);
  const records = [...store.messages(0, Date.now() + 86400000)].map((r) => JSON.parse(r.value));
  assert.equal(records.length, 2); assert.ok(records.some((r) => r.messageId === 'before')); assert.ok(records.some((r) => r.messageId === 'after!'));
});

test('DSH ignores inherited, synthetic and compaction messages, preserves tool evidence', async (t) => {
  const { store } = await fixture(t);
  const event = (seq, type, data, rest = {}) => ({ seq, type, time: 1792620000000 + seq, data, ...rest });
  const user = { id: 'user-1', source: { kind: 'user' }, content: [{ type: 'text', text: '请分析' }] };
  const snapshot = { session: { id: 'dsh-1', cwd: '/project' }, inheritedEventCount: 1, events: [
    event(0, 'user/message', user), event(1, 'user/message', { ...user, id: 'u2' }),
    event(2, 'user/message', { ...user, id: 'u3', source: { kind: 'schedule' } }),
    event(3, 'assistant/message', { message: { id: 'a1', content: [{ type: 'text', text: '已进行静态检查，未部署' }] } }),
    event(4, 'tool/result', { message: { id: 't1', content: [{ type: 'text', text: 'exit 0' }] } }),
    event(5, 'user/message', { ...user, id: 'compacted' }, { surfaceOp: { op: 'replace' } }),
  ] };
  assert.deepEqual(dshRecords(snapshot).map((r) => r.role), ['user', 'assistant', 'tool-result']);
  let reads = 0;
  const query = { listSessions: async () => [{ header: snapshot.session }], listEvents: async () => snapshot.events,
    readSession: async () => { reads++; return snapshot; } };
  const adapter = new DshSource(() => query), options = { store, config: readConfig({}), warn: () => {} };
  await adapter.scan(options); await adapter.scan(options); assert.equal(reads, 1);
  await assert.rejects(new DshSource(() => null).scan(options), /sessionQuery/);
});

test('model stream assembles deltas once, rejects truncation and hallucinated source references', async () => {
  const input = [record()];
  const llm = (finish) => ({ prepareCall: async () => ({ config: { provider: 'p', model: 'm' }, async *stream(options) {
    assert.deepEqual(options.tools, []);
    const text = JSON.stringify(output(input));
    yield { type: 'text-delta', index: 0, text }; yield { type: 'block-end', index: 0, block: { type: 'text', text } };
    yield { type: 'finish', reason: { kind: finish } };
  } }) });
  const result = await modelJson(llm('stop'), readConfig({ provider: 'p', model: 'm' }), {}, undefined);
  assert.equal(validateAnalysis(result, input).knowledge.length, 1);
  assert.equal(validateAnalysis(result, input).sources[0].text, undefined);
  await assert.rejects(modelJson(llm('max-tokens'), readConfig({ provider: 'p', model: 'm' }), {}), /未正常完成/);
  assert.throws(() => validateAnalysis({ ...result, sources: ['invented'] }, input), /来源/);
  const chunks = batches([record({ text: '很长'.repeat(10000) })], 8000);
  assert.ok(chunks.length > 1); assert.equal(chunks.flat().map((r) => r.text).join(''), '很长'.repeat(10000));
  const escaped = batches([record({ text: '\"\\'.repeat(10000) })], 8000);
  assert.ok(escaped.every((batch) => JSON.stringify(batch).length <= 8100));
  const tool = record({ role: 'tool-result', text: 'large log\n'.repeat(1200) + '\nTESTS PASSED\nexit_code: 0' });
  assert.equal(tool.metadata.locallyCompacted, true); assert.ok(tool.text.includes('TESTS PASSED')); assert.ok(tool.text.length < 8000);
});

test('generic chat adapter generates daily and knowledge, rerun does not duplicate, Chinese recall works', async (t) => {
  const { store } = await fixture(t); let calls = 0;
  const config = readConfig({ sources: ['dsh'], provider: 'test', model: 'test' });
  const service = new JournalService({ ctx: { get: () => null }, config, store, analyze: async (_llm, _config, payload) => { calls++; return output(payload.records); } });
  service.sources.adapters.set('dsh', { scan: async ({ store }) => store.putMessages([record({ source: 'dsh' }), record({ source: 'dsh', messageId: 'old', time: '2026-10-21T01:00:00Z', text: '昨天的事' })]) });
  service.startGenerate('2026-10-22'); await service.active;
  assert.equal(service.job.state, 'done'); assert.equal(service.job.result.messages, 1);
  service.startGenerate('2026-10-22'); await service.active;
  assert.equal(service.job.state, 'done'); assert.equal(service.list().length, 2); assert.equal(calls, 2); // one refresh after new knowledge becomes available
  service.startGenerate('2026-10-22'); await service.active; assert.equal(calls, 2);
  assert.equal(service.list('水温')[0].kind, 'knowledge');
  assert.equal(service.store.document(knowledgeKey('手冲咖啡水温', '')).body.match(/根据烘焙度/g).length, 1);
  assert.equal(service.list().find((d) => d.kind === 'daily').sources[0].text, undefined);
  await service.dispose(); await service.dispose();
});

test('invalid model output never overwrites stored results; failed Notion sync stays retryable', async (t) => {
  const { store } = await fixture(t);
  const config = readConfig({ sources: ['dsh'], provider: 'p', model: 'm', notionEnabled: true });
  let failure = false, writes = 0;
  const service = new JournalService({ ctx: { get: () => null }, config, store,
    analyze: async (_llm, _config, payload) => failure ? { ...output(payload.records), sources: ['fake'] } : output(payload.records),
    notionFactory: () => ({ sync: async () => { writes++; throw new Error('offline'); } }),
  });
  service.sources.adapters.set('dsh', { scan: async () => store.putMessages([record({ source: 'dsh' })]) });
  service.startGenerate('2026-10-22'); await service.active;
  assert.equal(service.job.result.sync.failed, 2); assert.equal(store.pending().length, 2);
  const before = store.document('daily:2026-10-22').body;
  failure = true; config.model = 'different'; service.startGenerate('2026-10-22'); await service.active;
  assert.equal(service.job.state, 'error'); assert.equal(store.document('daily:2026-10-22').body, before);
  service.notionFactory = () => ({ sync: async () => ({ url: 'https://www.notion.so/example' }) });
  service.notionAction('sync'); await service.active; assert.equal(store.pending().length, 0); assert.equal(writes, 2);
  await service.dispose();
});

test('scheduler covers evening and following-morning catchup, cancellation cleans timer and store', async (t) => {
  const { store } = await fixture(t); let now = Date.parse('2026-10-22T15:31:00Z');
  const config = readConfig({ sources: ['dsh'], provider: 'p', model: 'm', autoDaily: true });
  const service = new JournalService({ ctx: {}, config, store, clock: () => now });
  const days = []; service.startGenerate = (day) => { days.push(day); return {}; };
  await service.tick(); await service.tick(); assert.deepEqual(days, ['2026-10-22']);
  now = Date.parse('2026-10-22T16:01:00Z'); await service.tick(); assert.deepEqual(days, ['2026-10-22', '2026-10-22']);
  service.startTimer();
  service.run('test', (signal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true })));
  await new Promise((r) => setImmediate(r)); await service.dispose();
  assert.equal(service.job.state, 'cancelled'); assert.equal(service.timer, null); assert.equal(store.closed, true);
});

test('saving settings preserves blank secrets, checks revision and rejects invalid merged input', async (t) => {
  const { store } = await fixture(t); const config = readConfig({ notionToken: 'test-preserved', provider: 'p', model: 'm' });
  const updates = [];
  const settings = { describe: () => [{ ns: 'custom-journal', revision: 8 }], update: async (ns, patch, revision) => { updates.push({ ns, patch, revision }); Object.assign(config, patch); } };
  const service = new JournalService({ store, config, ctx: { get: (name) => name === 'settings' ? settings : name === 'configEditor' ? { entries: () => [{ options: { id: 'custom-journal', name: 'dsh-mek-conversation-journal' } }] } : null } });
  await service.save({ notionToken: '', timeZone: 'UTC' }, 8);
  assert.deepEqual(updates, [{ ns: 'custom-journal', patch: { timeZone: 'UTC' }, revision: 8 }]);
  assert.equal(config.notionToken, 'test-preserved'); assert.equal(service.settings().config.notionToken, undefined);
  await assert.rejects(service.save({ dailyTime: '25:99' }, 8)); assert.equal(updates.length, 1);
  await service.dispose();
});

test('sync receipts are scoped by destination, and a stable rerun has no remote delta', async (t) => {
  const { store } = await fixture(t); const config = readConfig({ notionEnabled: true }); let writes = 0;
  const service = new JournalService({ store, config, ctx: {}, notionFactory: () => ({ scope: `target:${config.notionParent}`, sync: async () => { writes++; return { url: 'https://www.notion.so/test' }; } }) });
  store.putDocument({ key: 'daily:2026-10-22', kind: 'daily', date: '2026-10-22', title: '测试', body: '正文', sources: [] });
  service.notionAction('sync'); await service.active; assert.equal(writes, 1);
  assert.equal(service.documentSummary().pending, 0);
  assert.equal(service.list()[0].status, 'synced');
  service.notionAction('sync'); await service.active; assert.equal(writes, 1);
  config.notionParent = 'different-target';
  assert.equal(service.documentSummary().pending, 1);
  assert.equal(service.list()[0].status, 'pending');
  service.notionAction('sync'); await service.active; assert.equal(writes, 2);
  assert.equal(service.documentSummary().pending, 0);
  const saved = store.document('daily:2026-10-22');
  store.putDocument({ ...saved, updatedAt: 123 }, 'synced');
  assert.equal(service.documentSummary().pending, 0, 'timestamps do not invalidate a content receipt');
  store.putDocument({ ...saved, body: '更新的正文' }, 'synced');
  assert.equal(service.documentSummary().pending, 1, 'a stale receipt does not prove the changed content was uploaded');
  assert.equal(service.list()[0].status, 'pending');
  await service.dispose();
});

test('RPC allowlist rejects malformed requests and never exposes secret settings', async () => {
  let handler, disposed = 0;
  await registerRpc({ connection: { fetch: { register: async (r) => { handler = r.fetch; return () => disposed++; } } } }, { settings: () => ({ config: publicConfig({ notionToken: 'test-only-secret' }) }) });
  const request = (method) => new Request('http://localhost/api/dsh-conversation-journal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: 'r1', method: 'dsh-conversation-journal', payload: { method, payload: {} } }) });
  const result = await (await handler(request('settings.get'))).json(); assert.equal(result.result.ok, true); assert.ok(!JSON.stringify(result).includes('test-only-secret'));
  assert.equal((await (await handler(request('__proto__'))).json()).result.ok, false);
  assert.equal((await handler(new Request('http://localhost', { method: 'POST', body: '{' }))).status, 415);
});

test('Host initialization failure is isolated and teardown works after partial setup', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'journal-host-')); t.after(() => rm(root, { recursive: true, force: true }));
  const old = process.env.DSH_HOME; process.env.DSH_HOME = root;
  let effect, errors = 0, registrations = 0;
  const ctx = { effect: (fn) => { effect = fn; }, connection: { fetch: { register: async () => { registrations++; throw new Error('registration failed'); } } }, logger: { error: () => errors++ } };
  try {
    apply(ctx, readConfig({})); const cleanup = effect(); await new Promise((r) => setTimeout(r, 30)); await cleanup();
    assert.equal(errors, 1); assert.equal(registrations, 1);
    const reopened = new Storage(join(root, 'conversation-journal')); reopened.close();
  } finally { if (old === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = old; }
});

test('settings survive a half-edited configuration and expose readiness plus per-day counts', async (t) => {
  const { root, store } = await fixture(t);
  const home = join(root, 'codex'); await mkdir(join(home, 'sessions'), { recursive: true });
  const config = readConfig({ codexHome: home, dailyTime: '23:30', timeZone: 'Asia/Shanghai' });
  const service = new JournalService({ store, config, ctx: {}, clock: () => Date.parse('2026-10-22T04:00:00Z') });
  t.after(() => service.dispose());
  // An invalid intermediate value must not turn the settings read into an error page.
  config.timeZone = 'bad/zone';
  const settings = service.settings(); assert.equal(settings.config.notionTokenConfigured, false); assert.equal(typeof settings.today, 'string');
  assert.deepEqual(settings.ready.sources, ['codex']);
  config.timeZone = 'Asia/Shanghai';
  store.putMessages([
    normalRecord({ source: 'codex', sessionId: 's1', messageId: 'm1', time: '2026-10-21T17:00:00Z', role: 'user', text: '一' }),
    normalRecord({ source: 'codex', sessionId: 's1', messageId: 'm2', time: '2026-10-21T18:00:00Z', role: 'assistant', text: '二' }),
    normalRecord({ source: 'codex', sessionId: 's1', messageId: 'm3', time: '2026-10-19T17:00:00Z', role: 'user', text: '三' }),
  ]);
  const summary = service.daySummary(7);
  assert.equal(summary.today, '2026-10-22'); assert.equal(summary.days.length, 7); assert.equal(summary.scanned, false);
  const counts = Object.fromEntries(summary.days.map((d) => [d.day, d.messages]));
  assert.equal(counts['2026-10-22'], 2); assert.equal(counts['2026-10-20'], 1); assert.equal(counts['2026-10-21'], 0);
  assert.deepEqual(await service.list(), []);
});

test('record search reaches older documents, pages after grouping, and totals cover the entire index', async (t) => {
  const { store } = await fixture(t);
  const service = new JournalService({ store, config: readConfig({}), ctx: {} }); t.after(() => service.dispose());
  assert.deepEqual(service.documentSummary(), { total: 0, documents: 0, daily: 0, knowledge: 0, rawKnowledge: 0, pending: 0, error: 0 });
  for (let i = 0; i < 130; i++) {
    const date = new Date(Date.parse('2026-05-01T00:00:00Z') + i * 86400000).toISOString().slice(0, 10);
    store.putDocument({ key: `daily:${date}`, kind: 'daily', date, title: `${date} 日报`, body: i === 0 ? '历史唯一词' : '普通记录', sources: [] }, 'synced');
  }
  store.putDocument({ key: 'knowledge:old', kind: 'knowledge', title: '合并知识', project: '/p', body: '旧正文', date: '2026-10-20', updatedAt: 1, sources: [] });
  store.putDocument({ key: 'knowledge:new', kind: 'knowledge', title: '合并知识', project: '/p', body: '新正文', date: '2026-10-21', updatedAt: 2, sources: [] }, 'error');
  assert.equal(service.list().length, 100);
  assert.equal(service.list().some((d) => d.body === '历史唯一词'), false);
  assert.equal(service.list('历史唯一词')[0].date, '2026-05-01');
  const pages = [0, 50, 100].flatMap((offset) => service.list('', { limit: 50, offset }));
  assert.equal(pages.length, 131); assert.equal(new Set(pages.map((d) => d.key)).size, 131);
  const knowledge = service.list('', { kind: 'knowledge', limit: 1 });
  assert.equal(knowledge.length, 1); assert.equal(knowledge[0].versions, 2); assert.equal(knowledge[0].body, '新正文');
  assert.equal(service.list('', { kind: 'knowledge', offset: 1 }).length, 0);
  assert.deepEqual(service.documentSummary(), { total: 131, documents: 132, daily: 130, knowledge: 1, rawKnowledge: 2, pending: 2, error: 1 });
  assert.throws(() => service.list('', { limit: 0 })); assert.throws(() => service.list('', { offset: -1 })); assert.throws(() => service.list('', { kind: 'other' }));
});

test('day counts respect enabled sources, exclusions and the first local midnight', async (t) => {
  const { store } = await fixture(t);
  const service = new JournalService({ store, config: readConfig({ sources: ['dsh'], excludedProjects: ['/private'], excludedSessions: ['hidden'] }), ctx: {}, clock: () => Date.parse('2026-10-22T04:00:00Z') });
  t.after(() => service.dispose());
  const add = (messageId, overrides = {}) => normalRecord({ source: 'dsh', sessionId: 'public', messageId, time: '2026-10-15T16:00:00Z', role: 'user', text: '记录', project: '/public', ...overrides });
  store.putMessages([add('first'), add('other-source', { source: 'codex' }), add('private-project', { project: '/private/sub' }), add('private-session', { sessionId: 'hidden' })]);
  const summary = service.daySummary(7);
  assert.equal(summary.days[0].day, '2026-10-16'); assert.equal(summary.days[0].messages, 1);
  assert.equal(summary.days.reduce((n, d) => n + d.messages, 0), 1);
});

test('source readiness checks Host directories and does not claim an absent Codex folder is usable', async (t) => {
  const { root, store } = await fixture(t); const home = join(root, 'codex');
  const service = new JournalService({ store, config: readConfig({ codexHome: home }), ctx: {} }); t.after(() => service.dispose());
  assert.deepEqual(service.ready().sources, []); assert.equal(service.ready().details.codex.available, false);
  await mkdir(join(home, 'archived_sessions'), { recursive: true });
  assert.deepEqual(service.ready().sources, ['codex']); assert.equal(service.ready().details.codex.available, true);
});

test('excluded knowledge never returns to the model through previous-knowledge hints', async (t) => {
  const { store } = await fixture(t); let hints;
  const config = readConfig({ sources: ['dsh'], provider: 'p', model: 'm', excludedProjects: ['/private'], excludedSessions: ['private-session'] });
  const input = record({ source: 'dsh', project: '/public', text: '讨论咖啡方法' });
  for (const [key, project, source, sessionId] of [
    ['project', '/private/child', 'dsh', 'other'], ['session', '/public', 'dsh', 'private-session'],
    ['source', '/public', 'codex', 'other'], ['allowed', '/public', 'dsh', 'public'],
  ]) store.putDocument({ key: `knowledge:${key}`, kind: 'knowledge', title: '咖啡', project, body: `context-${key}`, tags: [], sources: [{ id: key, source, sessionId, project }] });
  const service = new JournalService({ store, config, ctx: {}, analyze: async (_llm, _config, payload) => { hints = payload.existingKnowledge; return output(payload.records); } });
  t.after(() => service.dispose()); service.sources.adapters.set('dsh', { scan: async () => store.putMessages([input]) });
  service.startGenerate('2026-10-22'); await service.active;
  assert.equal(service.job.state, 'done'); assert.deepEqual(hints.map((h) => h.body), ['context-allowed']);
  assert.equal(store.document('knowledge:project').body, 'context-project', 'exclusions preserve previously generated local documents');
});

test('last generation survives connection tests and host restarts without exposing model inputs', async (t) => {
  const { root, store } = await fixture(t);
  const config = readConfig({ sources: ['dsh'], provider: 'p', model: 'm', codexHome: join(root, 'missing') });
  const service = new JournalService({ store, config, ctx: {}, analyze: async (_llm, _config, payload) => output(payload.records), notionFactory: () => ({ test: async () => ({ connected: true }) }) });
  service.sources.adapters.set('dsh', { scan: async () => store.putMessages([record({ source: 'dsh' })]) });
  service.startGenerate('2026-10-22'); await service.active;
  const generated = service.settings().lastGeneration;
  assert.equal(generated.kind, 'generate'); assert.equal(generated.result.documents, 2); assert.ok(generated.finishedAt);
  service.notionAction('test'); await service.active;
  assert.equal(service.job.kind, 'notion-test'); assert.deepEqual(service.settings().lastGeneration, generated);
  await service.dispose();
  const restartedStore = new Storage(root); const restarted = new JournalService({ store: restartedStore, config, ctx: {} });
  assert.deepEqual(restarted.settings().lastGeneration, generated); await restarted.dispose();
});

test('budget setting names and output token limits are not mistaken for Notion authorization', () => {
  assert.equal(errorCode('maxOutputTokens 必须在 1000 到 16000 之间'), 'budget');
  assert.equal(errorCode('单次输出 Token 上限无效'), 'budget');
  assert.equal(errorCode('Notion 请求失败（HTTP 401），请检查 Token'), 'notion-auth');
});

test('retitled knowledge is folded into one list row and keep the newest body', async (t) => {
  const { store } = await fixture(t);
  const service = new JournalService({ store, config: readConfig({}), ctx: {} }); t.after(() => service.dispose());
  store.putDocument({ key: 'knowledge:old', kind: 'knowledge', date: '2026-10-20', title: '插件设置页 注册', project: '/p', body: '旧正文', sources: [], updatedAt: 1 });
  store.putDocument({ key: 'knowledge:new', kind: 'knowledge', date: '2026-10-20', title: '插件设置页 注册', project: '/p', body: '新正文', sources: [], updatedAt: 5 });
  store.putDocument({ key: 'daily:2026-10-20', kind: 'daily', date: '2026-10-20', title: '2026-10-20 对话日报', body: '日报', sources: [], updatedAt: 2 });
  const rows = await service.list('');
  assert.equal(rows.length, 2);
  const knowledge = rows.find((r) => r.kind === 'knowledge');
  assert.equal(knowledge.versions, 2); assert.equal(knowledge.body, '新正文');
});

test('errors carry stable non-secret codes and RPC keeps them distinguishable', async () => {
  let handler;
  await registerRpc({ connection: { fetch: { register: async (r) => { handler = r.fetch; return () => {}; } } } }, {
    settings: () => ({ config: {} }),
    startGenerate: () => { const e = new Error('请先配置总结模型'); e.code = 'model'; throw e; },
  });
  const request = (method) => new Request('http://localhost/api/dsh-conversation-journal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: 'r1', method: 'dsh-conversation-journal', payload: { method, payload: {} } }) });
  const result = await (await handler(request('generate'))).json();
  assert.equal(result.result.ok, false); assert.equal(result.result.error.code, 'journal/model');
  const message = await (await handler(request('days.summary'))).text();
  assert.match(message, /journal\/error/);
});

test('service failures surface as codes instead of plain strings', async (t) => {
  const { store } = await fixture(t);
  const service = new JournalService({ store, config: readConfig({}), ctx: {}, clock: () => Date.parse('2026-10-22T04:00:00Z') });
  t.after(() => service.dispose());
  assert.equal((await service.save({}, 1).catch((e) => e.code)), 'error');
  let code; try { service.startGenerate('2026-10-22'); } catch (error) { code = error.code; }
  assert.equal(code, 'model');
  // An unconfigured Notion target is reported as a coded failure carrying the actionable message.
  const notion = (() => { try { service.notionAction('sync'); } catch (error) { return error; } })();
  assert.equal(notion.code, 'error'); assert.match(notion.message, /请先启用 Notion 同步/);
});

test('models.list merges provider routes with their advertised models', async () => {
  let handler;
  const llm = {
    listProviders: () => [{ id: 'magpie', name: 'Magpie' }, { id: 'deepseek', name: 'DeepSeek' }, { id: 'broken', name: 'Broken' }],
    listModels: async (provider) => {
      if (provider === 'broken') throw new Error('catalog unavailable');
      return provider === 'magpie'
        ? [{ id: 'auto/deepseek-v4.1-flash', name: 'Deepseek-V4.1-Flash' }]
        : [{ id: 'deepseek-chat', name: 'DeepSeek Chat' }];
    },
  };
  await registerRpc({ get: (name) => (name === 'llm' ? llm : undefined), connection: { fetch: { register: async (r) => { handler = r.fetch; return () => {}; } } } }, {});
  const result = await (await handler(new Request('http://localhost/api/dsh-conversation-journal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: 'r1', method: 'dsh-conversation-journal', payload: { method: 'models.list', payload: {} } }) }))).json();
  const providers = result.result.value.providers;
  assert.equal(result.result.ok, true);
  assert.deepEqual(providers.map((p) => [p.id, p.models.map((m) => m.id)]), [
    ['magpie', ['auto/deepseek-v4.1-flash']], ['deepseek', ['deepseek-chat']], ['broken', []],
  ]);
  assert.equal(providers[2].error, true);
});

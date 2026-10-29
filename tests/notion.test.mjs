import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Storage } from '../host/storage.js';
import { NotionClient, NotionOutput, notionId, documentBlocks, contentDigest } from '../host/notion.js';

const parent = '11111111111111111111111111111111';
const doc = () => ({ key: 'daily:2026-10-22', kind: 'daily', date: '2026-10-22', title: '2026-10-22 对话日报', body: '## 讨论\n- 记录咖啡知识\n\n仍需实际尝试。', projects: ['/project'], sources: [{ id: 'r1', source: 'chat', sessionId: 's1', reference: '聊天记录 42' }] });
class FakeNotion {
  next = 0; pages = new Map(); databases = new Map(); sources = new Map(); blocks = new Map(); lists = new Map([[parent, []]]); calls = []; fail = null;
  id() { return `fake-${++this.next}`; }
  materialize(raw, parentId) {
    const id = this.id(); const children = raw[raw.type]?.children ?? [];
    const value = structuredClone(raw); delete value[value.type]?.children;
    const b = { ...value, id, has_children: children.length > 0 };
    this.blocks.set(id, b); this.lists.set(id, children.map((r) => this.materialize(r, id)));
    return b;
  }
  async fetch(url, options) {
    assert.equal(new URL(url).hostname, 'api.notion.com');
    assert.equal(options.headers['Notion-Version'], '2025-09-03');
    const path = new URL(url).pathname.slice(4), method = options.method; const body = options.body && JSON.parse(options.body);
    this.calls.push({ path, method, body });
    const response = (value) => Response.json(structuredClone(value));
    if (this.fail?.when(path, method)) { const failure = this.fail; this.fail = null; if (!failure.after) throw new Error('Network failure'); this.afterFailure = true; }
    let result;
    if (path === `pages/${parent}` && method === 'GET') result = { id: parent, properties: { title: { type: 'title', title: [{ text: { content: '工作记录' } }] } } };
    else if (path.startsWith('blocks/') && path.endsWith('/children')) {
      const id = path.split('/')[1];
      if (method === 'GET') result = { results: this.lists.get(id) ?? [], has_more: false };
      else {
        const values = body.children.map((r) => this.materialize(r, id));
        this.lists.set(id, [...(this.lists.get(id) ?? []), ...values]); result = { results: values };
      }
    } else if (path === 'databases' && method === 'POST') {
      const id = this.id(), ds = this.id();
      result = { id, data_sources: [{ id: ds }] }; this.databases.set(id, result);
      this.sources.set(ds, { id: ds, properties: Object.fromEntries(Object.entries(body.initial_data_source.properties).map(([key, v]) => [key, { type: Object.keys(v)[0] }])) });
      const child = { id, type: 'child_database', child_database: { title: body.title[0].text.content } };
      this.lists.get(body.parent.page_id).push(child);
    } else if (path.startsWith('databases/')) result = this.databases.get(path.split('/')[1]);
    else if (path.startsWith('data_sources/') && path.endsWith('/query')) {
      const id = path.split('/')[1]; const key = body.filter.rich_text.equals;
      result = { results: [...this.pages.values()].filter((p) => p.parent.data_source_id === id && p.properties.Key.rich_text[0].text.content === key), has_more: false };
    } else if (path.startsWith('data_sources/')) result = this.sources.get(path.split('/')[1]);
    else if (path === 'pages' && method === 'POST') {
      const id = this.id(); result = { id, url: `https://www.notion.so/${id}`, parent: body.parent, properties: body.properties };
      this.pages.set(id, result); this.lists.set(id, (body.children ?? []).map((r) => this.materialize(r, id)));
    } else if (path.startsWith('pages/') && method === 'PATCH') {
      result = this.pages.get(path.split('/')[1]); result.properties = body.properties;
    } else if (path.startsWith('blocks/') && method === 'PATCH') {
      const id = path.split('/')[1]; result = this.blocks.get(id);
      if (body.archived) for (const [key, list] of this.lists) this.lists.set(key, list.filter((b) => b.id !== id));
    } else throw new Error(`Unexpected mock route: ${method} ${path}`);
    if (this.afterFailure) { this.afterFailure = false; throw new Error('Response lost after commit'); }
    return response(result);
  }
}
async function setup(t) {
  const root = await mkdtemp(join(tmpdir(), 'journal-notion-')), store = new Storage(root), api = new FakeNotion();
  t.after(async () => { store.close(); await rm(root, { recursive: true, force: true }); });
  const client = new NotionClient({ token: 'test-only-not-a-real-token', fetchImpl: api.fetch.bind(api), sleep: async () => {} });
  const output = new NotionOutput({ client, store, parent });
  return { api, output, store, client };
}

test('Notion IDs accept page URLs and reject non-Notion destinations', () => {
  assert.equal(notionId(`https://www.notion.so/Work-${parent}?v=22222222222222222222222222222222`), parent);
  assert.throws(() => notionId(`https://attacker.example/${parent}`));
  assert.throws(() => notionId('not-an-id'));
});
test('Notion initialization recovers existing databases after loss of local state', async (t) => {
  const { api, output, store } = await setup(t);
  await output.initialize(); await output.initialize();
  assert.equal(api.databases.size, 2);
  store.set(output.scope, {}); await output.initialize(); assert.equal(api.databases.size, 2);
});
test('Notion writes one page per day, keeps notes, detects manual edits inside generated region', async (t) => {
  const { api, output, store } = await setup(t); await output.initialize();
  const d = doc(); const first = await output.sync(d); await output.sync(d);
  assert.equal(api.pages.size, 1);
  const note = api.lists.get(first.pageId).find((b) => b.type === 'paragraph'); note.paragraph.rich_text[0].text.content = '我的人工笔记';
  await output.sync({ ...d, body: d.body + '\n新的讨论' });
  assert.equal(api.lists.get(first.pageId).find((b) => b.id === note.id).paragraph.rich_text[0].text.content, '我的人工笔记');
  assert.equal(api.lists.get(first.pageId).filter((b) => b.type === 'toggle').length, 1);
  const map = store.get(`${output.scope}:${d.key}`);
  api.lists.get(map.blockId)[0].heading_2.rich_text[0].text.content = '人工修改';
  await assert.rejects(output.sync({ ...d, body: '试图覆盖' }), /人工修改/);
  assert.equal(api.lists.get(map.blockId)[0].heading_2.rich_text[0].text.content, '人工修改');
});
test('Notion recovers an acknowledged page whose response was lost without duplication', async (t) => {
  const { api, output } = await setup(t); await output.initialize();
  api.fail = { when: (p, m) => p === 'pages' && m === 'POST', after: true };
  await assert.rejects(output.sync(doc()), /结果可能未知/);
  await output.sync(doc()); assert.equal(api.pages.size, 1);
});
test('Notion recovers append response loss and cleanup failure, never deletes notes', async (t) => {
  const { api, output } = await setup(t); await output.initialize(); const d = doc();
  api.fail = { when: (p, m) => p.endsWith('/children') && m === 'PATCH', after: true };
  await assert.rejects(output.sync(d)); const receipt = await output.sync(d);
  assert.equal(api.lists.get(receipt.pageId).filter((b) => b.type === 'toggle').length, 1);
  api.fail = { when: (p, m) => p.startsWith('blocks/') && !p.endsWith('/children') && m === 'PATCH' };
  const updated = { ...d, body: d.body + '\n补充' };
  await assert.rejects(output.sync(updated)); await output.sync(updated);
  assert.equal(api.lists.get(receipt.pageId).filter((b) => b.type === 'toggle').length, 1);
  assert.equal(api.lists.get(receipt.pageId).filter((b) => b.type === 'heading_2').length, 1);
});
test('Notion marker alone does not authorize overwriting unknown imported content', async (t) => {
  const { api, output, store } = await setup(t); await output.initialize(); const d = doc(); await output.sync(d);
  store.set(`${output.scope}:${d.key}`, {});
  await assert.rejects(output.sync({ ...d, body: 'different' }), /未确认/);
  assert.equal(api.pages.size, 1);
});
test('Notion formatting changes and nested content are conflicts; long rich text is split', () => {
  const blocks = documentBlocks({ ...doc(), body: '文字'.repeat(5000) });
  assert.ok(blocks.every((b) => b[b.type].rich_text.every((r) => r.text.content.length <= 1600)));
  const copy = structuredClone(blocks); copy[0].paragraph.rich_text[0].annotations = { bold: true };
  assert.notEqual(contentDigest(blocks), contentDigest(copy)); copy[0].has_children = true;
  assert.notEqual(contentDigest(blocks), contentDigest(copy));
});
test('Notion respects rate-limit Retry-After and does not blindly retry ambiguous writes', async () => {
  let requests = 0; const sleeps = [];
  const client = new NotionClient({ token: 'test', sleep: async (ms) => sleeps.push(ms), fetchImpl: async () => {
    requests++; return requests === 1 ? new Response('', { status: 429, headers: { 'Retry-After': '2' } }) : Response.json({ ok: true });
  } });
  assert.equal((await client.request('pages', 'POST', {})).ok, true); assert.equal(requests, 2); assert.ok(sleeps.includes(2000));
  requests = 0;
  const failing = new NotionClient({ token: 'test', fetchImpl: async () => { requests++; throw new Error('ambiguous'); } });
  await assert.rejects(failing.request('pages', 'POST', {})); assert.equal(requests, 1);
});

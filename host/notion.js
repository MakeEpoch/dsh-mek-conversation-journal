import { setTimeout as delay } from 'node:timers/promises';
import { abort, hash, redact } from './common.js';

export function notionId(input) {
  let value = String(input).trim();
  if (/^https:\/\//.test(value)) {
    const url = new URL(value);
    if (!['notion.so', 'www.notion.so', 'notion.site', 'www.notion.site'].includes(url.hostname) && !url.hostname.endsWith('.notion.site')) throw new Error('请输入 Notion 页面链接');
    value = url.pathname;
  }
  const match = value.match(/([a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}|[a-f\d]{32})\/?$/i);
  if (!match) throw new Error('Notion 父页面链接或 ID 无效');
  return match[1].replace(/-/g, '').toLowerCase();
}
const rich = (text) => {
  const result = [];
  for (let i = 0; i < text.length; i += 1600) result.push({ type: 'text', text: { content: text.slice(i, i + 1600) } });
  return result;
};
const block = (type, text) => ({ object: 'block', type, [type]: { rich_text: rich(text) } });
const plain = (items) => (items ?? []).map((x) => x.text?.content ?? x.plain_text ?? '').join('');
export function documentBlocks(doc) {
  const text = redact(`${doc.body}\n\n来源\n${(doc.sources ?? []).map((s) => `${s.source} · ${s.sessionId} · ${s.reference}`).join('\n')}`);
  const blocks = []; let code = null, lines = [];
  const add = (type, content) => {
    for (let i = 0; i < content.length; i += 5000) blocks.push(block(type, content.slice(i, i + 5000)));
  };
  for (const line of text.split('\n')) {
    if (line.startsWith('```')) {
      if (code !== null) {
        const content = lines.join('\n');
        for (let i = 0; i < content.length; i += 5000) blocks.push({ ...block('code', content.slice(i, i + 5000)), code: { rich_text: rich(content.slice(i, i + 5000)), language: 'plain text' } });
        lines = []; code = null;
      }
      else code = line.slice(3);
    } else if (code !== null) lines.push(line);
    else if (/^#{1,3} /.test(line)) add(`heading_${line.match(/^#+/)[0].length}`, line.replace(/^#+ /, ''));
    else if (/^[-*] /.test(line)) add('bulleted_list_item', line.slice(2));
    else if (line.trim()) add('paragraph', line);
  }
  if (lines.length) blocks.push({ ...block('code', lines.join('\n')), code: { rich_text: rich(lines.join('\n')), language: 'plain text' } });
  if (blocks.length > 95) {
    // Keep all text in bounded paragraphs if Markdown expands into too many blocks.
    blocks.length = 0; for (let i = 0; i < text.length; i += 5000) blocks.push(block('paragraph', text.slice(i, i + 5000)));
  }
  if (blocks.length > 95) throw new Error('文档超过 Notion 单次写入上限，已留在本地');
  return blocks;
}
/** Canonical content includes formatting/links; user edits inside the generated area conflict. */
export function contentDigest(blocks) {
  return hash(blocks.map((b) => {
    const body = b[b.type] ?? {};
    return { type: b.type, rich_text: (body.rich_text ?? []).map((r) => ({
      type: r.type ?? 'text', text: r.text?.content ?? r.plain_text ?? '', link: r.text?.link?.url ?? null,
      annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default', ...r.annotations },
    })), color: body.color ?? 'default', checked: body.checked ?? false,
    language: body.language ?? '', children: b.has_children ? true : false };
  }));
}
export class NotionClient {
  constructor({ token, fetchImpl = fetch, sleep = delay, signal }) { this.token = token; this.fetch = fetchImpl; this.sleep = sleep; this.signal = signal; }
  async request(path, method = 'GET', body) {
    if (!this.token) throw new Error('请先保存 Notion Token');
    for (let attempt = 0; attempt < 4; attempt++) {
      abort(this.signal);
      const gap = 350 - (Date.now() - (this.lastRequest ?? 0));
      if (gap > 0) await this.sleep(gap, undefined, { signal: this.signal });
      this.lastRequest = Date.now();
      let response;
      try {
        response = await this.fetch(`https://api.notion.com/v1/${path}`, { method, redirect: 'error',
          headers: { Authorization: `Bearer ${this.token}`, 'Notion-Version': '2025-09-03', 'Content-Type': 'application/json' },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: this.signal ? AbortSignal.any([this.signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) });
      } catch {
        abort(this.signal); throw new Error('Notion 网络请求失败；写入结果可能未知，补传时会先查询已有页面');
      }
      if ([429, 529].includes(response.status) && attempt < 3) {
        const seconds = Number(response.headers.get('retry-after') ?? 2 ** attempt);
        if (!Number.isFinite(seconds) || seconds > 60) throw new Error('Notion 要求稍后重试，结果已保留供补传');
        await response.body?.cancel(); await this.sleep(Math.max(0, seconds) * 1000, undefined, { signal: this.signal }); continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`Notion 请求失败（HTTP ${response.status}）${[401, 403, 404].includes(response.status) ? '，请检查 Token 与目标页面授权' : '，结果已保留；请稍后补传'}`);
      }
      return response.json();
    }
  }
  async children(id) {
    const result = []; let cursor;
    do {
      const page = await this.request(`blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ''}`);
      result.push(...page.results); cursor = page.has_more ? page.next_cursor : null;
      if (result.length > 10000) throw new Error('Notion 页面内容过多，停止扫描');
    } while (cursor);
    return result;
  }
}
const schema = { Name: { title: {} }, Key: { rich_text: {} }, Date: { date: {} }, Projects: { multi_select: {} }, Tags: { multi_select: {} }, Sources: { multi_select: {} } };
export class NotionOutput {
  constructor({ client, store, parent }) { this.client = client; this.store = store; this.parent = notionId(parent); this.scope = `notion:${this.parent}`; }
  async test() {
    const page = await this.client.request(`pages/${this.parent}`);
    return { connected: true, title: plain(Object.values(page.properties ?? {}).find((p) => p.type === 'title')?.title), parent: this.parent };
  }
  async initialize() {
    await this.test();
    let state = this.store.get(this.scope, {});
    const children = await this.client.children(this.parent);
    for (const [kind, title] of [['daily', '对话日报'], ['knowledge', '对话知识库']]) {
      if (state[kind]) continue;
      const matches = children.filter((b) => b.type === 'child_database' && b.child_database.title === title);
      if (matches.length > 1) throw new Error(`存在多个“${title}”数据库，请保留一个后重试`);
      const db = matches.length ? await this.client.request(`databases/${matches[0].id}`) : await this.client.request('databases', 'POST', {
        parent: { type: 'page_id', page_id: this.parent }, title: rich(title), is_inline: true,
        initial_data_source: { properties: schema },
      });
      if (!db.data_sources?.[0]?.id) throw new Error('Notion 未返回数据库的数据源 ID');
      const id = db.data_sources[0].id;
      const ds = await this.client.request(`data_sources/${id}`);
      for (const [key, value] of Object.entries(schema)) if (ds.properties?.[key]?.type !== Object.keys(value)[0]) throw new Error(`“${title}”的 ${key} 字段不兼容，请重命名旧库后重试初始化`);
      state = { ...state, [kind]: id }; this.store.set(this.scope, state);
    }
    return { initialized: true, ...state };
  }
  async sync(doc) {
    const ds = this.store.get(this.scope, {})[doc.kind];
    if (!ds) throw new Error('请先点击“初始化日报与知识库”');
    const mapKey = `${this.scope}:${doc.key}`;
    let mapping = this.store.get(mapKey, {});
    const found = await this.client.request(`data_sources/${ds}/query`, 'POST', { filter: { property: 'Key', rich_text: { equals: doc.key } }, page_size: 2 });
    if (found.results.length > 1 || found.has_more) throw new Error('Notion 中存在重复记录，已停止覆盖');
    let page = found.results[0];
    // Page properties are metadata. The body and manual notes are handled independently.
    const properties = { Name: { title: rich(doc.title) }, Key: { rich_text: rich(doc.key) },
      Date: { date: { start: doc.date } }, Projects: { multi_select: [...new Set(doc.projects ?? [doc.project])].filter(Boolean).slice(0, 30).map((name) => ({ name: name.slice(0, 100).replace(/,/g, '，') })) },
      Tags: { multi_select: (doc.tags ?? []).slice(0, 12).map((name) => ({ name: name.slice(0, 100).replace(/,/g, '，') })) },
      Sources: { multi_select: [...new Set(doc.sources.map((s) => s.source))].map((name) => ({ name })) } };
    if (!page) page = await this.client.request('pages', 'POST', { parent: { type: 'data_source_id', data_source_id: ds }, properties,
      children: [block('heading_2', '人工备注'), block('paragraph', '在此补充个人备注；自动整理不会修改此区域。')] });
    if (mapping.pageId && mapping.pageId !== page.id) throw new Error('Notion 记录身份发生变化，已停止覆盖');
    mapping = { ...mapping, pageId: page.id, url: page.url }; this.store.set(mapKey, mapping);
    const desired = documentBlocks(doc), digest = contentDigest(desired);
    const marker = `自动整理 · ${doc.key} · ${digest}`;
    const children = await this.client.children(page.id);
    const generated = children.filter((b) => b.type === 'toggle' && plain(b.toggle.rich_text).startsWith(`自动整理 · ${doc.key} · `));
    if (mapping.blockId) {
      const previous = children.find((b) => b.id === mapping.blockId);
      if (!previous || contentDigest(await this.client.children(previous.id)) !== mapping.digest
        || plain(previous.toggle?.rich_text) !== `自动整理 · ${doc.key} · ${mapping.digest}`) throw new Error('Notion 自动整理区域已被人工修改或删除，保留原文；请在 Notion 处理后再补传');
    } else if (generated.length) {
      // Recover successful writes whose response or local receipt was lost. Never trust a marker alone.
      const exact = generated.filter((b) => plain(b.toggle.rich_text) === marker);
      if (exact.length !== 1 || generated.length !== 1 || contentDigest(await this.client.children(exact[0].id)) !== digest) throw new Error('Notion 存在未确认的自动内容，保留原文并停止覆盖');
      mapping = { ...mapping, blockId: exact[0].id, digest }; this.store.set(mapKey, mapping);
    }
    if (mapping.digest !== digest) {
      const candidates = generated.filter((b) => plain(b.toggle.rich_text) === marker);
      let next;
      if (candidates.length > 1) throw new Error('发现重复的自动内容，停止覆盖');
      if (candidates.length) {
        next = candidates[0];
        if (contentDigest(await this.client.children(next.id)) !== digest) throw new Error('待恢复的自动内容已被修改');
      } else {
        const result = await this.client.request(`blocks/${page.id}/children`, 'PATCH', { children: [{ ...block('toggle', marker), toggle: { rich_text: rich(marker), children: desired } }] });
        next = result.results[0];
      }
      // Save receipt BEFORE removing the old region, so partial failures can be retried safely.
      mapping = { ...mapping, previousId: mapping.blockId, previousDigest: mapping.digest, blockId: next.id, digest };
      this.store.set(mapKey, mapping);
    }
    if (mapping.previousId) {
      const previous = children.find((b) => b.id === mapping.previousId);
      if (previous) {
        if (contentDigest(await this.client.children(previous.id)) !== mapping.previousDigest) throw new Error('旧自动区域被修改，已保留两个版本');
        await this.client.request(`blocks/${previous.id}`, 'PATCH', { archived: true });
      }
      delete mapping.previousId; delete mapping.previousDigest; this.store.set(mapKey, mapping);
    }
    await this.client.request(`pages/${page.id}`, 'PATCH', { properties });
    return { pageId: page.id, url: page.url };
  }
}

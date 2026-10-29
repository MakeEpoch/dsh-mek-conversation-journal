import { abort, dayAt, expandHome, fail, hash, redact, safeError, validDay } from './common.js';
import { readConfig, publicConfig, defaults } from './config.js';
import { Storage } from './storage.js';
import { SourceRegistry, CodexSource, DshSource } from './sources.js';
import { batches, modelJson, validateAnalysis } from './analyzer.js';
import { NotionClient, NotionOutput } from './notion.js';
import { accessSync, constants, statSync } from 'node:fs';
import { join } from 'node:path';

const excludedProject = (project, config) => config.excludedProjects.some((p) => project === p || project?.startsWith(p.replace(/\/$/, '') + '/'));
const includedRecord = (record, config) => config.sources.includes(record.source)
  && !config.excludedSessions.includes(record.sessionId) && !excludedProject(record.project, config);

export class JournalService {
  constructor({ ctx, config, root, store, analyze = modelJson, notionFactory, clock = () => Date.now() }) {
    this.ctx = ctx; this.raw = config; this.store = store ?? new Storage(root); this.analyze = analyze; this.clock = clock;
    this.notionFactory = notionFactory ?? ((config, signal) => new NotionOutput({
      client: new NotionClient({ token: config.notionToken, signal }), store: this.store, parent: config.notionParent,
    }));
    this.sources = new SourceRegistry();
    this.sources.register('codex', new CodexSource());
    this.sources.register('dsh', new DshSource(() => this.ctx.get?.('sessionQuery')));
    this.job = null; this.active = null; this.closed = false; this.timer = null; this.tickBusy = false;
  }
  config() { return readConfig(this.raw); }
  settingsEntry() {
    const editor = this.ctx.get?.('configEditor');
    const entry = editor?.entries?.().find((e) => e.options?.name === 'dsh-mek-conversation-journal' && (!this.ctx.fiber || e.fiber?.uid === this.ctx.fiber.uid))
      ?? editor?.entries?.().find((e) => e.options?.name === 'dsh-mek-conversation-journal');
    return entry?.options?.id ?? 'conversation-journal';
  }
  settings() {
    const settings = this.ctx.get?.('settings');
    const row = settings?.describe?.({ redactSecrets: true })?.find((r) => r.ns === this.settingsEntry());
    // A half-edited configuration must not turn the whole panel into an error page.
    let config, timeZone = defaults.timeZone;
    try { config = publicConfig(this.raw); timeZone = readConfig(this.raw).timeZone; }
    catch { config = { ...defaults, notionTokenConfigured: false }; delete config.notionToken; }
    return { config, revision: row?.revision, editable: Boolean(row), today: dayAt(this.clock(), timeZone),
      job: this.job, lastGeneration: this.store.get('lastGeneration'), initialized: this.initialized(), ready: this.ready() };
  }
  /** Host-side facts so the first screen can be honest instead of a blank form. */
  ready() {
    const sources = [], details = {};
    try {
      const query = this.ctx.get?.('sessionQuery');
      details.dsh = { available: Boolean(query), reason: query ? '' : '宿主会话查询服务未启用' };
      let home = this.raw?.codexHome;
      home = typeof home?.get === 'function' ? home.get() : home;
      home = expandHome(typeof home === 'string' && home.trim() ? home.trim() : defaults.codexHome);
      const readable = ['sessions', 'archived_sessions'].some((folder) => {
        try { const path = join(home, folder); accessSync(path, constants.R_OK | constants.X_OK); return statSync(path).isDirectory(); }
        catch { return false; }
      });
      details.codex = { available: readable, reason: readable ? '' : 'Host 本机没有可读取的 Codex 会话目录' };
      for (const name of this.sources.adapters.keys()) if (details[name]?.available) sources.push(name);
    } catch { /* Report unknown readiness as unavailable, never as a successful scan. */ }
    return { host: Boolean(this.store), sources, details };
  }
  /** Per-day message counts, so the panel can point at days that actually have content. */
  daySummary(days = 14) {
    let config = defaults;
    try { config = this.config(); } catch { /* fall back to the default zone */ }
    const { timeZone } = config;
    const today = dayAt(this.clock(), timeZone);
    const base = Date.parse(`${today}T00:00:00Z`);
    const counts = new Map();
    // One extra day on either side covers local dates in every supported zone.
    for (const row of this.store.messages(base - days * 86400000, base + 2 * 86400000)) {
      const record = JSON.parse(row.value);
      if (!includedRecord(record, config)) continue;
      const day = dayAt(record.time, timeZone);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return { today, scanned: Boolean(this.store.get('lastScan')),
      days: Array.from({ length: days }, (_, i) => {
        const day = new Date(base - (days - 1 - i) * 86400000).toISOString().slice(0, 10);
        return { day, messages: counts.get(day) ?? 0 };
      }) };
  }
  initialized() {
    try { const output = this.notionFactory(this.config()); return this.store.get(output.scope, {}); } catch { return {}; }
  }
  async save(patch, revision) {
    if (this.active) throw fail('请等待当前任务结束后保存设置');
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw fail('配置无效');
    const clean = Object.fromEntries(Object.entries(patch).filter(([key]) => Object.hasOwn(defaults, key)));
    if (!clean.notionToken?.trim()) delete clean.notionToken;
    try { readConfig({ ...this.config(), ...clean }); } catch (error) { throw fail(error.message); }
    const settings = this.ctx.get?.('settings');
    if (!settings?.update) throw fail('宿主 Settings 服务未启用');
    try { await settings.update(this.settingsEntry(), clean, revision); }
    catch (error) {
      if (/conflict|revision|冲突/i.test(`${error?.code ?? ''} ${error?.message ?? ''}`)) throw fail('设置已在其他窗口更新，请重新读取后再保存');
      throw fail(error?.message ?? String(error));
    }
    return this.settings();
  }
  run(kind, operation) {
    if (this.closed) throw fail('插件已停用');
    if (this.active) throw fail('已有任务在运行');
    const controller = new AbortController();
    this.controller = controller;
    this.job = { kind, state: 'running', stage: '准备', startedAt: this.clock(), warnings: [] };
    const warn = (message) => { if (!this.job.warnings.includes(message) && this.job.warnings.length < 50) this.job.warnings.push(message); };
    this.active = Promise.resolve().then(() => operation(controller.signal, warn))
      .then((result) => { this.job = { ...this.job, state: 'done', stage: '完成', result }; })
      .catch((error) => { this.job = { ...this.job, state: controller.signal.aborted ? 'cancelled' : 'error', stage: '已停止', error: safeError(error) }; })
      .finally(() => {
        this.job.finishedAt = this.clock();
        if (kind === 'generate') this.store.set('lastGeneration', this.job);
        this.active = null; this.controller = null;
      });
    return { started: true };
  }
  startGenerate(day, mode = 'both', automatic = false) {
    validDay(day);
    if (!['both', 'daily', 'knowledge'].includes(mode)) throw new Error('未知生成类型');
    const config = this.config();
    if (!config.enabled) throw fail('请先启用插件');
    if (!config.sources.length) throw fail('请至少选择一个对话来源');
    if (!config.provider || !config.model) throw fail('请先配置总结模型');
    return this.run('generate', async (signal, warn) => {
      this.job.stage = '读取对话';
      await this.sources.scan({ store: this.store, config, day, signal, warn });
      const center = Date.parse(`${day}T00:00:00Z`); const records = []; const seen = new Map(); let duplicates = 0;
      for (const row of this.store.messages(center - 86400000, center + 2 * 86400000)) {
        const r = JSON.parse(row.value);
        if (!includedRecord(r, config) || dayAt(r.time, config.timeZone) !== day) continue;
        // Only exact long content across different sources is collapsed, not merely similar discussion.
        const fingerprint = hash([r.role, r.project, r.text]);
        if (r.text.length > 80 && seen.has(fingerprint) && seen.get(fingerprint) !== r.source) { duplicates++; continue; }
        seen.set(fingerprint, r.source); records.push(r);
        if (records.length > 50000) throw new Error('当日记录超过 50000 条，请缩小来源或排除无关会话后重试');
      }
      if (!records.length) {
        if (automatic && !this.job.warnings.length) this.store.set('lastAutoDay', day);
        return { day, messages: 0, note: '没有可整理的对话，已有内容保持不变' };
      }
      const groups = batches(records, Math.floor(config.maxInputChars * 0.65));
      if (groups.length > 40) throw new Error(`需要 ${groups.length} 次分析，超过单次 40 批上限；请缩小来源后重试`);
      // Exclusions also apply to the old knowledge used as model context. A
      // partially excluded note cannot be safely separated into public pieces.
      const existing = this.store.listDocuments('', 10000, 0, 'knowledge').filter((d) =>
        !excludedProject(d.project, config) && (d.sources ?? []).every((s) => includedRecord(s, config)));
      const summaries = []; const cited = new Map(); const knowledges = new Map(); let calls = 0;
      for (const [i, input] of groups.entries()) {
        abort(signal); this.job.stage = `整理对话 ${i + 1}/${groups.length}`;
        const terms = input.map((r) => r.text).join('\n').toLowerCase();
        const candidates = existing.filter((d) => terms.includes(d.title.toLowerCase()) || (d.tags ?? []).some((t) => terms.includes(t.toLowerCase())));
        const hints = []; let hintSize = 0;
        for (const d of candidates) {
          const hint = { title: d.title, project: d.project, body: d.body, tags: d.tags, sources: d.sources?.map((s) => s.id) };
          const size = JSON.stringify(hint).length;
          if (hintSize + size < config.maxInputChars * 0.25) { hints.push(hint); hintSize += size; }
        }
        const key = `analysis:${hash(['v1', config.provider, config.model, input, hints])}`;
        let result = this.store.get(key);
        if (!result) { result = await this.analyze(this.ctx.get?.('llm'), config, { date: day, records: input, existingKnowledge: hints }, signal); calls++; }
        const visibleExisting = candidates.filter((d) => hints.some((h) => h.title === d.title && h.project === d.project));
        const validated = validateAnalysis(result, input, visibleExisting);
        this.store.set(key, { daily: validated.daily, sources: result.sources, knowledge: validated.knowledge.map((k) => ({
          title: k.title, project: k.project, tags: k.tags, body: k.body, sources: k.sources.map((s) => s.id),
        })) }); summaries.push(validated.daily);
        for (const ref of validated.sources) cited.set(ref.id, ref);
        for (const k of validated.knowledge) {
          // Do not silently replace a knowledge point mentioned by multiple chunks.
          const prev = knowledges.get(k.key) ?? this.store.document(k.key);
          if (prev) {
            k.sources = [...new Map([...prev.sources, ...k.sources].map((s) => [s.id, s])).values()];
            if (prev.body.includes(k.body)) k.body = prev.body;
            else if (!k.body.includes(prev.body)) k.body = `${prev.body}\n\n补充（${day}）\n${k.body}`;
          }
          if (k.body.length > 100000) throw new Error('知识点内容过长，已停止以保留原记录');
          knowledges.set(k.key, { ...k, date: day, updatedAt: this.clock() });
        }
      }
      let body = summaries.join('\n\n---\n\n');
      if (groups.length > 1) {
        this.job.stage = '合并日报';
        const input = summaries.map((text, i) => ({ id: `summary-${i}`, text }));
        if (JSON.stringify(input).length > config.maxInputChars) throw new Error('分批摘要超过合并预算；请缩小来源后重试，已有内容已保留');
        const key = `merge:${hash([config.provider, config.model, input])}`;
        let merged = this.store.get(key);
        if (!merged) { merged = await this.analyze(this.ctx.get?.('llm'), config, { date: day, instruction: '合并这些分批摘要为一份去重日报，knowledge 返回空数组', records: input }, signal); calls++; }
        if (typeof merged.daily !== 'string' || !merged.daily.trim()) throw new Error('合并日报无效');
        body = redact(merged.daily); this.store.set(key, { daily: body });
      }
      abort(signal);
      const refs = [...cited.values()];
      // Collection warnings are per-run diagnostics; persisting them inside the body made them permanent content.
      const daily = { key: `daily:${day}`, kind: 'daily', date: day, title: `${day} 对话日报`, body,
        sources: refs, projects: [...new Set(records.map((r) => r.project).filter(Boolean))], tags: [],
        warnings: this.job.warnings.slice(0, 20), updatedAt: this.clock() };
      const documents = [...(mode !== 'knowledge' ? [daily] : []), ...(mode !== 'daily' ? knowledges.values() : [])];
      this.store.transaction(() => { for (const doc of documents) {
        const previous = this.store.document(doc.key);
        if (previous && hash({ ...previous, status: undefined, updatedAt: undefined }) === hash({ ...doc, updatedAt: undefined })) continue;
        this.store.putDocument(doc);
      } });
      this.store.set('lastScan', this.clock());
      if (automatic && !this.job.warnings.length) this.store.set('lastAutoDay', day);
      const sync = config.notionEnabled ? await this.syncPending(config, signal, warn) : null;
      return { day, messages: records.length, duplicates, compactedTools: records.filter((r) => r.metadata?.locallyCompacted).length, documents: documents.length, modelCalls: calls, sync };
    });
  }
  async syncPending(config, signal, warn) {
    const output = this.notionFactory(config, signal); let synced = 0, failed = 0;
    const scope = output.scope ?? 'default';
    const documents = this.store.listDocuments('', 100000);
    for (const doc of documents) {
      const contentHash = hash({ ...doc, status: undefined, updatedAt: undefined });
      if (this.store.get(`synced:${scope}:${doc.key}`) === contentHash && doc.status === 'synced') continue;
      abort(signal); this.job.stage = `同步 ${doc.title}`;
      try {
        const receipt = await output.sync(doc);
        this.store.set(`link:${scope}:${doc.key}`, receipt);
        this.store.set(`synced:${scope}:${doc.key}`, contentHash); this.store.mark(doc.key, 'synced'); synced++;
      } catch (error) { abort(signal); this.store.mark(doc.key, 'error'); warn(safeError(error)); failed++; }
    }
    return { synced, failed };
  }
  notionAction(method) {
    const config = this.config();
    if (method === 'sync' && !config.notionEnabled) throw fail('请先启用 Notion 同步');
    return this.run(`notion-${method}`, async (signal, warn) => {
      const output = this.notionFactory(config, signal);
      if (method === 'test') return output.test();
      if (method === 'initialize') return output.initialize();
      if (method === 'sync') return this.syncPending(config, signal, warn);
      throw new Error('未知 Notion 操作');
    });
  }
  destinationScope() {
    try { return this.notionFactory(this.config()).scope ?? 'default'; } catch { return ''; }
  }
  list(query = '', { limit = 100, offset = 0, kind = '' } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw fail('每页条数必须在 1 到 200 之间');
    if (!Number.isInteger(offset) || offset < 0 || offset > 1000000) throw fail('分页位置无效');
    if (!['', 'daily', 'knowledge'].includes(kind)) throw fail('未知记录类型');
    const scope = this.destinationScope();
    return this.store.listDocumentGroups({ query: String(query).slice(0, 300), limit, offset, kind, scope })
      .map((d) => ({ ...d, link: this.store.get(`link:${scope || 'default'}:${d.key}`)?.url }));
  }
  documentSummary() { return this.store.documentSummary(this.destinationScope()); }
  cancel() { this.controller?.abort(); return { cancelled: Boolean(this.active) }; }
  startTimer() {
    this.timer = setInterval(() => { this.tick().catch(() => { /* tick records a safe diagnostic */ }); }, 30000);
    this.timer.unref?.();
  }
  async tick() {
    if (this.closed || this.active || this.tickBusy) return;
    this.tickBusy = true;
    try {
      const c = this.config(); if (!c.enabled || !c.autoDaily) return;
      const now = this.clock(), today = dayAt(now, c.timeZone);
      const time = new Intl.DateTimeFormat('en-GB', { timeZone: c.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
      const day = time >= c.dailyTime ? today : new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
      // An evening draft is refreshed next morning to include messages after the cutoff.
      const slot = `${today}:${time >= c.dailyTime ? 'evening' : 'catchup'}`;
      if (this.store.get('autoAttempt', '') === slot) return;
      this.store.set('autoAttempt', slot);
      this.startGenerate(day, 'both', true);
    } catch (error) { this.job = { state: 'error', stage: '自动整理未启动', error: safeError(error) }; }
    finally { this.tickBusy = false; }
  }
  async dispose() {
    if (this.closed) return this.disposing;
    this.closed = true; clearInterval(this.timer); this.timer = null;
    this.controller?.abort();
    this.disposing = Promise.resolve(this.active).finally(() => this.store.close());
    await this.disposing;
  }
}

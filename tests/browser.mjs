import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { build } = require(process.env.DSH_ESBUILD_MODULE || 'esbuild');
const { chromium } = require(process.env.DSH_PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));

// This fixture is bundled into an isolated browser. Real Host files, indexes,
// providers, credentials and Notion endpoints are never accessed.
function setupFixture(React, createRoot) {
  const config = {
    enabled: true, sources: ['dsh', 'codex'], codexHome: '~/.codex', timeZone: 'Asia/Shanghai',
    provider: '', model: '', excludedProjects: [], excludedSessions: [], autoDaily: false,
    dailyTime: '23:30', notionEnabled: false, notionTokenConfigured: false, notionParent: '',
    maxInputChars: 60000, maxOutputTokens: 6000,
  };
  const documents = Array.from({ length: 126 }, (_, i) => {
    const date = new Date(Date.parse('2026-10-19T00:00:00Z') - i * 86400000).toISOString().slice(0, 10);
    return {
      key: `history:${i}`, kind: i % 3 === 0 ? 'daily' : 'knowledge', date,
      title: i % 3 === 0 ? `${date} 对话日报` : `历史知识 ${i}`,
      body: i === 125 ? '远期检索哨兵-125：这条内容位于最初 100 条之外。' : `历史正文 ${i}`,
      project: `/fixture/project-${i % 4}`, status: 'pending', sources: [], updatedAt: 10000 - i,
    };
  });
  const demo = window.demo = {
    config, documents, revision: 1, calls: [], job: null, lastGeneration: null, initialized: {},
    delay: 150, stops: 0, jobSequence: 0, pauseSave: false, saveWaiting: false, releaseSave: null,
    failMethod: '', failure: null,
  };
  const allowed = new Set([...Object.keys(config).filter((key) => key !== 'notionTokenConfigured'), 'notionToken']);
  const snapshot = () => ({ config: structuredClone(config), revision: demo.revision, editable: true, today: '2026-10-22', job: structuredClone(demo.job), lastGeneration: structuredClone(demo.lastGeneration), initialized: structuredClone(demo.initialized), ready: { host: true, sources: ['dsh', 'codex'] } });
  const summary = () => ({ daily: demo.documents.filter((d) => d.kind === 'daily').length, knowledge: demo.documents.filter((d) => d.kind === 'knowledge').length, pending: demo.documents.filter((d) => d.status !== 'synced').length, error: demo.documents.filter((d) => d.status === 'error').length });
  const run = (kind, finish) => {
    const id = ++demo.jobSequence;
    const job = demo.job = { id, kind, state: 'running', stage: kind === 'generate' ? '整理对话 1/2' : '连接 Notion', startedAt: Date.now(), warnings: [] };
    if (kind === 'generate') demo.lastGeneration = structuredClone(job);
    setTimeout(() => {
      if (demo.job?.id !== id || demo.job.state !== 'running') return;
      demo.job = { ...job, state: 'done', stage: '完成', finishedAt: Date.now(), result: finish() };
      if (kind === 'generate') demo.lastGeneration = structuredClone(demo.job);
    }, demo.delay);
    return { started: true };
  };
  const connection = { rpc: { call: async (channel, endpoint, { method, payload = {} }, signal) => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (channel !== '/api' || endpoint !== 'dsh-conversation-journal') throw new Error('Unexpected RPC endpoint');
    demo.calls.push({ method, payload: structuredClone(payload) });
    if (demo.failMethod === method) return { ok: false, error: demo.failure };
    let value;
    if (method === 'settings.get') value = snapshot();
    else if (method === 'models.list') value = { providers: [{ id: 'test-provider', name: 'Test Provider', models: [{ id: 'test-model', name: 'Test Model' }] }] };
    else if (method === 'days.summary') value = { today: '2026-10-22', scanned: true, days: Array.from({ length: payload.days ?? 7 }, (_, i) => ({ day: new Date(Date.parse('2026-10-22T00:00:00Z') - ((payload.days ?? 7) - 1 - i) * 86400000).toISOString().slice(0, 10), messages: i + 1 })) };
    else if (method === 'documents.summary') value = summary();
    else if (method === 'documents.list') {
      const query = String(payload.query ?? '').toLowerCase();
      const offset = payload.offset ?? 0, limit = payload.limit ?? 100;
      if (!Number.isInteger(offset) || !Number.isInteger(limit) || offset < 0 || limit < 1) throw new Error('Invalid list pagination');
      value = demo.documents.filter((d) => (!payload.kind || d.kind === payload.kind) && (!query || [d.title, d.body, d.project, d.date].some((text) => String(text ?? '').toLowerCase().includes(query))))
        .sort((a, b) => b.updatedAt - a.updatedAt).slice(offset, offset + limit);
    } else if (method === 'settings.update') {
      if (demo.pauseSave) {
        demo.saveWaiting = true;
        await new Promise((resolve) => { demo.releaseSave = resolve; });
        demo.pauseSave = false; demo.saveWaiting = false; demo.releaseSave = null;
      }
      if (payload.revision !== demo.revision) return { ok: false, error: { code: 'journal/conflict', message: '设置已在其他窗口更新，请重新读取后再保存' } };
      for (const [key, val] of Object.entries(payload.patch)) {
        if (!allowed.has(key)) throw new Error(`Unknown writable setting: ${key}`);
        if (key === 'notionToken') { if (val.trim()) config.notionTokenConfigured = true; }
        else config[key] = structuredClone(val);
      }
      demo.revision++;
      value = snapshot();
    } else if (method === 'generate') {
      if (!config.provider || !config.model || !config.sources.length) throw new Error('Generation before configuration was saved');
      const day = payload.day;
      value = run('generate', () => {
        const next = [
          { key: `daily:${day}`, kind: 'daily', date: day, title: `${day} 对话日报`, body: '## 已讨论\n插件设置与统一记录。\n\n尚未部署。', status: 'pending', updatedAt: 20000, sources: [{ id: 'r1', source: 'dsh', sessionId: 'fixture-session', reference: 'fixture://conversation/1' }] },
          { key: 'knowledge:generated', kind: 'knowledge', date: day, title: '知识点 <img src=x onerror=window.__xss=1>', body: '## 安全展示\n<script>window.__xss=1</script>\n\n以统一记录支持聊天来源。\n\n```html\n<img src=x onerror=window.__xss=2>\n```', status: 'synced', project: '/fixture/project', updatedAt: 20001, sources: [{ id: 'r2', source: 'codex', sessionId: 'fixture-codex', reference: '<svg onload=window.__xss=3>' }], link: 'javascript:window.__xss=4' },
        ];
        demo.documents = [...next, ...demo.documents.filter((d) => !next.some((n) => n.key === d.key))];
        return { day, messages: 3, documents: 2, modelCalls: 1 };
      });
    } else if (method === 'cancel') {
      demo.job = { ...demo.job, state: 'cancelled', stage: '已停止', finishedAt: Date.now() };
      if (demo.job.kind === 'generate') demo.lastGeneration = structuredClone(demo.job);
      value = { cancelled: true };
    } else if (method === 'notion.initialize') value = run('notion-initialize', () => { demo.initialized = { daily: 'fixture-daily', knowledge: 'fixture-knowledge' }; return { initialized: true }; });
    else if (method === 'notion.test') value = run('notion-test', () => ({ connected: true, title: '测试父页面' }));
    else if (method === 'notion.sync') value = run('notion-sync', () => { let synced = 0; for (const doc of demo.documents) if (doc.status !== 'synced') { doc.status = 'synced'; synced++; } return { synced, failed: 0 }; });
    else throw new Error(`Unsupported fixture RPC: ${method}`);
    return { ok: true, value: structuredClone(value) };
  } } };
  let cleanup, view, plugin;
  const ctx = { connection, effect(fn) { cleanup = fn(); }, slots: {
    inject(name, fn) { return fn(); },
    register(options, Section) { demo.section = options; view = createRoot(document.getElementById('root')); view.render(React.createElement(Section)); return () => { demo.stops++; view.unmount(); }; },
  } };
  window.__ModuleLoader__ = { load({ id, factory }) {
    if (id !== 'dsh-mek-conversation-journal') throw new Error('Wrong module identity');
    plugin = factory((name) => { if (name === 'react') return React; throw new Error(`Unexpected module: ${name}`); });
    plugin.apply(ctx);
  } };
  window.unloadPlugin = () => { cleanup?.(); cleanup = null; };
  window.remountPlugin = () => plugin.apply(ctx);
}

const bundle = await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; (${setupFixture.toString()})(React, createRoot);`, resolveDir: root }, bundle: true, write: false, format: 'iife', platform: 'browser', target: 'chrome100', minify: true });
await mkdir(`${root}/artifacts`, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errors = [], checks = [], screenshots = [];
try {
  const page = await browser.newPage({ viewport: { width: 1160, height: 1050 }, reducedMotion: 'reduce', acceptDownloads: true });
  page.setDefaultTimeout(6000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => route.abort());
  await page.setContent(`<!doctype html><html lang="zh"><head><meta charset="utf-8"><style>
    :root{color-scheme:light}body{margin:24px;font-family:Arial,"Noto Sans CJK SC",sans-serif;background:#fff;color:#22252c}
    @media(prefers-color-scheme:dark){:root{color-scheme:dark;--dsw-alias-label-primary:#e7e9ef;--dsw-alias-label-secondary:#adb3c1;--dsw-alias-border-l1:#3a3f4c;--dsw-alias-bg-l1:#20232b;--dsw-alias-bg-l2:#292d37;--dsw-alias-state-business-primary:#8b9cff}body{background:#17191f;color:#e7e9ef}}
    @media(max-width:600px){body{margin:16px}}
  </style></head><body><div id="root"></div></body></html>`);
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.addScriptTag({ content: await readFile(`${root}/lib/client.js`, 'utf8') });
  const tab = (name) => {
    const top = { '整理': 'work', '内容库': 'library', '设置': 'settings' }[name];
    return top ? page.locator(`[data-tab="${top}"]`).click() : page.getByRole('tab', { name, exact: true }).click();
  };
  const savebar = () => page.locator('.cj-savebar');
  const shot = async (name) => { const path = `${root}/artifacts/settings-${name}.png`; await page.screenshot({ path, fullPage: true }); screenshots.push(`settings-${name}.png`); };
  const done = (name) => { checks.push(name); console.log(`Browser: ${name}`); };
  const idle = async () => { await page.waitForFunction(() => demo.job?.state !== 'running'); await page.waitForFunction(() => !document.querySelector('.cj fieldset:disabled')); };
  const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Page must fit the viewport');

  await page.getByRole('heading', { name: '对话整理', exact: true }).waitFor();
  await page.getByRole('heading', { name: '先选好来源和总结模型' }).waitFor();
  assert.equal(await page.evaluate(() => demo.section.name), 'settings.section');
  assert.deepEqual(await page.locator('.cj-tabs [role=tab]').allTextContents(), ['整理', '内容库', '设置']);
  await page.getByLabel('整理日期', { exact: true }).fill('2026-10-20');
  await page.getByRole('button', { name: '选择 2026-10-19', exact: true }).click();
  await page.getByRole('button', { name: '选择 2026-10-20', exact: true }).click();
  assert.equal(await page.evaluate(() => demo.calls.filter((c) => c.method === 'settings.update').length), 0);
  await shot('onboarding');
  done('three product entrances; choosing a historical date never writes settings');

  await page.getByRole('button', { name: '完成设置', exact: true }).click();
  await page.getByLabel('日报时区').fill('UTC');
  await tab('内容库'); await tab('设置');
  assert.equal(await page.getByLabel('日报时区').inputValue(), 'UTC');
  await savebar().getByRole('button', { name: '放弃修改', exact: true }).click();
  assert.equal(await page.getByLabel('日报时区').inputValue(), 'Asia/Shanghai');
  assert.equal(await savebar().count(), 0);
  await page.getByRole('checkbox', { name: 'Codex 对话', exact: true }).uncheck();
  await page.getByLabel('选择模型').selectOption({ label: 'Test Provider · Test Model' });
  await tab('整理');
  await page.getByRole('button', { name: '保存并开始整理', exact: true }).click();
  await page.waitForFunction(() => demo.lastGeneration?.state === 'done');
  await page.getByRole('button', { name: '查看整理结果', exact: true }).waitFor();
  assert.equal(await page.getByLabel('整理日期', { exact: true }).inputValue(), '2026-10-20');
  const firstCalls = await page.evaluate(() => demo.calls.filter((c) => ['settings.update', 'generate'].includes(c.method)));
  assert.deepEqual(firstCalls.map((c) => c.method), ['settings.update', 'generate']);
  assert.deepEqual(firstCalls[0].payload.patch, { sources: ['dsh'], provider: 'test-provider', model: 'test-model' });
  assert.deepEqual(firstCalls[1].payload, { day: '2026-10-20', mode: 'both' });
  await shot('work');
  done('draft survives navigation; discard restores saved values; first save and start uses the chosen historical day');

  await tab('内容库');
  await page.locator('.cj-item').first().waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.cj-item').length === 20 && document.querySelector('.cj-library')?.getAttribute('aria-busy') === 'false');
  const expected = await page.evaluate(() => ({ daily: demo.documents.filter((d) => d.kind === 'daily').length, knowledge: demo.documents.filter((d) => d.kind === 'knowledge').length }));
  await page.getByText(`${expected.daily} 份日报 · ${expected.knowledge} 条知识`, { exact: false }).waitFor();
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await page.getByText('第 2 页', { exact: true }).waitFor();
  await page.waitForFunction(() => demo.calls.some((c) => c.method === 'documents.list' && c.payload.offset === 20 && c.payload.limit === 21));
  await page.getByRole('button', { name: '上一页', exact: true }).click();
  await page.getByText('第 1 页', { exact: true }).waitFor();
  await page.getByLabel('搜索全部内容', { exact: true }).fill('远期检索哨兵-125');
  await page.getByRole('button', { name: /^历史知识 125/ }).waitFor();
  assert.equal(await page.locator('.cj-item').count(), 1);
  await page.waitForFunction(() => demo.calls.some((c) => c.method === 'documents.list' && c.payload.query === '远期检索哨兵-125' && c.payload.offset === 0 && c.payload.limit === 21));
  await page.getByLabel('内容类型', { exact: true }).selectOption('daily');
  await page.getByRole('heading', { name: '没有找到符合条件的内容', exact: true }).waitFor();
  await page.getByRole('button', { name: '清除筛选', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.cj-item').length === 20 && document.querySelector('.cj-library')?.getAttribute('aria-busy') === 'false');
  assert.equal(await page.getByLabel('内容类型', { exact: true }).inputValue(), '');
  done('server search reaches records beyond 120 entries; totals, type filtering and 20-row pagination use the RPC contract');

  await page.getByRole('button', { name: /^知识点 <img/ }).click();
  await page.getByRole('heading', { name: '安全展示', exact: true }).waitFor();
  assert.equal(await page.locator('.cj img, .cj script, .cj svg[onload]').count(), 0);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.equal(await page.getByRole('link', { name: '在 Notion 打开 ↗', exact: true }).count(), 0);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 Markdown', exact: true }).click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /\.md$/);
  assert.equal(/[<>]/.test(download.suggestedFilename()), false);
  const exported = await readFile(await download.path(), 'utf8');
  assert.match(exported, /以统一记录支持聊天来源/);
  assert.match(exported, /## 来源/); assert.match(exported, /fixture-codex/);
  await shot('library');
  done('title, body and source markup stay inert; unsafe links are hidden; Markdown exports include source references');

  await tab('设置'); await tab('Notion 同步');
  await page.getByRole('switch', { name: '同步到 Notion', exact: true }).check();
  await page.getByLabel('连接 Token', { exact: true }).fill('fake-browser-only-token');
  await page.getByLabel('目标父页面').fill('https://www.notion.so/11111111111111111111111111111111');
  await page.getByRole('button', { name: '保存并连接 Notion', exact: true }).click();
  await page.waitForFunction(() => demo.job?.kind === 'notion-initialize' && demo.job.state === 'done');
  await page.getByRole('button', { name: '检查目标数据库', exact: true }).waitFor({ state: 'visible' });
  await idle();
  assert.equal(await page.getByLabel('更换连接 Token', { exact: true }).inputValue(), '');
  assert.equal(await page.evaluate(() => Object.hasOwn(demo.config, 'notionToken')), false);
  assert.equal(await page.evaluate(() => demo.config.notionTokenConfigured), true);
  assert.equal(await page.evaluate(() => demo.lastGeneration.kind), 'generate');
  const notionPrimary = page.getByRole('button', { name: '检查目标数据库', exact: true });
  await page.mouse.move(1100, 1000);
  const primaryBackground = await notionPrimary.evaluate((button) => getComputedStyle(button).backgroundColor);
  await notionPrimary.hover();
  assert.equal(await notionPrimary.evaluate((button) => getComputedStyle(button).backgroundColor), primaryBackground, 'Primary actions must remain readable on hover');
  await shot('notion');
  await tab('整理'); await page.getByRole('button', { name: '查看整理结果', exact: true }).waitFor();
  await tab('设置'); await tab('Notion 同步');
  await page.evaluate(() => { demo.failMethod = 'notion.test'; demo.failure = { code: 'journal/notion-auth', message: 'Notion 请求失败（HTTP 401），请检查 Token 与目标页面授权' }; });
  await page.getByRole('button', { name: '测试连接', exact: true }).click();
  await page.getByRole('alert').getByRole('heading', { name: 'Notion 授权失败', exact: true }).waitFor();
  await page.evaluate(() => { demo.failMethod = ''; demo.failure = null; });
  await page.getByRole('button', { name: '测试连接', exact: true }).click();
  await page.waitForFunction(() => demo.job?.kind === 'notion-test' && demo.job.state === 'done'); await idle();
  done('Notion saves before connecting, clears the secret input, preserves the generation receipt and explains authorization failures');

  await tab('来源与模型');
  await page.getByLabel('日报时区').fill('UTC');
  await page.evaluate(() => { demo.pauseSave = true; });
  await savebar().getByRole('button', { name: '保存设置', exact: true }).click();
  await page.waitForFunction(() => demo.saveWaiting);
  for (const label of ['日报时区', '选择模型']) assert.equal(await page.getByLabel(label).isDisabled(), true);
  assert.equal(await page.getByRole('checkbox', { name: 'DSH 对话', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('switch', { name: '启用对话整理', exact: true }).isDisabled(), true);
  await tab('Notion 同步');
  assert.equal(await page.getByLabel('更换连接 Token', { exact: true }).isDisabled(), true);
  await page.evaluate(() => demo.releaseSave());
  await savebar().waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => demo.config.timeZone), 'UTC');
  assert.equal(await page.evaluate(() => demo.calls.filter((c) => c.method === 'settings.update').at(-1).payload.patch.notionToken), undefined);
  done('pending saves freeze editable settings across categories and never resend an unchanged secret');

  await tab('来源与模型');
  await page.getByLabel('日报时区').fill('Europe/Paris');
  const oldRevision = await page.evaluate(() => demo.revision);
  await page.evaluate(() => { demo.config.timeZone = 'America/New_York'; demo.revision++; });
  await savebar().getByRole('button', { name: '保存设置', exact: true }).click();
  await page.getByRole('alert').getByRole('heading', { name: '设置已在其他窗口更新', exact: true }).waitFor();
  assert.equal(await page.getByLabel('日报时区').inputValue(), 'Europe/Paris');
  assert.equal(await page.evaluate(() => demo.config.timeZone), 'America/New_York');
  assert.equal(await page.evaluate(() => demo.calls.filter((c) => c.method === 'settings.update').at(-1).payload.revision), oldRevision);
  assert.equal(await savebar().getByRole('button', { name: '保存设置', exact: true }).isDisabled(), true);
  await shot('conflict');
  await page.getByRole('button', { name: '载入最新设置并放弃本次修改', exact: true }).click();
  await savebar().waitFor({ state: 'detached' });
  assert.equal(await page.getByLabel('日报时区').inputValue(), 'America/New_York');
  assert.equal(await page.getByRole('alert').count(), 0);
  await shot('general');
  done('revision conflicts preserve the local draft, block stale writes and require an explicit load of the latest baseline');

  await page.getByLabel('日报时区').fill('Asia/Tokyo');
  await savebar().waitFor();
  const beforeClose = await page.evaluate(() => demo.calls.filter((call) => call.method === 'settings.update').length);
  await page.evaluate(() => unloadPlugin());
  assert.equal(await page.locator('.cj').count(), 0);
  await page.evaluate(() => remountPlugin());
  await page.getByText('已恢复上次未保存的修改', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('日报时区').inputValue(), 'Asia/Tokyo');
  assert.equal(await page.evaluate(() => demo.calls.filter((call) => call.method === 'settings.update').length), beforeClose);
  await savebar().getByRole('button', { name: '放弃修改', exact: true }).click();
  assert.equal(await page.getByLabel('日报时区').inputValue(), 'America/New_York');
  done('closing and reopening the plugin restores the in-memory draft without saving it');

  await tab('自动整理');
  await page.getByRole('switch', { name: '每天自动整理', exact: true }).check();
  await page.getByLabel('每日开始时间').fill('22:10');
  await shot('schedule');
  await savebar().getByRole('button', { name: '放弃修改', exact: true }).click();
  await tab('隐私与高级'); await page.getByText('模型调用预算', { exact: true }).click();
  await shot('advanced');
  await tab('整理');
  await page.evaluate(() => { demo.delay = 60000; });
  await page.getByRole('button', { name: '开始整理', exact: true }).click();
  await page.getByRole('button', { name: '停止任务', exact: true }).waitFor();
  await shot('running');
  await tab('设置'); await tab('来源与模型');
  assert.equal(await page.getByLabel('日报时区').isDisabled(), true);
  await tab('整理'); await page.getByRole('button', { name: '停止任务', exact: true }).click();
  await page.getByRole('button', { name: '继续任务', exact: true }).waitFor();
  await page.getByRole('button', { name: '确认停止', exact: true }).click();
  await page.getByText('对话整理已停止', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => demo.job.state), 'cancelled');
  done('running tasks show progress, freeze settings and require a deliberate stop confirmation');

  await page.setViewportSize({ width: 400, height: 900 });
  await noOverflow(); await shot('mobile-work');
  await tab('设置');
  for (const section of ['来源与模型', '自动整理', 'Notion 同步', '隐私与高级']) { await tab(section); await noOverflow(); }
  await tab('Notion 同步'); await shot('mobile-notion');
  assert.equal(await page.locator('.cj-toggle').evaluate((toggle) => {
    const text = [...toggle.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    const range = document.createRange(); range.selectNodeContents(text);
    return new Set([...range.getClientRects()].filter((rect) => rect.width > 0).map((rect) => Math.round(rect.top))).size;
  }), 1, 'Switch labels must stay on one line at 400px');
  await tab('内容库');
  await page.waitForFunction(() => document.querySelectorAll('.cj-item').length === 20 && document.querySelector('.cj-library')?.getAttribute('aria-busy') === 'false');
  const mobileKnowledge = page.getByRole('button', { name: /^知识点 <img/ });
  if (await mobileKnowledge.getAttribute('aria-expanded') !== 'true') await mobileKnowledge.click();
  await page.locator('.cj-detail').waitFor(); await noOverflow(); await shot('mobile-library');
  await page.emulateMedia({ colorScheme: 'dark' });
  await shot('dark-mobile-library');
  await page.setViewportSize({ width: 1160, height: 1050 }); await tab('设置'); await tab('Notion 同步'); await shot('dark-notion');
  done('all settings categories and expanded content fit 400px; desktop and mobile dark-mode artifacts captured');

  await tab('整理');
  await page.getByRole('button', { name: '开始整理', exact: true }).click();
  await page.getByRole('button', { name: '停止任务', exact: true }).waitFor();
  const beforePolling = await page.evaluate(() => demo.calls.length);
  await page.waitForFunction((before) => demo.calls.length > before, beforePolling);
  await page.evaluate(() => unloadPlugin());
  assert.equal(await page.locator('.cj').count(), 0);
  const afterUnmount = await page.evaluate(() => demo.calls.length);
  await page.waitForTimeout(1700);
  assert.equal(await page.evaluate(() => demo.calls.length), afterUnmount);
  assert.equal(await page.evaluate(() => demo.stops), 2);
  assert.deepEqual(errors, []);
  done('unmount cancels active polling and removes the plugin UI without browser errors');
  await writeFile(`${root}/artifacts/browser-result.json`, JSON.stringify({ passed: true, scope: 'isolated settings shell; fake RPC; no live DSH, model, conversations or Notion', checks, screenshots, browserErrors: errors }, null, 2));
} catch (error) {
  const page = browser.contexts()[0]?.pages()[0];
  if (page) await page.screenshot({ path: `${root}/artifacts/settings-failure.png`, fullPage: true }).catch(() => {});
  await writeFile(`${root}/artifacts/browser-result.json`, JSON.stringify({ passed: false, scope: 'isolated fake RPC only', checks, screenshots, browserErrors: errors, failure: error.message }, null, 2));
  throw error;
} finally { await browser.close(); }

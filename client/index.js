import * as React from 'react';
import { normalizeDraft, configPatch, isDirty, validateDraft, errorGuide } from './settings-model.js';
export { isDirty, errorGuide } from './settings-model.js';

export const name = 'dsh-conversation-journal-client';
export const inject = ['connection', 'slots'];
export const TABS = [{ id: 'work', label: '整理' }, { id: 'library', label: '内容库' }, { id: 'settings', label: '设置' }];
export const NOTION_INTEGRATIONS_URL = 'https://www.notion.so/profile/integrations';
const h = React.createElement;
const PAGE_SIZE = 20;
// Drafts survive closing this settings section, only in this page's memory.
// Credentials are never written to localStorage/sessionStorage.
const drafts = new WeakMap();
function tabKeys(event) {
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
  if (!keys.includes(event.key)) return;
  const tabs = [...event.currentTarget.querySelectorAll('[role=tab]')];
  const current = tabs.indexOf(event.target); if (current < 0) return;
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1) + tabs.length) % tabs.length;
  event.preventDefault(); tabs[index]?.focus(); tabs[index]?.click();
}
const SECTIONS = [{ id: 'general', label: '来源与模型' }, { id: 'schedule', label: '自动整理' }, { id: 'notion', label: 'Notion 同步' }, { id: 'advanced', label: '隐私与高级' }];
const CSS = `
.cj{--cj-accent:var(--dsw-alias-state-business-primary,#4a63d8);--cj-text:var(--dsw-alias-label-primary,#22252c);--cj-muted:var(--dsw-alias-label-secondary,#69707d);--cj-border:var(--dsw-alias-border-l1,#e5e7eb);--cj-bg:var(--dsw-alias-bg-l1,#fff);--cj-soft:var(--dsw-alias-bg-l2,#f5f6f8);container-type:inline-size;container-name:journal;width:100%;max-width:920px;min-width:0;color:var(--cj-text);font-size:13px;line-height:1.6;display:grid;gap:20px}
.cj *{box-sizing:border-box}.cj h2,.cj h3,.cj h4,.cj p{margin:0}.cj h2{font-size:20px;font-weight:650;letter-spacing:-.4px}.cj h3{font-size:16px;font-weight:600}.cj h4{font-size:13px;font-weight:600}.cj a{color:var(--cj-accent);text-underline-offset:3px}.cj small,.cj-muted{font-size:12px;color:var(--cj-muted)}
.cj-header{display:flex;justify-content:space-between;gap:16px;align-items:center}.cj-header p{margin-top:3px}.cj-mark{display:grid;place-items:center;flex:none;width:42px;height:42px;border-radius:12px;background:var(--cj-soft);color:var(--cj-accent)}
.cj-stack{display:grid;gap:16px;min-width:0}.cj-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.cj-between{justify-content:space-between}.cj-grow{flex:1;min-width:0}.cj-panel{display:grid;gap:18px;min-width:0}.cj-title{display:grid;gap:4px}.cj-divider{border-top:1px solid var(--cj-border);padding-top:20px}
.cj button,.cj input,.cj select,.cj textarea{font:inherit;color:inherit}.cj button{border:1px solid var(--cj-border);background:var(--cj-bg);border-radius:8px;padding:7px 13px;cursor:pointer;line-height:1.5}.cj button:hover:not(:disabled){background:var(--cj-soft)}.cj button:disabled{opacity:.45;cursor:default}.cj button.primary{background:var(--cj-accent);border-color:var(--cj-accent);color:#fff}.cj button.primary:hover:not(:disabled){background:var(--cj-accent);filter:brightness(1.07)}.cj button.quiet{border-color:transparent;background:transparent;color:var(--cj-muted)}.cj button.danger{color:var(--dsw-alias-state-error-primary,#bd4141)}
.cj button:focus-visible,.cj input:focus-visible,.cj select:focus-visible,.cj textarea:focus-visible,.cj summary:focus-visible{outline:2px solid var(--cj-accent);outline-offset:3px}.cj input:not([type=checkbox]),.cj select,.cj textarea{border:1px solid var(--cj-border);border-radius:8px;background:var(--cj-bg);padding:8px 10px;width:100%;min-width:0}.cj input[type=checkbox]{width:16px;height:16px;margin:0;accent-color:var(--cj-accent);flex:none}.cj input[role=switch]{appearance:none;width:32px;height:18px;border:0;border-radius:12px;background:var(--cj-border);position:relative;cursor:pointer}.cj input[role=switch]::after{content:"";position:absolute;left:2px;top:2px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.15)}.cj input[role=switch]:checked{background:var(--cj-accent)}.cj input[role=switch]:checked::after{left:16px}.cj textarea{min-height:90px;resize:vertical}.cj label{min-width:0}.cj-field{display:grid;gap:6px;font-size:12px}.cj-field>span:first-child{font-weight:500}.cj-field [aria-invalid=true]{border-color:#bd4141}.cj-field-error{color:#bd4141;font-size:12px}.cj fieldset{border:0;padding:0;margin:0;min-width:0}.cj fieldset:disabled{opacity:.7}.cj-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.cj .cj-tabs{display:flex;gap:24px;border-bottom:1px solid var(--cj-border)}.cj .cj-tab{padding:0 1px 11px;border:0;border-bottom:2px solid transparent;border-radius:0;background:transparent;color:var(--cj-muted)}.cj .cj-tab[aria-selected=true]{color:var(--cj-text);border-bottom-color:var(--cj-text);font-weight:600}.cj .cj-tab:hover{background:transparent;color:var(--cj-text)}.cj-unsaved{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--cj-accent);margin-left:6px;vertical-align:middle}
.cj-card{border:1px solid var(--cj-border);border-radius:12px;padding:20px;display:grid;gap:16px;background:var(--cj-bg)}.cj-hero{padding:22px;background:var(--cj-soft);border:0}.cj-hero .cj-field{min-width:160px;flex:1}.cj-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.cj-meta{font-size:12px;color:var(--cj-muted);overflow-wrap:anywhere}.cj-badge{font-size:11px;border-radius:5px;background:var(--cj-soft);color:var(--cj-muted);padding:2px 6px;white-space:nowrap}.cj-badge.ok{color:var(--dsw-alias-state-success-primary,#247653);background:rgba(60,150,110,.1)}.cj-badge.warn{color:#98671f;background:rgba(180,130,40,.1)}.cj-badge.bad{color:#bd4141;background:rgba(190,60,60,.08)}
.cj-callout{display:flex;gap:14px;align-items:center;justify-content:space-between;border-left:3px solid var(--cj-accent);background:var(--cj-soft);padding:13px 16px;border-radius:0 8px 8px 0}.cj-callout>div{min-width:0}.cj-error{border-left-color:#bd4141}.cj-error pre{font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0 0}.cj-error details{margin-top:8px}.cj-status{display:flex;gap:8px;align-items:center}.cj-dot{width:7px;height:7px;border-radius:50%;background:var(--cj-muted);flex:none}.cj-dot.running{background:var(--cj-accent);animation:cj-pulse 1.4s ease-in-out infinite}.cj-dot.ok{background:#349268}.cj-dot.bad{background:#bd4141}@keyframes cj-pulse{50%{opacity:.3}}@media(prefers-reduced-motion:reduce){.cj-dot.running{animation:none}}
.cj-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.cj .cj-day{display:grid;justify-items:center;gap:4px;font-size:11px;padding:9px 3px;color:var(--cj-muted)}.cj .cj-day b{font-size:13px;color:var(--cj-text);font-weight:500}.cj .cj-day[aria-pressed=true]{border-color:var(--cj-accent);background:var(--cj-soft)}.cj-day span{font-size:10px}.cj-stages{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.cj-stage{border-top:3px solid var(--cj-border);padding-top:7px;font-size:12px;color:var(--cj-muted)}.cj-stage.active{border-color:var(--cj-accent);color:var(--cj-text)}.cj-stage.done{border-color:#349268}.cj-metrics{display:flex;gap:28px;flex-wrap:wrap}.cj-metrics div{display:grid;gap:1px}.cj-metrics b{font-size:21px;line-height:1.4;font-weight:600}.cj-metrics span{font-size:11px;color:var(--cj-muted)}
.cj-settings{display:grid;grid-template-columns:148px minmax(0,1fr);gap:26px}.cj .cj-settings-nav{display:flex;flex-direction:column;gap:4px;align-self:start;position:sticky;top:0}.cj .cj-settings-nav button{text-align:left;border-color:transparent;color:var(--cj-muted);padding:9px 12px;background:none}.cj .cj-settings-nav button[aria-selected=true]{background:var(--cj-soft);color:var(--cj-text);font-weight:600}.cj-setting-row{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:16px 0}.cj-setting-row:first-child{padding-top:0}.cj-setting-row:last-child{border-bottom:0;padding-bottom:0}.cj-setting-row p{max-width:440px;margin-top:4px}.cj-toggle{display:flex;flex:none;white-space:nowrap;gap:8px;align-items:center;cursor:pointer}.cj-source{display:flex;gap:12px;align-items:flex-start;border:1px solid var(--cj-border);border-radius:10px;padding:14px;cursor:pointer}.cj-source input{margin-top:3px!important}.cj-source:has(input:checked){border-color:var(--cj-accent)}.cj-source b{font-weight:500}.cj-source small{display:block;margin-top:2px}.cj-savebar{position:sticky;bottom:0;z-index:3;background:var(--cj-bg);border:1px solid var(--cj-border);border-radius:10px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:12px;box-shadow:0 -4px 18px rgba(0,0,0,.03)}
.cj-library-tools{display:flex;gap:10px}.cj-library-tools input{flex:1}.cj-library-tools select{width:auto;max-width:140px}.cj-library{display:grid;grid-template-columns:minmax(0,1fr);gap:18px}.cj-list{display:grid;gap:0;border:1px solid var(--cj-border);border-radius:10px;overflow:hidden}.cj .cj-item{display:grid;gap:5px;text-align:left;padding:14px 16px;border:0;border-bottom:1px solid var(--cj-border);border-radius:0;background:var(--cj-bg);white-space:normal;min-width:0}.cj .cj-item:last-child{border-bottom:0}.cj .cj-item[aria-expanded=true]{background:var(--cj-soft)}.cj-item .cj-row{gap:8px;flex-wrap:nowrap}.cj-item strong{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cj-item small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cj-detail{border:1px solid var(--cj-border);border-radius:12px;padding:20px;display:grid;gap:18px;min-width:0}.cj-body{font-size:13px;line-height:1.85;overflow-wrap:anywhere;display:grid;gap:12px}.cj-body p{white-space:pre-wrap}.cj-body h3{font-size:16px}.cj-body h4{font-size:14px}.cj-body pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:0;padding:12px;background:var(--cj-soft);border-radius:8px;font-size:12px}.cj-body ul,.cj-body ol{padding-left:20px;margin:0}.cj-ref{padding:8px 0;border-bottom:1px solid var(--cj-border);font-size:11px;overflow-wrap:anywhere}.cj-empty{display:grid;gap:8px;justify-items:center;text-align:center;padding:42px 20px;background:var(--cj-soft);border-radius:12px}.cj-pagination{display:flex;justify-content:space-between;align-items:center;gap:10px}.cj-notice{font-size:12px;color:var(--dsw-alias-state-success-primary,#247653)}
@media(min-width:780px){.cj-library.has-detail{grid-template-columns:minmax(200px,.8fr) minmax(0,1.2fr);align-items:start}.cj-library.has-detail .cj-detail{position:sticky;top:0}}@container journal (max-width:680px){.cj-settings{grid-template-columns:minmax(0,1fr);gap:20px}.cj .cj-settings-nav{flex-direction:row;position:static;gap:3px;overflow-x:auto;padding-bottom:4px}.cj .cj-settings-nav button{white-space:nowrap;padding:7px 10px;font-size:12px}.cj-library.has-detail{grid-template-columns:minmax(0,1fr)}.cj-library.has-detail .cj-detail{position:static;order:-1}}
@media(max-width:600px){.cj{gap:16px}.cj-settings{grid-template-columns:minmax(0,1fr);gap:20px}.cj .cj-settings-nav{flex-direction:row;overflow-x:auto;position:static;gap:2px;padding-bottom:5px}.cj .cj-settings-nav button{white-space:nowrap;padding:7px 10px;font-size:12px}.cj-grid{grid-template-columns:minmax(0,1fr)}.cj-card,.cj-detail{padding:16px}.cj-hero{padding:18px}.cj-callout,.cj-savebar{align-items:flex-start;flex-wrap:wrap}.cj-days{gap:4px}.cj .cj-day{padding:8px 1px}.cj-header{align-items:flex-start}.cj-header h2{font-size:18px}.cj-mark{width:36px;height:36px}.cj-stages{gap:4px}.cj-tabs{gap:20px!important}.cj-setting-row{gap:12px}.cj-library-tools{flex-wrap:wrap}.cj-library-tools input{flex-basis:100%}.cj-library-tools select{max-width:none;width:100%}}
`;

export async function rpc(connection, method, payload, signal) {
  signal?.throwIfAborted();
  const response = await connection.rpc.call('/api', 'dsh-conversation-journal', { method, payload: payload ?? {} }, signal);
  const result = response?.result ?? response;
  if (!result?.ok) { const e = new Error(result?.error?.message || '无法访问对话整理插件'); e.code = result?.error?.code; throw e; }
  return result.value;
}
export function safeNotionLink(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && (u.hostname === 'notion.so' || u.hostname === 'www.notion.so' || u.hostname.endsWith('.notion.site')) ? u.href : null; } catch { return null; }
}
export function compactPath(value = '') { const parts = String(value).replace(/\/+$/, '').split('/').filter(Boolean); return parts.slice(-2).join('/'); }
export function runDuration(job, now = Date.now()) {
  if (!job?.startedAt) return '';
  const seconds = Math.max(0, Math.round(((job.finishedAt ?? now) - job.startedAt) / 1000));
  return seconds < 60 ? `${seconds} 秒` : `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}
export function stageProgress(job) {
  const stage = String(job?.stage ?? ''); const match = stage.match(/整理对话\s*(\d+)\/(\d+)/);
  const step = /同步/.test(stage) ? 4 : /合并/.test(stage) ? 3 : match ? 2 : 1;
  return { step, label: match ? `正在分析第 ${match[1]} / ${match[2]} 批` : stage || '准备中' };
}
function jobName(job) { return job?.kind?.startsWith('notion-') ? ({ 'notion-test': '连接测试', 'notion-initialize': '数据库准备', 'notion-sync': 'Notion 同步' }[job.kind]) : '对话整理'; }
export function jobLine(job) {
  if (!job) return { text: '尚未整理', tone: 'idle', detail: '' };
  return { text: job.state === 'running' ? `${jobName(job)}进行中` : `${jobName(job)}${({ done: '已完成', cancelled: '已停止', error: '未完成' })[job.state] ?? ''}`, tone: job.state === 'running' ? 'running' : job.state === 'done' ? 'ok' : job.state === 'error' ? 'bad' : 'idle', detail: job.error || resultSummary(job.result) };
}
export function resultSummary(result) {
  if (!result) return '';
  if (result.note) return result.note;
  if (result.connected) return `已连接${result.title ? `「${result.title}」` : ''}`;
  if (result.initialized) return '日报与知识库已就绪';
  if (result.messages !== undefined) return `本地已整理 ${result.documents ?? 0} 份内容${result.sync ? ` · Notion 已同步 ${result.sync.synced} 份${result.sync.failed ? `，${result.sync.failed} 份待处理` : ''}` : ''}`;
  if (result.synced !== undefined) return `已同步 ${result.synced} 份${result.failed ? `，${result.failed} 份待处理` : ''}`;
  return '';
}
function dateOffset(day, delta) { const n = Date.parse(`${day}T00:00:00Z`); return Number.isFinite(n) ? new Date(n + delta * 86400000).toISOString().slice(0, 10) : day; }
function canonical(value) { return Array.isArray(value) ? value.map((v) => typeof v === 'string' ? v.trim() : v).filter(Boolean) : typeof value === 'string' ? value.trim() : value; }
function matchesPatch(config, patch) { return Object.entries(patch).every(([key, value]) => key === 'notionToken' ? config.notionTokenConfigured : JSON.stringify(canonical(config[key])) === JSON.stringify(canonical(value))); }
function Body({ text }) {
  const nodes = []; const lines = String(text ?? '').split('\n'); let paragraph = [], code = [], fence = false;
  const flush = () => { if (paragraph.length) { nodes.push(h('p', { key: nodes.length }, paragraph.join('\n'))); paragraph = []; } };
  for (const line of lines) {
    if (/^```/.test(line)) { flush(); if (fence) { nodes.push(h('pre', { key: nodes.length }, h('code', null, code.join('\n')))); code = []; } fence = !fence; continue; }
    if (fence) { code.push(line); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)/);
    if (heading) { flush(); nodes.push(h(heading[1].length < 3 ? 'h3' : 'h4', { key: nodes.length }, heading[2])); }
    else if (!line.trim()) flush(); else paragraph.push(line);
  }
  flush(); if (code.length) nodes.push(h('pre', { key: nodes.length }, code.join('\n')));
  return h('div', { className: 'cj-body' }, nodes);
}

export function JournalPanel({ connection }) {
  const [model, setModel] = React.useState(null), [form, setForm] = React.useState(null);
  const [tab, setTab] = React.useState('work'), [section, setSection] = React.useState('general');
  const [day, setDay] = React.useState(''), [mode, setMode] = React.useState('both');
  const [busy, setBusy] = React.useState(''), [error, setError] = React.useState(null), [notice, setNotice] = React.useState('');
  const [fields, setFields] = React.useState({}), [conflict, setConflict] = React.useState(false);
  const [providers, setProviders] = React.useState(null), [modelsError, setModelsError] = React.useState(''), [manualModel, setManualModel] = React.useState(false);
  const [days, setDays] = React.useState(null), [stats, setStats] = React.useState(null), [statsError, setStatsError] = React.useState('');
  const [documents, setDocuments] = React.useState([]), [query, setQuery] = React.useState(''), [kind, setKind] = React.useState(''), [offset, setOffset] = React.useState(0);
  const [searching, setSearching] = React.useState(false), [listError, setListError] = React.useState(null), [hasNext, setHasNext] = React.useState(false), [selected, setSelected] = React.useState(null);
  const [confirmStop, setConfirmStop] = React.useState(false), [clock, setClock] = React.useState(Date.now());
  const mounted = React.useRef(true), baseline = React.useRef(null), operation = React.useRef(false), selection = React.useRef(false), draftRef = React.useRef(null), readVersion = React.useRef(0);
  draftRef.current = form;
  const dirty = isDirty(baseline.current?.config, form);
  const running = model?.job?.state === 'running'; const locked = Boolean(busy) || running;
  const resetDraft = React.useCallback((value) => { baseline.current = { config: normalizeDraft(value.config), revision: value.revision }; setForm(normalizeDraft(value.config)); setFields({}); setConflict(false); }, []);
  const reload = React.useCallback(async (signal, reset = false) => {
    const version = ++readVersion.current;
    const value = await rpc(connection, 'settings.get', {}, signal);
    if (!mounted.current || signal?.aborted || version !== readVersion.current) return value;
    setModel(value);
    const cached = !baseline.current && drafts.get(connection);
    if (cached && !reset) {
      baseline.current = cached.baseline; setForm(cached.form); setTab('settings'); setSection(cached.section); setNotice('已恢复上次未保存的修改');
      if (value.revision !== cached.baseline.revision) { setConflict(true); const e = new Error('设置已在其他窗口更新，请载入最新设置后继续。'); e.code = 'journal/conflict'; setError(e); }
    } else if (!baseline.current || reset || !isDirty(baseline.current.config, draftRef.current)) resetDraft(value);
    else if (value.revision !== baseline.current.revision) { setConflict(true); const e = new Error('设置已在其他窗口更新，请载入最新设置后继续。'); e.code = 'journal/conflict'; setError(e); }
    if (!selection.current) setDay((d) => d || value.today);
    return value;
  }, [connection, resetDraft]);
  const loadExtras = React.useCallback(async (signal) => {
    const results = await Promise.allSettled([rpc(connection, 'days.summary', { days: 7 }, signal), rpc(connection, 'documents.summary', {}, signal)]);
    if (!mounted.current || signal?.aborted) return;
    if (results[0].status === 'fulfilled') setDays(results[0].value);
    if (results[1].status === 'fulfilled') { setStats(results[1].value); setStatsError(''); }
    else { setStats(null); setStatsError('内容统计暂时不可用，可稍后刷新重试。'); }
  }, [connection]);
  const loadModels = React.useCallback(async (signal) => {
    try { const value = await rpc(connection, 'models.list', {}, signal); if (mounted.current && !signal?.aborted) { setProviders(value?.providers ?? []); setModelsError(''); } }
    catch (e) { if (mounted.current && !signal?.aborted) { setProviders([]); setModelsError(e.message); } }
  }, [connection]);
  React.useEffect(() => {
    mounted.current = true; const c = new AbortController();
    reload(c.signal).catch((e) => { if (!c.signal.aborted) setError(e); });
    loadExtras(c.signal); loadModels(c.signal);
    return () => { mounted.current = false; c.abort(); };
  }, [reload, loadExtras, loadModels]);
  React.useEffect(() => {
    if (!running) return;
    const c = new AbortController(); let timer;
    const poll = async () => {
      try { const value = await reload(c.signal); if (c.signal.aborted) return; if (value.job?.state === 'running') timer = setTimeout(poll, 1200); }
      catch (e) { if (!c.signal.aborted) { setError(e); timer = setTimeout(poll, 3000); } }
    };
    timer = setTimeout(poll, 400); const tick = setInterval(() => setClock(Date.now()), 1000);
    return () => { c.abort(); clearTimeout(timer); clearInterval(tick); };
  }, [running, reload, loadExtras]);
  React.useEffect(() => {
    if (model) loadExtras();
  }, [model?.revision, model?.job?.finishedAt, loadExtras]);
  React.useEffect(() => {
    if (running) return;
    const c = new AbortController(); let timer;
    const refresh = async () => {
      if (document.visibilityState !== 'hidden' && !operation.current) {
        try { await reload(c.signal); }
        catch (e) { if (!c.signal.aborted) setError(e); }
      }
      if (!c.signal.aborted) timer = setTimeout(refresh, 15000);
    };
    const onFocus = () => { clearTimeout(timer); refresh(); };
    timer = setTimeout(refresh, 15000); window.addEventListener('focus', onFocus);
    return () => { c.abort(); clearTimeout(timer); window.removeEventListener('focus', onFocus); };
  }, [running, reload, loadExtras]);
  React.useEffect(() => {
    if (dirty && form && baseline.current) drafts.set(connection, { form, baseline: baseline.current, section });
    else if (form) drafts.delete(connection);
  }, [connection, form, dirty, section]);
  React.useEffect(() => {
    if (!dirty) return;
    const guard = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  React.useEffect(() => {
    if (tab !== 'library') return;
    const c = new AbortController(); setSearching(true); setListError(null);
    const timer = setTimeout(async () => {
      try { const rows = await rpc(connection, 'documents.list', { query: query.trim(), kind, offset, limit: PAGE_SIZE + 1 }, c.signal); if (!c.signal.aborted) { setDocuments(rows.slice(0, PAGE_SIZE)); setHasNext(rows.length > PAGE_SIZE); setSelected((previous) => previous ? rows.slice(0, PAGE_SIZE).find((d) => d.key === previous.key) ?? null : null); } }
      catch (e) { if (!c.signal.aborted) setListError(e); }
      finally { if (!c.signal.aborted) setSearching(false); }
    }, query ? 250 : 0);
    return () => { c.abort(); clearTimeout(timer); };
  }, [connection, tab, query, kind, offset, model?.job?.finishedAt, model?.revision]);

  const goSettings = (id = 'general') => { setSection(id); setTab('settings'); };
  const update = (key, value) => { setForm((f) => ({ ...f, [key]: value })); setFields((f) => ({ ...f, [key]: '' })); setNotice(''); };
  const revealErrors = (errors) => {
    setFields(errors); const key = Object.keys(errors)[0];
    goSettings(['notionToken', 'notionParent', 'notionEnabled'].includes(key) ? 'notion' : ['dailyTime'].includes(key) ? 'schedule' : ['codexHome', 'maxInputChars', 'maxOutputTokens', 'excludedProjects', 'excludedSessions'].includes(key) ? 'advanced' : 'general');
    setTimeout(() => document.querySelector('.cj [aria-invalid=true]')?.focus(), 0);
  };
  const persist = async () => {
    if (conflict) { const e = new Error('设置已在其他窗口更新，请载入最新设置后继续。'); e.code = 'journal/conflict'; throw e; }
    const errors = validateDraft(form); if (Object.keys(errors).length) { revealErrors(errors); throw new Error('请检查设置中标出的项目。'); }
    const patch = configPatch(baseline.current.config, form); if (!Object.keys(patch).length) return model;
    const previousRevision = baseline.current.revision;
    await rpc(connection, 'settings.update', { patch, revision: previousRevision });
    let value, lastError;
    for (let i = 0; i < 4; i++) {
      try { value = await rpc(connection, 'settings.get'); if (value.revision !== undefined && value.revision !== previousRevision && matchesPatch(value.config, patch)) break; value = null; }
      catch (e) { lastError = e; }
      if (i < 3) await new Promise((r) => setTimeout(r, 200 * (i + 1)));
    }
    if (!value) throw lastError || new Error('尚未确认设置已生效，请重新读取确认。');
    if (mounted.current) { setModel(value); resetDraft(value); setNotice('设置已保存'); }
    return value;
  };
  const perform = async (label, fn) => {
    if (operation.current) return;
    operation.current = true; ++readVersion.current; setBusy(label); setError(null); setNotice('');
    try { await fn(); }
    catch (e) { if (mounted.current) { setError(e); if (/conflict|revision|冲突|其他窗口/i.test(`${e.code ?? ''} ${e.message}`)) setConflict(true); } }
    finally { operation.current = false; if (mounted.current) { setBusy(''); setConfirmStop(false); } }
  };
  const runtimeAction = async (method) => {
    if (dirty) await persist();
    await rpc(connection, method); await reload(); await loadExtras();
  };
  const start = () => perform('generate', async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > model.today) throw new Error('请选择有效日期，日期不能晚于今天。');
    const value = dirty ? await persist() : model;
    if (!value.config.enabled || !value.config.provider || !value.config.model || !value.config.sources.length) { revealErrors(validateDraft({ ...form, enabled: true })); throw new Error(value.config.enabled ? '请先完成来源与模型设置。' : '对话整理已暂停，请先在设置中启用。'); }
    await rpc(connection, 'generate', { day, mode }); await reload();
  });
  const pickDay = (value) => { selection.current = true; setDay(value); };
  const field = (key, title, { type = 'text', hint, placeholder, ...props } = {}) => h('label', { className: 'cj-field', key }, h('span', null, title),
    h('input', { type, value: form[key] ?? '', placeholder, autoComplete: type === 'password' ? 'new-password' : 'off', 'aria-invalid': Boolean(fields[key]), 'aria-describedby': fields[key] ? `cj-error-${key}` : undefined, onChange: (e) => update(key, type === 'number' ? e.target.value === '' ? '' : Number(e.target.value) : e.target.value), ...props }),
    fields[key] && h('span', { className: 'cj-field-error', id: `cj-error-${key}` }, fields[key]), hint && h('small', null, hint));
  const switchRow = (key, title, hint) => h('div', { className: 'cj-setting-row', key }, h('div', null, h('h4', null, title), h('p', { className: 'cj-muted' }, hint)),
    h('label', { className: 'cj-toggle' }, h('input', { type: 'checkbox', role: 'switch', 'aria-label': title, checked: Boolean(form[key]), onChange: (e) => update(key, e.target.checked) }), form[key] ? '开启' : '关闭'));
  const badge = (text, tone = '') => h('span', { className: `cj-badge ${tone}` }, text);
  const renderError = (e, local = false) => {
    if (!e) return null; const guide = errorGuide(e);
    return h('div', { className: 'cj-callout cj-error', role: 'alert' }, h('div', { className: 'cj-grow' }, h('h4', null, guide.title), h('p', { className: 'cj-muted' }, guide.hint),
      h('details', null, h('summary', null, '错误详情'), h('pre', null, e.message || String(e)))),
      !local && conflict && h('button', { type: 'button', disabled: locked, onClick: () => perform('reload', async () => { await reload(undefined, true); setError(null); }) }, '载入最新设置并放弃本次修改'));
  };
  if (!model || !form) return h('section', { className: 'cj', 'aria-label': '对话整理' }, h('style', null, CSS), h('h2', null, '对话整理'), error ? renderError(error) : h('p', { role: 'status', className: 'cj-muted' }, '正在读取设置…'), error && h('button', { type: 'button', onClick: () => perform('reload', () => reload()) }, '重新加载'));

  const savedConfig = baseline.current.config;
  const today = model.today;
  const modelReady = Boolean(savedConfig.provider && savedConfig.model && savedConfig.sources.length);
  const initialized = Boolean(model.initialized?.daily && model.initialized?.knowledge);
  const notionChanged = Object.keys(configPatch(savedConfig, form)).some((k) => k.startsWith('notion'));
  const notionReady = initialized && !notionChanged;
  const line = jobLine(model.job);
  const generated = model.job?.kind === 'generate' ? model.job : model.lastGeneration;
  const dayList = days?.days?.slice(-7) ?? Array.from({ length: 7 }, (_, i) => ({ day: dateOffset(today, i - 6), messages: null }));
  const options = (providers ?? []).flatMap((p) => (p.models ?? []).map((m) => ({ provider: p.id, model: m.id, label: `${p.name ?? p.id} · ${m.name ?? m.id}` })));
  if (form.provider && form.model && !options.some((o) => o.provider === form.provider && o.model === form.model)) options.unshift({ provider: form.provider, model: form.model, label: `${form.provider} · ${form.model}（当前配置）` });
  const readySources = model.ready?.sources ?? [];
  const unavailable = savedConfig.sources.filter((s) => !readySources.includes(s));
  const sourceTitle = (s) => s === 'dsh' ? 'DSH' : 'Codex';

  const jobCard = (job) => {
    if (!job) return null; const status = jobLine(job), progress = stageProgress(job); const result = job.result;
    return h('div', { className: 'cj-card' }, h('div', { className: 'cj-row cj-between' }, h('div', { className: 'cj-status' }, h('span', { className: `cj-dot ${status.tone}` }), h('h4', { role: 'status' }, status.text)), h('small', null, runDuration(job, clock))),
      job.state === 'running' && h('div', { className: 'cj-stack', role: 'status' }, h('p', null, progress.label),
        job.kind === 'generate' && h('div', { className: 'cj-stages' }, ...['读取对话', '模型整理', '合并日报', '同步结果'].map((s, i) => h('div', { key: s, className: `cj-stage ${i + 1 === progress.step ? 'active' : i + 1 < progress.step ? 'done' : ''}` }, s)))),
      result?.messages !== undefined && h('div', { className: 'cj-metrics' }, ...[[result.messages, '条对话'], [result.documents ?? 0, '份本地内容'], [result.modelCalls ?? 0, '次模型调用']].map(([n, label]) => h('div', { key: label }, h('b', null, n), h('span', null, label)))),
      status.detail && h('p', { className: job.error ? 'cj-field-error' : 'cj-muted' }, status.detail),
      result?.sync && h('div', { className: 'cj-row' }, badge(`Notion 已同步 ${result.sync.synced} 份`, result.sync.failed ? 'warn' : 'ok'), result.sync.failed > 0 && h('button', { type: 'button', onClick: () => goSettings('notion') }, '处理同步问题')),
      job.warnings?.length > 0 && h('details', null, h('summary', null, `查看 ${job.warnings.length} 条采集提示`), job.warnings.map((w, i) => h('p', { key: i, className: 'cj-muted' }, w))),
      job.state === 'running' && h('div', { className: 'cj-actions' }, !confirmStop ? h('button', { type: 'button', className: 'danger', disabled: Boolean(busy), onClick: () => setConfirmStop(true) }, '停止任务') : h(React.Fragment, null,
        h('span', { className: 'cj-muted' }, '已完成的内容会保留。停止当前任务？'), h('button', { type: 'button', className: 'danger', disabled: Boolean(busy), onClick: () => perform('cancel', async () => { await rpc(connection, 'cancel'); await reload(); }) }, '确认停止'), h('button', { type: 'button', onClick: () => setConfirmStop(false) }, '继续任务'))),
      result?.documents > 0 && h('div', null, h('button', { type: 'button', onClick: () => { setQuery(result.day ?? ''); setOffset(0); setTab('library'); } }, '查看整理结果')));
  };
  const work = h('div', { className: 'cj-panel' },
    !modelReady && h('div', { className: 'cj-callout' }, h('div', null, h('h4', null, '先选好来源和总结模型'), h('p', { className: 'cj-muted' }, '配置一次，就能按天整理。Notion 可以稍后再连接。')), h('button', { type: 'button', className: 'primary', onClick: () => goSettings() }, '完成设置')),
    modelReady && !savedConfig.enabled && h('div', { className: 'cj-callout' }, h('div', null, h('h4', null, '对话整理已暂停'), h('p', { className: 'cj-muted' }, '已有内容保留，启用后可以继续整理。')), h('button', { type: 'button', onClick: () => goSettings() }, '管理设置')),
    h('div', { className: 'cj-card cj-hero' }, h('div', { className: 'cj-title' }, h('h3', null, '把一天的对话，留成可回查的记录'), h('p', { className: 'cj-muted' }, '日报记录当天推进；知识库保留可复用的结论与来源。')),
      h('div', { className: 'cj-row' }, h('label', { className: 'cj-field' }, h('span', null, '整理日期'), h('input', { type: 'date', value: day, max: today, disabled: locked, onChange: (e) => pickDay(e.target.value) })),
        h('label', { className: 'cj-field' }, h('span', null, '生成内容'), h('select', { value: mode, disabled: locked, onChange: (e) => setMode(e.target.value) }, h('option', { value: 'both' }, '日报与知识库'), h('option', { value: 'daily' }, '仅日报'), h('option', { value: 'knowledge' }, '仅知识库')))),
      h('div', { className: 'cj-row cj-between' }, h('div', { className: 'cj-meta' }, modelReady ? `${savedConfig.sources.map(sourceTitle).join('、')} · ${savedConfig.provider} / ${savedConfig.model}` : '配置总结模型后即可开始', h('br'), `日期按 ${savedConfig.timeZone} 计算 · ${savedConfig.notionEnabled ? '生成后同步到 Notion' : '结果保存在本机'}`),
        h('button', { type: 'button', className: 'primary', disabled: locked || !modelReady && !dirty || !savedConfig.enabled && !dirty, onClick: start }, busy === 'generate' ? '正在开始…' : dirty ? '保存并开始整理' : '开始整理')),
      modelReady && h('p', { className: 'cj-muted' }, '对话正文和必要的工具记录会发送给所选模型，消耗该模型额度。可在设置中排除敏感项目。')),
    unavailable.length > 0 && h('div', { className: 'cj-callout' }, h('div', null, h('h4', null, `${unavailable.map(sourceTitle).join('、')} 来源暂不可用`), h('p', { className: 'cj-muted' }, '请检查宿主服务和本机数据目录；也可以在设置中取消该来源。')), h('button', { type: 'button', onClick: () => goSettings(unavailable.includes('codex') ? 'advanced' : 'general') }, '检查来源')),
    h('div', { className: 'cj-stack' }, h('div', { className: 'cj-row cj-between' }, h('h4', null, '最近七天'), h('small', null, '选择日期后开始整理')),
      h('div', { className: 'cj-days' }, ...dayList.map((d) => h('button', { key: d.day, type: 'button', className: 'cj-day', 'aria-pressed': day === d.day, 'aria-label': `选择 ${d.day}`, disabled: locked, onClick: () => pickDay(d.day) }, h('b', null, d.day === today ? '今天' : d.day.slice(5).replace('-', '/')), h('span', null, !days?.scanned || d.messages == null ? '尚未采集' : `${d.messages} 条`)))), h('p', { className: 'cj-muted' }, '条数来自本地已采集记录；开始整理时会重新读取来源。')),
    running || model.job?.state === 'error' && !model.job?.kind ? jobCard(model.job) : generated ? jobCard(generated) : h('div', { className: 'cj-empty' }, h('h4', null, '第一份记录，从选好一天开始'), h('p', { className: 'cj-muted' }, '结果先保存在本机；之后可以查看正文、回查来源或导出 Markdown。')),
    h('div', { className: 'cj-row cj-between cj-divider' }, h('p', { className: 'cj-muted' }, savedConfig.autoDaily && savedConfig.enabled ? `每天 ${savedConfig.dailyTime} 自动整理 · ${savedConfig.timeZone}` : '当前由你手动开始整理'), h('button', { type: 'button', className: 'quiet', onClick: () => goSettings('schedule') }, '管理自动整理')));

  const general = h('div', { className: 'cj-stack' }, h('div', { className: 'cj-title' }, h('h3', null, '来源与模型'), h('p', { className: 'cj-muted' }, '决定读取哪些对话，以及交给哪个模型整理。')),
    switchRow('enabled', '启用对话整理', '关闭后停止后续手动与自动整理，已有内容仍可查看。'),
    h('div', { className: 'cj-stack cj-divider' }, h('h4', null, '对话来源'), h('div', { className: 'cj-grid' }, ...['dsh', 'codex'].map((s) => h('label', { className: 'cj-source', key: s }, h('input', { type: 'checkbox', checked: form.sources.includes(s), 'aria-label': `${sourceTitle(s)} 对话`, onChange: () => update('sources', form.sources.includes(s) ? form.sources.filter((x) => x !== s) : [...form.sources, s]) }), h('span', null, h('b', null, `${sourceTitle(s)} 对话`), h('small', null, s === 'dsh' ? '从当前宿主读取历史会话' : '从宿主电脑读取本地会话文件'))))), fields.sources && h('p', { className: 'cj-field-error', role: 'alert' }, fields.sources)),
    h('div', { className: 'cj-stack cj-divider' }, h('h4', null, '总结模型'), options.length && !manualModel ? h('label', { className: 'cj-field' }, h('span', null, '选择模型'), h('select', { value: form.provider && form.model ? JSON.stringify([form.provider, form.model]) : '', 'aria-invalid': Boolean(fields.model || fields.provider), onChange: (e) => { if (!e.target.value) return; const [provider, m] = JSON.parse(e.target.value); setForm((f) => ({ ...f, provider, model: m })); setFields((f) => ({ ...f, provider: '', model: '' })); } }, h('option', { value: '' }, '请选择已在 DSH 中配置的模型'), ...options.map((o) => h('option', { value: JSON.stringify([o.provider, o.model]), key: `${o.provider}/${o.model}` }, o.label))), (fields.model || fields.provider) && h('span', { className: 'cj-field-error' }, fields.provider || fields.model)) : h('div', { className: 'cj-grid' }, field('provider', '模型提供商', { placeholder: 'DSH 中已配置的提供商名称' }), field('model', '模型名称', { placeholder: '提供商支持的模型 ID' })),
      h('div', { className: 'cj-actions' }, h('button', { type: 'button', className: 'quiet', onClick: () => setManualModel((x) => !x), disabled: !manualModel && !options.length }, manualModel ? '从列表选择' : '手动填写'), h('button', { type: 'button', className: 'quiet', onClick: () => loadModels() }, '刷新模型列表')),
      h('p', { className: 'cj-muted' }, modelsError ? `模型列表暂时不可用，可手动填写。${modelsError}` : providers === null ? '正在读取 DSH 模型列表…' : !options.length ? '还没有可选模型，请先在 DSH 的模型设置中添加提供商。' : '使用 DSH 已配置的模型，不需要另填 API Key。')),
    h('div', { className: 'cj-divider' }, field('timeZone', '日报时区', { placeholder: 'Asia/Shanghai', hint: '用于划分一天的对话范围与自动整理时间。' })));
  const schedule = h('div', { className: 'cj-stack' }, h('div', { className: 'cj-title' }, h('h3', null, '自动整理'), h('p', { className: 'cj-muted' }, '让每天的对话按时沉淀，不必手动打开插件。')),
    switchRow('autoDaily', '每天自动整理', '按设定时间整理当天的日报与知识库。'), form.autoDaily && field('dailyTime', '每日开始时间', { type: 'time', hint: `使用 ${form.timeZone} 时区。` }),
    h('div', { className: 'cj-card' }, h('h4', null, '晚间对话也会补齐'), h('p', { className: 'cj-muted' }, '第二天会再次整理前一天，补入截止时间后的对话。宿主需要保持运行；离线恢复后补最近一天，更早的日期可手动整理。')),
    !form.enabled && h('p', { className: 'cj-field-error' }, '对话整理已暂停，启用后自动计划才会执行。'), h('button', { type: 'button', className: 'quiet', onClick: () => setSection('general') }, '修改时区与总结模型'));
  const notion = h('div', { className: 'cj-stack' }, h('div', { className: 'cj-row cj-between' }, h('div', { className: 'cj-title' }, h('h3', null, 'Notion 同步'), h('p', { className: 'cj-muted' }, '可选。把整理后的日报与知识同步到一个 Notion 页面。')), badge(notionChanged ? '待保存' : !savedConfig.notionEnabled ? '已关闭' : notionReady ? '已就绪' : '待连接', notionReady && savedConfig.notionEnabled ? 'ok' : '')),
    switchRow('notionEnabled', '同步到 Notion', '关闭后继续在本机生成和查看，已有 Notion 内容保留。'),
    (form.notionEnabled || form.notionTokenConfigured) && h(React.Fragment, null,
      h('div', { className: 'cj-stack' }, field('notionToken', form.notionTokenConfigured ? '更换连接 Token' : '连接 Token', { type: 'password', placeholder: form.notionTokenConfigured ? '已安全保存，留空保留' : '粘贴 Notion 内部连接 Token' }), field('notionParent', '目标父页面', { placeholder: '粘贴 Notion 页面链接或 ID', hint: '插件会在该页面内建立「对话日报」和「对话知识库」。' })),
      h('details', null, h('summary', null, '如何取得 Token 并授权页面'), h('div', { className: 'cj-stack', style: { marginTop: 12 } }, h('p', { className: 'cj-muted' }, '1. 创建 Notion 内部连接，复制 Token。'), h('a', { href: NOTION_INTEGRATIONS_URL, target: '_blank', rel: 'noopener noreferrer' }, '打开 Notion 连接管理 ↗'), h('p', { className: 'cj-muted' }, '2. 打开目标页面，通过右上角「连接」添加该连接，并授予读取、插入和更新内容权限。'))),
      h('div', { className: 'cj-actions' }, h('button', { type: 'button', className: 'primary', disabled: locked || !form.notionEnabled || conflict, onClick: () => perform('notion.initialize', () => runtimeAction('notion.initialize')) }, busy === 'notion.initialize' ? '正在准备…' : dirty ? '保存并连接 Notion' : notionReady ? '检查目标数据库' : '连接并准备数据库'), h('button', { type: 'button', disabled: locked || conflict, onClick: () => perform('notion.test', () => runtimeAction('notion.test')) }, busy === 'notion.test' ? '正在测试…' : dirty ? '保存并测试连接' : '测试连接')),
      h('p', { className: 'cj-muted' }, '同步正文与来源索引，完整原始对话保留在本机。自动整理区域由插件维护；人工编辑请放在「人工备注」。'),
      stats?.pending > 0 && h('div', { className: 'cj-callout' }, h('div', null, h('h4', null, `${stats.pending} 份内容尚未同步`), h('p', { className: 'cj-muted' }, stats.error ? `${stats.error} 份需要检查授权、网络或编辑冲突。` : '连接就绪后可以补传已有内容。')), h('button', { type: 'button', disabled: locked || !form.notionEnabled || conflict, onClick: () => perform('notion.sync', () => runtimeAction('notion.sync')) }, busy === 'notion.sync' ? '补传中…' : dirty ? '保存并补传' : '补传内容'))),
    !form.notionEnabled && !form.notionTokenConfigured && h('div', { className: 'cj-empty' }, h('h4', null, '本机整理已足够使用'), h('p', { className: 'cj-muted' }, '需要跨设备查看时，再开启 Notion 同步。')),
    );
  const advanced = h('div', { className: 'cj-stack' }, h('div', { className: 'cj-title' }, h('h3', null, '隐私与高级'), h('p', { className: 'cj-muted' }, '限制参与整理的内容，或调整单次模型调用的预算。')),
    form.sources.includes('codex') && field('codexHome', 'Codex 数据目录', { hint: '这是运行 DSH Host 的电脑上的目录。默认无需修改。', placeholder: '~/.codex' }),
    ...[['excludedProjects', '排除项目', '每行一个完整项目路径，包含其下所有会话。'], ['excludedSessions', '排除会话', '每行一个会话 ID。']].map(([key, title, hint]) => h('label', { className: 'cj-field', key }, h('span', null, title), h('textarea', { value: (form[key] ?? []).join('\n'), onChange: (e) => update(key, e.target.value.split('\n')) }), h('small', null, hint))),
    h('p', { className: 'cj-muted' }, '排除范围影响后续整理，已有本地记录和 Notion 内容会保留。常见凭据会先脱敏，业务敏感信息请通过排除范围控制。'),
    h('details', { className: 'cj-divider', open: fields.maxInputChars || fields.maxOutputTokens ? true : undefined }, h('summary', null, '模型调用预算'), h('div', { className: 'cj-stack', style: { marginTop: 16 } }, h('div', { className: 'cj-grid' }, field('maxInputChars', '每次输入字符上限', { type: 'number', min: 8000, max: 200000, step: 1000 }), field('maxOutputTokens', '每次输出 Token 上限', { type: 'number', min: 1000, max: 16000, step: 1000 })), h('p', { className: 'cj-muted' }, '长对话会分批调用，最多 40 批。单次预算不代表整个任务的费用上限；预算不足会停止，已生成的旧内容保留。'))));
  const settings = h('div', { className: 'cj-panel' }, running && h('p', { className: 'cj-muted', role: 'status' }, '任务进行中，结束后可修改设置。'), !model.editable && h('p', { className: 'cj-field-error' }, '宿主设置服务暂不可用，当前设置只读。'),
    h('div', { className: 'cj-settings' }, h('nav', { className: 'cj-settings-nav', 'aria-label': '设置分类', role: 'tablist', 'aria-orientation': 'vertical', onKeyDown: tabKeys }, ...SECTIONS.map((s) => h('button', { key: s.id, role: 'tab', id: `cj-setting-${s.id}`, 'aria-selected': section === s.id, tabIndex: section === s.id ? 0 : -1, 'aria-controls': 'cj-settings-body', type: 'button', onClick: () => setSection(s.id) }, s.label))),
      h('div', { className: 'cj-stack' }, h('fieldset', { id: 'cj-settings-body', role: 'tabpanel', 'aria-labelledby': `cj-setting-${section}`, disabled: locked || !model.editable }, { general, schedule, notion, advanced }[section]), section === 'notion' && model.job?.kind?.startsWith('notion-') && jobCard(model.job))));

  const exportDocument = (doc) => {
    const blob = new Blob([`# ${doc.title}\n\n${doc.body}\n\n## 来源\n${(doc.sources ?? []).map((s) => `- ${s.source} · ${s.sessionId}\n  ${s.reference ?? ''}`).join('\n')}\n`], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `${doc.title.replace(/[\\/:*?"<>|]/g, '_')}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const library = h('div', { className: 'cj-panel' }, h('div', { className: 'cj-library-tools' }, h('input', { type: 'search', 'aria-label': '搜索全部内容', placeholder: '搜索标题、正文、项目或日期', value: query, onChange: (e) => { setQuery(e.target.value); setOffset(0); setSelected(null); } }), h('select', { 'aria-label': '内容类型', value: kind, onChange: (e) => { setKind(e.target.value); setOffset(0); setSelected(null); } }, h('option', { value: '' }, '全部内容'), h('option', { value: 'daily' }, '日报'), h('option', { value: 'knowledge' }, '知识库'))),
    h('div', { className: 'cj-row cj-between' }, h('p', { className: 'cj-muted' }, stats ? `${stats.daily} 份日报 · ${stats.knowledge} 条知识${stats.pending ? ` · ${stats.pending} 份未同步` : ''}` : statsError || '正在读取内容统计…'), searching && h('small', { role: 'status' }, '搜索中…')),
    renderError(listError, true),
    !searching && !listError && !documents.length && h('div', { className: 'cj-empty' }, h('h4', null, query || kind ? '没有找到符合条件的内容' : '还没有整理记录'), h('p', { className: 'cj-muted' }, query || kind ? '试试更短的关键词，或切换内容类型。' : '选一天对话，生成你的第一份日报与知识。'), h('button', { type: 'button', onClick: () => { if (query || kind) { setQuery(''); setKind(''); setOffset(0); } else setTab('work'); } }, query || kind ? '清除筛选' : '去整理')),
    documents.length > 0 && !listError && h('div', { className: `cj-library ${selected ? 'has-detail' : ''}`, 'aria-busy': searching }, h('div', { className: 'cj-list' }, ...documents.map((d) => h('button', { key: d.key, type: 'button', className: 'cj-item', 'aria-expanded': selected?.key === d.key, disabled: searching, onClick: (event) => { const root = event.currentTarget.closest('.cj'); const closing = selected?.key === d.key; setSelected(closing ? null : d); if (!closing && root?.clientWidth <= 680) setTimeout(() => root.isConnected && root.querySelector('.cj-detail')?.scrollIntoView({ block: 'start', behavior: 'auto' }), 0); } }, h('div', { className: 'cj-row cj-between' }, h('strong', { className: 'cj-grow' }, d.kind === 'daily' ? `${d.date} 日报` : d.title), badge(d.status === 'synced' ? '已同步' : d.status === 'error' ? '待处理' : '本地', d.status === 'synced' ? 'ok' : d.status === 'error' ? 'bad' : '')), h('small', null, [d.kind === 'knowledge' && '知识', d.project && compactPath(d.project), d.date].filter(Boolean).join(' · '))))),
      selected && h('article', { className: 'cj-detail' }, h('div', { className: 'cj-row cj-between' }, h('h3', { className: 'cj-grow' }, selected.title), h('button', { type: 'button', className: 'quiet', onClick: () => setSelected(null) }, '收起')), h('div', { className: 'cj-actions' }, h('button', { type: 'button', onClick: () => exportDocument(selected) }, '导出 Markdown'), h('button', { type: 'button', onClick: async () => { try { await navigator.clipboard.writeText(selected.body); setNotice('正文已复制'); } catch { setNotice(''); setError(new Error('无法访问剪贴板，请导出 Markdown 后复制。')); } } }, '复制正文'), safeNotionLink(selected.link) && h('a', { href: safeNotionLink(selected.link), target: '_blank', rel: 'noopener noreferrer' }, '在 Notion 打开 ↗')), h(Body, { text: selected.body }),
        h('details', { className: 'cj-divider' }, h('summary', null, `来源引用（${selected.sources?.length ?? 0}）`), (selected.sources ?? []).map((s, i) => h('div', { className: 'cj-ref', key: s.id ?? i }, h('b', null, `${sourceTitle(s.source)} · ${s.sessionId}`), h('p', { className: 'cj-muted' }, s.reference))), h('p', { className: 'cj-muted' }, '内容由模型整理，请结合来源审阅。')))),
    (offset > 0 || hasNext) && h('div', { className: 'cj-pagination' }, h('button', { type: 'button', disabled: searching || offset === 0, onClick: () => { setOffset((o) => Math.max(0, o - PAGE_SIZE)); setSelected(null); } }, '上一页'), h('small', null, `第 ${Math.floor(offset / PAGE_SIZE) + 1} 页`), h('button', { type: 'button', disabled: searching || !hasNext, onClick: () => { setOffset((o) => o + PAGE_SIZE); setSelected(null); } }, '下一页')));

  return h('section', { className: 'cj', 'aria-label': '对话整理' }, h('style', null, CSS),
    h('header', { className: 'cj-header' }, h('div', null, h('h2', null, '对话整理'), h('p', { className: 'cj-muted' }, '按天整理对话，回看日报与知识。')), h('span', { className: 'cj-mark', 'aria-hidden': true }, h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }, h('path', { d: 'M5 3h11l3 3v15H5z M15 3v5h4 M8 12h8 M8 16h5' })))),
    h('nav', { className: 'cj-tabs', role: 'tablist', 'aria-label': '对话整理导航', onKeyDown: tabKeys }, ...TABS.map((t) => h('button', { type: 'button', role: 'tab', className: 'cj-tab', key: t.id, id: `cj-tab-${t.id}`, 'data-tab': t.id, 'aria-selected': tab === t.id, tabIndex: tab === t.id ? 0 : -1, 'aria-controls': 'cj-main', onClick: () => setTab(t.id) }, t.label, t.id === 'settings' && dirty && h('span', { className: 'cj-unsaved', 'aria-label': '有未保存修改' })))),
    h('div', { id: 'cj-main', role: 'tabpanel', 'aria-labelledby': `cj-tab-${tab}` }, { work, library, settings }[tab]),
    renderError(error), notice && h('p', { className: 'cj-notice', role: 'status' }, notice),
    dirty && h('div', { className: 'cj-savebar' }, h('div', null, h('h4', null, conflict ? '设置需要更新' : '有未保存的修改'), h('p', { className: 'cj-muted' }, running ? '任务结束后可以保存，当前任务使用开始时的设置。' : '切换页面会保留草稿，保存后生效。')), h('div', { className: 'cj-actions' }, h('button', { type: 'button', disabled: locked, onClick: () => { if (conflict) return perform('reload', async () => { await reload(undefined, true); setError(null); }); setForm(normalizeDraft(savedConfig)); setFields({}); setError(null); setNotice(''); } }, conflict ? '载入最新设置' : '放弃修改'), h('button', { type: 'button', className: 'primary', disabled: locked || !model.editable || conflict, onClick: () => perform('save', persist) }, busy === 'save' ? '保存中…' : '保存设置'))));
}

export function apply(ctx) {
  const Section = () => h(JournalPanel, { connection: ctx.connection });
  ctx.effect(() => {
    try { return ctx.slots.inject('settings.section', () => {
      try { return ctx.slots.register({ name: 'settings.section', id: 'dsh-conversation-journal', order: 34, label: () => '对话整理' }, Section); }
      catch { ctx.logger?.error?.('对话整理设置页注册失败'); return undefined; }
    }); } catch { ctx.logger?.error?.('对话整理设置页注册失败'); return undefined; }
  }, 'conversation-journal: settings');
}

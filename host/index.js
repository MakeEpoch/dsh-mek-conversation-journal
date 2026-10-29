import { homedir } from 'node:os';
import { join } from 'node:path';
import { Config } from './config.js';
import { JournalService } from './service.js';
import { expandHome, safeError } from './common.js';

export { Config };
export const name = 'dsh-conversation-journal';
export const inject = ['connection'];
export const ENDPOINT = 'dsh-conversation-journal';
export async function registerRpc(ctx, service) {
  const methods = {
    'settings.get': () => service.settings(),
    'settings.update': (p) => service.save(p.patch, p.revision),
    'documents.list': (p) => service.list(p.query, { limit: p.limit, offset: p.offset, kind: p.kind }),
    'documents.summary': () => service.documentSummary(),
    'days.summary': (p) => service.daySummary(Number.isInteger(p.days) && p.days >= 1 && p.days <= 60 ? p.days : 14),
    'generate': (p) => service.startGenerate(p.day, p.mode),
    'cancel': () => service.cancel(),
    'notion.test': () => service.notionAction('test'),
    'notion.initialize': () => service.notionAction('initialize'),
    'notion.sync': () => service.notionAction('sync'),
    // listProviders() carries only {id, name}; the model ids live behind listModels(provider).
    'models.list': async () => {
      const llm = ctx.get?.('llm');
      const providers = (llm?.listProviders?.() ?? []).map((provider) => ({ id: provider.id, name: provider.name ?? provider.id }));
      const models = await Promise.all(providers.map(async (provider) => {
        if (typeof llm?.listModels !== 'function') return { ...provider, models: [] };
        try {
          const found = await llm.listModels(provider.id);
          return { ...provider, models: (Array.isArray(found) ? found : []).map((m) => ({ id: m.id ?? String(m), name: m.name ?? m.id ?? String(m) })) };
        } catch { return { ...provider, models: [], error: true }; }
      }));
      return { providers: models };
    },
  };
  return ctx.connection.fetch.register({ path: `/api/${ENDPOINT}`, methods: ['POST'], requestBody: 'buffered',
    async fetch(request) {
      if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return new Response('JSON required', { status: 415 });
      const raw = await request.text(); if (raw.length > 32768) return new Response('Request too large', { status: 413 });
      let message; try { message = JSON.parse(raw); } catch { return new Response('Invalid JSON', { status: 400 }); }
      const id = message?.rpcId;
      const reply = (result) => Response.json({ type: 'server-response', rpcId: id, result });
      if (message.type !== 'client-request' || message.method !== ENDPOINT || typeof id !== 'string'
        || !Object.hasOwn(methods, message.payload?.method ?? '')) return reply({ ok: false, error: { code: 'journal/bad-request', message: '无效的操作', details: {} } });
      try { return reply({ ok: true, value: await methods[message.payload.method](message.payload.payload ?? {}) }); }
      catch (error) {
        // Keep a stable, non-secret code so the browser can offer a next step; the raw text stays for diagnostics.
        return reply({ ok: false, error: { code: `journal/${error?.code ?? 'error'}`, message: safeError(error), details: {} } });
      }
    },
  });
}
export function apply(ctx, config) {
  ctx.effect(() => {
    let service, stopRpc, disposed = false;
    const ready = Promise.resolve().then(async () => {
      const root = join(process.env.DSH_HOME?.trim() ? expandHome(process.env.DSH_HOME.trim()) : join(homedir(), '.dsh'), 'conversation-journal');
      service = new JournalService({ ctx, config, root });
      const stop = await registerRpc(ctx, service);
      if (disposed) { await stop?.(); return; }
      stopRpc = stop; service.startTimer();
    }).catch(async (error) => {
      try { await service?.dispose(); } catch { /* preserve host */ }
      service = null;
      ctx.logger?.error?.(`[conversation-journal] 初始化失败：${safeError(error)}`);
    });
    return async () => {
      disposed = true; await ready;
      try { await stopRpc?.(); } finally { await service?.dispose(); }
    };
  }, 'conversation-journal: host');
}

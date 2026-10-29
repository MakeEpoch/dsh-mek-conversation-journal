import { createReadStream } from 'node:fs';
import { readdir, stat, open } from 'node:fs/promises';
import { join } from 'node:path';
import { abort, expandHome, hash, normalRecord, textContent, yieldLoop } from './common.js';

/** Adapter contract: scan({store, config, signal, warn, day}) -> normalized records in store.
 * Future chat importers implement this contract, not the daily/knowledge generators.
 */
export class SourceRegistry {
  adapters = new Map();
  register(name, adapter) {
    if (this.adapters.has(name)) throw new Error(`重复来源：${name}`);
    this.adapters.set(name, adapter);
    return () => this.adapters.delete(name);
  }
  async scan(options) {
    for (const name of options.config.sources) {
      abort(options.signal);
      const adapter = this.adapters.get(name);
      if (!adapter) throw new Error(`来源未加载：${name}`);
      await adapter.scan(options);
    }
  }
}
async function* files(root, signal) {
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  for (const entry of entries) {
    abort(signal);
    const path = join(root, entry.name);
    if (entry.isDirectory()) yield* files(path, signal);
    else if (entry.isFile() && entry.name.endsWith('.jsonl')) yield path;
  }
}
export function codexRecord(event, meta, file, offset) {
  if (event.type !== 'response_item') return null;
  const p = event.payload ?? {};
  let role, text, id = p.id;
  if (p.type === 'message' && ['user', 'assistant'].includes(p.role)) {
    // Codex reasoning is also serialized as an assistant message. Only the
    // explicit user-visible channels and legacy messages without a channel are
    // conversation material; never infer visibility from the assistant role.
    if (p.channel != null && !['final', 'commentary'].includes(p.channel)) return null;
    role = p.role; text = textContent(p.content);
    // Injected environment/instructions are not human conversation.
    if (role === 'user' && /^\s*(?:<environment_context>|# AGENTS\.md instructions|<permissions instructions>)/.test(text)) return null;
  } else if (['function_call', 'custom_tool_call'].includes(p.type)) {
    role = 'tool-call'; id = `${p.call_id || p.id || offset}:call`;
    text = `${p.name ?? 'tool'}\n${typeof p.arguments === 'string' ? p.arguments : p.input ?? ''}`;
  } else if (['function_call_output', 'custom_tool_call_output'].includes(p.type)) {
    role = 'tool-result'; id = `${p.call_id || p.id || offset}:result`;
    text = typeof p.output === 'string' ? p.output : JSON.stringify(p.output ?? '');
  } else return null;
  return normalRecord({ source: 'codex', sessionId: meta.id, messageId: id,
    time: event.timestamp, role, text, project: meta.cwd ?? '', reference: `${file} (byte ${offset})`,
    metadata: { file, parent: meta.forked_from_id ?? meta.parent_thread_id ?? null,
      ...(p.type === 'message' ? { channel: p.channel ?? null } : {}) } });
}
export class CodexSource {
  async scan({ store, config, signal, warn }) {
    for (const folder of ['sessions', 'archived_sessions']) {
      const root = join(expandHome(config.codexHome), folder);
      try { await stat(root); } catch (e) { if (e.code === 'ENOENT') { warn(`Codex ${folder} 目录不存在`); continue; } throw e; }
      for await (const file of files(root, signal)) {
        const info = await stat(file); const key = `file:${file}:${hash([config.excludedSessions, config.excludedProjects])}`;
        let cursor = store.get(key, { offset: 0, meta: null });
        // Compare a bounded prefix as well as inode/size to catch replaced files.
        const fd = await open(file, 'r'); const prefix = Buffer.alloc(Math.min(info.size, 512));
        const checkpoint = Buffer.alloc(Math.min(cursor.offset, 512));
        try {
          await fd.read(prefix, 0, prefix.length, 0);
          if (checkpoint.length) await fd.read(checkpoint, 0, checkpoint.length, cursor.offset - checkpoint.length);
        } finally { await fd.close(); }
        const prefixHash = hash(prefix.toString('utf8'));
        const reset = cursor.offset > info.size || (cursor.ino && cursor.ino !== info.ino)
          || (cursor.tailHash && cursor.tailHash !== hash(checkpoint.toString('base64')))
          || (cursor.prefixHash && cursor.prefixBytes === prefix.length && cursor.prefixHash !== prefixHash);
        if (reset) {
          store.transaction(() => store.dropOrigin(`file:${file}`));
          cursor = { offset: 0, meta: null }; warn('Codex 日志发生替换或截断，已重新索引该文件');
        }
        if (cursor.offset === info.size) continue;
        let position = cursor.offset, pending = Buffer.alloc(0), oversized = false, batch = [], batchBytes = 0;
        let committedTail = reset ? Buffer.alloc(0) : checkpoint;
        const save = () => store.transaction(() => {
          store.putMessages(batch); batch = []; batchBytes = 0;
          store.set(key, { offset: position, meta: cursor.meta, ino: info.ino, prefixHash, prefixBytes: prefix.length, tailHash: hash(committedTail.toString('base64')) });
        });
        const stream = createReadStream(file, { start: cursor.offset, end: info.size - 1, highWaterMark: 65536, signal });
        for await (const chunk of stream) {
          abort(signal); pending = Buffer.concat([pending, chunk]);
          let newline;
          while ((newline = pending.indexOf(10)) >= 0) {
            const line = pending.subarray(0, newline); const start = position;
            position += newline + 1; pending = pending.subarray(newline + 1);
            committedTail = Buffer.concat([committedTail, line.subarray(-511), Buffer.from('\n')]).subarray(-512);
            if (oversized || line.length > 2_000_000) { oversized = false; warn('跳过超过 2MB 的 Codex 记录'); continue; }
            let event;
            try { event = JSON.parse(line.toString('utf8')); } catch { warn('跳过损坏的 Codex JSONL 行'); continue; }
            if (event.type === 'session_meta') cursor.meta = { ...event.payload, id: event.payload?.id ?? event.payload?.session_id };
            if (cursor.meta?.id) {
              // Only retain fields actually needed; never persist base instructions or account metadata.
              cursor.meta = Object.fromEntries(['id', 'cwd', 'forked_from_id', 'parent_thread_id'].map((k) => [k, cursor.meta[k]]));
              const excluded = config.excludedSessions.includes(cursor.meta.id) || config.excludedProjects.some((p) => cursor.meta.cwd === p || cursor.meta.cwd?.startsWith(p.replace(/\/$/, '') + '/'));
              const record = excluded ? null : codexRecord(event, cursor.meta, file, start);
              if (record) { batch.push(record); batchBytes += record.text.length; }
            }
            if (batch.length >= 100 || batchBytes >= 1_000_000) { save(); await yieldLoop(); }
          }
          if (pending.length > 2_000_000) { position += pending.length; committedTail = pending.subarray(-512); pending = Buffer.alloc(0); oversized = true; }
          await yieldLoop();
        }
        // An incomplete tail is deliberately retried next time, including oversized tails.
        if (oversized) { warn('Codex 存在超长未完成行，暂不提交扫描游标'); continue; }
        save();
      }
    }
  }
}
export function dshRecords(snapshot) {
  const id = snapshot.session.id, project = snapshot.session.cwd ?? '';
  const records = [];
  for (const event of snapshot.events.slice(snapshot.inheritedEventCount ?? 0)) {
    const data = event.data ?? {}; let text = '', role, messageId;
    if (event.type === 'user/message') {
      if (data.source?.kind !== 'user') continue;
      role = 'user'; text = textContent(data.content); messageId = data.id;
    } else if (event.type === 'assistant/message') {
      role = 'assistant'; text = textContent(data.message?.content); messageId = data.message?.id;
    } else if (event.type === 'tool/result') {
      role = 'tool-result'; text = textContent(data.message?.content); messageId = data.message?.id;
    } else if (event.type === 'tool/call') {
      role = 'tool-call'; text = `${data.name}\n${data.arguments ?? ''}`; messageId = `${id}:${data.callId}:call`;
    } else continue;
    // Compaction/recalled content must not be counted as new conversation.
    if (event.surfaceOp && event.surfaceOp !== 'append') continue;
    const record = normalRecord({ source: 'dsh', sessionId: id, messageId: messageId || `${id}:${event.seq}`,
      time: event.time, role, text, project, reference: `DSH ${id} · event ${event.seq}`,
      metadata: { parent: snapshot.session.parentSession ?? null, seq: event.seq } });
    if (record) records.push(record);
  }
  return records;
}
export class DshSource {
  constructor(query) { this.query = query; }
  async scan({ store, config, signal, warn }) {
    const query = this.query();
    if (!query) throw new Error('DSH sessionQuery 未启用；请启用宿主会话查询服务或取消 DSH 来源');
    const sessions = await query.listSessions(signal);
    for (const row of sessions) {
      abort(signal);
      if (config.excludedSessions.includes(row.header.id) || config.excludedProjects.some((p) => row.header.cwd === p || row.header.cwd?.startsWith(p.replace(/\/$/, '') + '/'))) continue;
      try {
        const events = await query.listEvents(row.header.id);
        const revision = hash(events.map((e) => [e.seq, e.type, e.time]));
        const key = `dsh:${row.header.id}`;
        if (store.get(key) === revision) continue;
        const snapshot = await query.readSession(row.header.id);
        abort(signal);
        store.transaction(() => { store.putMessages(dshRecords(snapshot)); store.set(key, revision); });
      } catch (e) {
        abort(signal); warn(`DSH 会话 ${row.header.id} 无法读取，本次覆盖不完整`);
      }
      await yieldLoop();
    }
  }
}

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync, openSync, closeSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { hash, normalize } from './common.js';

// Use the same content identity as the synchronizer. A receipt belongs to one
// destination, so a successful upload elsewhere cannot mark this target ready.
const contentHash = (value) => {
  const doc = JSON.parse(value);
  return hash({ ...doc, status: undefined, updatedAt: undefined });
};
const documentRows = `SELECT d.*, d.rowid AS row_id,
  CASE WHEN ? = '' THEN d.status
    WHEN d.status = 'synced' AND receipt.value = json_quote(journal_content_hash(d.value)) THEN 'synced'
    WHEN d.status = 'error' THEN 'error' ELSE 'pending' END AS visible_status,
  CASE WHEN d.kind = 'knowledge' THEN 'knowledge:' || journal_normalize(COALESCE(json_extract(d.value, '$.project'), '')) || '::' || journal_normalize(d.title)
    ELSE d.key END AS identity
  FROM documents d LEFT JOIN kv receipt ON receipt.key = ? || d.key`;

/** Small local index/outbox. Raw source logs are never written. One Host owns it. */
export class Storage {
  constructor(root) {
    mkdirSync(root, { recursive: true, mode: 0o700 });
    this.lock = join(root, 'journal.lock'); this.identity = `${process.pid}:${randomUUID()}`;
    try { this.takeLock(); } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const owner = readFileSync(this.lock, 'utf8').split(':')[0];
      if (!/^\d+$/.test(owner)) throw new Error('对话索引锁无效，请确认其他实例已停止后清理 journal.lock');
      try { process.kill(Number(owner), 0); throw new Error('另一个对话整理实例正在使用本地索引，请只启用一个实例'); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
      unlinkSync(this.lock); this.takeLock();
    }
    try {
    this.db = new DatabaseSync(join(root, 'journal.sqlite'));
    this.db.function('journal_normalize', { deterministic: true }, (value) => normalize(value));
    this.db.function('journal_content_hash', { deterministic: true }, contentHash);
    chmodSync(join(root, 'journal.sqlite'), 0o600);
    const version = this.db.prepare('PRAGMA user_version').get().user_version;
    if (version > 1) throw new Error('本地索引来自更新版本，停止打开以保留数据');
    this.db.exec(`PRAGMA journal_mode=DELETE; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, time INTEGER NOT NULL, source TEXT NOT NULL, session TEXT NOT NULL, project TEXT NOT NULL, value TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS messages_time ON messages(time);
      CREATE TABLE IF NOT EXISTS origins (message TEXT NOT NULL, origin TEXT NOT NULL, PRIMARY KEY(message,origin));
      CREATE TABLE IF NOT EXISTS documents (key TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, value TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending');
      PRAGMA user_version=1;`);
    } catch (e) { this.db?.close(); this.releaseLock(); throw e; }
  }
  takeLock() { const fd = openSync(this.lock, 'wx', 0o600); try { writeFileSync(fd, this.identity); } finally { closeSync(fd); } }
  releaseLock() { try { if (readFileSync(this.lock, 'utf8') === this.identity) unlinkSync(this.lock); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
  get(key, fallback = null) { const row = this.db.prepare('SELECT value FROM kv WHERE key=?').get(key); return row ? JSON.parse(row.value) : fallback; }
  set(key, value) { this.db.prepare('INSERT OR REPLACE INTO kv VALUES (?,?)').run(key, JSON.stringify(value)); }
  transaction(fn) { this.db.exec('BEGIN IMMEDIATE'); try { const result = fn(); this.db.exec('COMMIT'); return result; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
  putMessages(records) {
    const put = this.db.prepare('INSERT OR IGNORE INTO messages VALUES (?,?,?,?,?,?)');
    const origin = this.db.prepare('INSERT OR IGNORE INTO origins VALUES (?,?)');
    for (const r of records) if (r) {
      put.run(r.id, r.time, r.source, r.sessionId, r.project, JSON.stringify(r));
      origin.run(r.id, r.metadata?.file ? `file:${r.metadata.file}` : `${r.source}:${r.sessionId}`);
    }
  }
  dropOrigin(origin) {
    this.db.prepare('DELETE FROM origins WHERE origin=?').run(origin);
    this.db.exec('DELETE FROM messages WHERE id NOT IN (SELECT message FROM origins)');
  }
  messages(from, to) { return this.db.prepare('SELECT value FROM messages WHERE time>=? AND time<? ORDER BY time,id').iterate(from, to); }
  document(key) { const row = this.db.prepare('SELECT value,status FROM documents WHERE key=?').get(key); return row ? { ...JSON.parse(row.value), status: row.status } : null; }
  putDocument(doc, status = 'pending') { this.db.prepare('INSERT OR REPLACE INTO documents VALUES (?,?,?,?,?)').run(doc.key, doc.kind, doc.title, JSON.stringify(doc), status); }
  listDocuments(query = '', limit = 100, offset = 0, kind = '') {
    return this.db.prepare("SELECT value,status FROM documents WHERE (?='' OR kind=?) AND (instr(lower(title),lower(?))>0 OR instr(lower(value),lower(?))>0) ORDER BY rowid DESC LIMIT ? OFFSET ?")
      .all(kind, kind, query, query, limit, offset).map((r) => ({ ...JSON.parse(r.value), status: r.status }));
  }
  listDocumentGroups({ query = '', limit = 100, offset = 0, kind = '', scope = '' } = {}) {
    const rows = this.db.prepare(`WITH matched AS (${documentRows}
      WHERE (?='' OR d.kind=?) AND (instr(lower(d.title),lower(?))>0 OR instr(lower(d.value),lower(?))>0)),
      ranked AS (SELECT *, count(*) OVER (PARTITION BY identity) AS versions,
        row_number() OVER (PARTITION BY identity ORDER BY COALESCE(json_extract(value,'$.updatedAt'),0) DESC,row_id DESC) AS version_rank FROM matched)
      SELECT value,visible_status AS status,versions FROM ranked WHERE version_rank=1
      ORDER BY COALESCE(json_extract(value,'$.date'),'') DESC,title,key LIMIT ? OFFSET ?`)
      .all(scope, scope ? `synced:${scope}:` : '', kind, kind, query, query, limit, offset);
    return rows.map((r) => ({ ...JSON.parse(r.value), status: r.status, versions: r.versions }));
  }
  documentSummary(scope = '') {
    const row = this.db.prepare(`WITH scoped AS (${documentRows})
      SELECT count(DISTINCT identity) AS total,count(*) AS documents,
        count(*) FILTER (WHERE kind='daily') AS daily,
        count(DISTINCT identity) FILTER (WHERE kind='knowledge') AS knowledge,
        count(*) FILTER (WHERE kind='knowledge') AS rawKnowledge,
        count(*) FILTER (WHERE visible_status!='synced') AS pending,
        count(*) FILTER (WHERE visible_status='error') AS error FROM scoped`)
      .get(scope, scope ? `synced:${scope}:` : '');
    return { ...row };
  }
  pending() { return this.db.prepare("SELECT value FROM documents WHERE status!='synced' ORDER BY key").all().map((r) => JSON.parse(r.value)); }
  mark(key, status) { this.db.prepare('UPDATE documents SET status=? WHERE key=?').run(status, key); }
  close() { if (this.closed) return; this.closed = true; try { this.db.close(); } finally { this.releaseLock(); } }
}

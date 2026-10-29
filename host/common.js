import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

export const hash = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export const expandHome = (value) => resolve(value === '~' ? homedir() : value.startsWith('~/') ? homedir() + value.slice(1) : value);
export function dayAt(time, timeZone = 'Asia/Shanghai') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(time));
}
export function validDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) throw new Error('日期必须是有效的 YYYY-MM-DD');
  return day;
}
export function textContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter((x) => ['text', 'input_text', 'output_text'].includes(x?.type)).map((x) => x.text ?? '').join('\n');
}
// Best effort, never a claim of complete anonymization. Redact before disk/model/output.
export function redact(value) {
  return String(value ?? '')
    .replace(/-----BEGIN [\w ]*PRIVATE KEY-----[\s\S]*?-----END [\w ]*PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]')
    .replace(/\b(?:sk-|ntn_|secret_)[A-Za-z0-9_\-]{12,}/g, '[REDACTED TOKEN]')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi, '$1[REDACTED]')
    .replace(/((?:api[_-]?key|access[_-]?token|authorization|password|passwd|client[_-]?secret|database_url|dsn)\s*["']?\s*[:=]\s*)["']?[^\s"',;}]+/gi, '$1[REDACTED]')
    .replace(/((?:https?|postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/)[^\s/@:]+:[^\s/@]+@/g, '$1[REDACTED]@');
}
export function safeError(error) {
  return redact(error?.message ?? String(error)).slice(0, 600);
}
export function abort(signal) { signal?.throwIfAborted(); }
export const yieldLoop = () => new Promise((done) => setImmediate(done));
export function compactToolText(text) {
  if (text.length <= 8000) return text;
  const notable = text.split('\n').filter((line) => /error|fail|pass|exit[_ ]?code|session_id|成功|失败|报错|验证|未部署|未测试|\*\*\* (?:Add|Update|Delete) File:/i.test(line))
    .slice(0, 24).map((line) => line.slice(0, 250)).join('\n');
  return `${text.slice(0, 1000)}\n[工具记录已在本地压缩；这不是完整输出，不能据此认定未出现的问题。原始内容请查看来源。]\n${notable}\n[末尾]\n${text.slice(-1500)}`;
}
export function normalRecord({ source, sessionId, messageId, time, role, text, project = '', reference = '', metadata = {} }) {
  const timestamp = typeof time === 'number' ? time : Date.parse(time);
  if (!Number.isFinite(timestamp) || !String(text).trim()) return null;
  const clean = redact(text), body = role.startsWith('tool-') ? compactToolText(clean) : clean;
  return { id: hash([source, messageId || [sessionId, timestamp, role, clean]]), source, sessionId,
    messageId: String(messageId ?? ''), time: timestamp, role, text: body, project: redact(project), reference: redact(reference),
    metadata: { ...metadata, ...(body !== clean ? { locallyCompacted: true } : {}) } };
}

export const normalize = (value = '') => String(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
/** Stable, non-secret error code so the browser can show a next step instead of a raw message. */
export function errorCode(message) {
  const text = String(message ?? '');
  if (/SETTINGS_CONFLICT|revision|冲突/i.test(text)) return 'conflict';
  if (/maxOutputTokens|maxInputChars|Token\s*上限|输入字符预算|输出\s*Token/i.test(text)) return 'budget';
  if (/HTTP 401|HTTP 403|Token|授权/i.test(text)) return 'notion-auth';
  if (/HTTP 404|父页面/i.test(text)) return 'notion-page';
  if (/429|529|稍后重试/i.test(text)) return 'notion-rate';
  if (/sessionQuery|来源未加载/i.test(text)) return 'source';
  if (/模型|模型服务|provider/i.test(text)) return 'model';
  if (/预算|批次|超过/i.test(text)) return 'budget';
  if (/已有任务|等待当前任务/i.test(text)) return 'busy';
  if (/另一个对话整理实例|索引锁/i.test(text)) return 'lock';
  return 'error';
}
export function fail(message, extra = {}) {
  const error = new Error(message);
  error.code = errorCode(message);
  Object.assign(error, extra);
  return error;
}

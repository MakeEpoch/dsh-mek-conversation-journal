import z from '@deepseek-ai/schemastery';

export const defaults = Object.freeze({
  enabled: true, sources: ['dsh', 'codex'], codexHome: '~/.codex', timeZone: 'Asia/Shanghai',
  provider: '', model: '', excludedProjects: [], excludedSessions: [],
  autoDaily: false, dailyTime: '23:30', notionEnabled: false, notionToken: '', notionParent: '',
  maxInputChars: 60000, maxOutputTokens: 6000,
});
const field = (schema, description) => schema.description(description).role('volatile').extra('volatile', true);
export const Config = z.object({
  enabled: field(z.boolean().default(true), '启用对话整理'),
  sources: field(z.array(z.string()).default(['dsh', 'codex']), '读取来源：dsh、codex'),
  codexHome: field(z.string().default('~/.codex'), 'Codex 数据目录（Host 本机）'),
  timeZone: field(z.string().default('Asia/Shanghai'), '日报时区'),
  provider: field(z.string().default(''), 'DSH 已配置的模型提供商名称'),
  model: field(z.string().default(''), '总结模型名称'),
  excludedProjects: field(z.array(z.string()).default([]), '排除的项目路径前缀'),
  excludedSessions: field(z.array(z.string()).default([]), '排除的会话 ID'),
  autoDaily: field(z.boolean().default(false), '每天自动整理日报及知识'),
  dailyTime: field(z.string().default('23:30'), '每日生成时间，按日报时区 HH:mm'),
  notionEnabled: field(z.boolean().default(false), '同步生成结果到 Notion'),
  notionToken: z.string().default('').description('Notion 内部连接 Token，只写不回显；留空保留原值').role('secret').extra('volatile', true),
  notionParent: field(z.string().default(''), 'Notion 父页面链接或 ID'),
  maxInputChars: field(z.number().default(60000), '单次模型输入字符预算'),
  maxOutputTokens: field(z.number().default(6000), '单次模型输出 Token 上限'),
});
// SettingsForms needs both metadata flags at the secret node.
const serialize = Config.toJSON.bind(Config);
Object.defineProperty(Config, 'toJSON', { value() {
  const json = serialize(); const refs = json.refs ?? {}; const root = refs[json.uid];
  const node = refs[root?.dict?.notionToken];
  if (node) node.meta = { ...node.meta, role: 'secret', volatile: true };
  return json;
}, enumerable: false });
export function readConfig(raw = {}) {
  const value = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => {
    const entry = raw[key]; return [key, entry && typeof entry.get === 'function' ? entry.get() : entry ?? fallback];
  }));
  if (typeof value.enabled !== 'boolean' || typeof value.autoDaily !== 'boolean' || typeof value.notionEnabled !== 'boolean') throw new Error('开关必须为布尔值');
  for (const key of ['sources', 'excludedProjects', 'excludedSessions']) {
    if (!Array.isArray(value[key]) || value[key].some((x) => typeof x !== 'string')) throw new Error(`${key} 必须是字符串列表`);
    value[key] = [...new Set(value[key].map((x) => x.trim()).filter(Boolean))];
  }
  if (value.sources.some((x) => !['dsh', 'codex'].includes(x))) throw new Error('当前支持 dsh 和 codex 来源');
  for (const key of ['codexHome', 'timeZone', 'provider', 'model', 'dailyTime', 'notionToken', 'notionParent']) {
    if (typeof value[key] !== 'string' || value[key].length > 4096) throw new Error(`${key} 格式无效`);
    value[key] = value[key].trim();
  }
  new Intl.DateTimeFormat('en', { timeZone: value.timeZone });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.dailyTime)) throw new Error('每日时间必须为 HH:mm');
  for (const [key, min, max] of [['maxInputChars', 8000, 200000], ['maxOutputTokens', 1000, 16000]]) {
    if (!Number.isInteger(value[key]) || value[key] < min || value[key] > max) throw new Error(`${key} 必须在 ${min} 到 ${max} 之间`);
  }
  if (value.sources.includes('codex') && !value.codexHome) throw new Error('Codex 数据目录不能为空');
  return value;
}
export function publicConfig(raw) { const { notionToken, ...rest } = readConfig(raw); return { ...rest, notionTokenConfigured: Boolean(notionToken) }; }

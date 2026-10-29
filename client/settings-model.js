// Keep this module independent of React and host-only dependencies. The public
// configuration is a read model; only these fields may be sent back to Settings.
export const CONFIG_KEYS = Object.freeze([
  'enabled', 'sources', 'codexHome', 'timeZone', 'provider', 'model',
  'excludedProjects', 'excludedSessions', 'autoDaily', 'dailyTime',
  'notionEnabled', 'notionToken', 'notionParent', 'maxInputChars', 'maxOutputTokens',
]);
const DEFAULTS = Object.freeze({
  enabled: true, sources: Object.freeze(['dsh', 'codex']), codexHome: '~/.codex',
  timeZone: 'Asia/Shanghai', provider: '', model: '',
  excludedProjects: Object.freeze([]), excludedSessions: Object.freeze([]),
  autoDaily: false, dailyTime: '23:30', notionEnabled: false, notionToken: '',
  notionParent: '', maxInputChars: 60000, maxOutputTokens: 6000,
});
const LIST_KEYS = ['sources', 'excludedProjects', 'excludedSessions'];
const STRING_KEYS = ['codexHome', 'timeZone', 'provider', 'model', 'dailyTime', 'notionToken', 'notionParent'];
const LABELS = {
  enabled: '对话整理开关', autoDaily: '每日自动整理开关', notionEnabled: 'Notion 同步开关',
  sources: '对话来源', excludedProjects: '排除项目', excludedSessions: '排除会话',
  codexHome: 'Codex 数据目录', timeZone: '时区', provider: '模型提供商',
  model: '总结模型', dailyTime: '每日时间', notionToken: 'Notion Token', notionParent: 'Notion 父页面',
};

/** A fresh editable draft never contains a credential returned by another layer. */
export function normalizeDraft(config = {}) {
  const source = config && typeof config === 'object' ? config : {};
  const draft = Object.fromEntries(CONFIG_KEYS.map((key) => {
    const value = source[key] === undefined ? DEFAULTS[key] : source[key];
    return [key, Array.isArray(value) ? [...value] : value];
  }));
  draft.notionToken = '';
  draft.notionTokenConfigured = source.notionTokenConfigured === true;
  return draft;
}

function canonicalValue(key, value) {
  if (Array.isArray(value)) return [...new Set(value.map((entry) => typeof entry === 'string' ? entry.trim() : entry).filter((entry) => entry !== ''))];
  if (typeof value === 'string') {
    const clean = value.trim();
    if (['maxInputChars', 'maxOutputTokens'].includes(key) && clean !== '' && Number.isFinite(Number(clean))) return Number(clean);
    return clean;
  }
  return value;
}
function equal(a, b) {
  return Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((entry, index) => entry === b[index])
    : a === b;
}

/** Send only intentional changes. Empty credentials mean keep the saved token. */
export function configPatch(base, draft) {
  if (!base || !draft) return {};
  const previous = normalizeDraft(base);
  const patch = {};
  for (const key of CONFIG_KEYS) {
    if (!Object.hasOwn(draft, key)) continue;
    const value = canonicalValue(key, draft[key]);
    if (key === 'notionToken') {
      if (typeof value === 'string' && value) patch[key] = value;
    } else if (!equal(canonicalValue(key, previous[key]), value)) patch[key] = value;
  }
  return patch;
}
export function isDirty(base, draft) { return Object.keys(configPatch(base, draft)).length > 0; }
export const dirty = isDirty;

/** Accept a bare page UUID or a HTTPS page URL with a page UUID in its path. */
export function validNotionParent(value) {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  const uuid = '(?:[a-f\\d]{8}-[a-f\\d]{4}-[a-f\\d]{4}-[a-f\\d]{4}-[a-f\\d]{12}|[a-f\\d]{32})';
  if (new RegExp(`^${uuid}$`, 'i').test(text)) return true;
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return false;
    if (!['notion.so', 'www.notion.so', 'notion.site', 'www.notion.site'].includes(url.hostname) && !url.hostname.endsWith('.notion.site')) return false;
    return new RegExp(`(?:^|[/-])${uuid}/?$`, 'i').test(url.pathname);
  } catch { return false; }
}

/** Field errors stay beside their inputs; optional Notion setup stays optional. */
export function validateDraft(draft = {}) {
  const input = draft && typeof draft === 'object' ? draft : {};
  const value = Object.fromEntries(CONFIG_KEYS.map((key) => [key, input[key] === undefined ? DEFAULTS[key] : input[key]]));
  const errors = {};
  for (const key of ['enabled', 'autoDaily', 'notionEnabled']) {
    if (typeof value[key] !== 'boolean') errors[key] = `${LABELS[key]}必须为开或关`;
  }
  for (const key of LIST_KEYS) {
    if (!Array.isArray(value[key]) || value[key].some((entry) => typeof entry !== 'string')) errors[key] = `${LABELS[key]}必须是文本列表`;
  }
  if (!errors.sources) {
    const sources = canonicalValue('sources', value.sources);
    if (sources.some((source) => !['dsh', 'codex'].includes(source))) errors.sources = '请选择支持的对话来源：DSH、Codex';
    else if (value.enabled && !sources.length) errors.sources = '请至少选择一个对话来源';
  }
  for (const key of STRING_KEYS) {
    if (typeof value[key] !== 'string' || value[key].length > 4096) errors[key] = `${LABELS[key]}必须为不超过 4096 个字符的文本`;
    else value[key] = value[key].trim();
  }
  if (value.enabled) {
    if (!errors.provider && !value.provider) errors.provider = '请选择模型提供商';
    if (!errors.model && !value.model) errors.model = '请选择或填写总结模型';
  }
  if (!errors.codexHome && Array.isArray(value.sources) && value.sources.map((source) => typeof source === 'string' ? source.trim() : source).includes('codex') && !value.codexHome) errors.codexHome = '读取 Codex 对话时请填写数据目录';
  if (!errors.dailyTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.dailyTime)) errors.dailyTime = '请输入有效的每日时间，格式为 HH:mm';
  if (!errors.timeZone) {
    try {
      if (!value.timeZone) throw new Error();
      new Intl.DateTimeFormat('zh-CN', { timeZone: value.timeZone });
    } catch { errors.timeZone = '请输入有效时区，例如 Asia/Shanghai'; }
  }
  for (const [key, label, min, max] of [['maxInputChars', '单次输入字符预算', 8000, 200000], ['maxOutputTokens', '模型输出 Token 上限', 1000, 16000]]) {
    const number = canonicalValue(key, value[key]);
    if (!Number.isInteger(number) || number < min || number > max) errors[key] = `${label}必须为 ${min} 到 ${max} 之间的整数`;
  }
  if (value.notionEnabled) {
    if (!errors.notionToken && !value.notionToken && input.notionTokenConfigured !== true) errors.notionToken = '请填写 Notion 内部连接 Token';
    else if (!errors.notionToken && /\s/.test(value.notionToken)) errors.notionToken = 'Notion Token 中不能包含空格或换行';
    if (!errors.notionParent && !validNotionParent(value.notionParent)) errors.notionParent = '请输入有效的 Notion 父页面 ID 或 HTTPS 页面链接';
  }
  return errors;
}

const GUIDES = {
  conflict: { level: 'warn', title: '设置已在其他窗口更新', hint: '重新读取最新设置，核对后再保存；当前输入会保留到你选择重新读取。' },
  model: { level: 'danger', title: '模型这一步没有完成', hint: '在「设置」检查模型提供商、总结模型及其授权，再重新整理。' },
  budget: { level: 'warn', title: '内容或参数超出分析预算', hint: '在「设置」检查输入与输出预算；也可以减少来源或排除无关会话后重试。' },
  'notion-auth': { level: 'danger', title: 'Notion 授权失败', hint: '检查 Notion Token，并在目标父页面的连接菜单中授权这个内部连接。' },
  'notion-page': { level: 'danger', title: '无法访问 Notion 父页面', hint: '检查父页面链接和内部连接的页面权限，再测试连接。' },
  'notion-rate': { level: 'warn', title: 'Notion 暂时无法接收请求', hint: '稍后再测试连接或同步待上传的内容。' },
  source: { level: 'danger', title: '无法读取对话来源', hint: '在「设置」检查来源；DSH 需要宿主会话查询服务，Codex 需要可读取的数据目录。' },
  busy: { level: 'warn', title: '已有任务正在运行', hint: '等待当前任务结束，或先停止任务后再操作。' },
  lock: { level: 'danger', title: '本地索引正被其他实例使用', hint: '检查并只保留一个对话整理实例，再重新打开插件。' },
  'notion-conflict': { level: 'warn', title: 'Notion 内容需要核对', hint: '先在 Notion 检查已有内容和人工修改，处理冲突后再同步。' },
  error: { level: 'danger', title: '这一步没有完成', hint: '检查当前设置后重试，也可以在「内容库」查看已有结果。' },
};
/** Prefer stable RPC codes, and never echo credentials or server payloads. */
export function errorGuide(error = '', code) {
  const message = typeof error === 'string' ? error : typeof error?.message === 'string' ? error.message : '';
  const kind = String(code ?? error?.code ?? '').replace(/^journal\//, '').toLowerCase();
  let key;
  // Old hosts classified every occurrence of "Token" as Notion authorization.
  // Recognizable budget fields must stay actionable even with that old code.
  if (/maxInputChars|maxOutputTokens|输入.{0,6}预算|输出.{0,6}(?:预算|上限)|Token\s*上限/i.test(message)) key = 'budget';
  else if (kind === 'conflict' || /SETTINGS_CONFLICT|revision|设置.*(?:其他窗口|冲突)/i.test(message)) key = 'conflict';
  else if (Object.hasOwn(GUIDES, kind) && kind !== 'error') key = kind;
  else if (/模型|provider|未正常完成|JSON/i.test(message)) key = 'model';
  else if (/预算|批次|超过|过长|\d+\s*批/.test(message)) key = 'budget';
  else if (/sessionQuery|来源|Codex.*(?:目录|读取)|ENOENT|EACCES/i.test(message)) key = 'source';
  else if (/人工修改|停止覆盖|未确认的自动内容|重复的自动内容|记录身份/.test(message)) key = 'notion-conflict';
  else if (/HTTP\s*404|父页面/i.test(message)) key = 'notion-page';
  else if (/HTTP\s*(?:401|403)|Notion\s*Token|授权|权限/i.test(message)) key = 'notion-auth';
  else if (/429|529|稍后重试|限流/i.test(message)) key = 'notion-rate';
  else if (/已有任务|等待当前任务/.test(message)) key = 'busy';
  else if (/另一个对话整理实例|索引锁/.test(message)) key = 'lock';
  else key = 'error';
  return { ...GUIDES[key] };
}

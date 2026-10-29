// Generated DSH Client ModuleLoader bundle.
window.__ModuleLoader__.load({id:"@dsh/conversation-journal",factory:(require)=>{var module={exports:{}};var exports=module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client/index.js
var index_exports = {};
__export(index_exports, {
  JournalPanel: () => JournalPanel,
  NOTION_INTEGRATIONS_URL: () => NOTION_INTEGRATIONS_URL,
  TABS: () => TABS,
  apply: () => apply,
  compactPath: () => compactPath,
  errorGuide: () => errorGuide,
  inject: () => inject,
  isDirty: () => isDirty,
  jobLine: () => jobLine,
  name: () => name,
  resultSummary: () => resultSummary,
  rpc: () => rpc,
  runDuration: () => runDuration,
  safeNotionLink: () => safeNotionLink,
  stageProgress: () => stageProgress
});
module.exports = __toCommonJS(index_exports);
var React = __toESM(require("react"), 1);

// client/settings-model.js
var CONFIG_KEYS = Object.freeze([
  "enabled",
  "sources",
  "codexHome",
  "timeZone",
  "provider",
  "model",
  "excludedProjects",
  "excludedSessions",
  "autoDaily",
  "dailyTime",
  "notionEnabled",
  "notionToken",
  "notionParent",
  "maxInputChars",
  "maxOutputTokens"
]);
var DEFAULTS = Object.freeze({
  enabled: true,
  sources: Object.freeze(["dsh", "codex"]),
  codexHome: "~/.codex",
  timeZone: "Asia/Shanghai",
  provider: "",
  model: "",
  excludedProjects: Object.freeze([]),
  excludedSessions: Object.freeze([]),
  autoDaily: false,
  dailyTime: "23:30",
  notionEnabled: false,
  notionToken: "",
  notionParent: "",
  maxInputChars: 6e4,
  maxOutputTokens: 6e3
});
var LIST_KEYS = ["sources", "excludedProjects", "excludedSessions"];
var STRING_KEYS = ["codexHome", "timeZone", "provider", "model", "dailyTime", "notionToken", "notionParent"];
var LABELS = {
  enabled: "\u5BF9\u8BDD\u6574\u7406\u5F00\u5173",
  autoDaily: "\u6BCF\u65E5\u81EA\u52A8\u6574\u7406\u5F00\u5173",
  notionEnabled: "Notion \u540C\u6B65\u5F00\u5173",
  sources: "\u5BF9\u8BDD\u6765\u6E90",
  excludedProjects: "\u6392\u9664\u9879\u76EE",
  excludedSessions: "\u6392\u9664\u4F1A\u8BDD",
  codexHome: "Codex \u6570\u636E\u76EE\u5F55",
  timeZone: "\u65F6\u533A",
  provider: "\u6A21\u578B\u63D0\u4F9B\u5546",
  model: "\u603B\u7ED3\u6A21\u578B",
  dailyTime: "\u6BCF\u65E5\u65F6\u95F4",
  notionToken: "Notion Token",
  notionParent: "Notion \u7236\u9875\u9762"
};
function normalizeDraft(config = {}) {
  const source = config && typeof config === "object" ? config : {};
  const draft = Object.fromEntries(CONFIG_KEYS.map((key) => {
    const value = source[key] === void 0 ? DEFAULTS[key] : source[key];
    return [key, Array.isArray(value) ? [...value] : value];
  }));
  draft.notionToken = "";
  draft.notionTokenConfigured = source.notionTokenConfigured === true;
  return draft;
}
function canonicalValue(key, value) {
  if (Array.isArray(value)) return [...new Set(value.map((entry) => typeof entry === "string" ? entry.trim() : entry).filter((entry) => entry !== ""))];
  if (typeof value === "string") {
    const clean = value.trim();
    if (["maxInputChars", "maxOutputTokens"].includes(key) && clean !== "" && Number.isFinite(Number(clean))) return Number(clean);
    return clean;
  }
  return value;
}
function equal(a, b) {
  return Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((entry, index) => entry === b[index]) : a === b;
}
function configPatch(base, draft) {
  if (!base || !draft) return {};
  const previous = normalizeDraft(base);
  const patch = {};
  for (const key of CONFIG_KEYS) {
    if (!Object.hasOwn(draft, key)) continue;
    const value = canonicalValue(key, draft[key]);
    if (key === "notionToken") {
      if (typeof value === "string" && value) patch[key] = value;
    } else if (!equal(canonicalValue(key, previous[key]), value)) patch[key] = value;
  }
  return patch;
}
function isDirty(base, draft) {
  return Object.keys(configPatch(base, draft)).length > 0;
}
function validNotionParent(value) {
  if (typeof value !== "string") return false;
  const text = value.trim();
  const uuid = "(?:[a-f\\d]{8}-[a-f\\d]{4}-[a-f\\d]{4}-[a-f\\d]{4}-[a-f\\d]{12}|[a-f\\d]{32})";
  if (new RegExp(`^${uuid}$`, "i").test(text)) return true;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443") return false;
    if (!["notion.so", "www.notion.so", "notion.site", "www.notion.site"].includes(url.hostname) && !url.hostname.endsWith(".notion.site")) return false;
    return new RegExp(`(?:^|[/-])${uuid}/?$`, "i").test(url.pathname);
  } catch {
    return false;
  }
}
function validateDraft(draft = {}) {
  const input = draft && typeof draft === "object" ? draft : {};
  const value = Object.fromEntries(CONFIG_KEYS.map((key) => [key, input[key] === void 0 ? DEFAULTS[key] : input[key]]));
  const errors = {};
  for (const key of ["enabled", "autoDaily", "notionEnabled"]) {
    if (typeof value[key] !== "boolean") errors[key] = `${LABELS[key]}\u5FC5\u987B\u4E3A\u5F00\u6216\u5173`;
  }
  for (const key of LIST_KEYS) {
    if (!Array.isArray(value[key]) || value[key].some((entry) => typeof entry !== "string")) errors[key] = `${LABELS[key]}\u5FC5\u987B\u662F\u6587\u672C\u5217\u8868`;
  }
  if (!errors.sources) {
    const sources = canonicalValue("sources", value.sources);
    if (sources.some((source) => !["dsh", "codex"].includes(source))) errors.sources = "\u8BF7\u9009\u62E9\u652F\u6301\u7684\u5BF9\u8BDD\u6765\u6E90\uFF1ADSH\u3001Codex";
    else if (value.enabled && !sources.length) errors.sources = "\u8BF7\u81F3\u5C11\u9009\u62E9\u4E00\u4E2A\u5BF9\u8BDD\u6765\u6E90";
  }
  for (const key of STRING_KEYS) {
    if (typeof value[key] !== "string" || value[key].length > 4096) errors[key] = `${LABELS[key]}\u5FC5\u987B\u4E3A\u4E0D\u8D85\u8FC7 4096 \u4E2A\u5B57\u7B26\u7684\u6587\u672C`;
    else value[key] = value[key].trim();
  }
  if (value.enabled) {
    if (!errors.provider && !value.provider) errors.provider = "\u8BF7\u9009\u62E9\u6A21\u578B\u63D0\u4F9B\u5546";
    if (!errors.model && !value.model) errors.model = "\u8BF7\u9009\u62E9\u6216\u586B\u5199\u603B\u7ED3\u6A21\u578B";
  }
  if (!errors.codexHome && Array.isArray(value.sources) && value.sources.map((source) => typeof source === "string" ? source.trim() : source).includes("codex") && !value.codexHome) errors.codexHome = "\u8BFB\u53D6 Codex \u5BF9\u8BDD\u65F6\u8BF7\u586B\u5199\u6570\u636E\u76EE\u5F55";
  if (!errors.dailyTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.dailyTime)) errors.dailyTime = "\u8BF7\u8F93\u5165\u6709\u6548\u7684\u6BCF\u65E5\u65F6\u95F4\uFF0C\u683C\u5F0F\u4E3A HH:mm";
  if (!errors.timeZone) {
    try {
      if (!value.timeZone) throw new Error();
      new Intl.DateTimeFormat("zh-CN", { timeZone: value.timeZone });
    } catch {
      errors.timeZone = "\u8BF7\u8F93\u5165\u6709\u6548\u65F6\u533A\uFF0C\u4F8B\u5982 Asia/Shanghai";
    }
  }
  for (const [key, label, min, max] of [["maxInputChars", "\u5355\u6B21\u8F93\u5165\u5B57\u7B26\u9884\u7B97", 8e3, 2e5], ["maxOutputTokens", "\u6A21\u578B\u8F93\u51FA Token \u4E0A\u9650", 1e3, 16e3]]) {
    const number = canonicalValue(key, value[key]);
    if (!Number.isInteger(number) || number < min || number > max) errors[key] = `${label}\u5FC5\u987B\u4E3A ${min} \u5230 ${max} \u4E4B\u95F4\u7684\u6574\u6570`;
  }
  if (value.notionEnabled) {
    if (!errors.notionToken && !value.notionToken && input.notionTokenConfigured !== true) errors.notionToken = "\u8BF7\u586B\u5199 Notion \u5185\u90E8\u8FDE\u63A5 Token";
    else if (!errors.notionToken && /\s/.test(value.notionToken)) errors.notionToken = "Notion Token \u4E2D\u4E0D\u80FD\u5305\u542B\u7A7A\u683C\u6216\u6362\u884C";
    if (!errors.notionParent && !validNotionParent(value.notionParent)) errors.notionParent = "\u8BF7\u8F93\u5165\u6709\u6548\u7684 Notion \u7236\u9875\u9762 ID \u6216 HTTPS \u9875\u9762\u94FE\u63A5";
  }
  return errors;
}
var GUIDES = {
  conflict: { level: "warn", title: "\u8BBE\u7F6E\u5DF2\u5728\u5176\u4ED6\u7A97\u53E3\u66F4\u65B0", hint: "\u91CD\u65B0\u8BFB\u53D6\u6700\u65B0\u8BBE\u7F6E\uFF0C\u6838\u5BF9\u540E\u518D\u4FDD\u5B58\uFF1B\u5F53\u524D\u8F93\u5165\u4F1A\u4FDD\u7559\u5230\u4F60\u9009\u62E9\u91CD\u65B0\u8BFB\u53D6\u3002" },
  model: { level: "danger", title: "\u6A21\u578B\u8FD9\u4E00\u6B65\u6CA1\u6709\u5B8C\u6210", hint: "\u5728\u300C\u8BBE\u7F6E\u300D\u68C0\u67E5\u6A21\u578B\u63D0\u4F9B\u5546\u3001\u603B\u7ED3\u6A21\u578B\u53CA\u5176\u6388\u6743\uFF0C\u518D\u91CD\u65B0\u6574\u7406\u3002" },
  budget: { level: "warn", title: "\u5185\u5BB9\u6216\u53C2\u6570\u8D85\u51FA\u5206\u6790\u9884\u7B97", hint: "\u5728\u300C\u8BBE\u7F6E\u300D\u68C0\u67E5\u8F93\u5165\u4E0E\u8F93\u51FA\u9884\u7B97\uFF1B\u4E5F\u53EF\u4EE5\u51CF\u5C11\u6765\u6E90\u6216\u6392\u9664\u65E0\u5173\u4F1A\u8BDD\u540E\u91CD\u8BD5\u3002" },
  "notion-auth": { level: "danger", title: "Notion \u6388\u6743\u5931\u8D25", hint: "\u68C0\u67E5 Notion Token\uFF0C\u5E76\u5728\u76EE\u6807\u7236\u9875\u9762\u7684\u8FDE\u63A5\u83DC\u5355\u4E2D\u6388\u6743\u8FD9\u4E2A\u5185\u90E8\u8FDE\u63A5\u3002" },
  "notion-page": { level: "danger", title: "\u65E0\u6CD5\u8BBF\u95EE Notion \u7236\u9875\u9762", hint: "\u68C0\u67E5\u7236\u9875\u9762\u94FE\u63A5\u548C\u5185\u90E8\u8FDE\u63A5\u7684\u9875\u9762\u6743\u9650\uFF0C\u518D\u6D4B\u8BD5\u8FDE\u63A5\u3002" },
  "notion-rate": { level: "warn", title: "Notion \u6682\u65F6\u65E0\u6CD5\u63A5\u6536\u8BF7\u6C42", hint: "\u7A0D\u540E\u518D\u6D4B\u8BD5\u8FDE\u63A5\u6216\u540C\u6B65\u5F85\u4E0A\u4F20\u7684\u5185\u5BB9\u3002" },
  source: { level: "danger", title: "\u65E0\u6CD5\u8BFB\u53D6\u5BF9\u8BDD\u6765\u6E90", hint: "\u5728\u300C\u8BBE\u7F6E\u300D\u68C0\u67E5\u6765\u6E90\uFF1BDSH \u9700\u8981\u5BBF\u4E3B\u4F1A\u8BDD\u67E5\u8BE2\u670D\u52A1\uFF0CCodex \u9700\u8981\u53EF\u8BFB\u53D6\u7684\u6570\u636E\u76EE\u5F55\u3002" },
  busy: { level: "warn", title: "\u5DF2\u6709\u4EFB\u52A1\u6B63\u5728\u8FD0\u884C", hint: "\u7B49\u5F85\u5F53\u524D\u4EFB\u52A1\u7ED3\u675F\uFF0C\u6216\u5148\u505C\u6B62\u4EFB\u52A1\u540E\u518D\u64CD\u4F5C\u3002" },
  lock: { level: "danger", title: "\u672C\u5730\u7D22\u5F15\u6B63\u88AB\u5176\u4ED6\u5B9E\u4F8B\u4F7F\u7528", hint: "\u68C0\u67E5\u5E76\u53EA\u4FDD\u7559\u4E00\u4E2A\u5BF9\u8BDD\u6574\u7406\u5B9E\u4F8B\uFF0C\u518D\u91CD\u65B0\u6253\u5F00\u63D2\u4EF6\u3002" },
  "notion-conflict": { level: "warn", title: "Notion \u5185\u5BB9\u9700\u8981\u6838\u5BF9", hint: "\u5148\u5728 Notion \u68C0\u67E5\u5DF2\u6709\u5185\u5BB9\u548C\u4EBA\u5DE5\u4FEE\u6539\uFF0C\u5904\u7406\u51B2\u7A81\u540E\u518D\u540C\u6B65\u3002" },
  error: { level: "danger", title: "\u8FD9\u4E00\u6B65\u6CA1\u6709\u5B8C\u6210", hint: "\u68C0\u67E5\u5F53\u524D\u8BBE\u7F6E\u540E\u91CD\u8BD5\uFF0C\u4E5F\u53EF\u4EE5\u5728\u300C\u5185\u5BB9\u5E93\u300D\u67E5\u770B\u5DF2\u6709\u7ED3\u679C\u3002" }
};
function errorGuide(error = "", code) {
  const message = typeof error === "string" ? error : typeof error?.message === "string" ? error.message : "";
  const kind = String(code ?? error?.code ?? "").replace(/^journal\//, "").toLowerCase();
  let key;
  if (/maxInputChars|maxOutputTokens|输入.{0,6}预算|输出.{0,6}(?:预算|上限)|Token\s*上限/i.test(message)) key = "budget";
  else if (kind === "conflict" || /SETTINGS_CONFLICT|revision|设置.*(?:其他窗口|冲突)/i.test(message)) key = "conflict";
  else if (Object.hasOwn(GUIDES, kind) && kind !== "error") key = kind;
  else if (/模型|provider|未正常完成|JSON/i.test(message)) key = "model";
  else if (/预算|批次|超过|过长|\d+\s*批/.test(message)) key = "budget";
  else if (/sessionQuery|来源|Codex.*(?:目录|读取)|ENOENT|EACCES/i.test(message)) key = "source";
  else if (/人工修改|停止覆盖|未确认的自动内容|重复的自动内容|记录身份/.test(message)) key = "notion-conflict";
  else if (/HTTP\s*404|父页面/i.test(message)) key = "notion-page";
  else if (/HTTP\s*(?:401|403)|Notion\s*Token|授权|权限/i.test(message)) key = "notion-auth";
  else if (/429|529|稍后重试|限流/i.test(message)) key = "notion-rate";
  else if (/已有任务|等待当前任务/.test(message)) key = "busy";
  else if (/另一个对话整理实例|索引锁/.test(message)) key = "lock";
  else key = "error";
  return { ...GUIDES[key] };
}

// client/index.js
var name = "dsh-conversation-journal-client";
var inject = ["connection", "slots"];
var TABS = [{ id: "work", label: "\u6574\u7406" }, { id: "library", label: "\u5185\u5BB9\u5E93" }, { id: "settings", label: "\u8BBE\u7F6E" }];
var NOTION_INTEGRATIONS_URL = "https://www.notion.so/profile/integrations";
var h = React.createElement;
var PAGE_SIZE = 20;
var drafts = /* @__PURE__ */ new WeakMap();
function tabKeys(event) {
  const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
  if (!keys.includes(event.key)) return;
  const tabs = [...event.currentTarget.querySelectorAll("[role=tab]")];
  const current = tabs.indexOf(event.target);
  if (current < 0) return;
  const index = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1) + tabs.length) % tabs.length;
  event.preventDefault();
  tabs[index]?.focus();
  tabs[index]?.click();
}
var SECTIONS = [{ id: "general", label: "\u6765\u6E90\u4E0E\u6A21\u578B" }, { id: "schedule", label: "\u81EA\u52A8\u6574\u7406" }, { id: "notion", label: "Notion \u540C\u6B65" }, { id: "advanced", label: "\u9690\u79C1\u4E0E\u9AD8\u7EA7" }];
var CSS = `
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
async function rpc(connection, method, payload, signal) {
  signal?.throwIfAborted();
  const response = await connection.rpc.call("/api", "dsh-conversation-journal", { method, payload: payload ?? {} }, signal);
  const result = response?.result ?? response;
  if (!result?.ok) {
    const e = new Error(result?.error?.message || "\u65E0\u6CD5\u8BBF\u95EE\u5BF9\u8BDD\u6574\u7406\u63D2\u4EF6");
    e.code = result?.error?.code;
    throw e;
  }
  return result.value;
}
function safeNotionLink(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && (u.hostname === "notion.so" || u.hostname === "www.notion.so" || u.hostname.endsWith(".notion.site")) ? u.href : null;
  } catch {
    return null;
  }
}
function compactPath(value = "") {
  const parts = String(value).replace(/\/+$/, "").split("/").filter(Boolean);
  return parts.slice(-2).join("/");
}
function runDuration(job, now = Date.now()) {
  if (!job?.startedAt) return "";
  const seconds = Math.max(0, Math.round(((job.finishedAt ?? now) - job.startedAt) / 1e3));
  return seconds < 60 ? `${seconds} \u79D2` : `${Math.floor(seconds / 60)} \u5206 ${seconds % 60} \u79D2`;
}
function stageProgress(job) {
  const stage = String(job?.stage ?? "");
  const match = stage.match(/整理对话\s*(\d+)\/(\d+)/);
  const step = /同步/.test(stage) ? 4 : /合并/.test(stage) ? 3 : match ? 2 : 1;
  return { step, label: match ? `\u6B63\u5728\u5206\u6790\u7B2C ${match[1]} / ${match[2]} \u6279` : stage || "\u51C6\u5907\u4E2D" };
}
function jobName(job) {
  return job?.kind?.startsWith("notion-") ? { "notion-test": "\u8FDE\u63A5\u6D4B\u8BD5", "notion-initialize": "\u6570\u636E\u5E93\u51C6\u5907", "notion-sync": "Notion \u540C\u6B65" }[job.kind] : "\u5BF9\u8BDD\u6574\u7406";
}
function jobLine(job) {
  if (!job) return { text: "\u5C1A\u672A\u6574\u7406", tone: "idle", detail: "" };
  return { text: job.state === "running" ? `${jobName(job)}\u8FDB\u884C\u4E2D` : `${jobName(job)}${{ done: "\u5DF2\u5B8C\u6210", cancelled: "\u5DF2\u505C\u6B62", error: "\u672A\u5B8C\u6210" }[job.state] ?? ""}`, tone: job.state === "running" ? "running" : job.state === "done" ? "ok" : job.state === "error" ? "bad" : "idle", detail: job.error || resultSummary(job.result) };
}
function resultSummary(result) {
  if (!result) return "";
  if (result.note) return result.note;
  if (result.connected) return `\u5DF2\u8FDE\u63A5${result.title ? `\u300C${result.title}\u300D` : ""}`;
  if (result.initialized) return "\u65E5\u62A5\u4E0E\u77E5\u8BC6\u5E93\u5DF2\u5C31\u7EEA";
  if (result.messages !== void 0) return `\u672C\u5730\u5DF2\u6574\u7406 ${result.documents ?? 0} \u4EFD\u5185\u5BB9${result.sync ? ` \xB7 Notion \u5DF2\u540C\u6B65 ${result.sync.synced} \u4EFD${result.sync.failed ? `\uFF0C${result.sync.failed} \u4EFD\u5F85\u5904\u7406` : ""}` : ""}`;
  if (result.synced !== void 0) return `\u5DF2\u540C\u6B65 ${result.synced} \u4EFD${result.failed ? `\uFF0C${result.failed} \u4EFD\u5F85\u5904\u7406` : ""}`;
  return "";
}
function dateOffset(day, delta) {
  const n = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(n) ? new Date(n + delta * 864e5).toISOString().slice(0, 10) : day;
}
function canonical(value) {
  return Array.isArray(value) ? value.map((v) => typeof v === "string" ? v.trim() : v).filter(Boolean) : typeof value === "string" ? value.trim() : value;
}
function matchesPatch(config, patch) {
  return Object.entries(patch).every(([key, value]) => key === "notionToken" ? config.notionTokenConfigured : JSON.stringify(canonical(config[key])) === JSON.stringify(canonical(value)));
}
function Body({ text }) {
  const nodes = [];
  const lines = String(text ?? "").split("\n");
  let paragraph = [], code = [], fence = false;
  const flush = () => {
    if (paragraph.length) {
      nodes.push(h("p", { key: nodes.length }, paragraph.join("\n")));
      paragraph = [];
    }
  };
  for (const line of lines) {
    if (/^```/.test(line)) {
      flush();
      if (fence) {
        nodes.push(h("pre", { key: nodes.length }, h("code", null, code.join("\n"))));
        code = [];
      }
      fence = !fence;
      continue;
    }
    if (fence) {
      code.push(line);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)/);
    if (heading) {
      flush();
      nodes.push(h(heading[1].length < 3 ? "h3" : "h4", { key: nodes.length }, heading[2]));
    } else if (!line.trim()) flush();
    else paragraph.push(line);
  }
  flush();
  if (code.length) nodes.push(h("pre", { key: nodes.length }, code.join("\n")));
  return h("div", { className: "cj-body" }, nodes);
}
function JournalPanel({ connection }) {
  const [model, setModel] = React.useState(null), [form, setForm] = React.useState(null);
  const [tab, setTab] = React.useState("work"), [section, setSection] = React.useState("general");
  const [day, setDay] = React.useState(""), [mode, setMode] = React.useState("both");
  const [busy, setBusy] = React.useState(""), [error, setError] = React.useState(null), [notice, setNotice] = React.useState("");
  const [fields, setFields] = React.useState({}), [conflict, setConflict] = React.useState(false);
  const [providers, setProviders] = React.useState(null), [modelsError, setModelsError] = React.useState(""), [manualModel, setManualModel] = React.useState(false);
  const [days, setDays] = React.useState(null), [stats, setStats] = React.useState(null), [statsError, setStatsError] = React.useState("");
  const [documents, setDocuments] = React.useState([]), [query, setQuery] = React.useState(""), [kind, setKind] = React.useState(""), [offset, setOffset] = React.useState(0);
  const [searching, setSearching] = React.useState(false), [listError, setListError] = React.useState(null), [hasNext, setHasNext] = React.useState(false), [selected, setSelected] = React.useState(null);
  const [confirmStop, setConfirmStop] = React.useState(false), [clock, setClock] = React.useState(Date.now());
  const mounted = React.useRef(true), baseline = React.useRef(null), operation = React.useRef(false), selection = React.useRef(false), draftRef = React.useRef(null), readVersion = React.useRef(0);
  draftRef.current = form;
  const dirty = isDirty(baseline.current?.config, form);
  const running = model?.job?.state === "running";
  const locked = Boolean(busy) || running;
  const resetDraft = React.useCallback((value) => {
    baseline.current = { config: normalizeDraft(value.config), revision: value.revision };
    setForm(normalizeDraft(value.config));
    setFields({});
    setConflict(false);
  }, []);
  const reload = React.useCallback(async (signal, reset = false) => {
    const version = ++readVersion.current;
    const value = await rpc(connection, "settings.get", {}, signal);
    if (!mounted.current || signal?.aborted || version !== readVersion.current) return value;
    setModel(value);
    const cached = !baseline.current && drafts.get(connection);
    if (cached && !reset) {
      baseline.current = cached.baseline;
      setForm(cached.form);
      setTab("settings");
      setSection(cached.section);
      setNotice("\u5DF2\u6062\u590D\u4E0A\u6B21\u672A\u4FDD\u5B58\u7684\u4FEE\u6539");
      if (value.revision !== cached.baseline.revision) {
        setConflict(true);
        const e = new Error("\u8BBE\u7F6E\u5DF2\u5728\u5176\u4ED6\u7A97\u53E3\u66F4\u65B0\uFF0C\u8BF7\u8F7D\u5165\u6700\u65B0\u8BBE\u7F6E\u540E\u7EE7\u7EED\u3002");
        e.code = "journal/conflict";
        setError(e);
      }
    } else if (!baseline.current || reset || !isDirty(baseline.current.config, draftRef.current)) resetDraft(value);
    else if (value.revision !== baseline.current.revision) {
      setConflict(true);
      const e = new Error("\u8BBE\u7F6E\u5DF2\u5728\u5176\u4ED6\u7A97\u53E3\u66F4\u65B0\uFF0C\u8BF7\u8F7D\u5165\u6700\u65B0\u8BBE\u7F6E\u540E\u7EE7\u7EED\u3002");
      e.code = "journal/conflict";
      setError(e);
    }
    if (!selection.current) setDay((d) => d || value.today);
    return value;
  }, [connection, resetDraft]);
  const loadExtras = React.useCallback(async (signal) => {
    const results = await Promise.allSettled([rpc(connection, "days.summary", { days: 7 }, signal), rpc(connection, "documents.summary", {}, signal)]);
    if (!mounted.current || signal?.aborted) return;
    if (results[0].status === "fulfilled") setDays(results[0].value);
    if (results[1].status === "fulfilled") {
      setStats(results[1].value);
      setStatsError("");
    } else {
      setStats(null);
      setStatsError("\u5185\u5BB9\u7EDF\u8BA1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u53EF\u7A0D\u540E\u5237\u65B0\u91CD\u8BD5\u3002");
    }
  }, [connection]);
  const loadModels = React.useCallback(async (signal) => {
    try {
      const value = await rpc(connection, "models.list", {}, signal);
      if (mounted.current && !signal?.aborted) {
        setProviders(value?.providers ?? []);
        setModelsError("");
      }
    } catch (e) {
      if (mounted.current && !signal?.aborted) {
        setProviders([]);
        setModelsError(e.message);
      }
    }
  }, [connection]);
  React.useEffect(() => {
    mounted.current = true;
    const c = new AbortController();
    reload(c.signal).catch((e) => {
      if (!c.signal.aborted) setError(e);
    });
    loadExtras(c.signal);
    loadModels(c.signal);
    return () => {
      mounted.current = false;
      c.abort();
    };
  }, [reload, loadExtras, loadModels]);
  React.useEffect(() => {
    if (!running) return;
    const c = new AbortController();
    let timer;
    const poll = async () => {
      try {
        const value = await reload(c.signal);
        if (c.signal.aborted) return;
        if (value.job?.state === "running") timer = setTimeout(poll, 1200);
      } catch (e) {
        if (!c.signal.aborted) {
          setError(e);
          timer = setTimeout(poll, 3e3);
        }
      }
    };
    timer = setTimeout(poll, 400);
    const tick = setInterval(() => setClock(Date.now()), 1e3);
    return () => {
      c.abort();
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, [running, reload, loadExtras]);
  React.useEffect(() => {
    if (model) loadExtras();
  }, [model?.revision, model?.job?.finishedAt, loadExtras]);
  React.useEffect(() => {
    if (running) return;
    const c = new AbortController();
    let timer;
    const refresh = async () => {
      if (document.visibilityState !== "hidden" && !operation.current) {
        try {
          await reload(c.signal);
        } catch (e) {
          if (!c.signal.aborted) setError(e);
        }
      }
      if (!c.signal.aborted) timer = setTimeout(refresh, 15e3);
    };
    const onFocus = () => {
      clearTimeout(timer);
      refresh();
    };
    timer = setTimeout(refresh, 15e3);
    window.addEventListener("focus", onFocus);
    return () => {
      c.abort();
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [running, reload, loadExtras]);
  React.useEffect(() => {
    if (dirty && form && baseline.current) drafts.set(connection, { form, baseline: baseline.current, section });
    else if (form) drafts.delete(connection);
  }, [connection, form, dirty, section]);
  React.useEffect(() => {
    if (!dirty) return;
    const guard = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  React.useEffect(() => {
    if (tab !== "library") return;
    const c = new AbortController();
    setSearching(true);
    setListError(null);
    const timer = setTimeout(async () => {
      try {
        const rows = await rpc(connection, "documents.list", { query: query.trim(), kind, offset, limit: PAGE_SIZE + 1 }, c.signal);
        if (!c.signal.aborted) {
          setDocuments(rows.slice(0, PAGE_SIZE));
          setHasNext(rows.length > PAGE_SIZE);
          setSelected((previous) => previous ? rows.slice(0, PAGE_SIZE).find((d) => d.key === previous.key) ?? null : null);
        }
      } catch (e) {
        if (!c.signal.aborted) setListError(e);
      } finally {
        if (!c.signal.aborted) setSearching(false);
      }
    }, query ? 250 : 0);
    return () => {
      c.abort();
      clearTimeout(timer);
    };
  }, [connection, tab, query, kind, offset, model?.job?.finishedAt, model?.revision]);
  const goSettings = (id = "general") => {
    setSection(id);
    setTab("settings");
  };
  const update = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFields((f) => ({ ...f, [key]: "" }));
    setNotice("");
  };
  const revealErrors = (errors) => {
    setFields(errors);
    const key = Object.keys(errors)[0];
    goSettings(["notionToken", "notionParent", "notionEnabled"].includes(key) ? "notion" : ["dailyTime"].includes(key) ? "schedule" : ["codexHome", "maxInputChars", "maxOutputTokens", "excludedProjects", "excludedSessions"].includes(key) ? "advanced" : "general");
    setTimeout(() => document.querySelector(".cj [aria-invalid=true]")?.focus(), 0);
  };
  const persist = async () => {
    if (conflict) {
      const e = new Error("\u8BBE\u7F6E\u5DF2\u5728\u5176\u4ED6\u7A97\u53E3\u66F4\u65B0\uFF0C\u8BF7\u8F7D\u5165\u6700\u65B0\u8BBE\u7F6E\u540E\u7EE7\u7EED\u3002");
      e.code = "journal/conflict";
      throw e;
    }
    const errors = validateDraft(form);
    if (Object.keys(errors).length) {
      revealErrors(errors);
      throw new Error("\u8BF7\u68C0\u67E5\u8BBE\u7F6E\u4E2D\u6807\u51FA\u7684\u9879\u76EE\u3002");
    }
    const patch = configPatch(baseline.current.config, form);
    if (!Object.keys(patch).length) return model;
    const previousRevision = baseline.current.revision;
    await rpc(connection, "settings.update", { patch, revision: previousRevision });
    let value, lastError;
    for (let i = 0; i < 4; i++) {
      try {
        value = await rpc(connection, "settings.get");
        if (value.revision !== void 0 && value.revision !== previousRevision && matchesPatch(value.config, patch)) break;
        value = null;
      } catch (e) {
        lastError = e;
      }
      if (i < 3) await new Promise((r) => setTimeout(r, 200 * (i + 1)));
    }
    if (!value) throw lastError || new Error("\u5C1A\u672A\u786E\u8BA4\u8BBE\u7F6E\u5DF2\u751F\u6548\uFF0C\u8BF7\u91CD\u65B0\u8BFB\u53D6\u786E\u8BA4\u3002");
    if (mounted.current) {
      setModel(value);
      resetDraft(value);
      setNotice("\u8BBE\u7F6E\u5DF2\u4FDD\u5B58");
    }
    return value;
  };
  const perform = async (label, fn) => {
    if (operation.current) return;
    operation.current = true;
    ++readVersion.current;
    setBusy(label);
    setError(null);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      if (mounted.current) {
        setError(e);
        if (/conflict|revision|冲突|其他窗口/i.test(`${e.code ?? ""} ${e.message}`)) setConflict(true);
      }
    } finally {
      operation.current = false;
      if (mounted.current) {
        setBusy("");
        setConfirmStop(false);
      }
    }
  };
  const runtimeAction = async (method) => {
    if (dirty) await persist();
    await rpc(connection, method);
    await reload();
    await loadExtras();
  };
  const start = () => perform("generate", async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > model.today) throw new Error("\u8BF7\u9009\u62E9\u6709\u6548\u65E5\u671F\uFF0C\u65E5\u671F\u4E0D\u80FD\u665A\u4E8E\u4ECA\u5929\u3002");
    const value = dirty ? await persist() : model;
    if (!value.config.enabled || !value.config.provider || !value.config.model || !value.config.sources.length) {
      revealErrors(validateDraft({ ...form, enabled: true }));
      throw new Error(value.config.enabled ? "\u8BF7\u5148\u5B8C\u6210\u6765\u6E90\u4E0E\u6A21\u578B\u8BBE\u7F6E\u3002" : "\u5BF9\u8BDD\u6574\u7406\u5DF2\u6682\u505C\uFF0C\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u542F\u7528\u3002");
    }
    await rpc(connection, "generate", { day, mode });
    await reload();
  });
  const pickDay = (value) => {
    selection.current = true;
    setDay(value);
  };
  const field = (key, title, { type = "text", hint, placeholder, ...props } = {}) => h(
    "label",
    { className: "cj-field", key },
    h("span", null, title),
    h("input", { type, value: form[key] ?? "", placeholder, autoComplete: type === "password" ? "new-password" : "off", "aria-invalid": Boolean(fields[key]), "aria-describedby": fields[key] ? `cj-error-${key}` : void 0, onChange: (e) => update(key, type === "number" ? e.target.value === "" ? "" : Number(e.target.value) : e.target.value), ...props }),
    fields[key] && h("span", { className: "cj-field-error", id: `cj-error-${key}` }, fields[key]),
    hint && h("small", null, hint)
  );
  const switchRow = (key, title, hint) => h(
    "div",
    { className: "cj-setting-row", key },
    h("div", null, h("h4", null, title), h("p", { className: "cj-muted" }, hint)),
    h("label", { className: "cj-toggle" }, h("input", { type: "checkbox", role: "switch", "aria-label": title, checked: Boolean(form[key]), onChange: (e) => update(key, e.target.checked) }), form[key] ? "\u5F00\u542F" : "\u5173\u95ED")
  );
  const badge = (text, tone = "") => h("span", { className: `cj-badge ${tone}` }, text);
  const renderError = (e, local = false) => {
    if (!e) return null;
    const guide = errorGuide(e);
    return h(
      "div",
      { className: "cj-callout cj-error", role: "alert" },
      h(
        "div",
        { className: "cj-grow" },
        h("h4", null, guide.title),
        h("p", { className: "cj-muted" }, guide.hint),
        h("details", null, h("summary", null, "\u9519\u8BEF\u8BE6\u60C5"), h("pre", null, e.message || String(e)))
      ),
      !local && conflict && h("button", { type: "button", disabled: locked, onClick: () => perform("reload", async () => {
        await reload(void 0, true);
        setError(null);
      }) }, "\u8F7D\u5165\u6700\u65B0\u8BBE\u7F6E\u5E76\u653E\u5F03\u672C\u6B21\u4FEE\u6539")
    );
  };
  if (!model || !form) return h("section", { className: "cj", "aria-label": "\u5BF9\u8BDD\u6574\u7406" }, h("style", null, CSS), h("h2", null, "\u5BF9\u8BDD\u6574\u7406"), error ? renderError(error) : h("p", { role: "status", className: "cj-muted" }, "\u6B63\u5728\u8BFB\u53D6\u8BBE\u7F6E\u2026"), error && h("button", { type: "button", onClick: () => perform("reload", () => reload()) }, "\u91CD\u65B0\u52A0\u8F7D"));
  const savedConfig = baseline.current.config;
  const today = model.today;
  const modelReady = Boolean(savedConfig.provider && savedConfig.model && savedConfig.sources.length);
  const initialized = Boolean(model.initialized?.daily && model.initialized?.knowledge);
  const notionChanged = Object.keys(configPatch(savedConfig, form)).some((k) => k.startsWith("notion"));
  const notionReady = initialized && !notionChanged;
  const line = jobLine(model.job);
  const generated = model.job?.kind === "generate" ? model.job : model.lastGeneration;
  const dayList = days?.days?.slice(-7) ?? Array.from({ length: 7 }, (_, i) => ({ day: dateOffset(today, i - 6), messages: null }));
  const options = (providers ?? []).flatMap((p) => (p.models ?? []).map((m) => ({ provider: p.id, model: m.id, label: `${p.name ?? p.id} \xB7 ${m.name ?? m.id}` })));
  if (form.provider && form.model && !options.some((o) => o.provider === form.provider && o.model === form.model)) options.unshift({ provider: form.provider, model: form.model, label: `${form.provider} \xB7 ${form.model}\uFF08\u5F53\u524D\u914D\u7F6E\uFF09` });
  const readySources = model.ready?.sources ?? [];
  const unavailable = savedConfig.sources.filter((s) => !readySources.includes(s));
  const sourceTitle = (s) => s === "dsh" ? "DSH" : "Codex";
  const jobCard = (job) => {
    if (!job) return null;
    const status = jobLine(job), progress = stageProgress(job);
    const result = job.result;
    return h(
      "div",
      { className: "cj-card" },
      h("div", { className: "cj-row cj-between" }, h("div", { className: "cj-status" }, h("span", { className: `cj-dot ${status.tone}` }), h("h4", { role: "status" }, status.text)), h("small", null, runDuration(job, clock))),
      job.state === "running" && h(
        "div",
        { className: "cj-stack", role: "status" },
        h("p", null, progress.label),
        job.kind === "generate" && h("div", { className: "cj-stages" }, ...["\u8BFB\u53D6\u5BF9\u8BDD", "\u6A21\u578B\u6574\u7406", "\u5408\u5E76\u65E5\u62A5", "\u540C\u6B65\u7ED3\u679C"].map((s, i) => h("div", { key: s, className: `cj-stage ${i + 1 === progress.step ? "active" : i + 1 < progress.step ? "done" : ""}` }, s)))
      ),
      result?.messages !== void 0 && h("div", { className: "cj-metrics" }, ...[[result.messages, "\u6761\u5BF9\u8BDD"], [result.documents ?? 0, "\u4EFD\u672C\u5730\u5185\u5BB9"], [result.modelCalls ?? 0, "\u6B21\u6A21\u578B\u8C03\u7528"]].map(([n, label]) => h("div", { key: label }, h("b", null, n), h("span", null, label)))),
      status.detail && h("p", { className: job.error ? "cj-field-error" : "cj-muted" }, status.detail),
      result?.sync && h("div", { className: "cj-row" }, badge(`Notion \u5DF2\u540C\u6B65 ${result.sync.synced} \u4EFD`, result.sync.failed ? "warn" : "ok"), result.sync.failed > 0 && h("button", { type: "button", onClick: () => goSettings("notion") }, "\u5904\u7406\u540C\u6B65\u95EE\u9898")),
      job.warnings?.length > 0 && h("details", null, h("summary", null, `\u67E5\u770B ${job.warnings.length} \u6761\u91C7\u96C6\u63D0\u793A`), job.warnings.map((w, i) => h("p", { key: i, className: "cj-muted" }, w))),
      job.state === "running" && h("div", { className: "cj-actions" }, !confirmStop ? h("button", { type: "button", className: "danger", disabled: Boolean(busy), onClick: () => setConfirmStop(true) }, "\u505C\u6B62\u4EFB\u52A1") : h(
        React.Fragment,
        null,
        h("span", { className: "cj-muted" }, "\u5DF2\u5B8C\u6210\u7684\u5185\u5BB9\u4F1A\u4FDD\u7559\u3002\u505C\u6B62\u5F53\u524D\u4EFB\u52A1\uFF1F"),
        h("button", { type: "button", className: "danger", disabled: Boolean(busy), onClick: () => perform("cancel", async () => {
          await rpc(connection, "cancel");
          await reload();
        }) }, "\u786E\u8BA4\u505C\u6B62"),
        h("button", { type: "button", onClick: () => setConfirmStop(false) }, "\u7EE7\u7EED\u4EFB\u52A1")
      )),
      result?.documents > 0 && h("div", null, h("button", { type: "button", onClick: () => {
        setQuery(result.day ?? "");
        setOffset(0);
        setTab("library");
      } }, "\u67E5\u770B\u6574\u7406\u7ED3\u679C"))
    );
  };
  const work = h(
    "div",
    { className: "cj-panel" },
    !modelReady && h("div", { className: "cj-callout" }, h("div", null, h("h4", null, "\u5148\u9009\u597D\u6765\u6E90\u548C\u603B\u7ED3\u6A21\u578B"), h("p", { className: "cj-muted" }, "\u914D\u7F6E\u4E00\u6B21\uFF0C\u5C31\u80FD\u6309\u5929\u6574\u7406\u3002Notion \u53EF\u4EE5\u7A0D\u540E\u518D\u8FDE\u63A5\u3002")), h("button", { type: "button", className: "primary", onClick: () => goSettings() }, "\u5B8C\u6210\u8BBE\u7F6E")),
    modelReady && !savedConfig.enabled && h("div", { className: "cj-callout" }, h("div", null, h("h4", null, "\u5BF9\u8BDD\u6574\u7406\u5DF2\u6682\u505C"), h("p", { className: "cj-muted" }, "\u5DF2\u6709\u5185\u5BB9\u4FDD\u7559\uFF0C\u542F\u7528\u540E\u53EF\u4EE5\u7EE7\u7EED\u6574\u7406\u3002")), h("button", { type: "button", onClick: () => goSettings() }, "\u7BA1\u7406\u8BBE\u7F6E")),
    h(
      "div",
      { className: "cj-card cj-hero" },
      h("div", { className: "cj-title" }, h("h3", null, "\u628A\u4E00\u5929\u7684\u5BF9\u8BDD\uFF0C\u7559\u6210\u53EF\u56DE\u67E5\u7684\u8BB0\u5F55"), h("p", { className: "cj-muted" }, "\u65E5\u62A5\u8BB0\u5F55\u5F53\u5929\u63A8\u8FDB\uFF1B\u77E5\u8BC6\u5E93\u4FDD\u7559\u53EF\u590D\u7528\u7684\u7ED3\u8BBA\u4E0E\u6765\u6E90\u3002")),
      h(
        "div",
        { className: "cj-row" },
        h("label", { className: "cj-field" }, h("span", null, "\u6574\u7406\u65E5\u671F"), h("input", { type: "date", value: day, max: today, disabled: locked, onChange: (e) => pickDay(e.target.value) })),
        h("label", { className: "cj-field" }, h("span", null, "\u751F\u6210\u5185\u5BB9"), h("select", { value: mode, disabled: locked, onChange: (e) => setMode(e.target.value) }, h("option", { value: "both" }, "\u65E5\u62A5\u4E0E\u77E5\u8BC6\u5E93"), h("option", { value: "daily" }, "\u4EC5\u65E5\u62A5"), h("option", { value: "knowledge" }, "\u4EC5\u77E5\u8BC6\u5E93")))
      ),
      h(
        "div",
        { className: "cj-row cj-between" },
        h("div", { className: "cj-meta" }, modelReady ? `${savedConfig.sources.map(sourceTitle).join("\u3001")} \xB7 ${savedConfig.provider} / ${savedConfig.model}` : "\u914D\u7F6E\u603B\u7ED3\u6A21\u578B\u540E\u5373\u53EF\u5F00\u59CB", h("br"), `\u65E5\u671F\u6309 ${savedConfig.timeZone} \u8BA1\u7B97 \xB7 ${savedConfig.notionEnabled ? "\u751F\u6210\u540E\u540C\u6B65\u5230 Notion" : "\u7ED3\u679C\u4FDD\u5B58\u5728\u672C\u673A"}`),
        h("button", { type: "button", className: "primary", disabled: locked || !modelReady && !dirty || !savedConfig.enabled && !dirty, onClick: start }, busy === "generate" ? "\u6B63\u5728\u5F00\u59CB\u2026" : dirty ? "\u4FDD\u5B58\u5E76\u5F00\u59CB\u6574\u7406" : "\u5F00\u59CB\u6574\u7406")
      ),
      modelReady && h("p", { className: "cj-muted" }, "\u5BF9\u8BDD\u6B63\u6587\u548C\u5FC5\u8981\u7684\u5DE5\u5177\u8BB0\u5F55\u4F1A\u53D1\u9001\u7ED9\u6240\u9009\u6A21\u578B\uFF0C\u6D88\u8017\u8BE5\u6A21\u578B\u989D\u5EA6\u3002\u53EF\u5728\u8BBE\u7F6E\u4E2D\u6392\u9664\u654F\u611F\u9879\u76EE\u3002")
    ),
    unavailable.length > 0 && h("div", { className: "cj-callout" }, h("div", null, h("h4", null, `${unavailable.map(sourceTitle).join("\u3001")} \u6765\u6E90\u6682\u4E0D\u53EF\u7528`), h("p", { className: "cj-muted" }, "\u8BF7\u68C0\u67E5\u5BBF\u4E3B\u670D\u52A1\u548C\u672C\u673A\u6570\u636E\u76EE\u5F55\uFF1B\u4E5F\u53EF\u4EE5\u5728\u8BBE\u7F6E\u4E2D\u53D6\u6D88\u8BE5\u6765\u6E90\u3002")), h("button", { type: "button", onClick: () => goSettings(unavailable.includes("codex") ? "advanced" : "general") }, "\u68C0\u67E5\u6765\u6E90")),
    h(
      "div",
      { className: "cj-stack" },
      h("div", { className: "cj-row cj-between" }, h("h4", null, "\u6700\u8FD1\u4E03\u5929"), h("small", null, "\u9009\u62E9\u65E5\u671F\u540E\u5F00\u59CB\u6574\u7406")),
      h("div", { className: "cj-days" }, ...dayList.map((d) => h("button", { key: d.day, type: "button", className: "cj-day", "aria-pressed": day === d.day, "aria-label": `\u9009\u62E9 ${d.day}`, disabled: locked, onClick: () => pickDay(d.day) }, h("b", null, d.day === today ? "\u4ECA\u5929" : d.day.slice(5).replace("-", "/")), h("span", null, !days?.scanned || d.messages == null ? "\u5C1A\u672A\u91C7\u96C6" : `${d.messages} \u6761`)))),
      h("p", { className: "cj-muted" }, "\u6761\u6570\u6765\u81EA\u672C\u5730\u5DF2\u91C7\u96C6\u8BB0\u5F55\uFF1B\u5F00\u59CB\u6574\u7406\u65F6\u4F1A\u91CD\u65B0\u8BFB\u53D6\u6765\u6E90\u3002")
    ),
    running || model.job?.state === "error" && !model.job?.kind ? jobCard(model.job) : generated ? jobCard(generated) : h("div", { className: "cj-empty" }, h("h4", null, "\u7B2C\u4E00\u4EFD\u8BB0\u5F55\uFF0C\u4ECE\u9009\u597D\u4E00\u5929\u5F00\u59CB"), h("p", { className: "cj-muted" }, "\u7ED3\u679C\u5148\u4FDD\u5B58\u5728\u672C\u673A\uFF1B\u4E4B\u540E\u53EF\u4EE5\u67E5\u770B\u6B63\u6587\u3001\u56DE\u67E5\u6765\u6E90\u6216\u5BFC\u51FA Markdown\u3002")),
    h("div", { className: "cj-row cj-between cj-divider" }, h("p", { className: "cj-muted" }, savedConfig.autoDaily && savedConfig.enabled ? `\u6BCF\u5929 ${savedConfig.dailyTime} \u81EA\u52A8\u6574\u7406 \xB7 ${savedConfig.timeZone}` : "\u5F53\u524D\u7531\u4F60\u624B\u52A8\u5F00\u59CB\u6574\u7406"), h("button", { type: "button", className: "quiet", onClick: () => goSettings("schedule") }, "\u7BA1\u7406\u81EA\u52A8\u6574\u7406"))
  );
  const general = h(
    "div",
    { className: "cj-stack" },
    h("div", { className: "cj-title" }, h("h3", null, "\u6765\u6E90\u4E0E\u6A21\u578B"), h("p", { className: "cj-muted" }, "\u51B3\u5B9A\u8BFB\u53D6\u54EA\u4E9B\u5BF9\u8BDD\uFF0C\u4EE5\u53CA\u4EA4\u7ED9\u54EA\u4E2A\u6A21\u578B\u6574\u7406\u3002")),
    switchRow("enabled", "\u542F\u7528\u5BF9\u8BDD\u6574\u7406", "\u5173\u95ED\u540E\u505C\u6B62\u540E\u7EED\u624B\u52A8\u4E0E\u81EA\u52A8\u6574\u7406\uFF0C\u5DF2\u6709\u5185\u5BB9\u4ECD\u53EF\u67E5\u770B\u3002"),
    h("div", { className: "cj-stack cj-divider" }, h("h4", null, "\u5BF9\u8BDD\u6765\u6E90"), h("div", { className: "cj-grid" }, ...["dsh", "codex"].map((s) => h("label", { className: "cj-source", key: s }, h("input", { type: "checkbox", checked: form.sources.includes(s), "aria-label": `${sourceTitle(s)} \u5BF9\u8BDD`, onChange: () => update("sources", form.sources.includes(s) ? form.sources.filter((x) => x !== s) : [...form.sources, s]) }), h("span", null, h("b", null, `${sourceTitle(s)} \u5BF9\u8BDD`), h("small", null, s === "dsh" ? "\u4ECE\u5F53\u524D\u5BBF\u4E3B\u8BFB\u53D6\u5386\u53F2\u4F1A\u8BDD" : "\u4ECE\u5BBF\u4E3B\u7535\u8111\u8BFB\u53D6\u672C\u5730\u4F1A\u8BDD\u6587\u4EF6"))))), fields.sources && h("p", { className: "cj-field-error", role: "alert" }, fields.sources)),
    h(
      "div",
      { className: "cj-stack cj-divider" },
      h("h4", null, "\u603B\u7ED3\u6A21\u578B"),
      options.length && !manualModel ? h("label", { className: "cj-field" }, h("span", null, "\u9009\u62E9\u6A21\u578B"), h("select", { value: form.provider && form.model ? JSON.stringify([form.provider, form.model]) : "", "aria-invalid": Boolean(fields.model || fields.provider), onChange: (e) => {
        if (!e.target.value) return;
        const [provider, m] = JSON.parse(e.target.value);
        setForm((f) => ({ ...f, provider, model: m }));
        setFields((f) => ({ ...f, provider: "", model: "" }));
      } }, h("option", { value: "" }, "\u8BF7\u9009\u62E9\u5DF2\u5728 DSH \u4E2D\u914D\u7F6E\u7684\u6A21\u578B"), ...options.map((o) => h("option", { value: JSON.stringify([o.provider, o.model]), key: `${o.provider}/${o.model}` }, o.label))), (fields.model || fields.provider) && h("span", { className: "cj-field-error" }, fields.provider || fields.model)) : h("div", { className: "cj-grid" }, field("provider", "\u6A21\u578B\u63D0\u4F9B\u5546", { placeholder: "DSH \u4E2D\u5DF2\u914D\u7F6E\u7684\u63D0\u4F9B\u5546\u540D\u79F0" }), field("model", "\u6A21\u578B\u540D\u79F0", { placeholder: "\u63D0\u4F9B\u5546\u652F\u6301\u7684\u6A21\u578B ID" })),
      h("div", { className: "cj-actions" }, h("button", { type: "button", className: "quiet", onClick: () => setManualModel((x) => !x), disabled: !manualModel && !options.length }, manualModel ? "\u4ECE\u5217\u8868\u9009\u62E9" : "\u624B\u52A8\u586B\u5199"), h("button", { type: "button", className: "quiet", onClick: () => loadModels() }, "\u5237\u65B0\u6A21\u578B\u5217\u8868")),
      h("p", { className: "cj-muted" }, modelsError ? `\u6A21\u578B\u5217\u8868\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u53EF\u624B\u52A8\u586B\u5199\u3002${modelsError}` : providers === null ? "\u6B63\u5728\u8BFB\u53D6 DSH \u6A21\u578B\u5217\u8868\u2026" : !options.length ? "\u8FD8\u6CA1\u6709\u53EF\u9009\u6A21\u578B\uFF0C\u8BF7\u5148\u5728 DSH \u7684\u6A21\u578B\u8BBE\u7F6E\u4E2D\u6DFB\u52A0\u63D0\u4F9B\u5546\u3002" : "\u4F7F\u7528 DSH \u5DF2\u914D\u7F6E\u7684\u6A21\u578B\uFF0C\u4E0D\u9700\u8981\u53E6\u586B API Key\u3002")
    ),
    h("div", { className: "cj-divider" }, field("timeZone", "\u65E5\u62A5\u65F6\u533A", { placeholder: "Asia/Shanghai", hint: "\u7528\u4E8E\u5212\u5206\u4E00\u5929\u7684\u5BF9\u8BDD\u8303\u56F4\u4E0E\u81EA\u52A8\u6574\u7406\u65F6\u95F4\u3002" }))
  );
  const schedule = h(
    "div",
    { className: "cj-stack" },
    h("div", { className: "cj-title" }, h("h3", null, "\u81EA\u52A8\u6574\u7406"), h("p", { className: "cj-muted" }, "\u8BA9\u6BCF\u5929\u7684\u5BF9\u8BDD\u6309\u65F6\u6C89\u6DC0\uFF0C\u4E0D\u5FC5\u624B\u52A8\u6253\u5F00\u63D2\u4EF6\u3002")),
    switchRow("autoDaily", "\u6BCF\u5929\u81EA\u52A8\u6574\u7406", "\u6309\u8BBE\u5B9A\u65F6\u95F4\u6574\u7406\u5F53\u5929\u7684\u65E5\u62A5\u4E0E\u77E5\u8BC6\u5E93\u3002"),
    form.autoDaily && field("dailyTime", "\u6BCF\u65E5\u5F00\u59CB\u65F6\u95F4", { type: "time", hint: `\u4F7F\u7528 ${form.timeZone} \u65F6\u533A\u3002` }),
    h("div", { className: "cj-card" }, h("h4", null, "\u665A\u95F4\u5BF9\u8BDD\u4E5F\u4F1A\u8865\u9F50"), h("p", { className: "cj-muted" }, "\u7B2C\u4E8C\u5929\u4F1A\u518D\u6B21\u6574\u7406\u524D\u4E00\u5929\uFF0C\u8865\u5165\u622A\u6B62\u65F6\u95F4\u540E\u7684\u5BF9\u8BDD\u3002\u5BBF\u4E3B\u9700\u8981\u4FDD\u6301\u8FD0\u884C\uFF1B\u79BB\u7EBF\u6062\u590D\u540E\u8865\u6700\u8FD1\u4E00\u5929\uFF0C\u66F4\u65E9\u7684\u65E5\u671F\u53EF\u624B\u52A8\u6574\u7406\u3002")),
    !form.enabled && h("p", { className: "cj-field-error" }, "\u5BF9\u8BDD\u6574\u7406\u5DF2\u6682\u505C\uFF0C\u542F\u7528\u540E\u81EA\u52A8\u8BA1\u5212\u624D\u4F1A\u6267\u884C\u3002"),
    h("button", { type: "button", className: "quiet", onClick: () => setSection("general") }, "\u4FEE\u6539\u65F6\u533A\u4E0E\u603B\u7ED3\u6A21\u578B")
  );
  const notion = h(
    "div",
    { className: "cj-stack" },
    h("div", { className: "cj-row cj-between" }, h("div", { className: "cj-title" }, h("h3", null, "Notion \u540C\u6B65"), h("p", { className: "cj-muted" }, "\u53EF\u9009\u3002\u628A\u6574\u7406\u540E\u7684\u65E5\u62A5\u4E0E\u77E5\u8BC6\u540C\u6B65\u5230\u4E00\u4E2A Notion \u9875\u9762\u3002")), badge(notionChanged ? "\u5F85\u4FDD\u5B58" : !savedConfig.notionEnabled ? "\u5DF2\u5173\u95ED" : notionReady ? "\u5DF2\u5C31\u7EEA" : "\u5F85\u8FDE\u63A5", notionReady && savedConfig.notionEnabled ? "ok" : "")),
    switchRow("notionEnabled", "\u540C\u6B65\u5230 Notion", "\u5173\u95ED\u540E\u7EE7\u7EED\u5728\u672C\u673A\u751F\u6210\u548C\u67E5\u770B\uFF0C\u5DF2\u6709 Notion \u5185\u5BB9\u4FDD\u7559\u3002"),
    (form.notionEnabled || form.notionTokenConfigured) && h(
      React.Fragment,
      null,
      h("div", { className: "cj-stack" }, field("notionToken", form.notionTokenConfigured ? "\u66F4\u6362\u8FDE\u63A5 Token" : "\u8FDE\u63A5 Token", { type: "password", placeholder: form.notionTokenConfigured ? "\u5DF2\u5B89\u5168\u4FDD\u5B58\uFF0C\u7559\u7A7A\u4FDD\u7559" : "\u7C98\u8D34 Notion \u5185\u90E8\u8FDE\u63A5 Token" }), field("notionParent", "\u76EE\u6807\u7236\u9875\u9762", { placeholder: "\u7C98\u8D34 Notion \u9875\u9762\u94FE\u63A5\u6216 ID", hint: "\u63D2\u4EF6\u4F1A\u5728\u8BE5\u9875\u9762\u5185\u5EFA\u7ACB\u300C\u5BF9\u8BDD\u65E5\u62A5\u300D\u548C\u300C\u5BF9\u8BDD\u77E5\u8BC6\u5E93\u300D\u3002" })),
      h("details", null, h("summary", null, "\u5982\u4F55\u53D6\u5F97 Token \u5E76\u6388\u6743\u9875\u9762"), h("div", { className: "cj-stack", style: { marginTop: 12 } }, h("p", { className: "cj-muted" }, "1. \u521B\u5EFA Notion \u5185\u90E8\u8FDE\u63A5\uFF0C\u590D\u5236 Token\u3002"), h("a", { href: NOTION_INTEGRATIONS_URL, target: "_blank", rel: "noopener noreferrer" }, "\u6253\u5F00 Notion \u8FDE\u63A5\u7BA1\u7406 \u2197"), h("p", { className: "cj-muted" }, "2. \u6253\u5F00\u76EE\u6807\u9875\u9762\uFF0C\u901A\u8FC7\u53F3\u4E0A\u89D2\u300C\u8FDE\u63A5\u300D\u6DFB\u52A0\u8BE5\u8FDE\u63A5\uFF0C\u5E76\u6388\u4E88\u8BFB\u53D6\u3001\u63D2\u5165\u548C\u66F4\u65B0\u5185\u5BB9\u6743\u9650\u3002"))),
      h("div", { className: "cj-actions" }, h("button", { type: "button", className: "primary", disabled: locked || !form.notionEnabled || conflict, onClick: () => perform("notion.initialize", () => runtimeAction("notion.initialize")) }, busy === "notion.initialize" ? "\u6B63\u5728\u51C6\u5907\u2026" : dirty ? "\u4FDD\u5B58\u5E76\u8FDE\u63A5 Notion" : notionReady ? "\u68C0\u67E5\u76EE\u6807\u6570\u636E\u5E93" : "\u8FDE\u63A5\u5E76\u51C6\u5907\u6570\u636E\u5E93"), h("button", { type: "button", disabled: locked || conflict, onClick: () => perform("notion.test", () => runtimeAction("notion.test")) }, busy === "notion.test" ? "\u6B63\u5728\u6D4B\u8BD5\u2026" : dirty ? "\u4FDD\u5B58\u5E76\u6D4B\u8BD5\u8FDE\u63A5" : "\u6D4B\u8BD5\u8FDE\u63A5")),
      h("p", { className: "cj-muted" }, "\u540C\u6B65\u6B63\u6587\u4E0E\u6765\u6E90\u7D22\u5F15\uFF0C\u5B8C\u6574\u539F\u59CB\u5BF9\u8BDD\u4FDD\u7559\u5728\u672C\u673A\u3002\u81EA\u52A8\u6574\u7406\u533A\u57DF\u7531\u63D2\u4EF6\u7EF4\u62A4\uFF1B\u4EBA\u5DE5\u7F16\u8F91\u8BF7\u653E\u5728\u300C\u4EBA\u5DE5\u5907\u6CE8\u300D\u3002"),
      stats?.pending > 0 && h("div", { className: "cj-callout" }, h("div", null, h("h4", null, `${stats.pending} \u4EFD\u5185\u5BB9\u5C1A\u672A\u540C\u6B65`), h("p", { className: "cj-muted" }, stats.error ? `${stats.error} \u4EFD\u9700\u8981\u68C0\u67E5\u6388\u6743\u3001\u7F51\u7EDC\u6216\u7F16\u8F91\u51B2\u7A81\u3002` : "\u8FDE\u63A5\u5C31\u7EEA\u540E\u53EF\u4EE5\u8865\u4F20\u5DF2\u6709\u5185\u5BB9\u3002")), h("button", { type: "button", disabled: locked || !form.notionEnabled || conflict, onClick: () => perform("notion.sync", () => runtimeAction("notion.sync")) }, busy === "notion.sync" ? "\u8865\u4F20\u4E2D\u2026" : dirty ? "\u4FDD\u5B58\u5E76\u8865\u4F20" : "\u8865\u4F20\u5185\u5BB9"))
    ),
    !form.notionEnabled && !form.notionTokenConfigured && h("div", { className: "cj-empty" }, h("h4", null, "\u672C\u673A\u6574\u7406\u5DF2\u8DB3\u591F\u4F7F\u7528"), h("p", { className: "cj-muted" }, "\u9700\u8981\u8DE8\u8BBE\u5907\u67E5\u770B\u65F6\uFF0C\u518D\u5F00\u542F Notion \u540C\u6B65\u3002"))
  );
  const advanced = h(
    "div",
    { className: "cj-stack" },
    h("div", { className: "cj-title" }, h("h3", null, "\u9690\u79C1\u4E0E\u9AD8\u7EA7"), h("p", { className: "cj-muted" }, "\u9650\u5236\u53C2\u4E0E\u6574\u7406\u7684\u5185\u5BB9\uFF0C\u6216\u8C03\u6574\u5355\u6B21\u6A21\u578B\u8C03\u7528\u7684\u9884\u7B97\u3002")),
    form.sources.includes("codex") && field("codexHome", "Codex \u6570\u636E\u76EE\u5F55", { hint: "\u8FD9\u662F\u8FD0\u884C DSH Host \u7684\u7535\u8111\u4E0A\u7684\u76EE\u5F55\u3002\u9ED8\u8BA4\u65E0\u9700\u4FEE\u6539\u3002", placeholder: "~/.codex" }),
    ...[["excludedProjects", "\u6392\u9664\u9879\u76EE", "\u6BCF\u884C\u4E00\u4E2A\u5B8C\u6574\u9879\u76EE\u8DEF\u5F84\uFF0C\u5305\u542B\u5176\u4E0B\u6240\u6709\u4F1A\u8BDD\u3002"], ["excludedSessions", "\u6392\u9664\u4F1A\u8BDD", "\u6BCF\u884C\u4E00\u4E2A\u4F1A\u8BDD ID\u3002"]].map(([key, title, hint]) => h("label", { className: "cj-field", key }, h("span", null, title), h("textarea", { value: (form[key] ?? []).join("\n"), onChange: (e) => update(key, e.target.value.split("\n")) }), h("small", null, hint))),
    h("p", { className: "cj-muted" }, "\u6392\u9664\u8303\u56F4\u5F71\u54CD\u540E\u7EED\u6574\u7406\uFF0C\u5DF2\u6709\u672C\u5730\u8BB0\u5F55\u548C Notion \u5185\u5BB9\u4F1A\u4FDD\u7559\u3002\u5E38\u89C1\u51ED\u636E\u4F1A\u5148\u8131\u654F\uFF0C\u4E1A\u52A1\u654F\u611F\u4FE1\u606F\u8BF7\u901A\u8FC7\u6392\u9664\u8303\u56F4\u63A7\u5236\u3002"),
    h("details", { className: "cj-divider", open: fields.maxInputChars || fields.maxOutputTokens ? true : void 0 }, h("summary", null, "\u6A21\u578B\u8C03\u7528\u9884\u7B97"), h("div", { className: "cj-stack", style: { marginTop: 16 } }, h("div", { className: "cj-grid" }, field("maxInputChars", "\u6BCF\u6B21\u8F93\u5165\u5B57\u7B26\u4E0A\u9650", { type: "number", min: 8e3, max: 2e5, step: 1e3 }), field("maxOutputTokens", "\u6BCF\u6B21\u8F93\u51FA Token \u4E0A\u9650", { type: "number", min: 1e3, max: 16e3, step: 1e3 })), h("p", { className: "cj-muted" }, "\u957F\u5BF9\u8BDD\u4F1A\u5206\u6279\u8C03\u7528\uFF0C\u6700\u591A 40 \u6279\u3002\u5355\u6B21\u9884\u7B97\u4E0D\u4EE3\u8868\u6574\u4E2A\u4EFB\u52A1\u7684\u8D39\u7528\u4E0A\u9650\uFF1B\u9884\u7B97\u4E0D\u8DB3\u4F1A\u505C\u6B62\uFF0C\u5DF2\u751F\u6210\u7684\u65E7\u5185\u5BB9\u4FDD\u7559\u3002")))
  );
  const settings = h(
    "div",
    { className: "cj-panel" },
    running && h("p", { className: "cj-muted", role: "status" }, "\u4EFB\u52A1\u8FDB\u884C\u4E2D\uFF0C\u7ED3\u675F\u540E\u53EF\u4FEE\u6539\u8BBE\u7F6E\u3002"),
    !model.editable && h("p", { className: "cj-field-error" }, "\u5BBF\u4E3B\u8BBE\u7F6E\u670D\u52A1\u6682\u4E0D\u53EF\u7528\uFF0C\u5F53\u524D\u8BBE\u7F6E\u53EA\u8BFB\u3002"),
    h(
      "div",
      { className: "cj-settings" },
      h("nav", { className: "cj-settings-nav", "aria-label": "\u8BBE\u7F6E\u5206\u7C7B", role: "tablist", "aria-orientation": "vertical", onKeyDown: tabKeys }, ...SECTIONS.map((s) => h("button", { key: s.id, role: "tab", id: `cj-setting-${s.id}`, "aria-selected": section === s.id, tabIndex: section === s.id ? 0 : -1, "aria-controls": "cj-settings-body", type: "button", onClick: () => setSection(s.id) }, s.label))),
      h("div", { className: "cj-stack" }, h("fieldset", { id: "cj-settings-body", role: "tabpanel", "aria-labelledby": `cj-setting-${section}`, disabled: locked || !model.editable }, { general, schedule, notion, advanced }[section]), section === "notion" && model.job?.kind?.startsWith("notion-") && jobCard(model.job))
    )
  );
  const exportDocument = (doc) => {
    const blob = new Blob([`# ${doc.title}

${doc.body}

## \u6765\u6E90
${(doc.sources ?? []).map((s) => `- ${s.source} \xB7 ${s.sessionId}
  ${s.reference ?? ""}`).join("\n")}
`], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url;
    a.download = `${doc.title.replace(/[\\/:*?"<>|]/g, "_")}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  };
  const library = h(
    "div",
    { className: "cj-panel" },
    h("div", { className: "cj-library-tools" }, h("input", { type: "search", "aria-label": "\u641C\u7D22\u5168\u90E8\u5185\u5BB9", placeholder: "\u641C\u7D22\u6807\u9898\u3001\u6B63\u6587\u3001\u9879\u76EE\u6216\u65E5\u671F", value: query, onChange: (e) => {
      setQuery(e.target.value);
      setOffset(0);
      setSelected(null);
    } }), h("select", { "aria-label": "\u5185\u5BB9\u7C7B\u578B", value: kind, onChange: (e) => {
      setKind(e.target.value);
      setOffset(0);
      setSelected(null);
    } }, h("option", { value: "" }, "\u5168\u90E8\u5185\u5BB9"), h("option", { value: "daily" }, "\u65E5\u62A5"), h("option", { value: "knowledge" }, "\u77E5\u8BC6\u5E93"))),
    h("div", { className: "cj-row cj-between" }, h("p", { className: "cj-muted" }, stats ? `${stats.daily} \u4EFD\u65E5\u62A5 \xB7 ${stats.knowledge} \u6761\u77E5\u8BC6${stats.pending ? ` \xB7 ${stats.pending} \u4EFD\u672A\u540C\u6B65` : ""}` : statsError || "\u6B63\u5728\u8BFB\u53D6\u5185\u5BB9\u7EDF\u8BA1\u2026"), searching && h("small", { role: "status" }, "\u641C\u7D22\u4E2D\u2026")),
    renderError(listError, true),
    !searching && !listError && !documents.length && h("div", { className: "cj-empty" }, h("h4", null, query || kind ? "\u6CA1\u6709\u627E\u5230\u7B26\u5408\u6761\u4EF6\u7684\u5185\u5BB9" : "\u8FD8\u6CA1\u6709\u6574\u7406\u8BB0\u5F55"), h("p", { className: "cj-muted" }, query || kind ? "\u8BD5\u8BD5\u66F4\u77ED\u7684\u5173\u952E\u8BCD\uFF0C\u6216\u5207\u6362\u5185\u5BB9\u7C7B\u578B\u3002" : "\u9009\u4E00\u5929\u5BF9\u8BDD\uFF0C\u751F\u6210\u4F60\u7684\u7B2C\u4E00\u4EFD\u65E5\u62A5\u4E0E\u77E5\u8BC6\u3002"), h("button", { type: "button", onClick: () => {
      if (query || kind) {
        setQuery("");
        setKind("");
        setOffset(0);
      } else setTab("work");
    } }, query || kind ? "\u6E05\u9664\u7B5B\u9009" : "\u53BB\u6574\u7406")),
    documents.length > 0 && !listError && h(
      "div",
      { className: `cj-library ${selected ? "has-detail" : ""}`, "aria-busy": searching },
      h("div", { className: "cj-list" }, ...documents.map((d) => h("button", { key: d.key, type: "button", className: "cj-item", "aria-expanded": selected?.key === d.key, disabled: searching, onClick: (event) => {
        const root = event.currentTarget.closest(".cj");
        const closing = selected?.key === d.key;
        setSelected(closing ? null : d);
        if (!closing && root?.clientWidth <= 680) setTimeout(() => root.isConnected && root.querySelector(".cj-detail")?.scrollIntoView({ block: "start", behavior: "auto" }), 0);
      } }, h("div", { className: "cj-row cj-between" }, h("strong", { className: "cj-grow" }, d.kind === "daily" ? `${d.date} \u65E5\u62A5` : d.title), badge(d.status === "synced" ? "\u5DF2\u540C\u6B65" : d.status === "error" ? "\u5F85\u5904\u7406" : "\u672C\u5730", d.status === "synced" ? "ok" : d.status === "error" ? "bad" : "")), h("small", null, [d.kind === "knowledge" && "\u77E5\u8BC6", d.project && compactPath(d.project), d.date].filter(Boolean).join(" \xB7 "))))),
      selected && h(
        "article",
        { className: "cj-detail" },
        h("div", { className: "cj-row cj-between" }, h("h3", { className: "cj-grow" }, selected.title), h("button", { type: "button", className: "quiet", onClick: () => setSelected(null) }, "\u6536\u8D77")),
        h("div", { className: "cj-actions" }, h("button", { type: "button", onClick: () => exportDocument(selected) }, "\u5BFC\u51FA Markdown"), h("button", { type: "button", onClick: async () => {
          try {
            await navigator.clipboard.writeText(selected.body);
            setNotice("\u6B63\u6587\u5DF2\u590D\u5236");
          } catch {
            setNotice("");
            setError(new Error("\u65E0\u6CD5\u8BBF\u95EE\u526A\u8D34\u677F\uFF0C\u8BF7\u5BFC\u51FA Markdown \u540E\u590D\u5236\u3002"));
          }
        } }, "\u590D\u5236\u6B63\u6587"), safeNotionLink(selected.link) && h("a", { href: safeNotionLink(selected.link), target: "_blank", rel: "noopener noreferrer" }, "\u5728 Notion \u6253\u5F00 \u2197")),
        h(Body, { text: selected.body }),
        h("details", { className: "cj-divider" }, h("summary", null, `\u6765\u6E90\u5F15\u7528\uFF08${selected.sources?.length ?? 0}\uFF09`), (selected.sources ?? []).map((s, i) => h("div", { className: "cj-ref", key: s.id ?? i }, h("b", null, `${sourceTitle(s.source)} \xB7 ${s.sessionId}`), h("p", { className: "cj-muted" }, s.reference))), h("p", { className: "cj-muted" }, "\u5185\u5BB9\u7531\u6A21\u578B\u6574\u7406\uFF0C\u8BF7\u7ED3\u5408\u6765\u6E90\u5BA1\u9605\u3002"))
      )
    ),
    (offset > 0 || hasNext) && h("div", { className: "cj-pagination" }, h("button", { type: "button", disabled: searching || offset === 0, onClick: () => {
      setOffset((o) => Math.max(0, o - PAGE_SIZE));
      setSelected(null);
    } }, "\u4E0A\u4E00\u9875"), h("small", null, `\u7B2C ${Math.floor(offset / PAGE_SIZE) + 1} \u9875`), h("button", { type: "button", disabled: searching || !hasNext, onClick: () => {
      setOffset((o) => o + PAGE_SIZE);
      setSelected(null);
    } }, "\u4E0B\u4E00\u9875"))
  );
  return h(
    "section",
    { className: "cj", "aria-label": "\u5BF9\u8BDD\u6574\u7406" },
    h("style", null, CSS),
    h("header", { className: "cj-header" }, h("div", null, h("h2", null, "\u5BF9\u8BDD\u6574\u7406"), h("p", { className: "cj-muted" }, "\u6309\u5929\u6574\u7406\u5BF9\u8BDD\uFF0C\u56DE\u770B\u65E5\u62A5\u4E0E\u77E5\u8BC6\u3002")), h("span", { className: "cj-mark", "aria-hidden": true }, h("svg", { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" }, h("path", { d: "M5 3h11l3 3v15H5z M15 3v5h4 M8 12h8 M8 16h5" })))),
    h("nav", { className: "cj-tabs", role: "tablist", "aria-label": "\u5BF9\u8BDD\u6574\u7406\u5BFC\u822A", onKeyDown: tabKeys }, ...TABS.map((t) => h("button", { type: "button", role: "tab", className: "cj-tab", key: t.id, id: `cj-tab-${t.id}`, "data-tab": t.id, "aria-selected": tab === t.id, tabIndex: tab === t.id ? 0 : -1, "aria-controls": "cj-main", onClick: () => setTab(t.id) }, t.label, t.id === "settings" && dirty && h("span", { className: "cj-unsaved", "aria-label": "\u6709\u672A\u4FDD\u5B58\u4FEE\u6539" })))),
    h("div", { id: "cj-main", role: "tabpanel", "aria-labelledby": `cj-tab-${tab}` }, { work, library, settings }[tab]),
    renderError(error),
    notice && h("p", { className: "cj-notice", role: "status" }, notice),
    dirty && h("div", { className: "cj-savebar" }, h("div", null, h("h4", null, conflict ? "\u8BBE\u7F6E\u9700\u8981\u66F4\u65B0" : "\u6709\u672A\u4FDD\u5B58\u7684\u4FEE\u6539"), h("p", { className: "cj-muted" }, running ? "\u4EFB\u52A1\u7ED3\u675F\u540E\u53EF\u4EE5\u4FDD\u5B58\uFF0C\u5F53\u524D\u4EFB\u52A1\u4F7F\u7528\u5F00\u59CB\u65F6\u7684\u8BBE\u7F6E\u3002" : "\u5207\u6362\u9875\u9762\u4F1A\u4FDD\u7559\u8349\u7A3F\uFF0C\u4FDD\u5B58\u540E\u751F\u6548\u3002")), h("div", { className: "cj-actions" }, h("button", { type: "button", disabled: locked, onClick: () => {
      if (conflict) return perform("reload", async () => {
        await reload(void 0, true);
        setError(null);
      });
      setForm(normalizeDraft(savedConfig));
      setFields({});
      setError(null);
      setNotice("");
    } }, conflict ? "\u8F7D\u5165\u6700\u65B0\u8BBE\u7F6E" : "\u653E\u5F03\u4FEE\u6539"), h("button", { type: "button", className: "primary", disabled: locked || !model.editable || conflict, onClick: () => perform("save", persist) }, busy === "save" ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58\u8BBE\u7F6E")))
  );
}
function apply(ctx) {
  const Section = () => h(JournalPanel, { connection: ctx.connection });
  ctx.effect(() => {
    try {
      return ctx.slots.inject("settings.section", () => {
        try {
          return ctx.slots.register({ name: "settings.section", id: "dsh-conversation-journal", order: 34, label: () => "\u5BF9\u8BDD\u6574\u7406" }, Section);
        } catch {
          ctx.logger?.error?.("\u5BF9\u8BDD\u6574\u7406\u8BBE\u7F6E\u9875\u6CE8\u518C\u5931\u8D25");
          return void 0;
        }
      });
    } catch {
      ctx.logger?.error?.("\u5BF9\u8BDD\u6574\u7406\u8BBE\u7F6E\u9875\u6CE8\u518C\u5931\u8D25");
      return void 0;
    }
  }, "conversation-journal: settings");
}

return module.exports;}});

# 最小扩展边界

```text
DSH sessionQuery ─┐
Codex JSONL ──────┼─ SourceRegistry → 统一对话索引 → 按日/按知识点整理 → NotionOutput
未来聊天记录 ────┘                                    └→ 本地结果缓存
```

## 来源接口

`SourceRegistry.register(name, adapter)` 注册来源。`adapter.scan({store, config, signal, warn, day})` 负责只读采集、来源特有的增量游标及规范化。通过 `normalRecord()` 生成记录，`store.putMessages()` 写入索引；`store.set/get()` 保存游标。批次消息与游标通过 `store.transaction()` 一起提交。必须响应取消并在大批量工作之间让出事件循环。

基础记录字段为 `source / sessionId / messageId / time / role / text / reference`；`project` 与 `metadata` 可选。`role` 是开放字符串，普通聊天可记录发言者身份；不依赖工具、代码仓库或任务状态。来源必须提供稳定标识，或基于原始记录位置形成可重建标识。`time` 归一化为 Unix 毫秒。

第一版设置页仅允许 `dsh`、`codex`，以后增加来源只需实现适配器、在配置/设置页增加来源选项并注册，不改生成器或 Notion 模块。需要图片/语音/OCR 时由新适配器负责生成可分析文本与来源信息，不能声称未读取的附件已经分析。

## 整理器

`analyzer.js` 只处理规范化文本，不依赖来源接口。调用 DSH `llm.prepareCall` 的一次性无工具模型请求，不创建 Agent 或历史会话。每次请求 180 秒超时，支持主动取消。结构化结果先验证引用与字段，再落盘；未知来源和截断结果拒绝覆盖。

`JournalService` 串行执行生成、Notion 初始化和同步，提供状态及取消。来源范围和完整性提示进入日报。SQLite 是索引、缓存和 outbox；原始会话保持只读。通过独占文件锁限制一个写入实例，过期锁只在确认原 PID 不存在后回收。

知识条目采用规范化标题 + 项目的稳定 Key，不引入向量库；相同条目追加有日期的补充，已有内容包含新片段时不重复追加。相似但不相同的条目暂不自动合并。

## 输出接口

`NotionOutput.test / initialize / sync(document)` 与来源完全独立。`document` 包含 `key / kind / title / date / body / sources`，知识额外包含 `project / tags`。未来文件导出可直接消费该结构，不需要再解析原始对话。

同步收据按 Notion 父页面隔离。页面用 `Key` 查询恢复；正文用包含文档 Key 和内容摘要的折叠区域恢复。人工编辑比较基于已有区域的实际块内容，不仅信任标记。不能为任意未知旧区域自动建立覆盖权限。

## 验证范围

- 单元/集成测试：时间与范围、真实 SQLite 事务与锁、增量完整行、归档重复、DSH 继承/合成消息、无工具模型流、结构化引用、普通聊天适配、重跑缓存、自动时间段与取消、RPC 白名单、部分初始化失败。
- 模拟 Notion：数据库初始化恢复、稳定页面、人工备注与自动区域冲突、创建/追加响应丢失、旧版本清理失败、未知基线、格式修改、限流。
- 隔离浏览器：宿主设置槽位、保存/密钥不回显、生成/取消、中文搜索、文本转义、窄屏、接口失败、卸载清理。
- 尚需真实环境验收：实际 DSH 设置页加载、所选提供商推理、Notion 账户权限与真实页面写入、长期运行的自动生成。

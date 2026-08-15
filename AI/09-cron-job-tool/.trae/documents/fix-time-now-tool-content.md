# 修复 `message.content.flatMap is not a function`（time_now 工具返回对象导致）

## Summary（概要）

调用 AI SSE 对话时（如 query = "5分钟后提醒我喝水"），第一轮模型调用 `time_now` 工具成功，但把工具结果 push 回 `messages` 后进入**第二轮** `stream()` 时，抛出 `message.content.flatMap is not a function`。

**根因**：`time_now` 工具的实现直接返回了一个 JavaScript 对象 `{ iso, timestamp }`。在 LangChain 1.x 中，`tool()` 包装函数的返回值会被直接放入 `ToolMessage.content`。当 `content` 是**对象**（而非字符串或 content-block 数组）时，`@langchain/openai` 在把历史消息转换成 OpenAI 请求格式的过程中会对 `content` 调用 `.flatMap(...)` / `.findIndex(...)`，而对象没有这些数组方法，于是运行时报错。

用户提供的运行时数据已直接证实：第二轮 `messages` 里存在
```
ToolMessage { "content": { "iso": "2026-08-14T05:47:46.303Z", "timestamp": 1786686466303 }, ... }
```
`content` 是对象，正是触发点。

**结论**：`ToolMessage.content` 必须是字符串。修复方式是让工具返回字符串（或在写入 `ToolMessage` 时对结果做字符串化）。

## Current State Analysis（现状分析）

- 触发链路：
  - [ai.controller.ts](file:///e:/project/test/AI/09-cron-job-tool/src/ai/ai.controller.ts) 调用 `runChainStream(query)`
  - [ai.service.ts:83-225](file:///e:/project/test/AI/09-cron-job-tool/src/ai/ai.service.ts#L83-L225) 的多轮工具调用循环
  - 第二轮 [ai.service.ts:111](file:///e:/project/test/AI/09-cron-job-tool/src/ai/ai.service.ts#L111) `this.modelWithTools.stream(messages)` 抛错
- 问题工具定义：[ai.module.ts:454-472](file:///e:/project/test/AI/09-cron-job-tool/src/ai/ai.module.ts#L454-L472) `TIME_NOW_TOOL`
  ```
  return { iso: now.toISOString(), timestamp: now.getTime() };  // ← 返回对象
  ```
- 对照：其他工具（`send_mail`/`web_search`/`db_users_crud`/`cron_job`）都返回**字符串**，所以从未触发此错误。这进一步锁定 `time_now` 是唯一返回非字符串的工具。
- LangChain 版本：`@langchain/core@1.2.1`、`@langchain/openai@1.5.3`（1.x），`ToolMessage.content` 期望为字符串。

## Proposed Changes（提议的改动）

### 改动 1（主修复）：让 `time_now` 工具返回字符串
**文件**：[ai.module.ts:454-472](file:///e:/project/test/AI/09-cron-job-tool/src/ai/ai.module.ts#L454-L472)
**What/Why**：工具返回值会成为 `ToolMessage.content`，必须是字符串，避免 `@langchain/openai` 转换时对对象调用 `flatMap`。
**How**：把返回的对象改为其 JSON 字符串形式。模型仍能从字符串中读到 `iso` 和 `timestamp`，语义不丢失。

```ts
return tool(
  () => {
    const now = new Date();
    return JSON.stringify({
      iso: now.toISOString(),
      timestamp: now.getTime(),
    });
  },
  {
    name: 'time_now',
    description:
      '获取当前服务器时间，返回 ISO 字符串（iso）和毫秒级时间戳（timestamp）。',
  },
);
```

### 改动 2（防御性加固，可选但推荐）：在写入 ToolMessage 时统一字符串化
**文件**：[ai.service.ts:159-223](file:///e:/project/test/AI/09-cron-job-tool/src/ai/ai.service.ts#L159-L223) 的工具结果处理分支
**What/Why**：即使将来新增的工具再次误返回非字符串，也不会让整个对话崩溃。这是对根因的兜底，防止同类问题复发。
**How**：在每个 `new ToolMessage({ content })` 处，把 `result` 规范化为字符串。推荐抽取一个小的本地帮助函数：

```ts
const toToolContent = (result: unknown): string =>
  typeof result === 'string' ? result : JSON.stringify(result);
```
然后各分支用 `content: toToolContent(result)`。

> 注意：仅做 改动 1 已能修复当前报错；改动 2 用于防止未来同类问题。若希望改动最小化，可只做改动 1。

## Assumptions & Decisions（假设与决策）

- **决策**：优先在工具侧（改动 1）修复，因为它是根因所在，且不改变对外行为（模型仍拿到 iso/timestamp）。
- **假设**：模型能正常解析 JSON 字符串形式的时间（这是 LangChain 工具结果的标准做法，通常没问题）。
- **决策**：改动 2 作为防御性加固推荐一并实施，成本极低，可根治"工具返回对象"这一类问题。
- **不改动**：不升级/降级 LangChain 版本——问题可在应用侧干净修复，动版本风险更大。
- **超出范围**：`ai.module.ts:327` `type` 枚举里的 `'corn'` 疑似拼写错误（应为 `'cron'`）、[ai.service.ts:120](file:///e:/project/test/AI/09-cron-job-tool/src/ai/ai.service.ts#L120) 直接 push chunk 等其它历史问题，与本次报错无直接因果，本次不处理，仅在此备注。

## Verification（验证步骤）

1. 应用改动后（改动 1，及可选的改动 2），保存文件让 `start:dev`/`start:debug` 热重载重新编译（确认 "Found 0 errors"）。
2. 前置条件：MySQL 已启动且库 `hello` 存在（否则 TypeORM 会 `ECONNREFUSED`，属独立问题）。
3. 浏览器打开 `http://localhost:3000/ai-sse-test.html`，输入「5分钟后提醒我喝水」。
4. 预期：
   - 不再出现 `event: error ... flatMap is not a function`；
   - 第一轮调用 `time_now`，第二轮调用 `cron_job` 成功创建 `type=at` 任务；
   - SSE 正常流式返回最终文本回复。
5. 回归检查：再测一个纯文本问答与一个 `web_search` 场景，确认其它工具链路未受影响。

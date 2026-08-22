# AI 流式返回内容区分与前端展示指南

> 本文档整理自两次关于 LangChain 流式输出与前端展示的对话讨论，适用于 `09-cron-job-tool` 项目的 `ai.service.ts` / `ai.controller.ts` 与前端 SSE 消费链路。

---

## 一、`yield chunk.content` 返回的是什么

### 1.1 返回内容

`yield chunk.content` 返回的是 **AI 模型本轮输出的普通文本内容**（字符串），是模型实时生成的文字片段（一个字、一个词、一句话），最终会被前端拼接成完整回复。

### 1.2 LangChain 流式输出的内容类型

ChatOpenAI 流式接口的每个 `AIMessageChunk` 可能携带以下几类内容：

#### 1.2.1 普通文本内容 `chunk.content`

```typescript
{ content: "你", ... }
{ content: "好", ... }
{ content: "！", ... }
```

- **类型**：`string`
- **含义**：模型正常生成的回复文本
- **来源**：模型直接输出给用户看的内容

#### 1.2.2 思考内容 `chunk.additional_kwargs.reasoning_content`

```typescript
{
  content: "",
  additional_kwargs: {
    reasoning_content: "我需要先查询用户信息..."
  }
}
```

- **类型**：`string`
- **含义**：模型"思考过程"（DeepSeek-R1、GPT-o1 等推理模型才有）
- **特点**：`content` 为空，思考内容在 `additional_kwargs.reasoning_content` 中
- **UI 处理**：通常折叠展示或灰色显示

#### 1.2.3 工具调用片段 `chunk.tool_call_chunks`

```typescript
{
  content: "",
  tool_call_chunks: [{
    name: "send_mail",
    args: '{"to":"',  // 参数被切成多片
    id: "call_xxx",
    index: 0
  }]
}
{ content: "", tool_call_chunks: [{ args: 'user@', index: 0 }] }
{ content: "", tool_call_chunks: [{ args: 'test.com"}', index: 0 }] }
```

- **类型**：数组
- **含义**：模型决定调用工具时，工具名 + 参数会被流式分片输出
- **特点**：`content` 为空，参数 JSON 被切成多片拼接
- **不应 yield 给前端**：这是模型内部决策，不是给用户看的内容

### 1.3 当前代码的区分策略（ai.service.ts L130-137）

```typescript
const hasToolCallChunk =
  !!fullAIMessage.tool_call_chunks &&
  fullAIMessage.tool_call_chunks.length > 0;

// 只要当前轮次还没出现 tool 调用的 chunk，就可以把文本内容流式往外推
if (!hasToolCallChunk && chunk.content) {
  yield chunk.content as string;
}
```

**关键判断**：检查**累积的** `fullAIMessage.tool_call_chunks`（不是当前 chunk 的）：

- 本轮还没出现 tool_call_chunk → 文本内容是给用户看的 → yield
- 本轮已出现过 tool_call_chunk → 后续 chunk 多半是工具参数分片 → 不 yield

这种"一旦切换到工具调用就停止 yield"的策略是合理的，因为模型在同一轮里**通常**不会既输出文本又调用工具。

### 1.4 多轮对话中如何区分阶段

`runChainStream` 外层是个 `while(true)` 循环（L109-223），每轮对应一个阶段：

```
┌─────────────────────────────────────────────────────────┐
│ Round 1: 模型收到用户 query                              │
│   ├─ chunk 流出：思考内容（如有）                         │
│   ├─ chunk 流出：普通文本（解释要做什么）                │
│   └─ chunk 流出：tool_call_chunks（决定调用工具）        │
│         ↓                                                │
│   代码: fullAIMessage.tool_calls.length > 0 → 继续      │
│   代码: 执行对应工具，结果 push 成 ToolMessage            │
└─────────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│ Round 2: 模型拿到工具结果继续推理                        │
│   ├─ chunk 流出：思考内容                                │
│   ├─ chunk 流出：普通文本                                 │
│   └─ chunk 流出：又调用别的工具？                         │
│         ↓                                                │
│   代码: 如有 tool_calls 继续；否则进入下一轮              │
└─────────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│ Round N (最终轮): 模型不再调用工具                       │
│   ├─ chunk 流出：普通文本（最终结论）                     │
│   └─ chunk: content="" tool_call_chunks=undefined        │
│         ↓                                                │
│   代码: toolCalls.length === 0 → return (结束流)         │
└─────────────────────────────────────────────────────────┘
```

### 1.5 三类内容的区分方法（汇总表）

| 内容类型 | 字段位置 | 当前代码是否 yield | 如何识别 |
|---------|---------|-------------------|---------|
| **思考过程** | `additional_kwargs.reasoning_content` | ❌ 不 yield（被注释掉了，L127-129） | 字段存在且非空 |
| **中间轮文本** | `content`（在 while 循环中间几轮） | ✅ yield | `content` 非空且无 tool_call_chunks |
| **最终结论** | `content`（最后一轮，无 tool_calls） | ✅ yield | 同上，外层 while 通过 `toolCalls.length===0` 退出 |
| **工具调用参数** | `tool_call_chunks` | ❌ 不 yield | `tool_call_chunks` 数组非空 |

### 1.6 当前代码的两个细节问题

#### 问题 1：思考内容被过滤掉了

L127-129 被注释：

```typescript
// if (chunk.additional_kwargs.reasoning_content) {
//   yield chunk.additional_kwargs.reasoning_content as string;
// }
```

**后果**：如果使用 DeepSeek-R1 等推理模型，思考过程**不会**输出到前端，用户只能看到最终结论。

#### 问题 2：无法区分"中间轮文本"和"最终结论"

当前代码**对前端来说无法区分**这两类——它们都是同样的 `yield chunk.content` 字符串流。前端只能看到一段连续的文本拼接。

---

## 二、如何在前端区分并展示思考过程与最终结论

### 2.1 现状回顾

当前架构下，前端通过 EventSource 只能拿到一段**连续拼接的字符串**，无法区分思考过程、中间轮文本、最终结论：

```
前端 onmessage 收到的：
"data1" + "data2" + "data3" + ... = "你好我是AI..."
                  ↑ 思考? 中间? 最终? 无法分辨
```

### 2.2 三种解决方案对比

| 方案 | 改动量 | SSE 兼容性 | 推荐度 |
|------|--------|----------|--------|
| **A. SSE event 类型** | 中 | ✅ 原生支持 | ⭐⭐⭐⭐⭐ |
| **B. JSON 信封** | 小 | ✅ | ⭐⭐⭐⭐ |
| **C. 特殊文本标记** | 极小 | ✅ | ⭐⭐ |

---

### 2.3 方案 A：SSE event 类型（推荐）

#### 2.3.1 原理

SSE 协议除了 `data:` 字段，还支持 `event:` 字段，前端可用 `addEventListener('事件名', ...)` 分别监听：

```
event: reasoning
data: 我需要先查询...

event: text
data: 你好

event: final
data: 这是最终结论

event: tool
data: 调用了 send_mail 工具
```

#### 2.3.2 后端实现

**Step 1：修改 `ai.service.ts` 让 yield 携带类型**

把 `yield string` 改成 `yield { type, data }`：

```typescript
type StreamChunk =
  | { type: 'reasoning'; data: string }
  | { type: 'text'; data: string }
  | { type: 'tool'; data: string }
  | { type: 'final'; data: string };

async *runChainStream(query: string): AsyncIterable<StreamChunk> {
  // ...省略 messages 构造...

  while (true) {
    const stream = await this.modelWithTools.stream(messages);
    let fullAIMessage: AIMessageChunk | null = null;

    for await (const chunk of stream as AsyncIterable<AIMessageChunk>) {
      fullAIMessage = fullAIMessage ? fullAIMessage.concat(chunk) : chunk;

      // 1. 思考内容：单独 yield，标注类型
      if (chunk.additional_kwargs.reasoning_content) {
        yield {
          type: 'reasoning',
          data: chunk.additional_kwargs.reasoning_content as string,
        };
      }

      const hasToolCallChunk =
        !!fullAIMessage.tool_call_chunks &&
        fullAIMessage.tool_call_chunks.length > 0;

      // 2. 普通文本：本轮还没进入工具调用阶段时 yield
      if (!hasToolCallChunk && chunk.content) {
        yield { type: 'text', data: chunk.content as string };
      }
    }

    if (!fullAIMessage) return;

    messages.push(fullAIMessage);
    const toolCalls = fullAIMessage.tool_calls ?? [];

    // 3. 工具调用：通知前端本轮发起了工具调用
    for (const toolCall of toolCalls) {
      yield {
        type: 'tool',
        data: `调用工具：${toolCall.name}，参数：${JSON.stringify(toolCall.args)}`,
      };
    }

    // 4. 最终结论：无工具调用 → 标记结束
    if (!toolCalls.length) {
      yield { type: 'final', data: '[DONE]' };
      return;
    }

    // 执行工具，结果 push 到 messages，进入下一轮
    for (const toolCall of toolCalls) {
      // ... 现有工具调用逻辑 ...
    }
  }
}
```

**Step 2：修改 `ai.controller.ts` 把类型映射到 SSE event 字段**

```typescript
@Sse('chat/stream')
chatStream(@Query('query') query: string): Observable<MessageEvent> {
  const stream = this.aiService.runChainStream(query);
  return from(stream).pipe(
    map(({ type, data }) => ({
      type,           // ← SSE event 字段
      data,           // ← SSE data 字段
    })),
  );
}
```

返回的 `MessageEvent` 含 `type` 时，Nest 会自动生成 `event: xxx\ndata: xxx\n\n` 格式的 SSE 帧。

#### 2.3.3 前端实现

```typescript
function streamAiReply(query: string) {
  return new Promise<void>((resolve) => {
    const url = '/ai/chat/stream?query=' + encodeURIComponent(query);
    const es = new EventSource(url);

    let reasoningText = '';
    let finalText = '';

    // 思考内容单独显示在折叠区
    es.addEventListener('reasoning', (e) => {
      reasoningText += e.data;
      updateReasoningBubble(reasoningText); // 灰色/折叠展示
    });

    // 普通文本追加到主气泡
    es.addEventListener('text', (e) => {
      finalText += e.data;
      updateMainBubble(finalText);
    });

    // 工具调用：显示一个 chip "🔧 调用 send_mail"
    es.addEventListener('tool', (e) => {
      appendToolChip(e.data);
    });

    // 最终结论标记：可选滚动到底部 / 解除 loading
    es.addEventListener('final', () => {
      setStatus('对话完成');
      es.close();
      resolve();
    });

    es.onerror = () => {
      es.close();
      resolve();
    };
  });
}
```

#### 2.3.4 前端 UI 结构示例

```html
<!-- 思考过程：折叠展开 -->
<details class="reasoning">
  <summary>💭 思考过程</summary>
  <div id="reasoningContent" class="reasoning-text"></div>
</details>

<!-- 工具调用：横向 chips -->
<div class="tool-chips" id="toolChips"></div>

<!-- 最终回复：主气泡 -->
<div class="bubble" id="mainBubble"></div>
```

```css
.reasoning-text {
  color: #94a3b8;
  font-style: italic;
  font-size: 13px;
  background: #f8fafc;
  padding: 10px;
  border-radius: 8px;
  white-space: pre-wrap;
}

.tool-chips {
  display: flex;
  gap: 6px;
  margin: 6px 0;
}

.tool-chip {
  background: #fef3c7;
  color: #92400e;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 12px;
}
```

---

### 2.4 方案 B：JSON 信封（改动小）

如果不想动 SSE event 字段，可以在 data 里塞 JSON：

#### 后端

```typescript
// service 改为
yield JSON.stringify({ type: 'reasoning', data: chunk.additional_kwargs.reasoning_content });

// controller 不变
return from(stream).pipe(map((chunk) => ({ data: chunk })));
```

#### 前端

```typescript
es.onmessage = (e) => {
  try {
    const msg = JSON.parse(e.data);
    if (msg.type === 'reasoning') {
      reasoningText += msg.data;
      updateReasoningBubble(reasoningText);
    } else if (msg.type === 'text') {
      finalText += msg.data;
      updateMainBubble(finalText);
    }
    // ...
  } catch {
    // 兼容旧版纯文本流
    finalText += e.data;
    updateMainBubble(finalText);
  }
};
```

**优势**：兼容现有 SSE 控制器，只改 service 和前端
**劣势**：每个 chunk 都要 JSON.parse，对高频流式有一定开销

---

### 2.5 方案 C：特殊文本标记（最简单）

完全不修改协议，只用文本前缀：

#### 后端

```typescript
// service
if (chunk.additional_kwargs.reasoning_content) {
  yield `💭${chunk.additional_kwargs.reasoning_content}`;
}
if (!hasToolCallChunk && chunk.content) {
  yield `💬${chunk.content}`;
}
```

#### 前端

```typescript
es.onmessage = (e) => {
  const data = e.data;
  if (data.startsWith('💭')) {
    reasoningText += data.slice(1);
  } else if (data.startsWith('💬')) {
    finalText += data.slice(1);
  }
};
```

**优势**：零架构改动
**劣势**：前缀污染数据，不利于后续解析

---

### 2.6 推荐选型

| 场景 | 推荐方案 |
|------|---------|
| **生产环境** | 方案 A（SSE event 类型）—— 协议清晰、扩展性好、 Nest/SSE 规范原生支持 |
| **快速验证** | 方案 B（JSON 信封）—— 改动小、向后兼容 |
| **Demo 演示** | 方案 C（文本标记）—— 几行代码搞定 |

---

### 2.7 完整效果对比

#### 改造前

```
[用户]：1分钟后提醒我喝水
[AI]：好的我先调用 cron_job 创建任务...好的我已经为你设置好了...
```

（思考过程、工具调用、最终结论混在一起）

#### 改造后（方案 A）

```
[用户]：1分钟后提醒我喝水

💭 思考过程（可折叠）
   用户要 1 分钟后提醒，应该用 cron_job + type=at，
   at = 当前时间 + 60秒。instruction 应填"提醒我喝水"...

🔧 调用工具
   [cron_job] { type: 'add', at: '...', instruction: '提醒我喝水' }

💬 最终回复
   好的，我已经为你设置了一个 1 分钟后的定时任务，
   届时会提醒你喝水。
```

完整保留了从思考到结论的全过程，UI 可按需折叠/展开各部分。

---

## 三、关键改动点速查

| 文件 | 改造前 | 改造后（方案 A） |
|------|--------|------------------|
| `ai.service.ts` L136 | `yield chunk.content as string` | `yield { type: 'text', data: chunk.content }` |
| `ai.service.ts` L127-129 | 注释掉 | 取消注释，yield `{ type: 'reasoning', data: ... }` |
| `ai.controller.ts` L19 | `map(chunk => ({ data: chunk }))` | `map(({type, data}) => ({ type, data }))` |
| 前端 `es.onmessage` | 累加所有 data | `addEventListener('reasoning'/'text'/'final')` 分别处理 |

---

## 四、相关代码定位

- 流式服务实现：[`ai.service.ts`](./ai.service.ts) `runChainStream` 方法（L83-224）
- SSE 控制器：[`ai.controller.ts`](./ai.controller.ts) `chatStream` 方法（L16-20）
- 关键过滤逻辑：[`ai.service.ts`](./ai.service.ts) L130-137（tool_call_chunks 判断）
- 最终轮判断：[`ai.service.ts`](./ai.service.ts) L154（`if (!toolCalls.length)`）

---

## 五、项目约束（来自项目记忆）

- AI response streams must filter out tool call chunks and only yield non-empty content strings to frontend
- Asynchronous stream handling in services uses async generator functions with `for await...yield` or `yield*` for forwarding LangChain streams
- AI controller SSE endpoints convert AsyncIterable<string> streams to Observable using RxJS `from()` and map to `{ data: chunk }`
- Frontend SSE consumption uses EventSource API with onmessage event to accumulate and render chunks incrementally
- SSE endpoints using `@Sse()` must return `Observable<MessageEvent>` with `{ data: chunk }` structure

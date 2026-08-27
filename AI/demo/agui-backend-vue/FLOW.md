# agui-backend-vue 数据流文档

> 本文档讲解项目从「请求发送 → 接收响应 → 流式处理 → 界面显示」的完整流程与设计思路。

## 目录

- [整体架构](#整体架构)
- [阶段一：请求发送](#阶段一请求发送)
- [阶段二：接收响应流](#阶段二接收响应流)
- [阶段三：流式处理（核心）](#阶段三流式处理核心)
- [阶段四：界面显示](#阶段四界面显示)
- [完整时序图](#完整时序图)
- [关键技术决策](#关键技术决策)

---

## 整体架构

```
┌─────────────────────────────────────────────────────────┐
│  前端（Vue 3 + Vite）                                    │
│                                                         │
│  App.vue ── useChat composable ── fetch POST            │
│    │              │                        │            │
│    │              │                        ▼            │
│    │              │              ┌─ ReadableStream ──┐  │
│    │              │              │  逐 chunk 读取     │  │
│    │              │              │  按行解析 SSE      │  │
│    │              │              │  handleStreamEvent│  │
│    │              │              └──────────────────┘  │
│    │              │                        │            │
│    │              │     响应式更新 messages[i].parts    │
│    │              │                        │            │
│    │     ┌────────┘                        ▼            │
│    │     │     Vue 自动重渲染                             │
│    │     │        │                                     │
│    │     ▼        ▼                                     │
│  MessagePart → StreamdownText / ToolMessagePart       │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          │
                    HTTP POST + SSE 流
                          │
┌─────────────────────────▼──────────────────────────────┐
│  后端（NestJS）                                          │
│                                                         │
│  AiController @Post('chat')                             │
│    → AiService.stream(messages)                        │
│    → LangChain createAgent + tool 调用                  │
│    → toUIMessageStream()                                │
│    → pipeUIMessageStreamToResponse()                    │
│      → Content-Type: text/event-stream                 │
│      → 逐块写入 SSE: data: {json}\n\n                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 阶段一：请求发送

```
用户输入 → App.vue doSend() → useChat.sendMessage() → fetch POST
```

### 1.1 用户输入触发发送

用户在 textarea 输入文本，按 Enter（或点击「发送」按钮）触发 `doSend()`：

```typescript
// src/App.vue
function doSend() {
  if (!canSend.value) return          // ready + 非空输入才允许发送
  void sendMessage({ text: input.value })
  input.value = ''                    // 清空输入框
}
```

### 1.2 构造请求

`useChat.sendMessage()` 做三件事：

```typescript
// src/composables/useChat.ts
async function sendMessage(msg: { text: string }) {
  // ① push 用户消息到 messages（UI 立即显示用户气泡）
  const userMessage: UIMessage = {
    id: genId(),
    role: 'user',
    parts: [{ type: 'text', text: msg.text }],
  }
  messages.value.push(userMessage)

  // ② 进入 submitted 状态（按钮禁用、输入框锁定）
  status.value = 'submitted'
  abortController = new AbortController()

  // ③ fetch POST，body 带完整消息历史
  const response = await fetch(options.api, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: messages.value }),
    signal: abortController.signal,
  })
}
```

- 请求体格式 `{ messages: UIMessage[] }`，与后端 `AiController` 的 `@Body()` 参数一致
- `signal` 建立 fetch 与 `stop()` 按钮的桥梁，用户可随时中断

---

## 阶段二：接收响应流

```
后端 pipeUIMessageStreamToResponse → HTTP chunked → fetch ReadableStream → reader.read()
```

### 2.1 后端编码格式

后端使用 Vercel AI SDK 的 `pipeUIMessageStreamToResponse`，内部通过 `JsonToSseTransformStream` 将每个事件块编码为标准 SSE：

```
data: {"type":"start","messageId":"a1"}\n\n
data: {"type":"text-delta","id":"t1","delta":"你好"}\n\n
data: [DONE]\n\n
```

响应头：

| Header | 值 | 作用 |
|--------|-----|------|
| Content-Type | text/event-stream | SSE 标准 |
| Cache-Control | no-cache | 禁止缓存 |
| Connection | keep-alive | 长连接 |
| X-Accel-Buffering | no | 禁止 nginx 缓冲 |

### 2.2 前端逐块读取

前端用 `ReadableStream` 逐块读取，**不等响应结束就开始处理**：

```typescript
// src/composables/useChat.ts
const reader = response.body.getReader()
const decoder = new TextDecoder()
let buffer = ''

while (true) {
  const { done, value } = await reader.read()   // 每次收到一个 chunk
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  // → 进入行解析
}
```

---

## 阶段三：流式处理（核心）

```
SSE 行 → JSON.parse → handleStreamEvent → 响应式更新 messages[i].parts
```

### 3.1 按行切分 SSE

从 buffer 中按 `\n` 切行，提取 `data:` 后的 JSON：

```typescript
// src/composables/useChat.ts
while ((newlineIdx = buffer.indexOf('\n')) >= 0) {
  const line = buffer.slice(0, newlineIdx).trim()
  buffer = buffer.slice(newlineIdx + 1)
  if (!line.startsWith('data:')) continue

  const data = line.slice(5).trim()
  if (data === '[DONE]') { status.value = 'ready'; return }

  const event = JSON.parse(data)        // → {"type":"text-delta","delta":"你好",...}
  handleStreamEvent(event, ctx)         // → 交给事件处理器
}
```

### 3.2 事件处理器

`handleStreamEvent` 根据 `event.type` 分发，增量更新 `messages` 数组中助手消息的 `parts`：

| 事件类型 | 处理逻辑 |
|---------|---------|
| `start` | 创建空助手消息，push 到 messages |
| `text-start` | push 一个空 text part |
| `text-delta` | 最后一个 text part 的 `text += delta`（逐字追加） |
| `text-end` | 无操作 |
| `tool-input-start` | push 工具 part（state = `input-streaming`） |
| `tool-input-delta` | 拼接工具参数 JSON 片段到缓冲 |
| `tool-input-available` | 设置 `part.input` + state = `input-available` |
| `tool-output-available` | 设置 `part.output` + state = `output-available` |
| `tool-output-error` | 设置 `part.errorText` + state = `output-error` |
| `finish` | 无操作（status 由调用方设置） |
| `[DONE]` | status = `ready` |

### 3.3 响应式关键点

Vue 3 的响应式系统基于 Proxy。push 到 reactive 数组后，**必须从数组取回代理对象**，后续修改才能触发重渲染：

```typescript
// src/composables/useChat.ts
ctx.messages.push(msg)
// 关键：从 reactive 数组取回代理对象
const reactiveMsg = ctx.messages[ctx.messages.length - 1]
ctx.setAssistant(reactiveMsg)
```

之后 `p.text += delta` 通过 Proxy 的 set 拦截 → 触发依赖 → Vue 重渲染。

> 如果直接使用原始 `msg` 引用，修改 `parts` 不会触发 Vue 更新，导致 UI 不刷新。

---

## 阶段四：界面显示

```
messages 变化 → App.vue v-for 重渲染 → MessagePart 分发 → StreamdownText / ToolMessagePart
```

### 4.1 App.vue 遍历消息

```html
<!-- src/App.vue -->
<article v-for="message in messages" :key="message.id"
         :class="`chat-bubble chat-bubble--${message.role}`">
  <MessagePart
    v-for="(part, index) in message.parts"
    :key="`${message.id}-p-${index}`"
    :part="part"
    :text-stream-active="isTextStreaming(message, index)"
  />
</article>
```

每次 `messages` 或 `parts` 变化，Vue 自动重渲染对应组件。

### 4.2 MessagePart 分发

`MessagePart.vue` 根据 `part.type` 分发到不同子组件：

```
type='text'             → StreamdownText（Markdown 渲染）
type='tool-invocation'  → ToolMessagePart（工具面板）
其他                    → 不渲染
```

### 4.3 StreamdownText 流式 Markdown

用 `computed` 响应式重算，`content` 变化时自动重新渲染 Markdown：

```typescript
// src/components/StreamdownText.vue
const html = computed(() => {
  const rendered = renderMarkdown(props.content)   // markdown-it → HTML
  if (!props.isStreaming) return rendered
  // 流式中：末尾追加闪烁光标
  return `${rendered}<span class="chat-streamdown__cursor"></span>`
})
```

渲染链路：`text-delta` → `part.text += delta` → `content` prop 变化 → `computed` 重算 → `v-html` 更新 → 用户看到文字逐字出现 + 闪烁光标。

### 4.4 ToolMessagePart 工具面板状态机

根据 `part.state` 切换不同面板：

```
input-streaming   → ToolPendingPanel / SendMailToolPanel（参数生成中）
input-available    → 同上（参数就绪等待执行）
output-available   → WebSearchToolPanel / SendMailToolPanel / DefaultToolOutput
output-error       → ToolErrorPanel
```

```
src/components/ToolMessagePart.vue
  ├─ WebSearchToolPanel.vue    联网搜索结果卡片
  ├─ SendMailToolPanel.vue     发邮件面板
  ├─ ToolPendingPanel.vue      工具执行中提示
  ├─ ToolErrorPanel.vue        工具出错面板
  └─ DefaultToolOutput.vue     兜底输出
```

---

## 完整时序图

以「北京天气」为例：

```
用户输入 "北京天气"
  │
  ├─ App.vue: sendMessage({text:"北京天气"})
  ├─ useChat: messages.push(用户消息) → UI 立即显示用户气泡
  ├─ useChat: status='submitted' → 按钮禁用
  ├─ useChat: fetch POST → 后端
  │
  │  后端: LLM 生成 → toUIMessageStream → SSE chunks
  │
  │  ←─ data: {"type":"start","messageId":"a1"}
  │     useChat: push 空助手消息 → UI 显示空助手气泡
  │
  │  ←─ data: {"type":"text-start","id":"t1"}
  │     useChat: push 空 text part
  │
  │  ←─ data: {"type":"text-delta","delta":"北"}
  │     useChat: part.text = "北" → StreamdownText 显示「北」+ 光标
  │
  │  ←─ data: {"type":"text-delta","delta":"京"}
  │     useChat: part.text = "北京" → StreamdownText 显示「北京」+ 光标
  │
  │  ←─ data: {"type":"tool-input-start","toolCallId":"c1","toolName":"web_search"}
  │     useChat: push 工具 part(state=input-streaming)
  │     → ToolPendingPanel 显示「正在调用 web_search」
  │
  │  ←─ data: {"type":"tool-input-available","input":{"query":"北京天气"}}
  │     useChat: part.input = {...}, state=input-available
  │     → 面板显示参数
  │
  │  ←─ data: {"type":"tool-output-available","output":"搜索结果..."}
  │     useChat: part.output = "...", state=output-available
  │     → WebSearchToolPanel 显示搜索结果卡片
  │
  │  ←─ data: {"type":"text-delta","delta":"今天北京..."}
  │     useChat: 追加文本 → StreamdownText 继续逐字显示
  │
  │  ←─ data: {"type":"finish"}
  │  ←─ data: [DONE]
  │     useChat: status='ready' → 按钮恢复、输入框解锁、光标消失
```

---

## 关键技术决策

### 为什么用 fetch 而不是 EventSource？

| | fetch + ReadableStream | EventSource |
|---|---|---|
| HTTP 方法 | 任意（GET/POST/...） | 仅 GET |
| 请求体 | 支持 | 不支持 |
| 自定义头 | 支持 | 不支持 |
| 中断控制 | AbortController 精确中断 | 自动重连，需手动 close() |
| 返回数据 | ReadableStream（手动解析 SSE） | 自动解析 data 事件 |

后端接口是 `POST /ai/chat`，需要把消息历史放在 body 中，且需要自定义 `Content-Type` 头，EventSource 无法满足。

### 为什么手写 useChat 而不用 @ai-sdk/vue？

`@ai-sdk/vue` 3.x 仅导出 `useCompletion`、`Chat` 类、`experimental_useObject`，没有 `useChat`。`Chat` 类需要自定义 transport 实现 `ChatTransport` 接口，API 较复杂。直接手写 `fetch` + SSE 解析更可控，且与后端 `pipeUIMessageStreamToResponse` 输出格式完全对齐。

### 为什么从 reactive 数组取回代理对象？

Vue 3 的响应式基于 Proxy。`reactive([]).push(plainObj)` 后，`plainObj` 本身不是代理对象。必须通过 `array[index]` 访问才能获得 Proxy 包装后的响应式对象。后续对 `parts` 的增量修改（`push` / `text +=`）必须通过 Proxy 才能触发 Vue 重渲染，否则数据更新了但 UI 不刷新。

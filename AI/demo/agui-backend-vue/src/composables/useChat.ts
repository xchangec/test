/**
 * useChat composable - 手写实现，替代 React 版本的 @ai-sdk/react useChat
 *
 * 为什么不直接用 @ai-sdk/vue？
 * - @ai-sdk/vue 3.x 只导出 useCompletion/Chat 类/experimental_useObject
 * - Chat 类需要自定义 transport 实现 ChatTransport 接口，API 较复杂
 * - 直接手写 fetch + SSE 解析更可控，且与后端 pipeUIMessageStreamToResponse 输出格式对齐
 *
 * Vercel AI SDK UI Message Stream Protocol（后端 pipeUIMessageStreamToResponse 输出）：
 * - 基于 SSE，每行格式：data: {JSON}\n
 * - 每个事件有 type 字段，常见类型：
 *     start                 → 新消息开始（含 messageId）
 *     text-start/end        → 文本块开始/结束（含 id）
 *     text-delta            → 文本增量（含 id + delta）
 *     tool-input-start      → 工具调用开始（toolCallId + toolName）
 *     tool-input-delta      → 工具参数增量（toolCallId + inputTextDelta，JSON 片段）
 *     tool-input-available  → 工具参数完整（toolCallId + toolName + input）
 *     tool-output-available → 工具结果（toolCallId + output）
 *     tool-output-error     → 工具出错（toolCallId + errorText）
 *     finish                → 流结束
 *     [DONE]                → SSE 结束标志
 *
 * 维护的状态：
 * - messages: UIMessage[]  - 完整消息历史（含流式增量更新）
 * - status: ChatStatus     - ready/submitted/streaming/error
 * - error: Error | null    - 最近错误
 *
 * 数据流：
 *   sendMessage({text})
 *     → push 用户消息到 messages
 *     → POST { messages } 到后端 /ai/chat
 *     → 读取 SSE 流，按事件类型更新/追加助手消息的 parts
 *     → finish/[DONE] 时 status 回到 ready
 */
import { ref, type Ref } from 'vue'
import type {
  ChatStatus,
  MessagePart,
  ToolPart,
  UIMessage,
} from '../types/chat'

export interface UseChatOptions {
  /** 后端聊天接口 URL，如 http://localhost:3000/ai/chat */
  api: string
}

export interface UseChatReturn {
  messages: Ref<UIMessage[]>
  status: Ref<ChatStatus>
  error: Ref<Error | null>
  sendMessage: (msg: { text: string }) => Promise<void>
  stop: () => void
  clearError: () => void
}

/** 生成唯一 ID（crypto.randomUUID 优先，兜底 Math.random） */
function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function useChat(options: UseChatOptions): UseChatReturn {
  /** 完整消息历史（流式时助手消息的 parts 会被增量追加） */
  const messages = ref<UIMessage[]>([]) as Ref<UIMessage[]>
  /** 会话状态机 */
  const status = ref<ChatStatus>('ready')
  /** 最近错误（null 表示无错误） */
  const error = ref<Error | null>(null)

  /** 当前请求的 AbortController，用于 stop() 中断流 */
  let abortController: AbortController | null = null

  /**
   * 发送一条用户消息，并流式接收助手回复
   * - 会先把用户消息 push 到 messages，再发请求
   * - 请求体格式：{ messages: UIMessage[] }，与后端 AiController 期望一致
   */
  async function sendMessage(msg: { text: string }) {
    // 防止并发：忙时直接返回
    if (status.value === 'submitted' || status.value === 'streaming') return

    // 1. 添加用户消息到历史
    const userMessage: UIMessage = {
      id: genId(),
      role: 'user',
      parts: [{ type: 'text', text: msg.text }],
    }
    messages.value.push(userMessage)

    // 2. 进入 submitted 状态，准备请求
    status.value = 'submitted'
    error.value = null
    abortController = new AbortController()

    // 当前正在生成的助手消息引用（流式过程中增量更新它的 parts）
    let assistantMessage: UIMessage | null = null
    // 工具调用的 inputTextDelta 拼接缓冲（key = toolCallId）
    // SDK 会把工具参数 JSON 分片发来，这里拼接原始字符串（暂不解析，input-available 时才有完整对象）
    const toolInputBuffers = new Map<string, string>()

    try {
      const response = await fetch(options.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages.value }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      if (!response.body) {
        throw new Error('响应没有可读的 body 流')
      }

      // 3. 进入 streaming 状态，开始读取 SSE 流
      status.value = 'streaming'

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      // 循环读取 chunk，按行解析 SSE
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        console.log('buffer:', buffer);

        // 按换行切分，逐行处理（SSE 每个事件占一行）
        let newlineIdx: number
        while ((newlineIdx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newlineIdx).trim()
          buffer = buffer.slice(newlineIdx + 1)
          if (!line) continue

          // SSE 格式：data: {JSON}
          if (!line.startsWith('data:')) continue
          const data = line.slice(5).trim()

          // SSE 结束标志
          if (data === '[DONE]') {
            status.value = 'ready'
            return
          }

          // 解析事件 JSON
          let event: { type: string; [key: string]: unknown }
          try {
            event = JSON.parse(data)
          } catch {
            // 解析失败：跳过该行（流式中可能出现不完整 JSON）
            continue
          }

          console.log('event:', event);
          handleStreamEvent(event, {
            getAssistant: () => assistantMessage,
            setAssistant: (m) => (assistantMessage = m),
            messages: messages.value,
            toolInputBuffers,
          })
        }
      }

      // 流自然结束
      status.value = 'ready'
    } catch (e: unknown) {
      const err = e as Error
      if (err.name === 'AbortError') {
        // 用户主动 stop() 中断，不算错误，回到 ready
        status.value = 'ready'
      } else {
        error.value = err
        status.value = 'error'
      }
    } finally {
      abortController = null
    }
  }

  /** 中断当前流（用户点击停止按钮） */
  function stop() {
    if (abortController) {
      abortController.abort()
    }
  }

  /** 清除错误状态 */
  function clearError() {
    error.value = null
  }

  return {
    messages,
    status,
    error,
    sendMessage,
    stop,
    clearError,
  }
}

/**
 * 处理单个 SSE 事件，更新助手消息的 parts
 *
 * @param event       - 解析后的事件对象 { type, ... }
 * @param ctx.getAssistant  - 获取当前正在生成的助手消息
 * @param ctx.setAssistant  - 设置当前正在生成的助手消息
 * @param ctx.messages      - messages 数组（直接 push 新消息）
 * @param ctx.toolInputBuffers - 工具参数 delta 拼接缓冲
 */
function handleStreamEvent(
  event: { type: string; [key: string]: unknown },
  ctx: {
    getAssistant: () => UIMessage | null
    setAssistant: (m: UIMessage | null) => void
    messages: UIMessage[]
    toolInputBuffers: Map<string, string>
  },
): void {
  const type = event.type

  // 新助手消息开始：创建空消息并 push
  if (type === 'start') {
    const msg: UIMessage = {
      id: (event.messageId as string) ?? genId(),
      role: 'assistant',
      parts: [],
    }
    ctx.messages.push(msg)
    // 关键：必须从 reactive 数组取回代理对象，否则后续对 parts 的
    // 增量修改（push / text +=）操作的是原始对象，Vue 不会触发更新
    const reactiveMsg = ctx.messages[ctx.messages.length - 1]
    ctx.setAssistant(reactiveMsg)
    return
  }

  // 流结束：无需处理（status 由调用方在 [DONE] 或流结束时设为 ready）
  if (type === 'finish') return

  const assistant = ctx.getAssistant()
  if (!assistant) return

  // —— 文本块 ——
  if (type === 'text-start') {
    assistant.parts.push({ type: 'text', text: '' })
    return
  }
  if (type === 'text-delta') {
    // 找到最后一个 text part，追加 delta（流式增量）
    for (let i = assistant.parts.length - 1; i >= 0; i--) {
      const p = assistant.parts[i]
      if (p.type === 'text') {
        p.text += event.delta as string
        break
      }
    }
    return
  }
  if (type === 'text-end') return

  // —— 工具调用块 ——
  if (type === 'tool-input-start') {
    const toolCallId = event.toolCallId as string
    const toolName = event.toolName as string
    const part: ToolPart = {
      type: 'tool-invocation',
      toolCallId,
      toolName,
      state: 'input-streaming',
    }
    assistant.parts.push(part)
    ctx.toolInputBuffers.set(toolCallId, '')
    return
  }
  if (type === 'tool-input-delta') {
    // 拼接参数 JSON 片段到缓冲（不解析，等 input-available）
    const toolCallId = event.toolCallId as string
    const delta = event.inputTextDelta as string
    const prev = ctx.toolInputBuffers.get(toolCallId) ?? ''
    ctx.toolInputBuffers.set(toolCallId, prev + delta)
    return
  }
  if (type === 'tool-input-available') {
    // 参数完整：设置 input 对象 + state=input-available
    const toolCallId = event.toolCallId as string
    const part = findToolPart(assistant, toolCallId)
    if (part) {
      part.input = event.input
      part.state = 'input-available'
    }
    return
  }
  if (type === 'tool-output-available') {
    // 工具执行完毕：设置 output + state=output-available
    const toolCallId = event.toolCallId as string
    const part = findToolPart(assistant, toolCallId)
    if (part) {
      part.output = event.output
      part.state = 'output-available'
    }
    return
  }
  if (type === 'tool-output-error') {
    // 工具出错：设置 errorText + state=output-error
    const toolCallId = event.toolCallId as string
    const part = findToolPart(assistant, toolCallId)
    if (part) {
      part.errorText = event.errorText as string
      part.state = 'output-error'
    }
    return
  }

  // 其他类型（reasoning/source/file/step 等）暂不处理
}

/** 在助手消息的 parts 中按 toolCallId 查找工具 part */
function findToolPart(
  message: UIMessage,
  toolCallId: string,
): ToolPart | undefined {
  for (let i = message.parts.length - 1; i >= 0; i--) {
    const p = message.parts[i] as MessagePart
    if (
      'toolCallId' in p &&
      (p as ToolPart).toolCallId === toolCallId
    ) {
      return p as ToolPart
    }
  }
  return undefined
}

/**
 * ============================================================
 * 依赖包 API 详细说明
 * ============================================================
 *
 * 1. react - React 19 Hooks
 *    --------------------------------------------------------
 *    useState<T>(initialValue): [T, (value: T | ((prev: T) => T)) => void]
 *    - 作用：在函数组件中保存可变状态，状态变化会触发组件重新渲染
 *    - 返回：[当前值, setter]
 *    - 本文件用法：const [input, setInput] = useState('')
 *      input 是受控输入框的值，setInput 用于 onChange 时更新
 *
 *    useMemo<T>(factory: () => T, deps: any[]): T
 *    - 作用：缓存 factory 的计算结果，仅在 deps 变化时才重新计算
 *    - 为什么用：防止每次渲染都 new 一个 Transport 实例（会导致 useChat 状态重置）
 *    - 本文件用法：
 *        const transport = useMemo(() => new DefaultChatTransport({...}), [chatUrl])
 *        → 只有 chatUrl 变化时才重建 transport，保持 useChat 内部状态稳定
 *
 * 2. ai (Vercel AI SDK 核心) - 消息类型与传输层
 *    --------------------------------------------------------
 *    UIMessage: 类型，前端 useChat 维护的消息结构（与后端 UIMessage 对应）
 *    - 结构字段：
 *      {
 *        id: string,                              // 消息唯一 ID（useChat 自动生成）
 *        role: 'user' | 'assistant' | 'system',   // 消息角色
 *        parts: UIMessagePart[],                  // 多模态内容块数组
 *      }
 *    - 注意：Vercel AI SDK 6.x 用 parts 替代旧的 content 字段，
 *            每个 part 可以是 text / tool-invocation / reasoning / image 等
 *
 *    DefaultChatTransport: 类，定义「请求如何发送到后端」
 *    - 作用：抽象数据传输层，告诉 useChat：
 *        1) 往哪个 URL 发请求
 *        2) 请求体怎么编码（默认 UIMessage 协议）
 *        3) 响应流怎么解析（默认 Vercel SDK 流协议）
 *    - 构造参数：
 *      {
 *        api: string,                  // 后端接口 URL（如 'http://localhost:3000/ai/chat'）
 *        credentials?: RequestCredentials,  // 'omit' | 'same-origin' | 'include'
 *        headers?: Record<string, string>,  // 自定义请求头
 *        body?: Record<string, any>,        // 额外附加的 body 字段
 *        prepareSendMessages?: (msg) => ..., // 发送前钩子，可改写请求体
 *      }
 *    - 为什么用 Transport 抽象：方便切换实现（如 DefaultChatTransport vs WebSocket 传输），
 *      而不需要改 useChat 调用代码
 *
 * 3. @ai-sdk/react - React 绑定的 useChat Hook
 *    --------------------------------------------------------
 *    useChat<UIMessage>(options): ChatResult
 *    - 作用：管理聊天会话的全部状态（消息列表、连接状态、错误、流控制）
 *    - 泛型参数 <UIMessage>：约束消息类型，便于 TS 类型提示
 *    - 关键 options：
 *      {
 *        transport: Transport<UIMessage>,   // 必填，定义后端通信方式
 *        id?: string,                        // 会话 ID，同 ID 的 useChat 共享状态
 *        messages?: UIMessage[],             // 受控初始消息（可选）
 *        onFinish?: (message) => void,       // 流完成回调
 *        onError?: (error) => void,          // 错误回调
 *        prepareSendMessages?: ...,          // 发送前钩子
 *      }
 *    - 返回值 ChatResult（本文件用到）：
 *      {
 *        messages: UIMessage[],              // 当前消息历史（含流式增量更新）
 *        sendMessage: (msg) => Promise<void>, // 发送一条新消息
 *        status: 'ready' | 'submitted' | 'streaming' | 'error',
 *                                            // 会话状态机
 *        stop: () => void,                   // 中断当前流
 *        error: Error | null,                // 最近错误（null 表示无错误）
 *        clearError: () => void,             // 清除错误状态
 *        setMessages, regenerate, ...        // 其他 API
 *      }
 *    - status 状态机详解：
 *        ready      → 空闲，可发新消息
 *        submitted  → 已发送请求，等待响应
 *        streaming  → 正在接收流式响应
 *        error      → 出错
 *      状态流转：ready → submitted → streaming → ready（正常）
 *                   或 submitted/streaming → error → ready（出错）
 *
 * 4. message.parts 的结构（流式渲染的关键）
 *    --------------------------------------------------------
 *    每条 UIMessage 的 parts 数组元素可能是：
 *    - { type: 'text', text: string }                          // 文本块（可流式增量）
 *    - { type: 'tool-invocation', toolCallId, toolName, ... }  // 工具调用
 *    - { type: 'reasoning', text: string, ... }                // 思考过程（部分模型支持）
 *    - { type: 'image', image: ... }                           // 图片
 *    - 流式过程中 text part 的 .text 字段会不断被追加更新，
 *      触发 React 重新渲染，UI 上呈现打字机效果
 * ============================================================
 */

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { useMemo, useState } from 'react'
import { MessagePart } from './components/ToolPanels'
import './App.css'

/** 后端根地址（与本地 `agui-backend` 默认端口一致） */
const API_BASE = 'http://localhost:3000'

export default function App() {
  /** 完整聊天接口 URL，对应后端 AiController 的 POST /ai/chat 路由 */
  const chatUrl = `${API_BASE}/ai/chat`

  /**
   * 构建传输层实例，useMemo 缓存避免每次渲染都重建
   * - 重建会导致 useChat 重新初始化，丢失 messages 等状态
   * - 依赖 [chatUrl]：只有 URL 变化时（如配置切换）才重建
   */
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: chatUrl,
      }),
    [chatUrl],
  )

  /**
   * useChat Hook：管理整个聊天会话
   * - transport：注入上面的传输层实例
   * - 解构出本项目用到的字段：messages / sendMessage / status / stop / error / clearError
   *   （其他如 setMessages、regenerate 未使用，故不解构）
   */
  const { messages, sendMessage, status, stop, error, clearError } = useChat<UIMessage>({
    transport,
  })

  /** 受控输入框状态：用户正在输入但尚未发送的文本 */
  const [input, setInput] = useState('')

  /**
   * busy：是否处于「请求中或流式中」状态，用于控制停止按钮显示
   * - 'submitted'（已发送等待响应）和 'streaming'（正在流式接收）都算忙
   */
  const busy = status === 'submitted' || status === 'streaming'

  /**
   * canSend：是否允许发送
   * - 必须状态为 ready（非忙/非出错）
   * - 且输入框有非空白内容（trim 去掉首尾空格后长度 > 0）
   */
  const canSend = status === 'ready' && input.trim().length > 0

  /**
   * lastAssistant：最后一条助手消息的引用
   * - messages.filter(...).at(-1) 取数组最后一项
   * - 用途：判断当前正在流式输出的文本 part 是否属于最后这条助手消息
   *         只有它的最后一个 text part 需要「流式动画」（打字机效果）
   */
  const lastAssistant = messages.filter((m) => m.role === 'assistant').at(-1)

  return (
    <div className="chat-app">
      <header className="chat-header">
        <div>
          <h1>agui</h1>
          <p className="chat-sub">后端：{chatUrl}</p>
        </div>
        {/* 只有 busy 状态才显示停止按钮，点击 stop() 中断当前流 */}
        {busy && (
          <button type="button" className="btn-stop" onClick={() => stop()}>
            停止
          </button>
        )}
      </header>

      {/*
        消息列表容器
        - role="log"：ARIA 角色，标识为日志区域
        - aria-live="polite"：屏幕阅读器会在空闲时播报新消息更新
      */}
      <div className="chat-messages" role="log" aria-live="polite">
        {/* 空状态：没有消息时显示提示 */}
        {messages.length === 0 && (
          <p className="chat-empty">
            输入问题开始对话
          </p>
        )}

        {/*
          遍历所有消息渲染气泡
          - 每条消息 key={message.id}：React 列表 key，必须是稳定的唯一值
          - 一条消息可能包含多个 part（文本+工具调用+文本...），需要逐一渲染
        */}
        {messages.map((message) => {
          /**
           * 计算这条消息里所有 text part 的索引（在 parts 数组中的位置）
           * - map + filter 技巧：先把 text part 的索引保留，其他置 -1，再过滤掉 -1
           * - 例：parts = [text, tool, text] → [0, -1, 2] → filter → [0, 2]
           *   最后一个 text part 索引 = 2
           */
          const textPartIndices = message.parts
            .map((p, i) => (p.type === 'text' ? i : -1))
            .filter((i) => i >= 0)

          /** 最后一个 text part 的索引，用于判断是否需要启动流式打字机动画 */
          const lastTextPartIdx = textPartIndices[textPartIndices.length - 1]

          return (
            <article
              key={message.id}
              className={`chat-bubble chat-bubble--${message.role}`}
            >
              <span className="chat-role">
                {message.role === 'user' ? '你' : '助手'}
              </span>
              <div className="chat-body">
                {/*
                  渲染每个 part
                  textStreamActive 判断条件（同时满足才显示流式效果）：
                  1. part.type === 'text'              → 当前 part 是文本
                  2. message.role === 'assistant'      → 助手消息（用户消息不流式）
                  3. message.id === lastAssistant?.id  → 是最后一条助手消息
                  4. index === lastTextPartIdx         → 是这条消息最后一个 text part
                  5. busy                              → 正在生成中
                  → 满足以上 5 条才启动打字机动画，避免历史消息也被重新动画
                */}
                {message.parts.map((part, index) => (
                  <MessagePart
                    key={`${message.id}-p-${index}`}
                    part={part}
                    textStreamActive={
                      part.type === 'text' &&
                      message.role === 'assistant' &&
                      message.id === lastAssistant?.id &&
                      index === lastTextPartIdx &&
                      busy
                    }
                  />
                ))}
              </div>
            </article>
          )
        })}
      </div>

      {/* 错误提示条：error 非 null 时显示，可点关闭按钮清除 */}
      {error && (
        <div className="chat-error" role="alert">
          <span>{error.message}</span>
          <button type="button" onClick={() => clearError()}>
            关闭
          </button>
        </div>
      )}

      {/*
        输入区表单
        - onSubmit：表单提交（点击「发送」按钮触发）
        - e.preventDefault()：阻止表单默认提交（避免整页刷新）
        - void sendMessage(...)：sendMessage 返回 Promise，void 显式丢弃避免未处理 Promise
        - setInput('')：发送后清空输入框
      */}
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!canSend) return
          void sendMessage({ text: input })
          setInput('')
        }}
      >
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          /* 键盘快捷键：Enter 发送，Shift+Enter 换行；e.preventDefault() 阻止 Enter 默认换行 */
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (canSend) {
                void sendMessage({ text: input })
                setInput('')
              }
            }
          }}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          rows={3}
          disabled={status !== 'ready'}
          aria-label="消息输入"
        />
        <div className="chat-actions">
          {/*
            状态指示器：根据 status 显示不同文案
            - ready：就绪
            - submitted：已发送…（等待响应）
            - streaming：生成中…（流式接收）
            - error：出错
          */}
          <span className="chat-status">
            {status === 'ready' && '就绪'}
            {status === 'submitted' && '已发送…'}
            {status === 'streaming' && '生成中…'}
            {status === 'error' && '出错'}
          </span>
          {/* 发送按钮：canSend 为 false 时禁用 */}
          <button type="submit" disabled={!canSend}>
            发送
          </button>
        </div>
      </form>
    </div>
  )
}

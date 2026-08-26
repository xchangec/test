/**
 * 聊天相关类型定义
 * - 复刻自 agui-frontend/src/components/ToolPanels.tsx 中的类型
 * - 这里集中导出，便于多个组件复用
 */

/** 流式 / 工具里常见的可 JSON 序列化值（不含 unknown） */
export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

/**
 * 与流式 `tool-input-available` 及 agui-backend `web_search` 参数一致。
 * @example {"query":"北京今天天气预报"} 或含 `count`
 */
export type WebSearchToolInput = {
  query: string
  count?: number
}

/** `tool-output-available` 中 `output` 为整段检索结果字符串（非 JSON） */
export type WebSearchToolOutput = string

/** 与 agui-backend `send_mail` 参数一致（text/html 可选） */
export type SendMailToolInput = {
  to: string
  subject: string
  text?: string
  html?: string
}

/** 联网搜索结果项（解析自后端返回的多段文本） */
export type WebSearchResultItem = {
  ref: string
  title: string
  url: string
  summary: string
  siteName?: string
  publishedAt?: string
}

/**
 * 工具调用部件类型
 * - 这里不依赖 ai SDK 的 ToolUIPart/DynamicToolUIPart（类型较复杂），
 *   而是定义一个简化结构，覆盖本项目用到的字段
 * - state 字段对应 Vercel AI SDK 的 ToolState：
 *     'input-streaming' | 'input-available' | 'output-available' | 'output-error'
 */
export interface ToolPart {
  type: string
  toolCallId: string
  toolName: string
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
  input?: unknown
  output?: unknown
  errorText?: string
}

/**
 * 消息部件类型联合
 * - Vercel AI SDK 的 UIMessage.parts 是一个联合类型数组
 * - 本项目只处理 text 和 tool-invocation 两类
 */
export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | ToolPart
  | { type: string; [key: string]: unknown }

/** UIMessage 简化结构（覆盖本项目用到字段） */
export interface UIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  parts: MessagePart[]
}

/** useChat 返回的状态枚举 */
export type ChatStatus = 'ready' | 'submitted' | 'streaming' | 'error'

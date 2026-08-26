/**
 * 工具输入/输出解析工具
 * - 复刻自 agui-frontend/src/components/ToolPanels.tsx 中的解析函数
 * - 把 SDK 中 unknown 类型的流式值收窄为 JsonValue，再解析为具体结构
 *   （web_search input / send_mail input / web_search 多段文本结果 等）
 */
import type {
  JsonValue,
  SendMailToolInput,
  WebSearchResultItem,
  WebSearchToolInput,
  WebSearchToolOutput,
} from '../types/chat'

/**
 * 把 SDK 中 unknown 类型的流式值收窄为 JsonValue
 * - SDK 把 tool input/output 都标为 unknown，前端渲染前必须类型收窄
 * - 递归定义的 JsonValue 覆盖了 object / array / primitive 全部情况
 * - 无法识别的类型返回 undefined（调用方降级为 String(raw) 兜底）
 */
export function streamValueToJson(value: unknown): JsonValue | undefined {
  if (value === undefined) return undefined
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  if (Array.isArray(value)) {
    return value as JsonValue[]
  }
  if (typeof value === 'object') {
    return value as JsonValue
  }
  return undefined
}

/** 类型守卫：判断 JsonValue 是否为合法的 web_search input（必须有非空 query） */
function isWebSearchToolInput(v: JsonValue | undefined): v is WebSearchToolInput {
  if (v === null || v === undefined) return false
  if (typeof v !== 'object' || Array.isArray(v)) return false
  const o = v as Record<string, JsonValue>
  if (typeof o.query !== 'string' || o.query.length === 0) return false
  if (o.count !== undefined) {
    if (typeof o.count !== 'number' || !Number.isFinite(o.count)) return false
  }
  return true
}

/** 解析 web_search 的 input（参数对象） */
export function parseWebSearchToolInput(
  input: JsonValue | undefined,
): WebSearchToolInput | undefined {
  if (!isWebSearchToolInput(input)) return undefined
  const out: WebSearchToolInput = { query: input.query }
  if (input.count !== undefined) out.count = input.count
  return out
}

/** 流式阶段 input 可能不完整，仅做宽松解析（send_mail） */
export function parseSendMailToolInputPartial(
  input: JsonValue | undefined,
): Partial<SendMailToolInput> | undefined {
  if (input === null || input === undefined) return undefined
  if (typeof input !== 'object' || Array.isArray(input)) return undefined
  const o = input as Record<string, JsonValue>
  const out: Partial<SendMailToolInput> = {}
  if (typeof o.to === 'string') out.to = o.to
  if (typeof o.subject === 'string') out.subject = o.subject
  if (typeof o.text === 'string') out.text = o.text
  if (typeof o.html === 'string') out.html = o.html
  return Object.keys(out).length > 0 ? out : undefined
}

/** 标准化 web_search 输出：确保是字符串（JSON 对象也转成格式化字符串） */
export function normalizeWebSearchOutput(
  output: JsonValue | WebSearchToolOutput,
): WebSearchToolOutput {
  if (typeof output === 'string') return output
  return JSON.stringify(output, null, 2)
}

/** 默认工具输出格式化：字符串尝试 JSON 美化，非字符串直接 JSON 序列化 */
export function formatDefaultToolString(s: WebSearchToolOutput): string {
  const t = s.trim()
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      return JSON.stringify(JSON.parse(t) as JsonValue, null, 2)
    } catch {
      return s
    }
  }
  return s
}

/**
 * 解析 `web_search` 返回的多段文本（引用 / 标题 / URL / 摘要可跨行 …）
 * - 后端 web_search 工具把搜索结果格式化为多段文本（见 ai.module.ts 中的拼接逻辑）
 * - 每段以 "引用: N" 开头，含 标题/URL/摘要/网站名称/发布时间 字段
 * - 用 \n\n+ 分段，正则逐字段提取，组装为结构化结果数组
 */
export function parseWebSearchBlocks(text: WebSearchToolOutput): WebSearchResultItem[] {
  const blocks = text
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean)
  const items: WebSearchResultItem[] = []
  for (const block of blocks) {
    const ref = block.match(/^引用:\s*(\d+)/m)?.[1] ?? ''
    const title = block.match(/标题:\s*(.+)/)?.[1]?.trim() ?? ''
    const url = block.match(/URL:\s*(\S+)/)?.[1]?.trim() ?? ''
    const summary =
      block.match(/摘要:\s*([\s\S]*?)(?=\n\s*网站名称:|$)/)?.[1]?.trim() ?? ''
    const siteName = block.match(/网站名称:\s*(.+)/)?.[1]?.trim()
    const publishedAt = block.match(/发布时间:\s*(\S+)/)?.[1]?.trim()
    if (title || url || summary || ref) {
      items.push({ ref, title, url, summary, siteName, publishedAt })
    }
  }
  return items
}

/**
 * 根据工具名和（可能不完整的）input 提取提示语，用于 pending 态展示
 * - web_search：返回 query 关键词
 * - send_mail：返回 subject 或 to（按优先级）
 * - 其他：undefined（不显示提示）
 */
export function getPendingHint(
  name: string,
  inputJson: JsonValue | undefined,
): string | undefined {
  if (name === 'web_search') {
    return parseWebSearchToolInput(inputJson)?.query
  }
  if (name === 'send_mail') {
    const p = parseSendMailToolInputPartial(inputJson)
    const sub = p?.subject?.trim()
    if (sub) return sub
    const to = p?.to?.trim()
    if (to) return to
  }
  return undefined
}

/** 默认工具输出兜底值提取：unknown → JsonValue / string 兜底 */
export function defaultToolValueFromStream(raw: unknown): JsonValue | WebSearchToolOutput {
  const j = streamValueToJson(raw)
  if (j !== undefined) return j
  if (typeof raw === 'string') return raw
  if (typeof raw === 'number' || typeof raw === 'boolean') return raw
  if (raw === null) return null
  return String(raw)
}

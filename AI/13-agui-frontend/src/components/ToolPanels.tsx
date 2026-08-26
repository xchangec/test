/**
 * ============================================================
 * 依赖包 API 详细说明
 * ============================================================
 *
 * 1. ai (Vercel AI SDK) - 消息与工具部件类型
 *    --------------------------------------------------------
 *    UIMessage: 类型，前端 useChat 维护的消息结构
 *    - 关键字段：id / role / parts: UIMessagePart[]
 *    - parts 数组元素类型联合，常见有：
 *        { type: 'text', text }                          // 文本块
 *        { type: 'tool-invocation', ... }                // 工具调用块（旧式）
 *        { type: 'reasoning', text }                     // 思考过程
 *        { type: 'image', image }                        // 图片
 *        { type: 'file', file }                          // 文件
 *
 *    ToolUIPart: 类型，工具调用部件（类型已知 / 已声明）
 *    - 结构：
 *      {
 *        type: 'tool-invocation' (或其他 type 标识)
 *        toolCallId: string,            // 工具调用唯一 ID，匹配后端
 *        toolName: string,              // 工具名，如 'web_search' / 'send_mail'
 *        state: ToolState,              // 调用生命周期状态（见下）
 *        input?: unknown,               // 调用参数（流式时可能不完整）
 *        output?: unknown,              // 工具返回结果
 *        errorText?: string,            // 出错时的错误信息
 *      }
 *    - 注意：input/output 类型为 unknown，需自行收窄
 *
 *    DynamicToolUIPart: 类型，动态工具调用部件
 *    - 与 ToolUIPart 几乎一致，区别：
 *      toolName 是动态字符串（未在静态工具集中声明）
 *      input/output 同样为 unknown，类型上更宽松
 *    - 本项目后端的 web_search / send_mail 都按 DynamicToolUIPart 流式传输
 *
 *    ToolState（工具调用生命周期）：
 *      'input-streaming'    → 工具参数正在生成（LLM 还在吐 input）
 *      'input-available'    → 参数已完整，准备执行工具
 *      'output-available'   → 工具已执行完毕，结果已返回
 *      'output-error'       → 工具执行出错
 *    流转：input-streaming → input-available → output-available
 *           或 → output-error
 *
 *    getToolName(part: AnyToolPart): string
 *    - 作用：从 ToolUIPart / DynamicToolUIPart 中安全提取工具名
 *    - 为什么不用 part.toolName 直接访问？
 *      → 两种 part 类型的字段定义可能有差异，getToolName 统一处理兼容性
 *
 *    isToolUIPart(part: UIMessage['parts'][number]): part is ToolUIPart | DynamicToolUIPart
 *    - 作用：类型守卫，判断某个 part 是否为工具调用部件
 *    - 返回 part is ...：TypeScript 类型收窄，if 内可安全访问工具字段
 *    - 用于 MessagePart 中区分 text part 和 tool part
 * ============================================================
 */

import {
  getToolName,
  isToolUIPart,
  type DynamicToolUIPart,
  type ToolUIPart,
  type UIMessage,
} from 'ai'
import { StreamdownText } from './StreamdownText'
import './ToolPanels.css'

type AnyToolPart = ToolUIPart | DynamicToolUIPart

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

/** 流式 / 工具里常见的可 JSON 序列化值（不含 unknown） */
export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

/**
 * 把 SDK 中 unknown 类型的流式值收窄为 JsonValue
 * - SDK 把 tool input/output 都标为 unknown，前端渲染前必须类型收窄
 * - 递归定义的 JsonValue 覆盖了 object / array / primitive 全部情况
 * - 无法识别的类型返回 undefined（调用方降级为 String(raw) 兜底）
 */
function streamValueToJson(value: unknown): JsonValue | undefined {
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

function parseWebSearchToolInput(
  input: JsonValue | undefined,
): WebSearchToolInput | undefined {
  if (!isWebSearchToolInput(input)) return undefined
  const out: WebSearchToolInput = { query: input.query }
  if (input.count !== undefined) out.count = input.count
  return out
}

/** 流式阶段 input 可能不完整，仅做宽松解析 */
function parseSendMailToolInputPartial(
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

function normalizeWebSearchOutput(
  output: JsonValue | WebSearchToolOutput,
): WebSearchToolOutput {
  if (typeof output === 'string') return output
  return JSON.stringify(output, null, 2)
}

function formatDefaultToolString(s: WebSearchToolOutput): string {
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

type WebSearchResultItem = {
  ref: string
  title: string
  url: string
  summary: string
  siteName?: string
  publishedAt?: string
}

/** 解析 `web_search` 返回的多段文本（引用 / 标题 / URL / 摘要可跨行 …）
 * - 后端 web_search 工具把搜索结果格式化为多段文本（见 ai.module.ts 中的拼接逻辑）
 * - 每段以 "引用: N" 开头，含 标题/URL/摘要/网站名称/发布时间 字段
 * - 用 \n\n+ 分段，正则逐字段提取，组装为结构化结果数组
 */
function parseWebSearchBlocks(text: WebSearchToolOutput): WebSearchResultItem[] {
  const blocks = text.split(/\n\n+/).map((b) => b.trim()).filter(Boolean)
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
 * 联网搜索结果面板
 * - 把后端返回的多段文本解析为结构化卡片列表展示
 * - 展示字段：引用编号 / 标题 / URL（可点击跳转）/ 摘要 / 站名 / 发布时间
 * - 无法解析时降级为 <pre> 原文展示（兜底）
 */
function WebSearchToolPanel({
  input,
  output,
}: {
  input?: WebSearchToolInput
  output: WebSearchToolOutput
}) {
  const query = input?.query ?? null
  const count = input?.count
  const items = parseWebSearchBlocks(output)

  return (
    <div className="tool-panel tool-panel--web-search">
      <div className="tool-panel__head">
        <span className="tool-panel__label">联网搜索</span>
        {query ? (
          <span className="tool-panel__query">
            「{query}」
            {count != null ? (
              <span className="tool-panel__count"> · {count} 条</span>
            ) : null}
          </span>
        ) : null}
      </div>
      {items.length > 0 ? (
        <ul className="tool-panel__results">
          {items.map((it, idx) => (
            <li key={`${it.ref}-${idx}`} className="tool-panel__result">
              {it.ref ? (
                <span className="tool-panel__ref">引用 {it.ref}</span>
              ) : null}
              {it.title ? (
                <div className="tool-panel__title">{it.title}</div>
              ) : null}
              {it.url ? (
                <a
                  className="tool-panel__url"
                  href={it.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {it.url}
                </a>
              ) : null}
              {it.summary ? (
                <p className="tool-panel__summary">{it.summary}</p>
              ) : null}
              {it.siteName ? (
                <span className="tool-panel__site">{it.siteName}</span>
              ) : null}
              {it.publishedAt ? (
                <span className="tool-panel__time">{it.publishedAt}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <pre className="tool-panel__raw">{output}</pre>
      )}
    </div>
  )
}

/**
 * 根据工具名和（可能不完整的）input 提取提示语，用于 pending 态展示
 * - web_search：返回 query 关键词
 * - send_mail：返回 subject 或 to（按优先级）
 * - 其他：undefined（不显示提示）
 */
function getPendingHint(
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

/**
 * 发送邮件工具面板
 * - 流式阶段（progress != undefined）：展示收件人/主题/正文的实时生成过程
 *   - input-streaming：LLM 还在生成参数，显示光标动画
 *   - input-available：参数已完整等待执行，显示进度文案
 * - 完成态（progress == undefined）：展示邮件正文 + 后端返回的执行结果
 *   - text 优先用纯文本展示，html 用 dangerouslySetInnerHTML 渲染
 */
function SendMailToolPanel({
  input,
  output,
  progress,
}: {
  input?: Partial<SendMailToolInput>
  output: string
  /** 流式生成参数或等待执行时展示进度条文案，与完成态互斥 */
  progress?: 'input-streaming' | 'input-available'
}) {
  const to = input?.to
  const subject = input?.subject
  const bodyText = input?.text
  const bodyHtml = input?.html
  const isStreaming = progress === 'input-streaming'
  const inProgress = progress !== undefined

  const bodyCaption = isStreaming ? '正文（生成中）' : '正文预览'

  return (
    <div
      className={`tool-panel tool-panel--send-mail${inProgress ? ' tool-panel--send-mail-streaming' : ''}`}
      aria-busy={inProgress}
    >
      <div className="tool-panel__head tool-panel__head--send-mail">
        <span className="tool-panel__label tool-panel__label--send-mail">发送邮件</span>
        {subject ? (
          <span className="tool-panel__mail-subject-hint">「{subject}」</span>
        ) : null}
      </div>
      <dl className="tool-panel__mail-fields">
        <div className="tool-panel__mail-row">
          <dt>收件人</dt>
          <dd>
            {to?.trim() ? to : '—'}
            {isStreaming && !to?.trim() ? (
              <span className="tool-panel__mail-cursor tool-panel__mail-cursor--inline" aria-hidden />
            ) : null}
          </dd>
        </div>
        <div className="tool-panel__mail-row">
          <dt>主题</dt>
          <dd>
            {subject?.trim() ? subject : '—'}
            {isStreaming && to?.trim() && !subject?.trim() ? (
              <span className="tool-panel__mail-cursor tool-panel__mail-cursor--inline" aria-hidden />
            ) : null}
          </dd>
        </div>
      </dl>
      {bodyText || bodyHtml ? (
        <div className="tool-panel__mail-body-block">
          <div className="tool-panel__mail-body-caption">{bodyCaption}</div>
          <div className="tool-panel__mail-body-scroll">
            {bodyText ? (
              <pre className="tool-panel__mail-text">
                {bodyText}
                {isStreaming ? (
                  <span className="tool-panel__mail-cursor tool-panel__mail-cursor--block" aria-hidden />
                ) : null}
              </pre>
            ) : isStreaming ? (
              <pre className="tool-panel__mail-text">
                {bodyHtml ?? ''}
                <span className="tool-panel__mail-cursor tool-panel__mail-cursor--block" aria-hidden />
              </pre>
            ) : (
              <div
                className="tool-panel__mail-html"
                // 来自助手工具调用的 HTML 片段，仅展示用
                dangerouslySetInnerHTML={{ __html: bodyHtml ?? '' }}
              />
            )}
          </div>
        </div>
      ) : isStreaming ? (
        <div className="tool-panel__mail-body-block">
          <div className="tool-panel__mail-body-caption">{bodyCaption}</div>
          <div className="tool-panel__mail-body-scroll tool-panel__mail-body-scroll--empty">
            <span className="tool-panel__mail-body-placeholder">等待正文…</span>
            <span className="tool-panel__mail-cursor tool-panel__mail-cursor--block" aria-hidden />
          </div>
        </div>
      ) : null}
      {inProgress ? (
        <div className="tool-panel__mail-status tool-panel__mail-status--progress" role="status">
          {progress === 'input-streaming' ? '正在生成邮件参数…' : '正在发送邮件…'}
        </div>
      ) : output.trim() ? (
        <div className="tool-panel__mail-status" role="status">
          {output}
        </div>
      ) : null}
    </div>
  )
}

/** 工具调用等待面板：流式参数生成中或工具执行中，展示工具名+提示 */
function ToolPendingPanel({ name, hint }: { name: string; hint?: string }) {
  const isMail = name === 'send_mail'
  return (
    <div
      className={`tool-panel tool-panel--pending${isMail ? ' tool-panel--pending-mail' : ''}`}
      aria-busy="true"
    >
      <span className="tool-panel__pending-text">
        正在调用 <strong>{name}</strong>
        {hint ? <>：{hint}</> : '…'}
      </span>
    </div>
  )
}

/** 工具出错面板：展示工具名 + 错误信息 */
function ToolErrorPanel({ name, message }: { name: string; message: string }) {
  return (
    <div className="tool-panel tool-panel--error" role="alert">
      <span className="tool-panel__label">{name}</span>
      <p className="tool-panel__err-msg">{message}</p>
    </div>
  )
}

/** 默认工具输出面板：未知工具的兜底展示，字符串美化、对象 JSON 序列化 */
function DefaultToolOutput({ value }: { value: JsonValue | WebSearchToolOutput }) {
  const text =
    typeof value === 'string'
      ? formatDefaultToolString(value)
      : JSON.stringify(value, null, 2)
  return <pre className="tool-panel tool-panel--default">{text}</pre>
}

function defaultToolValueFromStream(raw: unknown): JsonValue | WebSearchToolOutput {
  const j = streamValueToJson(raw)
  if (j !== undefined) return j
  if (typeof raw === 'string') return raw
  if (typeof raw === 'number' || typeof raw === 'boolean') return raw
  if (raw === null) return null
  return String(raw)
}

/**
 * 工具调用部件渲染器（核心分发逻辑）
 * - 输入：UIMessage 中的某个 tool part（AnyToolPart = ToolUIPart | DynamicToolUIPart）
 * - 根据 part.state 分发到不同子面板：
 *   1. output-error      → ToolErrorPanel      （工具执行出错）
 *   2. input-streaming   → SendMailToolPanel / ToolPendingPanel（参数生成中）
 *      - send_mail 特殊处理：流式展示参数实时生成
 *      - 其他工具：展示「正在调用 xxx」+ 提示语
 *   3. input-available   → SendMailToolPanel / ToolPendingPanel（参数已就绪等待执行）
 *   4. output-available   → 按 toolName 分发到具体结果面板
 *      - web_search → WebSearchToolPanel（解析多段文本为卡片列表）
 *      - send_mail  → SendMailToolPanel（展示邮件正文 + 发送结果）
 *      - 其他       → DefaultToolOutput（兜底 JSON/字符串展示）
 *
 * 数据来源链路：
 *   后端 agent.stream() → toUIMessageStream() → 前端 useChat → message.parts[i]
 *   每个 tool part 的 state 会随流式过程逐步切换：
 *     input-streaming → input-available → output-available
 */
function ToolMessagePart({ part }: { part: AnyToolPart }) {
  // 用 getToolName 统一提取工具名（兼容 ToolUIPart 和 DynamicToolUIPart）
  const name = getToolName(part)

  // 分支 1：工具执行出错
  if (part.state === 'output-error') {
    return (
      <ToolErrorPanel name={name} message={part.errorText ?? '工具执行出错'} />
    )
  }

  // 分支 2/3：尚未产出结果（input-streaming 或 input-available）
  if (part.state !== 'output-available') {
    // 把 unknown 类型的 input 收窄为 JsonValue，便于后续解析
    const inputJson = streamValueToJson('input' in part ? part.input : undefined)
    // send_mail 在流式阶段特殊处理：实时展示参数生成过程
    if (name === 'send_mail') {
      const input = parseSendMailToolInputPartial(inputJson) ?? {}
      // 根据状态决定进度文案：
      //   input-available → 参数已完整，等待执行（显示"正在发送邮件…"）
      //   input-streaming → 参数还在生成（显示"正在生成邮件参数…"）
      const progress: 'input-streaming' | 'input-available' =
        part.state === 'input-available' ? 'input-available' : 'input-streaming'
      return <SendMailToolPanel input={input} output="" progress={progress} />
    }
    // 其他工具：展示「正在调用 xxx」+ 提示语（query/subject 等）
    const hint = getPendingHint(name, inputJson)
    return <ToolPendingPanel name={name} hint={hint} />
  }

  // 分支 4：工具已执行完毕，按 toolName 分发到具体结果面板
  const rawIn = 'input' in part ? part.input : undefined
  const rawOut = part.output
  // input/output 都是 unknown，收窄为 JsonValue；失败时降级为 String 兜底
  const inputJson = streamValueToJson(rawIn)
  const outputJson = streamValueToJson(rawOut)

  switch (name) {
    case 'web_search': {
      const input = parseWebSearchToolInput(inputJson)
      const output = normalizeWebSearchOutput(
        outputJson !== undefined ? outputJson : String(rawOut),
      )
      return <WebSearchToolPanel input={input} output={output} />
    }
    case 'send_mail': {
      const input = parseSendMailToolInputPartial(inputJson) ?? {}
      const output = normalizeWebSearchOutput(
        outputJson !== undefined ? outputJson : String(rawOut),
      )
      return <SendMailToolPanel input={input} output={output} />
    }
    default:
      // 未知工具：兜底展示，字符串美化或 JSON 序列化
      return (
        <DefaultToolOutput value={defaultToolValueFromStream(rawOut)} />
      )
  }
}

export type MessagePartProps = {
  part: UIMessage['parts'][number]
  /** 助手消息里当前 text 块是否处于流式输出（最后一段文本） */
  textStreamActive?: boolean
}

/**
 * 消息部件渲染入口（被 App.tsx 调用）
 * - 遍历 message.parts 时，每个 part 都会经过这里分发：
 *   1. type='text' → StreamdownText（流式 Markdown 渲染）
 *   2. isToolUIPart=true → ToolMessagePart（工具调用面板）
 *   3. 其他类型（reasoning/image/file 等）→ null（本项目暂不渲染）
 * - textStreamActive 仅对 text part 生效，控制打字机动画
 */
export function MessagePart({
  part,
  textStreamActive = false,
}: MessagePartProps) {
  // 文本块：交给 Streamdown 渲染（支持流式 Markdown）
  if (part.type === 'text') {
    return (
      <StreamdownText isStreaming={textStreamActive}>{part.text}</StreamdownText>
    )
  }
  // 工具调用块：isToolUIPart 是类型守卫，通过后 part 收窄为工具部件
  if (isToolUIPart(part)) {
    return (
      <div className="chat-tool-wrap">
        <ToolMessagePart part={part} />
      </div>
    )
  }
  // 其他类型（reasoning/image 等）暂不处理，返回 null 不渲染
  return null
}

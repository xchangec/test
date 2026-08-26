<script setup lang="ts">
/**
 * 工具调用部件渲染器（核心分发逻辑）
 * - 输入：UIMessage 中的某个 tool part
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
import { computed } from 'vue'
import {
  defaultToolValueFromStream,
  getPendingHint,
  normalizeWebSearchOutput,
  parseSendMailToolInputPartial,
  parseWebSearchToolInput,
  streamValueToJson,
} from '../utils/tool-parsers'
import type { ToolPart } from '../types/chat'
import WebSearchToolPanel from './WebSearchToolPanel.vue'
import SendMailToolPanel from './SendMailToolPanel.vue'
import ToolPendingPanel from './ToolPendingPanel.vue'
import ToolErrorPanel from './ToolErrorPanel.vue'
import DefaultToolOutput from './DefaultToolOutput.vue'

const props = defineProps<{
  part: ToolPart
}>()

/** 渲染上下文：当前应该展示哪个面板 + 对应数据 */
type RenderContext =
  | { kind: 'error'; name: string; message: string }
  | { kind: 'pending'; name: string; hint?: string }
  | { kind: 'send-mail-pending'; input: Partial<import('../types/chat').SendMailToolInput>; progress: 'input-streaming' | 'input-available' }
  | { kind: 'web-search-result'; input?: import('../types/chat').WebSearchToolInput; output: import('../types/chat').WebSearchToolOutput }
  | { kind: 'send-mail-result'; input: Partial<import('../types/chat').SendMailToolInput>; output: import('../types/chat').WebSearchToolOutput }
  | { kind: 'default'; value: import('../types/chat').JsonValue | import('../types/chat').WebSearchToolOutput }

/** 根据 part.state + toolName 计算渲染上下文（Vue 响应式，part 变化自动重算） */
const ctx = computed<RenderContext>(() => {
  const part = props.part
  const name = part.toolName

  // 分支 1：工具执行出错
  if (part.state === 'output-error') {
    return { kind: 'error', name, message: part.errorText ?? '工具执行出错' }
  }

  // 分支 2/3：尚未产出结果（input-streaming 或 input-available）
  if (part.state !== 'output-available') {
    const inputJson = streamValueToJson('input' in part ? part.input : undefined)
    if (name === 'send_mail') {
      const input = parseSendMailToolInputPartial(inputJson) ?? {}
      const progress: 'input-streaming' | 'input-available' =
        part.state === 'input-available' ? 'input-available' : 'input-streaming'
      return { kind: 'send-mail-pending', input, progress }
    }
    const hint = getPendingHint(name, inputJson)
    return { kind: 'pending', name, hint }
  }

  // 分支 4：工具已执行完毕，按 toolName 分发到具体结果面板
  const rawIn = 'input' in part ? part.input : undefined
  const rawOut = part.output
  const inputJson = streamValueToJson(rawIn)
  const outputJson = streamValueToJson(rawOut)

  switch (name) {
    case 'web_search':
      return {
        kind: 'web-search-result',
        input: parseWebSearchToolInput(inputJson),
        output: normalizeWebSearchOutput(outputJson !== undefined ? outputJson : String(rawOut)),
      }
    case 'send_mail':
      return {
        kind: 'send-mail-result',
        input: parseSendMailToolInputPartial(inputJson) ?? {},
        output: normalizeWebSearchOutput(outputJson !== undefined ? outputJson : String(rawOut)),
      }
    default:
      return { kind: 'default', value: defaultToolValueFromStream(rawOut) }
  }
})
</script>

<template>
  <ToolErrorPanel
    v-if="ctx.kind === 'error'"
    :name="ctx.name"
    :message="ctx.message"
  />
  <ToolPendingPanel
    v-else-if="ctx.kind === 'pending'"
    :name="ctx.name"
    :hint="ctx.hint"
  />
  <SendMailToolPanel
    v-else-if="ctx.kind === 'send-mail-pending'"
    :input="ctx.input"
    output=""
    :progress="ctx.progress"
  />
  <WebSearchToolPanel
    v-else-if="ctx.kind === 'web-search-result'"
    :input="ctx.input"
    :output="ctx.output"
  />
  <SendMailToolPanel
    v-else-if="ctx.kind === 'send-mail-result'"
    :input="ctx.input"
    :output="ctx.output"
  />
  <DefaultToolOutput
    v-else
    :value="ctx.value"
  />
</template>

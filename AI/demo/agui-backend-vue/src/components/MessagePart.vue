<script setup lang="ts">
/**
 * 消息部件渲染入口（被 App.vue 调用）
 * - 遍历 message.parts 时，每个 part 都会经过这里分发：
 *   1. type='text' → StreamdownText（流式 Markdown 渲染）
 *   2. 工具调用 → ToolMessagePart（工具调用面板）
 *   3. 其他类型（reasoning/image 等）→ 不渲染
 * - textStreamActive 仅对 text part 生效，控制打字机动画
 */
import { computed } from 'vue'
import StreamdownText from './StreamdownText.vue'
import ToolMessagePart from './ToolMessagePart.vue'
import type { MessagePart, ToolPart } from '../types/chat'

const props = withDefaults(
  defineProps<{
    part: MessagePart
    /** 助手消息里当前 text 块是否处于流式输出（最后一段文本） */
    textStreamActive?: boolean
  }>(),
  {
    textStreamActive: false,
  },
)

/** 当前 part 是否为工具调用部件 */
const isToolPart = computed((): part is ToolPart => {
  const p = props.part as { type?: string; toolName?: string; state?: string }
  return Boolean(p.toolName && p.state)
})
</script>

<template>
  <StreamdownText
    v-if="part.type === 'text'"
    :content="(part as { text: string }).text"
    :is-streaming="textStreamActive"
  />
  <div v-else-if="isToolPart" class="chat-tool-wrap">
    <ToolMessagePart :part="(part as ToolPart)" />
  </div>
  <!-- 其他类型（reasoning/image 等）暂不处理，不渲染 -->
</template>

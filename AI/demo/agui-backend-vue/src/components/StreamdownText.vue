<script setup lang="ts">
/**
 * 流式 Markdown 渲染组件
 * - 用 markdown-it + highlight.js 替代 React 版本的 streamdown
 * - 流式时 isStreaming=true，末尾追加闪烁光标提示「正在生成」
 * - 文本变化时通过 computed 自动重新渲染（Vue 响应式）
 */
import { computed } from 'vue'
import { renderMarkdown } from '../utils/markdown'
import '../styles/StreamdownText.css'

const props = withDefaults(
  defineProps<{
    /** 要渲染的 Markdown 文本（流式时会不断追加新内容） */
    content?: string
    /** 助手最后一段文本在流式输出时为 true，显示光标动画 */
    isStreaming?: boolean
  }>(),
  {
    content: '',
    isStreaming: false,
  },
)

/** 把 Markdown 文本渲染为 HTML，流式时末尾追加光标 span */
const html = computed(() => {
  const rendered = renderMarkdown(props.content)
  if (!props.isStreaming) return rendered
  // 流式中：末尾追加闪烁光标（注意：rendered 末尾若是 </pre>，
  // 光标应放在 pre 外层，避免破坏代码块结构 → 放在整个 HTML 之后即可）
  return `${rendered}<span class="chat-streamdown__cursor" aria-hidden="true"></span>`
})
</script>

<template>
  <div class="chat-streamdown">
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div class="chat-streamdown__inner" v-html="html"></div>
  </div>
</template>

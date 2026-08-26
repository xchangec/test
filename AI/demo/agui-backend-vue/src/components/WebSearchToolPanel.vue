<script setup lang="ts">
/**
 * 联网搜索结果面板
 * - 把后端返回的多段文本解析为结构化卡片列表展示
 * - 展示字段：引用编号 / 标题 / URL（可点击跳转）/ 摘要 / 站名 / 发布时间
 * - 无法解析时降级为 <pre> 原文展示（兜底）
 */
import { computed } from 'vue'
import {
  parseWebSearchBlocks,
} from '../utils/tool-parsers'
import type {
  WebSearchToolInput,
  WebSearchToolOutput,
} from '../types/chat'

const props = defineProps<{
  input?: WebSearchToolInput
  output: WebSearchToolOutput
}>()

const query = computed(() => props.input?.query ?? null)
const count = computed(() => props.input?.count)
const items = computed(() => parseWebSearchBlocks(props.output))
</script>

<template>
  <div class="tool-panel tool-panel--web-search">
    <div class="tool-panel__head">
      <span class="tool-panel__label">联网搜索</span>
      <span v-if="query" class="tool-panel__query">
        「{{ query }}」
        <span v-if="count != null" class="tool-panel__count"> · {{ count }} 条</span>
      </span>
    </div>
    <ul v-if="items.length > 0" class="tool-panel__results">
      <li
        v-for="(it, idx) in items"
        :key="`${it.ref}-${idx}`"
        class="tool-panel__result"
      >
        <span v-if="it.ref" class="tool-panel__ref">引用 {{ it.ref }}</span>
        <div v-if="it.title" class="tool-panel__title">{{ it.title }}</div>
        <a
          v-if="it.url"
          class="tool-panel__url"
          :href="it.url"
          target="_blank"
          rel="noreferrer"
        >{{ it.url }}</a>
        <p v-if="it.summary" class="tool-panel__summary">{{ it.summary }}</p>
        <span v-if="it.siteName" class="tool-panel__site">{{ it.siteName }}</span>
        <span v-if="it.publishedAt" class="tool-panel__time">{{ it.publishedAt }}</span>
      </li>
    </ul>
    <pre v-else class="tool-panel__raw">{{ output }}</pre>
  </div>
</template>

<script setup lang="ts">
/** 默认工具输出面板：未知工具的兜底展示，字符串美化、对象 JSON 序列化 */
import { computed } from 'vue'
import { formatDefaultToolString } from '../utils/tool-parsers'
import type { JsonValue, WebSearchToolOutput } from '../types/chat'

const props = defineProps<{
  value: JsonValue | WebSearchToolOutput
}>()

const text = computed(() =>
  typeof props.value === 'string'
    ? formatDefaultToolString(props.value)
    : JSON.stringify(props.value, null, 2),
)
</script>

<template>
  <pre class="tool-panel tool-panel--default">{{ text }}</pre>
</template>

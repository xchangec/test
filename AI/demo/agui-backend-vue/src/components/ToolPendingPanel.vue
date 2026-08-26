<script setup lang="ts">
/** 工具调用等待面板：流式参数生成中或工具执行中，展示工具名+提示 */
import { computed } from 'vue'

const props = defineProps<{
  name: string
  hint?: string
}>()

const isMail = computed(() => props.name === 'send_mail')
</script>

<template>
  <div
    class="tool-panel tool-panel--pending"
    :class="{ 'tool-panel--pending-mail': isMail }"
    aria-busy="true"
  >
    <span class="tool-panel__pending-text">
      正在调用 <strong>{{ name }}</strong>
      <template v-if="hint">：{{ hint }}</template>
      <template v-else>…</template>
    </span>
  </div>
</template>

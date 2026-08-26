<script setup lang="ts">
/** 工具出错面板：展示工具名 + 错误信息 */
defineProps<{
  name: string
  message: string
}>()
</script>

<template>
  <div class="tool-panel tool-panel--error" role="alert">
    <span class="tool-panel__label">{{ name }}</span>
    <p class="tool-panel__err-msg">{{ message }}</p>
  </div>
</template>

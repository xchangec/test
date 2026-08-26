<script setup lang="ts">
/**
 * 发送邮件工具面板
 * - 流式阶段（progress != undefined）：展示收件人/主题/正文的实时生成过程
 *   - input-streaming：LLM 还在生成参数，显示光标动画
 *   - input-available：参数已完整等待执行，显示进度文案
 * - 完成态（progress == undefined）：展示邮件正文 + 后端返回的执行结果
 *   - text 优先用纯文本展示，html 用 v-html 渲染
 */
import { computed } from 'vue'
import type { SendMailToolInput } from '../types/chat'

const props = defineProps<{
  input?: Partial<SendMailToolInput>
  output: string
  /** 流式生成参数或等待执行时展示进度条文案，与完成态互斥 */
  progress?: 'input-streaming' | 'input-available'
}>()

const to = computed(() => props.input?.to)
const subject = computed(() => props.input?.subject)
const bodyText = computed(() => props.input?.text)
const bodyHtml = computed(() => props.input?.html)
const isStreaming = computed(() => props.progress === 'input-streaming')
const inProgress = computed(() => props.progress !== undefined)
const bodyCaption = computed(() => (isStreaming.value ? '正文（生成中）' : '正文预览'))
</script>

<template>
  <div
    class="tool-panel tool-panel--send-mail"
    :class="{ 'tool-panel--send-mail-streaming': inProgress }"
    :aria-busy="inProgress"
  >
    <div class="tool-panel__head tool-panel__head--send-mail">
      <span class="tool-panel__label tool-panel__label--send-mail">发送邮件</span>
      <span v-if="subject" class="tool-panel__mail-subject-hint">「{{ subject }}」</span>
    </div>
    <dl class="tool-panel__mail-fields">
      <div class="tool-panel__mail-row">
        <dt>收件人</dt>
        <dd>
          {{ to?.trim() ? to : '—' }}
          <span
            v-if="isStreaming && !to?.trim()"
            class="tool-panel__mail-cursor tool-panel__mail-cursor--inline"
            aria-hidden="true"
          ></span>
        </dd>
      </div>
      <div class="tool-panel__mail-row">
        <dt>主题</dt>
        <dd>
          {{ subject?.trim() ? subject : '—' }}
          <span
            v-if="isStreaming && to?.trim() && !subject?.trim()"
            class="tool-panel__mail-cursor tool-panel__mail-cursor--inline"
            aria-hidden="true"
          ></span>
        </dd>
      </div>
    </dl>

    <div
      v-if="bodyText || bodyHtml"
      class="tool-panel__mail-body-block"
    >
      <div class="tool-panel__mail-body-caption">{{ bodyCaption }}</div>
      <div class="tool-panel__mail-body-scroll">
        <pre v-if="bodyText" class="tool-panel__mail-text">
{{ bodyText }}<span
            v-if="isStreaming"
            class="tool-panel__mail-cursor tool-panel__mail-cursor--block"
            aria-hidden="true"
          ></span></pre>
        <pre
          v-else-if="isStreaming"
          class="tool-panel__mail-text"
        >{{ bodyHtml ?? '' }}<span
            class="tool-panel__mail-cursor tool-panel__mail-cursor--block"
            aria-hidden="true"
          ></span></pre>
        <!-- 来自助手工具调用的 HTML 片段，仅展示用 -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-else class="tool-panel__mail-html" v-html="bodyHtml ?? ''"></div>
      </div>
    </div>

    <div
      v-else-if="isStreaming"
      class="tool-panel__mail-body-block"
    >
      <div class="tool-panel__mail-body-caption">{{ bodyCaption }}</div>
      <div class="tool-panel__mail-body-scroll tool-panel__mail-body-scroll--empty">
        <span class="tool-panel__mail-body-placeholder">等待正文…</span>
        <span
          class="tool-panel__mail-cursor tool-panel__mail-cursor--block"
          aria-hidden="true"
        ></span>
      </div>
    </div>

    <div
      v-if="inProgress"
      class="tool-panel__mail-status tool-panel__mail-status--progress"
      role="status"
    >
      {{ progress === 'input-streaming' ? '正在生成邮件参数…' : '正在发送邮件…' }}
    </div>
    <div
      v-else-if="output.trim()"
      class="tool-panel__mail-status"
      role="status"
    >{{ output }}</div>
  </div>
</template>

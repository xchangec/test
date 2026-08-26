<script setup lang="ts">
/**
 * 主聊天界面（Vue 3 版本）
 * - 使用自定义 useChat composable 替代 React 版本的 useChat hook
 *   （@ai-sdk/vue 3.x 未导出 useChat，因此手写实现以解析 Vercel AI SDK 数据流）
 * - 功能与 React 版本 agui-frontend/src/App.tsx 对齐：
 *   1) 消息列表渲染（用户/助手气泡）
 *   2) 流式输入框 + Enter 发送 / Shift+Enter 换行
 *   3) 停止按钮（中断当前流）
 *   4) 状态指示（就绪/已发送/生成中/出错）
 *   5) 错误提示条
 *   6) 最后一条助手消息的最后一个 text part 启动流式光标动画
 * - 按钮使用 Element Plus（el-button），输入框保持原生 textarea 以保留原版样式与键盘事件
 */
import { computed, ref } from 'vue'
import { useChat } from './composables/useChat'
import type { UIMessage } from 'ai'
import { ElButton } from 'element-plus'
import MessagePart from './components/MessagePart.vue'
import type { MessagePart as MessagePartType } from './types/chat'
import './styles/App.css'

/** 后端根地址（与本地 agui-backend 默认端口一致） */
const API_BASE = 'http://localhost:3000'
/** 完整聊天接口 URL，对应后端 AiController 的 POST /ai/chat 路由 */
const chatUrl = `${API_BASE}/ai/chat`

/**
 * useChat：管理整个聊天会话
 * - 自定义实现，返回 ref（messages/status/error 是 Ref）
 * - 模板中自动解包，setup 中用 .value 访问
 */
const { messages, sendMessage, status, stop, error, clearError } = useChat({
  api: chatUrl,
})

/** 受控输入框状态：用户正在输入但尚未发送的文本 */
const input = ref('')

/** busy：是否处于「请求中或流式中」状态，用于控制停止按钮显示 */
const busy = computed(() => status.value === 'submitted' || status.value === 'streaming')

/** canSend：是否允许发送（ready + 非空输入） */
const canSend = computed(() => status.value === 'ready' && input.value.trim().length > 0)

/** lastAssistant：最后一条助手消息引用，用于判断流式动画作用域 */
const lastAssistant = computed(() => {
  const arr = messages.value.filter((m) => m.role === 'assistant')
  return arr.at(-1) ?? null
})

/** 状态文案映射 */
const statusText = computed(() => {
  switch (status.value) {
    case 'ready':
      return '就绪'
    case 'submitted':
      return '已发送…'
    case 'streaming':
      return '生成中…'
    case 'error':
      return '出错'
    default:
      return ''
  }
})

/** 发送消息 */
function doSend() {
  if (!canSend.value) return
  void sendMessage({ text: input.value })
  input.value = ''
}

/** 键盘快捷键：Enter 发送，Shift+Enter 换行 */
function onEnter(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    doSend()
  }
}

/**
 * 计算某条消息里所有 text part 的索引
 * - 用于判断「最后一个 text part」是否需要启动流式光标动画
 */
function getTextPartIndices(parts: MessagePartType[]): number[] {
  return parts
    .map((p, i) => (p.type === 'text' ? i : -1))
    .filter((i) => i >= 0)
}

/** 判断某个 text part 是否应该启动流式动画 */
function isTextStreaming(
  message: UIMessage,
  partIndex: number,
): boolean {
  const textIndices = getTextPartIndices(message.parts as MessagePartType[])
  const lastTextPartIdx = textIndices.at(-1)
  return (
    busy.value &&
    message.role === 'assistant' &&
    message.id === lastAssistant.value?.id &&
    partIndex === lastTextPartIdx
  )
}
</script>

<template>
  <div class="chat-app">
    <header class="chat-header">
      <div>
        <h1>agui</h1>
        <p class="chat-sub">后端：{{ chatUrl }}</p>
      </div>
      <el-button
        v-if="busy"
        type="default"
        size="default"
        class="btn-stop"
        @click="stop()"
      >停止</el-button>
    </header>

    <div class="chat-messages" role="log" aria-live="polite">
      <p v-if="messages.length === 0" class="chat-empty">
        输入问题开始对话
      </p>

      <article
        v-for="message in messages"
        :key="message.id"
        :class="`chat-bubble chat-bubble--${message.role}`"
      >
        <span class="chat-role">
          {{ message.role === 'user' ? '你' : '助手' }}
        </span>
        <div class="chat-body">
          <MessagePart
            v-for="(part, index) in (message.parts as MessagePartType[])"
            :key="`${message.id}-p-${index}`"
            :part="part"
            :text-stream-active="isTextStreaming(message, index)"
          />
        </div>
      </article>
    </div>

    <div v-if="error" class="chat-error" role="alert">
      <span>{{ error.message }}</span>
      <el-button type="default" size="small" @click="clearError()">关闭</el-button>
    </div>

    <form class="chat-form" @submit.prevent="doSend">
      <textarea
        class="chat-input"
        v-model="input"
        @keydown="onEnter"
        placeholder="输入消息，Enter 发送，Shift+Enter 换行"
        rows="3"
        :disabled="status !== 'ready'"
        aria-label="消息输入"
      />
      <div class="chat-actions">
        <span class="chat-status">{{ statusText }}</span>
        <el-button
          type="primary"
          native-type="submit"
          :disabled="!canSend"
        >发送</el-button>
      </div>
    </form>
  </div>
</template>

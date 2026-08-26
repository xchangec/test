/**
 * Markdown 渲染工具
 * - 用 markdown-it + highlight.js 替代 React 版本的 streamdown
 * - 流式增量渲染策略：每次 text 变化时全量重新渲染（markdown-it 不支持流式增量）
 *   对于聊天场景，单条消息长度有限，全量重渲染性能可接受
 * - 容忍未闭合 Markdown：markdown-it 默认对未闭合语法有容错处理，
 *   流式过程中 "```" 代码块未闭合时仍能渲染已到达部分
 */
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

/**
 * 创建一个 markdown-it 实例（模块级单例，避免重复初始化）
 * - html: false        禁止原始 HTML 直通（安全：防 XSS）
 * - linkify: true      自动识别 URL 文本为链接
 * - breaks: false      不把单换行转 <br>（保持标准 Markdown 语义）
 * - highlight: 自定义代码块高亮函数
 */
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  highlight(str: string, lang: string): string {
    // 流式过程中可能 lang 还没传完整，做空字符串兼容
    const language = (lang || '').trim()
    // 能识别语言：用 highlight.js 高亮
    if (language && hljs.getLanguage(language)) {
      try {
        const result = hljs.highlight(str, { language, ignoreIllegals: true })
        return `<pre><code class="hljs language-${language}">${result.value}</code></pre>`
      } catch {
        // 高亮失败：走兜底
      }
    }
    // 无法识别语言：尝试自动检测
    try {
      const result = hljs.highlightAuto(str)
      return `<pre><code class="hljs">${result.value}</code></pre>`
    } catch {
      // 全部失败：转义后输出纯文本
    }
    // 最终兜底：转义 + 包 pre/code
    return `<pre><code class="hljs">${md.utils.escapeHtml(str)}</code></pre>`
  },
})

/** 默认链接打开新窗口，rel=nofollow noopener（安全） */
const defaultLinkOpen =
  md.renderer.rules.link_open ||
  function (tokens: any, idx: any, options: any, _env: any, self: any) {
    return self.renderToken(tokens, idx, options)
  }
md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  const token = tokens[idx]
  if (token) {
    token.attrSet('target', '_blank')
    token.attrSet('rel', 'noopener noreferrer')
  }
  return defaultLinkOpen(tokens, idx, options, env, self)
}

/**
 * 渲染 Markdown 文本为 HTML
 * @param text - Markdown 原文（流式时可能是未闭合的不完整文本）
 * @returns HTML 字符串
 */
export function renderMarkdown(text: string): string {
  if (!text) return ''
  return md.render(text)
}

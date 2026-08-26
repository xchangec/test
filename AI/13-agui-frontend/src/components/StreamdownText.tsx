/**
 * ============================================================
 * 依赖包 API 详细说明
 * ============================================================
 *
 * 1. streamdown - 流式 Markdown 渲染组件
 *    --------------------------------------------------------
 *    Streamdown: React 组件，专为「流式 LLM 输出」设计的 Markdown 渲染器
 *    - 核心能力：
 *      1) 实时解析增量到达的 Markdown 文本（边收边渲染）
 *      2) 支持代码块语法高亮（通过 Shiki）
 *      3) 支持数学公式、表格、列表等完整 Markdown 语法
 *      4) 流式过程中能容忍未闭合的 Markdown 语法（如未闭合的代码块 ```)
 *
 *    Streamdown 的关键 props：
 *    - mode: 'static' | 'streaming'
 *        - 'static'    用于一次性渲染完整 Markdown（如历史消息）
 *        - 'streaming' 用于流式场景，会启用增量解析和动画
 *    - isAnimating: boolean
 *        - true 时显示打字机/光标动画，提示用户「正在生成」
 *        - false 时静默渲染最终结果
 *    - parseIncompleteMarkdown: boolean
 *        - true 容忍未闭合的 Markdown（流式必备）
 *        - 例：流到 "```js\nconst a" 时，代码块未闭合，仍能渲染已到达部分
 *    - shikiTheme: [ThemeInput, ThemeInput]
 *        - 双主题配置：[亮色主题, 暗色主题]
 *        - 支持 CSS 媒体查询自动切换，或通过 data-theme 属性切换
 *    - plugins: { code?, mermaid?, ... }
 *        - 注入第三方插件扩展能力
 *        - code 插件：代码块语法高亮（基于 Shiki）
 *        - mermaid 插件：渲染 mermaid 流程图/时序图等
 *    - className: string
 *        - 外层容器 CSS 类名
 *    - children: string
 *        - 要渲染的 Markdown 文本（流式时是不断追加的增量字符串）
 *
 *    ThemeInput: 类型，Shiki 主题标识
 *    - 取值：内置主题名（如 'github-light'）或自定义主题对象
 *
 * 2. @streamdown/code - 代码高亮插件
 *    --------------------------------------------------------
 *    createCodePlugin(options): CodePlugin
 *    - 作用：创建一个代码高亮插件实例，注入 Streamdown
 *    - 参数 options:
 *      {
 *        themes: [ThemeInput, ThemeInput],  // [亮色, 暗色]
 *        // 其他可选配置如 highlightLines、lineNumbers 等
 *      }
 *    - 内部机制：用 Shiki（基于 VS Code 语法的 WASM 高亮器）渲染代码块
 *      比 Prism/highlight.js 更准确，但首次加载会拉取 WASM 文件
 *
 * 3. @streamdown/mermaid - Mermaid 图表插件
 *    --------------------------------------------------------
 *    mermaid: MermaidPlugin（导出即用的插件实例）
 *    - 作用：让 Streamdown 能渲染 ```mermaid 代码块为流程图、时序图、甘特图等
 *    - 内部机制：动态加载 mermaid.js（按需，避免首屏体积过大）
 *    - 用法：直接放入 plugins.mermaid 即可，无需配置
 * ============================================================
 */

import { createCodePlugin } from '@streamdown/code'
import { mermaid } from '@streamdown/mermaid'
import { Streamdown, type ThemeInput } from 'streamdown'
import 'streamdown/styles.css'
import './StreamdownText.css'

/** Shiki 双主题：亮色用 github-light，暗色用 github-dark（配合 CSS 媒体查询切换） */
const shikiTheme: [ThemeInput, ThemeInput] = ['github-light', 'github-dark']

/** 代码高亮插件实例：模块级单例，避免每次渲染重建（Shiki 初始化较重） */
const codePlugin = createCodePlugin({ themes: shikiTheme })

export type StreamdownTextProps = {
  /** 要渲染的 Markdown 文本（流式时会不断追加新内容） */
  children: string
  /**
   * 助手最后一段文本在流式输出时为 true，用于 Streamdown 动画与未闭合 Markdown
   * - true：显示光标动画、启用 parseIncompleteMarkdown（容忍未闭合语法）
   * - false：作为完整 Markdown 静态渲染
   */
  isStreaming?: boolean
}

/**
 * 流式 Markdown 渲染组件
 * - 被 ToolPanels.tsx 的 MessagePart 调用，渲染 UIMessage 中 type='text' 的 part
 * - 流式时 isStreaming=true，配合 useChat 的增量更新实现打字机效果
 */
export function StreamdownText({
  children,
  isStreaming = false,
}: StreamdownTextProps) {
  return (
    <div className="chat-streamdown">
      <Streamdown
        // 流式模式：启用增量解析，适配边到边渲染
        mode="streaming"
        // 仅在流式输出时显示动画（光标/打字机）
        isAnimating={isStreaming}
        // 容忍未闭合 Markdown：流式过程中 "```" 代码块可能还没闭合
        parseIncompleteMarkdown
        // 注入双主题（亮/暗），Shiki 会按当前主题高亮代码
        shikiTheme={shikiTheme}
        // 注入 mermaid 图表插件 + 代码高亮插件
        plugins={{ mermaid, code: codePlugin }}
        className="chat-streamdown__inner"
      >
        {children}
      </Streamdown>
    </div>
  )
}

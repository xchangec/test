/**
 * 应用入口
 * - 注册 Element Plus（按需导入用到的组件在 App.vue 中已局部导入，
 *   这里 import 基础样式以保证 el-button 等样式正常）
 * - 加载 highlight.js 暗色主题（github-dark），用于 markdown-it 代码高亮
 * - 加载全局样式（CSS 变量 + 暗色模式 + 各组件样式）
 */
import { createApp } from 'vue'
import App from './App.vue'

// Element Plus 基础样式（el-button 等组件样式依赖）
import 'element-plus/dist/index.css'

// highlight.js 主题：固定用 github-dark（代码块在亮暗模式下都是暗底亮字）
import 'highlight.js/styles/github-dark.css'

// 全局样式（CSS 变量、暗色模式、基础元素样式）
import './styles/index.css'

createApp(App).mount('#app')

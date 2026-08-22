/**
 * ============================================================
 * 依赖包 API 详细说明
 * ============================================================
 *
 * 1. @langchain/openai - LangChain 的 OpenAI 模型适配器
 *    --------------------------------------------------------
 *    ChatOpenAI: 类，用于创建与 OpenAI 兼容的聊天模型实例。
 *    - 作用：封装对 OpenAI API（或兼容接口如 DeepSeek、Qwen 等）的调用
 *    - 构造参数示例：
 *      {
 *        model: "gpt-4o-mini",        // 模型名称
 *        apiKey: "sk-xxx",            // API 密钥
 *        baseURL: "https://api.openai.com/v1",  // API 端点（兼容其他模型时修改）
 *        temperature: 0.7,            // 创造性参数，0=确定性，2=非常随机
 *        maxTokens: 2000,             // 单次回复最大 token 数
 *      }
 *    - 通常作为 NestJS Provider 通过工厂模式注入，便于集中配置
 *
 * 2. langchain - LangChain 核心框架
 *    --------------------------------------------------------
 *    AIMessageChunk: 类型/类，表示 AI 流式回复中的一个「消息块」
 *    - 作用：流式输出时，每次 yield 的增量内容容器
 *    - 主要属性：
 *      - content: string | Array<any>   // 文本内容（增量片段）
 *      - tool_calls?: ToolCall[]        // AI 发起的工具调用（如果有）
 *      - response_metadata?: object     // 原始响应元数据（token 用量等）
 *
 *    createAgent(options): 创建一个「带工具调用能力的 Agent」
 *    - 作用：让 LLM 能自主判断何时调用工具（如 web_search），
 *            自动执行工具 → 把结果回传 LLM → 生成最终回答，形成「思考-行动-观察」循环
 *    - 参数 options:
 *      {
 *        model: BaseChatModel,           // LLM 实例（如 ChatOpenAI）
 *        tools: ToolInterface[],         // 可用工具数组，Agent 会自主选择调用
 *        systemPrompt?: string,          // 系统提示词，设定 AI 的角色和行为规则
 *        name?: string,                  // Agent 名称（可选）
 *        description?: string,           // Agent 描述（可选）
 *      }
 *    - 返回类型：LangChain Agent 实例，具备 .invoke() / .stream() 等方法
 *
 * 3. ai - Vercel AI SDK（统一 AI 接口层）
 *    --------------------------------------------------------
 *    UIMessage: 类型，前端与后端之间约定的「消息传输格式」
 *    - 作用：Vercel AI SDK 的标准消息结构，便于前后端（useChat hook）无缝对接
 *    - 结构定义：
 *      {
 *        id: string,                     // 消息唯一 ID（前端 useChat 自动生成）
 *        role: 'user' | 'assistant' | 'system',  // 消息角色
 *        content: string,                // 消息文本内容
 *        parts?: Array<...>,             // 多模态内容块（图片、工具调用等，可选）
 *        toolInvocations?: Array<...>,   // 工具调用记录（可选）
 *        experimental_attachments?: Array<...>,  // 附件（可选）
 *      }
 *
 * 4. @ai-sdk/langchain - Vercel AI SDK 与 LangChain 的桥接层
 *    --------------------------------------------------------
 *    toBaseMessages(uiMessages: UIMessage[]): Promise<BaseMessage[]>
 *    - 作用：把 Vercel AI SDK 的 UIMessage[] 格式，转换为 LangChain 内部的 BaseMessage[] 格式
 *    - 为什么需要：两边对消息结构定义不同，必须桥接后才能喂给 LangChain Agent
 *    - 转换映射关系：
 *        UIMessage.role='user'      →  LangChain HumanMessage
 *        UIMessage.role='assistant' →  LangChain AIMessage
 *        UIMessage.role='system'    →  LangChain SystemMessage
 *        toolInvocations 字段       →  LangChain ToolMessage + AIMessage.tool_calls
 *
 *    toUIMessageStream(lcStream: AsyncIterable<AIMessageChunk>): AsyncIterable<any>
 *    - 作用：把 LangChain 的 AIMessageChunk 流式迭代器，转换为 Vercel AI SDK 可消费的流格式
 *    - 为什么需要：前端 useChat hook 只能识别 Vercel AI SDK 的标准流结构
 *    - 实际效果：自动过滤工具调用中间块、合并纯文本内容，
 *               输出前端 SSE/Stream 能直接消费的格式（text 事件、tool-call 事件等）
 * ============================================================
 */

import { ChatOpenAI } from '@langchain/openai';
import { Inject, Injectable } from '@nestjs/common';
import { AIMessageChunk, createAgent } from 'langchain';
import { UIMessage } from 'ai';
import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';

/**
 * AI 服务层
 * 职责：封装 LangChain Agent 的创建与流式对话逻辑，供 Controller 调用
 *
 * 数据流全貌（一次对话请求）：
 *   前端 useChat → UIMessage[]
 *      → [HTTP/SSE 到后端]
 *         → ai.service.stream() 被调用
 *            → toBaseMessages()      「UIMessage → LangChain BaseMessage」
 *            → agent.stream()         「LLM 推理 + 自动工具调用循环（可能多轮）」
 *               ├─ LLM 判断：需要搜索？
 *               │    └─ 调用 webSearchTool → 返回搜索结果 → 再喂给 LLM
 *               └─ LLM 生成最终回答（流式 token 逐个吐出）
 *            → toUIMessageStream()   「LangChain AIMessageChunk → Vercel SDK 流格式」
 *      → [SSE 流式返回前端]
 *   前端 useChat 自动增量拼接、渲染气泡
 */
@Injectable()
export class AiService {
    /**
     * LangChain Agent 实例
     * - 用 ReturnType<typeof createAgent> 推断类型，避免显式导入复杂的 Agent 类
     * - 该 Agent 已绑定 LLM 模型 + webSearch 工具，可直接调用 .invoke() / .stream()
     */
    private readonly agent: ReturnType<typeof createAgent>;

    /**
     * 构造函数：依赖注入 + 初始化 Agent
     *
     * @param model          - ChatOpenAI 实例，由 NestJS DI 容器提供（token: 'CHAT_MODEL'）
     *                        通常在 ai.module.ts 中通过 useFactory 配置 apiKey/baseURL/model 等参数
     * @param webSearchTool  - 联网搜索工具实例（token: 'WEB_SEARCH_TOOL'）
     *                        必须是 LangChain ToolInterface 类型，即带有 name/description/schema/run 方法
     *                        Agent 会根据 tool 的 description 自主判断何时调用它
     */
    constructor(
        @Inject('CHAT_MODEL') model: ChatOpenAI,
        @Inject('WEB_SEARCH_TOOL') private readonly webSearchTool: any,
    ) {
        /**
         * 创建 LangChain Agent
         * 内部机制简述：
         *   createAgent 返回的是一个 LangGraph 图（StateGraph），状态流转如下：
         *   [START] → 调用 LLM → 判断是否含 tool_calls
         *     → 是：并行/串行执行 tools → 结果塞回 messages → 再次调用 LLM（循环，最多 recursionLimit 次）
         *     → 否：输出最终回答 → [END]
         *
         * 注意：systemPrompt 会被拼接到每次 LLM 调用的消息头部，指导 Agent 的行为策略
         */
        this.agent = createAgent({
            model,
            tools: [this.webSearchTool],
            systemPrompt:
                '你是 AI 助手，需要最新信息、事实核查或联网信息时，请使用 web_search 工具搜索后再作答。发送邮件用 send_mail 工具',
        })
    }

    /**
     * 流式对话接口
     *
     * @param message - 前端 useChat 发来的完整消息历史，UIMessage[] 格式
     *                  最后一条是用户新输入，之前的是上下文（用于多轮对话记忆）
     *
     * @returns - AsyncIterable，可被 NestJS @Sse() 装饰器直接消费，
     *            或被 Controller 手动转换为 SSE MessageEvent 流
     *            每个 yield 的值都是 Vercel AI SDK 标准流块（文本增量 / 工具调用事件等）
     *
     * 执行步骤详解：
     * ─────────────────────────────────────────────────
     * 步骤 1: toBaseMessages(message)
     *   - 输入：[{id:'1',role:'user',content:'今天天气？'}, ...]
     *   - 输出：[HumanMessage(...), ...]  LangChain 原生消息对象数组
     *   - 原因：LangChain Agent 只认识自己的 BaseMessage 体系
     *
     * 步骤 2: this.agent.stream({ messages: lcMessages }, { ... })
     *   - 第一个参数：Agent 的输入状态，必须包含 messages 字段
     *   - 第二个参数：流式配置
     *       streamMode: ['messages', 'values']
     *         - 'messages' 模式：逐块吐出 AIMessageChunk（每个 token 块）
     *         - 'values' 模式：在每个节点结束时吐出完整状态快照
     *         - 两种组合可以同时拿到增量流 + 阶段性完整状态
     *       recursionLimit: 30
     *         - 「LLM → 工具 → LLM」循环的最大次数，防止死循环
     *         - 复杂查询（多次搜索、多次工具链）可能需要较高值
     *         - 超过限制会抛出 RecursionError
     *
     * 步骤 3: toUIMessageStream(lgStream)
     *   - 输入：LangChain 原生异步迭代器，混合了 AIMessageChunk、工具消息块等
     *   - 输出：Vercel AI SDK 标准异步迭代器，前端 useChat 可直接解析
     *   - 关键处理：过滤掉纯工具调用中间块，只向前端暴露有意义的内容块
     */
    async stream(message: UIMessage[]) {
        // 桥接层 1: Vercel UIMessage[] → LangChain BaseMessage[]
        const lcMessages = await toBaseMessages(message);

        // 核心推理: LangChain Agent 流式执行（含自动工具调用循环）
        const lgStream = await this.agent.stream(
            { messages: lcMessages },
            {
                streamMode: ['messages', 'values'],
                recursionLimit: 30,
            },
        );

        // 桥接层 2: LangChain 流 → Vercel SDK 流（前端 useChat 可消费）
        return toUIMessageStream(lgStream as AsyncIterable<AIMessageChunk>);
    }
}

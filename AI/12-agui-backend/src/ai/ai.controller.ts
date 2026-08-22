/**
 * ============================================================
 * 依赖包 API 详细说明
 * ============================================================
 *
 * 1. @nestjs/common - NestJS 核心装饰器与异常
 *    --------------------------------------------------------
 *    BadRequestException: 类，HTTP 400 异常
 *    - 作用：向客户端返回 400 Bad Request 响应
 *    - 构造参数：new BadRequestException(message | object)
 *      - message: string 描述信息，或对象作为响应体
 *
 *    Body(): 参数装饰器，从 HTTP 请求体中提取数据
 *    - 用法：@Body() body: BodyType  或  @Body('field') field: FieldType
 *    - 底层：使用 Express/CookieParser 解析请求体，依赖 NestJS 的 body parser 中间件
 *
 *    Controller(prefix?): 类装饰器，声明一个 NestJS 控制器
 *    - 参数 prefix: 路由前缀（可选），本类所有路由都会带上该前缀
 *      例如 @Controller('ai') + @Post('chat') → 完整路由 POST /ai/chat
 *
 *    Post(path?): 方法装饰器，声明一个 POST HTTP 路由
 *    - 参数 path: 子路径，相对于 Controller 前缀
 *    - 同类还有 @Get / @Put / @Delete / @Patch / @Options / @Head 等
 *
 *    Res(options?): 参数装饰器，注入 Express 的原生 Response 对象
 *    - 关键参数 options:
 *      { passthrough: boolean }
 *        - passthrough: false（默认）= 你接管了响应写入，NestJS 不会再处理返回值，
 *          此时方法返回类型通常为 void，因为你直接通过 res.write()/res.end()/pipe() 输出
 *        - passthrough: true = NestJS 仍会处理方法返回值，但你可以用 res 操作 headers
 *    - 为什么这里用 passthrough: false？
 *      → pipeUIMessageStreamToResponse 内部会直接往 Express Response 流式写数据，
 *        不需要 NestJS 再做一层序列化包装
 *
 * 2. ai (Vercel AI SDK) - 流响应写入工具
 *    --------------------------------------------------------
 *    pipeUIMessageStreamToResponse({ response, stream, data?, status?, headers? }): Promise<void>
 *    - 作用：把 Vercel AI SDK 标准格式的 stream（AsyncIterable），写入到 HTTP Response 对象
 *    - 它会自动完成以下工作：
 *      1) 设置正确的 HTTP headers：
 *         - Content-Type: 'text/plain; charset=utf-8'   （或根据需要 application/x-ndjson）
 *         - Transfer-Encoding: 'chunked'
 *         - Cache-Control: 'no-cache, no-transform'   禁止中间代理做压缩/缓存，否则流式失效
 *         - Connection: 'keep-alive'
 *      2) 处理各类型流块（text / tool-call / tool-result / finish 等），
 *         按 Vercel SDK 约定的编码格式逐个 chunk 写入 response
 *      3) 流结束时自动调用 res.end()，以及捕获上游错误并向 body 写入错误事件
 *    - 参数：
 *      {
 *        response: Express Response | NextResponse,  // HTTP 响应对象
 *        stream: AsyncIterable<any>,                 // 由 toUIMessageStream() 产出的流
 *        data?: Record<string, any>,                 // 额外元数据，附加在每个块（可选）
 *        status?: number,                            // HTTP 状态码，默认 200
 *        headers?: Record<string, string>,           // 附加响应头（可选）
 *      }
 *    - 返回：Promise<void>，在流完全写入并 response.end() 后 resolve
 *
 *    UIMessage: 类型（同 ai.service.ts 中说明），前端 useChat 的标准消息结构
 *
 * 3. express (Type) - Express 类型定义
 *    --------------------------------------------------------
 *    Response: Express 的响应对象 TS 类型接口（仅作类型导入，不引入运行时代码）
 *    - 核心能力：res.writeHead / res.write / res.end / res.setHeader / res.status() 等
 *    - type Response 来自 @types/express，只有在 tsconfig skipLibCheck=false 时做静态检查
 *
 * ============================================================
 */

import { BadRequestException, Body, Controller, Post, Res } from '@nestjs/common';
import { AiService } from './ai.service';
import { pipeUIMessageStreamToResponse, UIMessage } from 'ai';
import type { Response } from 'express';

/**
 * AI 控制器层
 * 职责：作为 HTTP 入口，接收前端对话请求，调用 AiService 生成流式回复，
 *       并通过 pipeUIMessageStreamToResponse 以流式 HTTP 响应返回给前端
 *
 * HTTP 流式传输机制（关键）：
 *   不同于普通 JSON 响应（一次性 res.json()），流式响应的 Headers 里带有
 *   Transfer-Encoding: chunked，响应体会被分成多个「块（chunk）」逐个发出，
 *   前端（fetch with ReadableStream / EventSource / useChat hook）可以边收边渲染。
 *
 *   当前实现使用 POST 方法 + Vercel SDK 编码格式（text/plain 内按行分隔事件块），
 *   而不是 SSE（GET + text/event-stream），原因：
 *   - Vercel AI SDK 的 useChat 默认 POST /chat 端点
 *   - POST 可以把完整消息历史放在 body 里，不受 URL 长度限制
 *   - pipeUIMessageStreamToResponse 会按 Vercel 标准协议编码，useChat 前端能直接解析
 */
@Controller('ai')
export class AiController {
    constructor(private readonly aiService: AiService) { }

    /**
     * 本地测试 curl 命令说明：
     *   -N, --no-buffer     禁用 curl 的输出缓冲，让 chunk 一到达就打印
     *   -sS, --silent       静默模式 + 出错时仍然显示错误
     *   -X POST             指定方法为 POST
     *   -H 'Content-Type: application/json'  声明请求体格式
     *   -d '{...}'          请求体，必须包含 messages 数组（UIMessage[] 结构）
     *
     *   请求体结构细节：
     *   {
     *     messages: [
     *       {
     *         id: "1",                                 // 每条消息必须有唯一 id
     *         role: "user",                            // 'user' | 'assistant' | 'system'
     *         parts: [                                 // 推荐用 parts（多模态），也可用 content 字段
     *           { type: "text", text: "北京今天的天气" }
     *         ]
     *       }
     *     ]
     *   }
     */
    @Post('chat')
    async postChat(
        /**
         * @Body() 从 JSON 请求体提取整个 body 对象
         * 类型：{ messages?: UIMessage[] }，messages 标记为可选，因为要在方法内做非空校验
         */
        @Body() body: { messages?: UIMessage[] },
        /**
         * @Res({ passthrough: false }) 注入 Express Response 对象
         * - passthrough: false 表示我们完全手动写入响应，NestJS 不再干涉
         * - 这就是为什么返回值是 Promise<void> 而不是 Observable / 普通对象
         */
        @Res({ passthrough: false }) res: Response,
    ): Promise<void> {
        // 参数合法性校验：必须存在 messages 且是数组，否则抛 400
        // 前端 useChat 发送的 body 一定带 messages，这里主要防御手工调用或非法请求
        if (!body?.messages || !Array.isArray(body.messages)) {
            throw new BadRequestException('Invalid JSON');
        }

        // 1. 调用服务层，拿到 Vercel AI SDK 标准格式的 AsyncIterable 流
        const stream = await this.aiService.stream(body.messages);

        // 2. 把流写入 HTTP Response
        //    - 该函数内部会：设置正确 headers → 遍历流 → 逐块 res.write → 结束时 res.end()
        //    - 前端 useChat hook 拿到响应后，会自动按 Vercel 协议解码出文本增量、工具调用事件等
        pipeUIMessageStreamToResponse({ response: res, stream });
    }
}

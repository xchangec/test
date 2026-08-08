import { Inject, Injectable } from '@nestjs/common';
import { Log } from '../common/log';
import z from 'zod';
import { tool } from '@langchain/core/tools';
import { Runnable } from '@langchain/core/runnables';
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';

@Injectable()
export class AiService {
  private readonly modelWithTools: Runnable<BaseMessage[], AIMessage>;

  constructor(
    @Inject('CHAT_MODEL') model: ChatOpenAI,
    // @Inject('QUERY_USER_TOOL') private readonly queryUserTool: any,
    @Inject('SEND_MAIL_TOOL') private readonly sendMailTool: any,
    @Inject('WEB_SEARCH_TOOL') private readonly webSearchTool: any,
    @Inject('DB_USERS_CRUD_TOOL') private readonly dbUsersCrudTool: any,
  ) {
    this.modelWithTools = model.bindTools([
      // this.queryUserTool,
      this.sendMailTool,
      this.webSearchTool,
      this.dbUsersCrudTool,
    ]);
  }

  async runChain(query: string): Promise<string> {
    const messages: BaseMessage[] = [
      new SystemMessage(
        '你是一个智能助手，可以在需要时调用工具，再用结果回答用户问题',
      ),
      new HumanMessage(query),
    ];
    const log = new Log('ai.log');
    log.appendLog(`用户请求: ${query}`);

    while (true) {
      const aiMessage = await this.modelWithTools.invoke(messages);

      messages.push(aiMessage);

      const toolCalls = aiMessage.tool_calls ?? [];

      // 记录大模型返回
      if (!toolCalls.length) {
        log.appendLog(`最终回复: ${JSON.stringify(aiMessage)}`);
        const content = (aiMessage.content as string) || '';
        return content;
      }
      log.appendLog(`大模型返回: ${JSON.stringify(aiMessage)}`);

      for (const toolCall of toolCalls) {
        const toolCallId = toolCall.id || '';
        const toolName = toolCall.name;

        if (toolName === 'send_mail') {
          const result = await this.sendMailTool.invoke(toolCall.args);
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: result,
            }),
          );
        }
      }
    }
  }

  // 流式版本
  async *runChainStream(query: string): AsyncIterable<string> {
    console.log('触发。。。');

    const messages: BaseMessage[] = [
      new SystemMessage(
        '你是一个智能助手，可以在需要时调用工具，再用结果回答用户问题',
      ),
      new HumanMessage(query),
    ];
    const log = new Log('ai');
    log.appendLog(`用户请求:`);
    log.appendLog(query);

    while (true) {
      const stream = await this.modelWithTools.stream(messages);
      log.appendLog(`stream:`);
      log.appendLog(stream);
      log.appendLog(``);
      log.appendLog('');

      let fullAIMessage: AIMessageChunk | null = null;

      for await (const chunk of stream as AsyncIterable<AIMessageChunk>) {
        fullAIMessage = fullAIMessage ? fullAIMessage.concat(chunk) : chunk;
        // log.appendLog(`chunk:`);
        // // log.appendLog(chunk);
        // log.appendLog(chunk.toDict());
        // log.appendLog(`fullAIMessage:`);
        // // log.appendLog(fullAIMessage);
        // log.appendLog(fullAIMessage.toDict());

        // if (chunk.additional_kwargs.reasoning_content) {
        //   yield chunk.additional_kwargs.reasoning_content as string;
        // }
        const hasToolCallChunk =
          !!fullAIMessage.tool_call_chunks &&
          fullAIMessage.tool_call_chunks.length > 0;

        // 只要当前轮次还没出现 tool 调用的 chunk，就可以把文本内容流式往外推
        if (!hasToolCallChunk && chunk.content) {
          yield chunk.content as string;
        }
      }

      if (!fullAIMessage) {
        return;
      }

      // fullAIMessage和普通的aiMessage有什么区别？
      messages.push(fullAIMessage);
      log.appendLog(``);
      log.appendLog('');
      log.appendLog(`完整fullAIMessage:`);
      log.appendLog(fullAIMessage);

      const toolCalls = fullAIMessage.tool_calls ?? [];

      // 没有工具调用：说明这一轮就是最终回答，已经在上面的 for-await 中流完了，可以结束
      if (!toolCalls.length) {
        return;
      }

      for (const toolCall of toolCalls) {
        const toolCallId = toolCall.id || '';
        const toolName = toolCall.name;

        // if (toolName === 'query_user') {
        //   const args = queryUserArgsSchema.parse(toolCall.args);
        //   const result = await this.queryUserTool.invoke(args);

        //   log.appendLog(`工具执行结果: ${result}`);

        //   messages.push(
        //     new ToolMessage({
        //       tool_call_id: toolCallId,
        //       name: toolName,
        //       content: result,
        //     }),
        //   );
        // } else
        if (toolName === 'send_mail') {
          const result = await this.sendMailTool.invoke(toolCall.args);
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: result,
            }),
          );
        } else if (toolName === 'web_search') {
          const result = await this.webSearchTool.invoke(toolCall.args);
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: result,
            }),
          );
        } else if (toolName === 'db_users_crud') {
          const result = await this.dbUsersCrudTool.invoke(toolCall.args);
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: result,
            }),
          );
        }
      }
    }
  }
}

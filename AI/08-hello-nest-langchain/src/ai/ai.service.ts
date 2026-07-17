import { Inject, Injectable } from '@nestjs/common';
import { CreateAiDto } from './dto/create-ai.dto';
import { UpdateAiDto } from './dto/update-ai.dto';
import { PromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ConfigService } from '@nestjs/config';
import { Runnable } from '@langchain/core/runnables';

@Injectable()
export class AiService {
  private readonly chain: Runnable;

  // constructor(@Inject(ConfigService) configService: ConfigService) {
  //   const prompt = PromptTemplate.fromTemplate('请回答以下问题：\n\n{query}');
  //   const model = new ChatOpenAI({
  //     temperature: 0.7,
  //     modelName: configService.get('MODEL_NAME'),
  //     apiKey: configService.get('OPENAI_API_KEY'),
  //     configuration: {
  //       baseURL: configService.get('OPENAI_BASE_URL'),
  //     },
  //   });
  //   this.chain = prompt.pipe(model).pipe(new StringOutputParser());
  // }
  constructor(@Inject('CHAT_MODEL') model: ChatOpenAI) {
    const prompt = PromptTemplate.fromTemplate('请回答以下问题：\n\n{query}');
    this.chain = prompt.pipe(model).pipe(new StringOutputParser());
  }

  async runChain(query) {
    return this.chain.invoke({ query });
  }
  async *streamChain(query: string): AsyncGenerator<string> {
    const stream = await this.chain.stream({ query });
    for await (const chunk of stream) {
      yield chunk;
    }
  }
}

import { Injectable } from '@nestjs/common';
import { CreateAiDto } from './dto/create-ai.dto';
import { UpdateAiDto } from './dto/update-ai.dto';
import { PromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { StringOutputParser } from '@langchain/core/output_parsers';

@Injectable()
export class AiService {
  private readonly chain;

  constructor() {
    const prompt = PromptTemplate.fromTemplate('请回答以下问题：\n\n{query}');
    const model = new ChatOpenAI({
      temperature: 0.7,
      modelName: 'deepseek-v4-pro',
      apiKey: 'sk-438f84d3fe4445b68088952806c6b107',
      configuration: {
        baseURL: 'https://api.deepseek.com',
      },
    });
    this.chain = prompt.pipe(model).pipe(new StringOutputParser());
  }

  async runChain(query) {
    return this.chain.invoke({ query });
  }
  create(createAiDto: CreateAiDto) {
    return 'This action adds a new ai';
  }

  findAll() {
    return `This action returns all ai`;
  }

  findOne(id: number) {
    return `This action returns a #${id} ai`;
  }

  update(id: number, updateAiDto: UpdateAiDto) {
    return `This action updates a #${id} ai`;
  }

  remove(id: number) {
    return `This action removes a #${id} ai`;
  }
}

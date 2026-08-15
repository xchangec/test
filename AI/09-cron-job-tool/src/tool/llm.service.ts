import { ChatOpenAI } from "@langchain/openai";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class LlmService {
    @Inject(ConfigService)
    private readonly configService: ConfigService;

    getModel() {
        return new ChatOpenAI({
            // temperature: 0.7,
            model: this.configService.get('MODEL_NAME'),
            apiKey: this.configService.get('OPENAI_API_KEY'),
            configuration: {
                baseURL: this.configService.get('OPENAI_BASE_URL'),
            },
        });
    }
}
import { ChatOpenAI } from '@langchain/openai';
import { Inject, Injectable } from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { Runnable } from '@langchain/core/runnables';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AI_TTS_STREAM_EVENT, AiTtsStreamEvent } from 'src/common/stream-events';
import { Log } from '../common/log';

@Injectable()
export class AiService {
    private readonly chain: Runnable;
    private readonly log: Log;

    constructor(
        @Inject('CHAT_MODEL') private readonly model: ChatOpenAI,
        private readonly eventEmitter: EventEmitter2,
    ) {
        this.log = new Log('chunk.log');
        const prompt = PromptTemplate.fromTemplate(`请回答以下问题：\n\n{query}`);
        this.chain = prompt.pipe(this.model).pipe(new StringOutputParser());
    }

    async *streamChain(query: string, ttsSessionId?: string): AsyncGenerator<string> {
        try {
            const stream = await this.chain.stream({ query });
            for await (const chunk of stream) {
                if (ttsSessionId) {
                    const event: AiTtsStreamEvent = {
                        type: 'chunk',
                        sessionId: ttsSessionId,
                        chunk,
                    };
                    this.eventEmitter.emit(AI_TTS_STREAM_EVENT, event);
                }
                this.log.appendLog(chunk);
                this.log.appendLog('');
                yield chunk;
            }
            if (ttsSessionId) {
                const endEvent: AiTtsStreamEvent = { type: 'end', sessionId: ttsSessionId };
                this.eventEmitter.emit(AI_TTS_STREAM_EVENT, endEvent);
            }
        } catch (error) {
            if (ttsSessionId) {
                const errorEvent: AiTtsStreamEvent = {
                    type: 'error',
                    sessionId: ttsSessionId,
                    error: error instanceof Error ? error.message : String(error),
                };
                this.eventEmitter.emit(AI_TTS_STREAM_EVENT, errorEvent);
            }
            throw error;
        }
    }
}

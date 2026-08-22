import { Controller, Query, Sse } from '@nestjs/common';
import { AiService } from './ai.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { from, map } from 'rxjs';
import { AI_TTS_STREAM_EVENT, AiTtsStreamEvent } from 'src/common/stream-events';

@Controller('ai')
export class AiController {
    constructor(
        private readonly aiService: AiService,
        private readonly eventEmitter: EventEmitter2
    ) { }
    @Sse('chat/stream')
    chartStream(
        @Query('query') query: string,
        @Query('ttsSessionId') ttsSessionId: string,
    ) {
        const sessionId = ttsSessionId?.trim();
        if (sessionId) {
            const startEvent: AiTtsStreamEvent = { type: 'start', sessionId, query };
            this.eventEmitter.emit(AI_TTS_STREAM_EVENT, startEvent);
        }

        return from(this.aiService.streamChain(query, sessionId)).pipe(
            map((chunk) => ({ data: chunk })),
        );
    }
}

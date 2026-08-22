import { Module } from '@nestjs/common';
import { SpeechService } from './speech.service';
import { SpeechController } from './speech.controller';
import { TtsRelayService } from './tts-relay.service';
import { ConfigService } from '@nestjs/config';
import * as tencentcloud from "tencentcloud-sdk-nodejs";

const AsrClient = tencentcloud.asr.v20190614.Client;

@Module({
  providers: [
    SpeechService,
    TtsRelayService,
    {
      provide: 'ASR_CLIENT',
      useFactory: (configService: ConfigService) => {
        return new AsrClient({
          credential: {
            secretId: configService.get('SECRET_ID'),
            secretKey: configService.get('SECRET_KEY'),
          },
          region: "ap-shanghai",
          profile: {
            httpProfile: {
              reqMethod: "POST",
              reqTimeout: 30,
            },
          },
        });
      },
      inject: [ConfigService],
    }
  ],
  // 导出 TtsRelayService，让 main.ts 通过 app.get() 能在根上下文取到实例
  exports: [TtsRelayService],
  controllers: [SpeechController]
})
export class SpeechModule { }

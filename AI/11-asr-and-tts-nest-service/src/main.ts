import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TtsRelayService } from './speech/tts-relay.service';
import { WebSocketServer } from 'ws';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 从 Nest IoC 容器中获取 TTS 中转服务实例（main.ts 不在 DI 体系内，需手动获取）
  const ttsRelayService = app.get(TtsRelayService);
  // 获取 Nest 底层的 Node.js HTTP 服务器实例，用于复用同一端口挂载 WebSocket
  const server = app.getHttpServer()

  // 创建 WebSocket 服务器，复用 HTTP 端口，仅处理路径为 /speech/tts/ws 的升级请求
  const ttsWss = new WebSocketServer({ server, path: '/speech/tts/ws' });

  // 监听新的 WebSocket 连接
  ttsWss.on('connection', (socket, request) => {
    // 解析连接 URL 中的 query 参数，取出客户端期望绑定的 sessionId
    const reqUrl = new URL(request.url ?? '', 'http://localhost');
    const wantedSessionId = reqUrl.searchParams.get('sessionId') ?? undefined;
    // 将 socket 注册到中转服务，建立会话与连接的映射，返回最终生效的 sessionId
    const sessionId = ttsRelayService.registerClient(socket, wantedSessionId);

    // 连接关闭时清理对应会话，防止内存泄漏
    socket.on('close', () => {
      ttsRelayService.unregisterClient(sessionId);
    });
  });

  // 启动 HTTP 服务，默认监听 3000 端口（WebSocket 也随之生效）
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

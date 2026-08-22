import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'node:crypto';
import { OnEvent } from '@nestjs/event-emitter';
import { AI_TTS_STREAM_EVENT, type AiTtsStreamEvent } from '../common/stream-events';
import WebSocket from 'ws';

/**
 * 单个 TTS 客户端的会话上下文
 *  - 同时持有面向前端的 WebSocket 和面向腾讯云 TTS 的 WebSocket
 *  - pendingChunks 用于在腾讯连接未就绪时缓存 AI 流式分片，避免丢失数据
 */
type ClientSession = {
  sessionId: string;              // 会话唯一标识，前端与腾讯侧共用
  clientWs: WebSocket;            // 面向前端的 WebSocket 连接
  tencentWs?: WebSocket;          // 面向腾讯云 TTS 的 WebSocket 连接（按需创建）
  ready: boolean;                 // 腾讯 TTS 是否已就绪（收到 ready=1 后才可发送文本）
  pendingChunks: string[];        // 腾讯未就绪期间缓存的文本分片，就绪后统一 flush
  closed: boolean;                // 会话是否已关闭，关闭后忽略后续消息
};

/**
 * TTS 中转服务
 *
 * 角色：在前端 WebSocket 与腾讯云 TTS WebSocket 之间充当"中继/代理"
 *  - 监听 AI 模块发出的事件流（@OnEvent），把文本分片转发给腾讯 TTS
 *  - 接收腾讯返回的二进制音频，原样转发给前端
 *  - 管理会话生命周期：注册、重连、清理
 */
@Injectable()
export class TtsRelayService implements OnModuleDestroy {
  private readonly logger = new Logger(TtsRelayService.name);
  // sessionId -> ClientSession 的会话表，所有状态都通过该 Map 集中管理
  private readonly sessions = new Map<string, ClientSession>();
  // 腾讯云鉴权与音色配置，从 .env 读取
  private readonly secretId: string;
  private readonly secretKey: string;
  private readonly appId: number;
  private readonly voiceType: number;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.secretId = configService.get<string>('SECRET_ID') ?? '';
    this.secretKey = configService.get<string>('SECRET_KEY') ?? '';
    this.appId = Number(configService.get<string>('APP_ID') ?? 0);
    // 默认 101001 为腾讯智晟云音色 ID，可在 .env 中通过 TTS_VOICE_TYPE 覆盖
    this.voiceType = Number(configService.get<string>('TTS_VOICE_TYPE') ?? 101001);
  }

  /**
   * 模块销毁时关闭所有会话，避免遗留的 WebSocket 连接与定时器
   * （Nest 在应用关闭时会自动调用 OnModuleDestroy 钩子）
   */
  onModuleDestroy(): void {
    for (const session of this.sessions.values()) {
      this.closeSession(session.sessionId, 'module destroy');
    }
  }

  /**
   * 注册新的前端 WebSocket 客户端
   *  - 若客户端携带 sessionId（断线重连场景），先关闭旧会话再重建
   *  - 否则生成新的 UUID 作为 sessionId
   *  - 向前端回送 { type: 'session', sessionId } 以确认绑定关系
   */
  registerClient(clientWs: WebSocket, wantedSessionId?: string): string {
    const sessionId = wantedSessionId?.trim() || randomUUID();
    const existing = this.sessions.get(sessionId);
    if (existing) {
      // 同一 sessionId 已存在旧会话，清理掉以避免状态冲突
      this.closeSession(sessionId, 'client reconnected');
    }

    this.sessions.set(sessionId, {
      sessionId,
      clientWs,
      ready: false,
      pendingChunks: [],
      closed: false,
    });
    // 通知前端：会话已建立，后续事件请带上此 sessionId
    this.sendClientJson(clientWs, { type: 'session', sessionId });
    this.logger.log(`TTS client connected: ${sessionId}`);
    return sessionId;
  }

  /**
   * 注销客户端：在连接关闭时被调用，统一走 closeSession 清理流程
   */
  unregisterClient(sessionId: string): void {
    this.closeSession(sessionId, 'client disconnected');
  }

  /**
   * 监听 AI 模块通过 EventEmitter 发出的 TTS 流事件
   *  - start  : AI 开始流式输出，需建立到腾讯 TTS 的连接
   *  - chunk  : AI 流式文本分片，转发给腾讯 TTS 进行合成
   *  - end    : AI 流结束，通知腾讯结束本轮合成
   *  - error  : AI 流异常，关闭会话并通知前端
   */
  @OnEvent(AI_TTS_STREAM_EVENT)
  handleAiStreamEvent(event: AiTtsStreamEvent): void {
    const session = this.sessions.get(event.sessionId);
    if (!session) return; // 客户端已断开，丢弃事件

    switch (event.type) {
      case 'start': {
        // 确保（按需建立）到腾讯 TTS 的 WebSocket 连接
        this.ensureTencentConnection(session);
        // 通知前端：TTS 已开始，同时带上原始 query 便于 UI 展示
        this.sendClientJson(session.clientWs, {
          type: 'tts_started',
          sessionId: session.sessionId,
          query: event.query,
        });
        break;
      }
      case 'chunk': {
        const chunk = event.chunk?.trim();
        if (!chunk) return; // 空文本直接忽略，避免无意义的合成请求
        // 腾讯连接尚未就绪：先入队缓存，等 ready 后由 flushPendingChunks 统一发送
        if (!session.ready || !session.tencentWs || session.tencentWs.readyState !== WebSocket.OPEN) {
          session.pendingChunks.push(chunk);
          return;
        }
        this.sendTencentChunk(session, chunk);
        break;
      }
      case 'end': {
        // 收尾前先把缓存中的分片冲刷到腾讯，避免最后一段文本丢失
        this.flushPendingChunks(session);
        if (session.tencentWs && session.tencentWs.readyState === WebSocket.OPEN) {
          // 通知腾讯：本轮合成输入结束，请输出剩余音频
          session.tencentWs.send(
            JSON.stringify({
              session_id: session.sessionId,
              action: 'ACTION_COMPLETE',
            }),
          );
        }
        break;
      }
      case 'error': {
        this.sendClientJson(session.clientWs, {
          type: 'tts_error',
          message: event.error,
        });
        this.closeSession(session.sessionId, 'ai stream error');
        break;
      }
    }
  }

  /**
   * 确保会话存在一条到腾讯云 TTS 的可用 WebSocket 连接
   *  - 已存在且未关闭：直接复用
   *  - 缺凭证：向前端报错
   *  - 否则：构造签名 URL 并建立连接，绑定 message/error/close 监听
   */
  private ensureTencentConnection(session: ClientSession): void {
    // 已存在且处于 OPEN/CONNECTING 状态则复用，避免重复创建
    if (session.tencentWs && session.tencentWs.readyState <= WebSocket.OPEN) {
      return;
    }
    if (!this.secretId || !this.secretKey || !this.appId) {
      this.sendClientJson(session.clientWs, {
        type: 'tts_error',
        message: 'TTS 凭证缺失，请检查 SECRET_ID/SECRET_KEY/APP_ID',
      });
      return;
    }

    const url = this.buildTencentTtsWsUrl(session.sessionId);
    const tencentWs = new WebSocket(url);
    session.tencentWs = tencentWs;
    session.ready = false; // 重置就绪标记，等腾讯返回 ready=1 后再置为 true

    tencentWs.on('open', () => {
      this.logger.log(`Tencent TTS ws opened: ${session.sessionId}`);
    });

    /**
     * 腾讯 TTS 下行消息处理
     *  - 二进制帧：音频数据，直接转发给前端（保留二进制格式以节省带宽）
     *  - 文本帧：控制信令（ready / code 错误码 / final 收尾标志）
     */
    tencentWs.on('message', (data, isBinary) => {
      if (session.closed) return; // 会话已关闭，丢弃迟到的消息
      if (isBinary) {
        if (session.clientWs.readyState === WebSocket.OPEN) {
          session.clientWs.send(data, { binary: true });
        }
        return;
      }

      // 文本信令：尝试解析为 JSON，非法 JSON 静默丢弃
      const raw = data.toString();
      let msg: Record<string, unknown> | undefined;
      try {
        msg = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return;
      }

      // 腾讯侧就绪：可开始向其发送文本，并冲刷缓存队列
      if (Number(msg.ready) === 1) {
        session.ready = true;
        this.flushPendingChunks(session);
      }

      // 腾讯侧返回业务错误码：通知前端并关闭会话
      if (Number(msg.code) && Number(msg.code) !== 0) {
        this.sendClientJson(session.clientWs, {
          type: 'tts_error',
          message: String(msg.message ?? 'Tencent TTS error'),
          code: Number(msg.code),
        });
        this.closeSession(session.sessionId, 'tencent error');
        return;
      }

      // 腾讯侧合成结束：通知前端做收尾（如关闭播放器、解除等待状态）
      if (Number(msg.final) === 1) {
        this.sendClientJson(session.clientWs, { type: 'tts_final' });
      }
    });

    // 腾讯连接异常：把错误透传给前端（不主动关闭，由 close 事件兜底）
    tencentWs.on('error', (error) => {
      this.sendClientJson(session.clientWs, {
        type: 'tts_error',
        message: `Tencent ws error: ${error.message}`,
      });
    });

    // 腾讯连接关闭：清引用并标记未就绪，下次 start 事件会重建连接
    tencentWs.on('close', () => {
      session.tencentWs = undefined;
      session.ready = false;
    });
  }

  /**
   * 冲刷缓存队列：在腾讯就绪后把先前积累的 chunk 依次补发
   *  - 仍不就绪则直接返回（避免误调用）
   *  - 队列顺序发送，保证文本时序
   */
  private flushPendingChunks(session: ClientSession): void {
    if (!session.ready || !session.tencentWs || session.tencentWs.readyState !== WebSocket.OPEN) {
      return;
    }
    while (session.pendingChunks.length > 0) {
      const chunk = session.pendingChunks.shift();
      if (!chunk) continue;
      this.sendTencentChunk(session, chunk);
    }
  }

  /**
   * 向腾讯 TTS 发送一段文本合成请求
   *  - 若连接不可用则回退到缓存队列（兜底）
   *  - message_id 由时间戳+随机串拼接，保证唯一性便于腾讯侧追踪
   */
  private sendTencentChunk(session: ClientSession, text: string): void {
    if (!session.tencentWs || session.tencentWs.readyState !== WebSocket.OPEN) {
      session.pendingChunks.push(text);
      return;
    }

    session.tencentWs.send(
      JSON.stringify({
        session_id: session.sessionId,
        message_id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        action: 'ACTION_SYNTHESIS',
        data: text,
      }),
    );
  }

  /**
   * 关闭会话：先标记 closed 屏蔽后续消息，再关闭两条 WebSocket，最后从表中删除
   *  - 关闭前向前端发 { type: 'tts_closed', reason } 以便前端做 UI 收尾
   *  - readyState < CLOSING 表示尚未在关闭流程中，可安全 close
   */
  private closeSession(sessionId: string, reason: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.closed = true; // 先置标记，让进行中的 message 回调自动短路

    if (session.tencentWs && session.tencentWs.readyState < WebSocket.CLOSING) {
      session.tencentWs.close();
    }
    if (session.clientWs.readyState < WebSocket.CLOSING) {
      this.sendClientJson(session.clientWs, { type: 'tts_closed', reason });
      session.clientWs.close();
    }
    this.sessions.delete(sessionId);
    this.logger.log(`TTS session closed: ${sessionId}, reason: ${reason}`);
  }

  /**
   * 安全地向前端发送 JSON 消息：连接未 OPEN 时静默跳过，避免抛错
   */
  private sendClientJson(clientWs: WebSocket, payload: Record<string, unknown>): void {
    if (clientWs.readyState !== WebSocket.OPEN) return;
    clientWs.send(JSON.stringify(payload));
  }

  /**
   * 构造腾讯云 TTS WebSocket 的签名 URL（v2 协议）
   *
   * 签名步骤（腾讯云 API v3 风格的简化版）：
   *  1. 按 key 字典序排序参数，拼成 k1=v1&k2=v2... 的查询串
   *  2. 构造签名原文：`GETtts.cloud.tencent.com/stream_wsv2?${signStr}`
   *  3. 用 SecretKey 对原文做 HMAC-SHA1，输出 base64 作为 Signature
   *  4. 把 Signature 拼回查询参数，形成最终的 wss URL
   *
   * 注意：腾讯云要求参数按字典序排序后参与签名，否则会鉴权失败。
   */
  private buildTencentTtsWsUrl(sessionId: string): string {
    const now = Math.floor(Date.now() / 1000);
    // 注意：字段名需与腾讯云文档保持一致，签名时按 key 排序
    const params: Record<string, string | number> = {
      Action: 'TextToStreamAudioWSv2',
      AppId: this.appId,
      Codec: 'mp3',
      Expired: now + 3600,        // 链接有效期 1 小时
      SampleRate: 16000,
      SecretId: this.secretId,
      SessionId: sessionId,
      Speed: 0,                  // 语速 0 为默认
      Timestamp: now,
      VoiceType: this.voiceType,
      Volume: 5,                 // 音量 0~10
    };

    // 步骤 1：参数按 key 字典序排序后拼接
    const signStr = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    // 步骤 2-3：构造签名原文并计算 HMAC-SHA1 -> base64
    const rawStr = `GETtts.cloud.tencent.com/stream_wsv2?${signStr}`;
    const signature = createHmac('sha1', this.secretKey).update(rawStr).digest('base64');
    // 步骤 4：把所有参数（含 Signature）组装为最终 URL
    const searchParams = new URLSearchParams({
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
      Signature: signature,
    });

    return `wss://tts.cloud.tencent.com/stream_wsv2?${searchParams.toString()}`;
  }
}

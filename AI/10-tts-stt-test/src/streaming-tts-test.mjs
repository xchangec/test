// 腾讯云流式语音合成（TTS）测试脚本
// 通过 WebSocket 连接 tts.cloud.tencent.com，分段发送文本并接收合成的音频流，最终写入 mp3 文件
import "dotenv/config"; // 自动从 .env 文件加载环境变量到 process.env
import WebSocket from "ws"; // Node.js 环境下的 WebSocket 客户端
import crypto from "node:crypto"; // 用于生成鉴权签名（HMAC-SHA1）
import fs from "node:fs"; // 用于将音频数据写入本地文件
import path from "node:path"; // 用于从输出路径推导目录
import { Log } from '../common/log.ts';

// 从环境变量读取腾讯云鉴权凭据
const SECRET_ID = process.env.SECRET_ID; // 密钥 ID
const SECRET_KEY = process.env.SECRET_KEY; // 密钥 Key，用于签名
const APP_ID = process.env.APP_ID; // 应用 ID

const VOICE_TYPE = 101001; // 音色类型（101001 为标准女声）
const OUTPUT_FILE = "./file/output3.mp3"; // 合成音频的输出文件名
const TEXT_INTERVAL_MS = 3000; // 相邻文本分段的发送间隔（毫秒），模拟流式输入
// 待合成的文本分段，按顺序依次发送
const TEXTS = [
  "傍晚我还在为晚霞开心，",
  "突然接到电话说系统崩了，",
  "我心里一沉冲回办公室，",
  "好在大家一起排查后终于恢复，",
  "我长长松了口气。",
];

const log = new Log('message.log');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)); // 延时工具：返回一个在 ms 毫秒后 resolve 的 Promise

// 构造带鉴权签名的 WebSocket 连接地址
function buildWsUrl() {
  const now = Math.floor(Date.now() / 1000); // 当前 Unix 时间戳（秒）
  const sessionId = `session_${now}_${Math.random().toString(36).slice(2)}`; // 生成唯一会话 ID

  // 鉴权与合成参数（键名需与腾讯云接口约定一致）
  const params = {
    Action: "TextToStreamAudioWSv2", // 接口动作：流式语音合成 v2
    AppId: parseInt(APP_ID), // 应用 ID（转为整数）
    Codec: "mp3", // 音频编码格式
    Expired: now + 3600, // 签名过期时间（1 小时后）
    SampleRate: 16000, // 采样率
    SecretId: SECRET_ID, // 密钥 ID
    SessionId: sessionId, // 会话 ID
    Speed: 0, // 语速（0 为默认）
    Timestamp: now, // 请求时间戳
    VoiceType: VOICE_TYPE, // 音色类型
    Volume: 5, // 音量
  };

  // 生成签名：参数按键名字典序排序后拼接，再用 HMAC-SHA1 计算并进行 base64 编码
  const sortedKeys = Object.keys(params).sort();
  const signStr = sortedKeys.map((k) => `${k}=${params[k]}`).join("&"); // 排序后的 key=value 字符串
  const rawStr = `GETtts.cloud.tencent.com/stream_wsv2?${signStr}`; // 待签名的原始串（含请求方法与路径）
  const signature = crypto
    .createHmac("sha1", SECRET_KEY)
    .update(rawStr)
    .digest("base64");
  // 将全部参数与签名一并作为 URL 查询串
  const searchParams = new URLSearchParams({
    ...params,
    Signature: signature,
  });

  return {
    sessionId,
    url: `wss://tts.cloud.tencent.com/stream_wsv2?${searchParams.toString()}`,
  };
}

// 依次发送各文本分段，最后发送完成指令
async function sendTexts(ws, sessionId) {
  for (let i = 0; i < TEXTS.length; i++) {
    // 每段文本作为一次合成请求发送
    ws.send(JSON.stringify({ session_id: sessionId, message_id: `msg_${i}`, action: "ACTION_SYNTHESIS", data: TEXTS[i] }));
    console.log(`[文本] 已发送: ${TEXTS[i]}`);
    if (i < TEXTS.length - 1) await sleep(TEXT_INTERVAL_MS); // 分段之间等待，模拟流式输入
  }
  // 通知服务端所有文本已发送完毕，可结束合成
  ws.send(JSON.stringify({ session_id: sessionId, action: "ACTION_COMPLETE" }));
  console.log("[文本] 已发送 ACTION_COMPLETE");
}

// 主流程：建立连接、发送文本、接收并保存音频流
function streamTTS() {


  // 缺少任一鉴权凭据则直接报错退出
  if (!SECRET_ID || !SECRET_KEY || !APP_ID) {
    throw new Error("请先在 .env 配置 SECRET_ID、SECRET_KEY、APP_ID");
  }

  const { url, sessionId } = buildWsUrl(); // 生成鉴权连接地址与会话 ID
  const ws = new WebSocket(url); // 建立 WebSocket 连接
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true }); // 确保输出目录存在（不存在则递归创建）
  const writeStream = fs.createWriteStream(OUTPUT_FILE, { flags: "w" }); // 以覆盖模式创建输出文件写入流
  let totalBytes = 0; // 已接收音频的累计字节数
  let closed = false; // 是否已执行清理，避免重复关闭
  let sent = false; // 是否已发送文本，避免重复发送

  // 关闭连接并结束文件写入的统一清理函数
  const closeAll = () => {
    if (closed) return; // 已清理则跳过
    closed = true;
    writeStream.end(() => {
      console.log(`[保存] 音频已保存至 ${OUTPUT_FILE}，共 ${totalBytes} 字节`);
    });
    if (ws.readyState < WebSocket.CLOSING) ws.close(); // 仅在连接尚未关闭时主动关闭
  };

  // 连接建立：等待服务端下发就绪消息后再发送文本
  ws.on("open", () => {
    console.log("[连接] WebSocket 已建立，等待服务端就绪...");
  });

  // 收到消息：二进制为音频数据，文本为控制/状态消息
  ws.on("message", async (data, isBinary) => {
    log.appendLog(isBinary ? data : data.toString())

    if (isBinary) {
      writeStream.write(data); // 音频分片直接写入文件
      totalBytes += data.length;
      return;
    }

    try {
      const msg = JSON.parse(data.toString()); // 解析服务端返回的 JSON 状态消息
      console.log("[消息]", JSON.stringify(msg));

      // 服务端就绪且尚未发送时，开始发送文本
      if (msg.ready === 1 && !sent) {
        sent = true;
        await sendTexts(ws, sessionId);
      }

      if (msg.code && msg.code !== 0) {
        // 非 0 错误码：打印错误并关闭
        console.error(`[错误] code=${msg.code}, message=${msg.message}`);
        closeAll();
      } else if (msg.final === 1) {
        // 合成完成标志：正常结束
        console.log("[完成] 合成结束。");
        closeAll();
      }
    } catch (e) {
      console.error("[解析错误]", e.message); // JSON 解析失败等异常
    }
  });

  // 连接出错：记录并清理
  ws.on("error", (err) => {
    console.error("[WebSocket 错误]", err.message);
    closeAll();
  });

  // 连接关闭：记录关闭码与原因并清理
  ws.on("close", (code, reason) => {
    console.log(`[断开] 连接已关闭，code=${code}, reason=${reason}`);
    closeAll();
  });
}

streamTTS(); // 启动脚本
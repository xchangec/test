import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";

import fs from "fs";
import path from "path";
// 1. 创建日志文件流（追加模式，不会覆盖）
const logStream = fs.createWriteStream(path.join(process.cwd(), "log/07-log.log"), { flags: "a" });

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});
const prompt = `详细介绍莫扎特的信息。`;

console.log("🌊 普通流式输出演示（无结构化）\n");

try {
  const stream = await model.stream(prompt);
  let fullContent = "";
  let chunkCount = 0;
  for await (const chunk of stream) {
    const toolsStr = JSON.stringify({ ...chunk }, null, 2);
    logStream.write(`chunk:${"-".repeat(30)}\n`);
    logStream.write(toolsStr + "\n");
    logStream.write(`chunk:${"-".repeat(30)}\n`);

    const content = chunk.content;
    chunkCount++;
    fullContent += content;
    process.stdout.write(content);
  }
  console.log(`\n\n✅ 共接收 ${chunkCount} 个数据块\n`);
  console.log(`📝 完整内容长度: ${fullContent.length} 字符`);
} catch (error) {
  console.error("\n❌ 错误:", error.message);
}

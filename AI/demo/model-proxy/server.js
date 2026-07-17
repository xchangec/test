const express = require("express");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const app = express();
const PORT = 8000;
const LOG_FILE = path.resolve(__dirname, "llm.log");

// 启动时清空日志文件
fs.writeFileSync(LOG_FILE, "", "utf8");

// 简易日志工具：输出控制台 + 写入文件
const logger = {
  log: async (msg) => {
    const line = String(msg) + "\n";
    console.log(msg);
    // 异步追加写入，不阻塞事件循环
    await fs.appendFile(LOG_FILE, line, "utf8");
  },
};

// 解析 JSON 请求体（提高限制以容纳大型 tools 载荷）
app.use(express.json({ type: "application/json", limit: "20mb" }));
// 捕获原始body（用于打印完整请求日志）
// app.use(async (req, res, next) => {
//   const chunks = [];
//   for await (const chunk of req) {
//     chunks.push(chunk);
//   }
//   req.rawBody = Buffer.concat(chunks).toString("utf8");
//   next();
// });

// 代理接口
app.post("/chat/completions", async (req, res) => {
  try {
    // 打印原始请求日志
    const body = req.body;
    await logger.log(`模型请求：${JSON.stringify(body)}`);
    // console.log('body:',body);

    // 自动补全Bearer，兼容Trae自定义配置只填key的场景
    let auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) auth = `Bearer ${auth}`;
    

    // SSE 响应头
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // 上游请求流式转发
    const upstream = await axios.post(
      "https://ws-45wpkw375qvsfci9.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions",
      body,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: auth,
        },
        responseType: "stream",
        timeout: 0, // 无超时，适配长思考
      },
    );

    await logger.log("模型返回：\n");

    // 逐行读取上游流，日志+转发给客户端
    upstream.data.on("data", async (chunk) => {
      const text = chunk.toString("utf8");
      // 按行分割输出日志
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.trim()) await logger.log(line);
      }
      res.write(chunk);
    });

    upstream.data.on("end", () => {
      res.end();
    });

    upstream.data.on("error", async (err) => {
      await logger.log(`上游流异常：${err.message}`);
      res.end();
    });
  } catch (err) {
    await logger.log(`代理请求异常：${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// 启动服务
app.listen(PORT, "0.0.0.0", () => {
  console.log(`代理服务运行在 http://0.0.0.0:${PORT}`);
});

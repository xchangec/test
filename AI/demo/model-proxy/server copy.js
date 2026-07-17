const express = require("express");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const app = express();
const PORT = 8000;
const LOG_FILE = path.resolve(__dirname, "llm.log");
fs.writeFileSync(LOG_FILE, "", "utf8");

const logger = {
  log: async (msg) => {
    const line = String(msg) + "\n";
    console.log(msg);
    try {
      await fs.appendFile(LOG_FILE, line, "utf8");
    } catch (e) {}
  },
};

// 1. 优先读取原始请求流，再解析json（解决body残缺）
app.use(async (req, res, next) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  req.rawBody = Buffer.concat(chunks).toString("utf8");
  next();
});
// 限制最大20MB请求体，拦截超大tools载荷
app.use(express.json({ limit: "20mb" }));

app.post("/chat/completions", async (req, res) => {
  let upstreamReq;
  try {
    console.log(req.body);
    
    const body = JSON.parse(req.rawBody);
    delete body.tools;
    await logger.log(`模型请求：${JSON.stringify(body)}`);

    // 自动补全Bearer，兼容Trae自定义配置只填key的场景
    let auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) auth = `Bearer ${auth}`;

    // SSE标准头
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const upstreamUrl = "https://ws-45wpkw375qvsfci9.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions";
    upstreamReq = await axios.post(upstreamUrl, body, {
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: auth,
      },
      responseType: "stream",
      timeout: 180000, // 3分钟长连接兜底超时
    });

    await logger.log("模型返回：\n");

    upstreamReq.data.on("data", async (chunk) => {
      const text = chunk.toString("utf8");
      text.split("\n").forEach(line => line.trim() && logger.log(line));
      res.write(chunk);
    });

    upstreamReq.data.on("end", () => res.end());
    upstreamReq.data.on("error", async (err) => {
      await logger.log(`上游流断开 ${err.code}:${err.message}`);
      res.write(`data: {"error":"连接中断，请检查模型名称、缩短工具描述"}\n\n`);
      res.end();
    });

    // Trae关闭对话/页面时，立刻销毁上游连接，避免堆积
    req.on("close", () => {
      if (upstreamReq?.request) upstreamReq.request.destroy();
    });

  } catch (err) {
    let log = `代理请求异常：${err.message}`;
    if (err.code === "ECONNRESET") {
      log += "\n排查：1.模型改为qwen系列 2.精简tools超长文本 3.密钥带Bearer前缀";
    }
    if (err.response) log += `\n状态码${err.response.status}:${JSON.stringify(err.response.data)}`;
    await logger.log(log);
    res.status(500).json({ code: err.code, msg: "上游连接被强制断开" });
  }
});

app.listen(PORT, "0.0.0.0", () => console.log("代理启动 8000"));
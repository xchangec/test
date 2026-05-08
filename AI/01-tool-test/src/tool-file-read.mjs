// 导入 zod 库，用于工具入参的类型校验
import { z } from "zod";
// 导入 dotenv 库，用于加载 .env 文件中的环境变量
import dotenv from "dotenv";
// 导入 node.js 的 fs/promises 模块，用于异步文件操作
import fs from "node:fs/promises";
// 从 langchain 核心工具模块导入 tool 装饰器，用于定义自定义工具
import { tool } from "@langchain/core/tools";
// 导入 OpenAI 聊天模型
import { ChatOpenAI } from "@langchain/openai";
// 导入 langchain 核心消息类型，用于构建对话消息流
import {
  SystemMessage, // 系统消息：定义 AI 的角色和行为准则
  ToolMessage, // 工具消息：工具调用的返回结果
  HumanMessage, // 人类消息：用户输入的内容
} from "@langchain/core/messages";

// 加载 .env 文件中的环境变量（如 API_KEY、MODEL_NAME 等）
dotenv.config();

// 初始化 OpenAI 聊天模型实例
const model = new ChatOpenAI({
  // 从环境变量读取模型名称（如 gpt-3.5-turbo、gpt-4 等）
  modelName: process.env.MODEL_NAME,
  // 从环境变量读取 OpenAI API 密钥
  apiKey: process.env.API_KEY,
  // 温度值：0 表示输出结果更确定、可预测（无随机性）
  temperature: 0,
  // 配置项：自定义 API 基础地址（可用于对接代理或自定义服务）
  configuration: {
    baseURL: process.env.BASE_URL,
  },
});

// 定义「读取文件」工具：使用 tool 装饰器封装异步函数，使其成为 LangChain 可调用的工具
const readFileTool = tool(
  // 工具核心逻辑：接收文件路径，读取文件内容并返回（含异常处理）
  async ({ filePath }) => {
    try {
      // 异步读取文件内容，编码为 utf-8
      const content = await fs.readFile(filePath, "utf-8");
      // 控制台日志：记录工具调用成功，输出读取的字节数
      console.log(
        ` [工具调用] read_file(${filePath}) - 成功读取 ${content.length} 字节`,
      );
      // 返回文件内容（格式化，方便 AI 模型解析）
      return `文件内容:\n${content}`;
    } catch (error) {
      // 异常处理：区分不同错误类型，返回精准的错误信息
      let errorMsg = "";
      if (error.code === "ENOENT") {
        // 文件不存在错误：提示路径 + 当前工作目录，方便排查
        errorMsg = `文件不存在：${error.path}（当前工作目录：${process.cwd()}）`;
      } else if (error.code === "EACCES") {
        // 权限不足错误
        errorMsg = `没有权限读取文件：${error.path}`;
      } else {
        // 其他未知错误：提示错误信息 + 错误码
        errorMsg = `读取文件失败：${error.message}（错误码：${error.code}）`;
      }
      // 控制台打印错误日志
      console.error(`❌ [工具调用] ${errorMsg}`);
      // 返回错误信息，让 AI 模型感知到调用失败的原因
      return errorMsg;
    }
  },
  // 工具元信息配置：定义工具名称、描述、入参校验规则
  {
    name: "read_file", // 工具唯一标识（AI 调用时会使用此名称）
    description: `用此工具来读取文件内容。当用户要求读取文件、查看代码、分析文件内容时，调用此工具。输入文件路径（可以是相对路径或绝对路径）。`, // 工具描述：告诉 AI 何时/如何使用此工具
    schema: z.object({
      // 入参校验规则：使用 zod 定义入参结构
      filePath: z.string().describe("要读取的文件路径"), // 入参为字符串类型，描述其含义
    }),
  },
);

// 整理所有可用工具（此处仅包含 readFileTool）
const tools = [readFileTool];

// 将 AI 模型与工具绑定：让模型知道可以调用这些工具
const modelWithTools = model.bindTools(tools);

// 构建对话消息流：初始化系统消息和用户消息
const messages = [
  // 系统消息：定义 AI 的角色和工作流程
  new SystemMessage(`
    你是一个代码助手，可以使用工具读取文件并解释代码。

    工作流程：
    1. 用户要求读取文件时，立即调用 read_file 工具
    2. 等待工具返回文件内容
    3. 基于文件内容进行分析和解释

    可用工具：
    - read_file：读取文件内容（使用此工具来获取文件内容）        
  `),
  // 人类消息：用户的具体指令（读取指定文件并解释代码）
  new HumanMessage("请读取 ./src/tool-file-read.mjs 文件内容并解释代码"),
];

// 第一步：调用绑定了工具的模型，获取初始响应（此时模型会判断是否需要调用工具）
let response = await modelWithTools.invoke(messages);
// 将模型的初始响应加入消息流（保证对话上下文完整）
messages.push(response);

// 循环处理工具调用：只要模型返回了工具调用指令，就执行工具并将结果返回给模型
while (response.tool_calls && response.tool_calls.length > 0) {
  // 控制台日志：提示检测到的工具调用数量
  console.log(`\n[监测到 ${response.tool_calls.length} 个工具调用]`);
  // 批量执行所有工具调用（Promise.all 并行处理）
  const toolResults = await Promise.all(
    response.tool_calls.map(async (toolCall) => {
      // 根据工具名称查找对应的工具实例
      const tool = tools.find((t) => t.name === toolCall.name);
      // 未找到工具时返回错误信息
      if (!tool) return `error: 找不到工具 ${toolCall.name}`;
      // 控制台日志：打印要执行的工具及入参
      console.log(`执行工具 ${tool.name}(${JSON.stringify(toolCall.args)})`);
      try {
        // 执行工具并获取结果
        const result = await tool.invoke(toolCall.args);
        return result;
      } catch (error) {
        // 工具执行异常时返回错误信息
        return `error: ${error.message}`;
      }
    }),
  );

  // 将每个工具调用的结果封装为 ToolMessage，加入消息流
  response.tool_calls.forEach((toolCall, index) => {
    messages.push(
      new ToolMessage({
        content: toolResults[index], // 工具执行结果
        tool_call_id: toolCall.id, // 关联对应的工具调用 ID（模型需通过此 ID 匹配结果）
      }),
    );
  });

  // 第二步：将工具执行结果返回给模型，获取最终响应（此时模型会基于文件内容生成解释）
  response = await modelWithTools.invoke(messages);
}

// 控制台打印最终结果：AI 对文件代码的解释
console.log(`\n[最终回复]`);
console.log(response.content);

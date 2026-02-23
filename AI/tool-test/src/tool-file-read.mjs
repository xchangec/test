import {z} from "zod";
// import 'dotenv/config'
import dotenv from "dotenv";
import fs from "node:fs/promises";
import { tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import {
  SystemMessage,
  ToolMessage,
  HumanMessage,
} from "@langchain/core/messages";

dotenv.config();

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.BASE_URL,
  },
});

const readFileTool = tool(
  async ({ filePath }) => {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      console.log(
        ` [工具调用] read_file(${filePath}) - 成功读取 ${content.length} 字节`,
      );
      return `文件内容:\n${content}`;
    } catch (error) {
      // 详细的错误信息，让模型能准确判断问题
      let errorMsg = "";
      if (error.code === "ENOENT") {
        errorMsg = `文件不存在：${error.path}（当前工作目录：${process.cwd()}）`;
      } else if (error.code === "EACCES") {
        errorMsg = `没有权限读取文件：${error.path}`;
      } else {
        errorMsg = `读取文件失败：${error.message}（错误码：${error.code}）`;
      }
      console.error(`❌ [工具调用] ${errorMsg}`);
      return errorMsg;
    }
  },
  {
    name: "read_file",
    description: `用此工具来读取文件内容。当用户要求读取文件、查看代码、分析文件内容时，调用此工具。输入文件路径（可以是相对路径或绝对路径）。`,
    schema: z.object({
      filePath: z.string().describe("要读取的文件路径"),
    }),
  },
);

const tools = [readFileTool];
// console.log(`
//     \n tools:
//     ${JSON.stringify(tools)}
//     \n
// `);

const modelWithTools = model.bindTools(tools);

const messages = [
  new SystemMessage(`
        你是一个代码助手，可以使用工具读取文件并解释代码。

        工作流程：
        1. 用户要求读取文件时，立即调用 read_file 工具
        2. 等待工具返回文件内容
        3. 基于文件内容进行分析和解释

        可用工具：
        - read_file：读取文件内容（使用此工具来获取文件内容）        
    `),
  new HumanMessage("请读取 ./src/tool-file-read.mjs 文件内容并解释代码"),
];

let response = await modelWithTools.invoke(messages);
// console.log(response);

messages.push(response);

while (response.tool_calls && response.tool_calls.length > 0) {
  console.log(`\n[监测到 ${response.tool_calls.length} 个工具调用]`);
  const toolResults = await Promise.all(
    response.tool_calls.map(async (toolCall) => {
      const tool = tools.find((t) => t.name === toolCall.name);
      if (!tool) return `error: 找不到工具 ${toolCall.name}`;
      console.log(`执行工具 ${tool.name}(${JSON.stringify(toolCall.args)})`);
      try {
        const result = await tool.invoke(toolCall.args);
        return result;
      } catch (error) {
        return `error: ${error.message}`;
      }
    }),
  );

  response.tool_calls.forEach((toolCall, index) => {
    messages.push(
      new ToolMessage({
        content: toolResults[index],
        tool_call_id: toolCall.id,
      }),
    );
  });
  response = await modelWithTools.invoke(messages);
}
console.log(`\n[最终回复]`);
console.log(response.content);

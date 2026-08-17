// 从 .env 文件加载环境变量到 process.env（如 API Key、Base URL、模型名）
import "dotenv/config";
// StructuredOutputParser: 结构化输出解析器，把模型返回的文本解析成符合指定 schema 的对象
import { StructuredOutputParser } from "@langchain/core/output_parsers";
// PromptTemplate: 提示词模板，用占位符 {var} 拼装最终发给模型的字符串
import { PromptTemplate } from "@langchain/core/prompts";
// ChatOpenAI: OpenAI 兼容的对话模型封装
import { ChatOpenAI } from "@langchain/openai";
// zod: 运行时数据校验库，这里用来声明期望的输出结构
import { z } from "zod";

// 创建模型实例。通过 configuration.baseURL 可指向任何 OpenAI 兼容的服务端点
const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0, // 0 表示输出尽量确定、可复现，减少随机性
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

// 定义输出结构 schema：期望模型返回一个对象，包含译文和 3 个关键词。
// .describe(...) 的说明会被写进 format_instructions，用来引导模型按此含义填充字段
const schema = z.object({
  translation: z.string().describe("翻译后的英文文本"),
  keywords: z.array(z.string()).length(3).describe("3个关键词"),
});

// 根据 zod schema 生成解析器：
// - getFormatInstructions() 会产出一段“请按此 JSON 格式输出”的提示文本
// - invoke(response) 会从模型输出中提取并校验出符合 schema 的对象
const outputParser = StructuredOutputParser.fromZodSchema(schema);

// 定义提示词模板：{text} 与 {format_instructions} 是待填充的占位符
const promptTemplate = PromptTemplate.fromTemplate(
  "将以下文本翻译成英文，然后总结为3个关键词。\n\n文本：{text}\n\n{format_instructions}",
);

// 模板变量的实际取值。format_instructions 来自解析器，告诉模型该用什么格式作答
const input = {
  text: "LangChain 是一个强大的 AI 应用开发框架",
  format_instructions: outputParser.getFormatInstructions(),
};

// 步骤 1: 格式化 prompt —— 用 input 填充模板占位符，得到最终的提示词字符串
const formattedPrompt = await promptTemplate.format(input);
// console.log(formattedPrompt);

// 步骤 2: 调用模型 —— 把提示词发给模型，返回一条消息（AIMessage）
const response = await model.invoke(formattedPrompt);
console.log('response:', response);
// 步骤 3: 解析输出 —— 从模型返回的文本里抽取并校验成符合 schema 的对象
const result = await outputParser.invoke(response);
console.log("✅ 最终结果:");
console.log(result);

import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import chalk from "chalk";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { JsonOutputToolsParser } from "@langchain/core/output_parsers/openai_tools";

console.log(process.cwd());

// const model = new ChatOpenAI({
//   modelName: "deepseek-v4-pro",
//   temperature: 0,
//   apiKey: "sk-438f84d3fe4445b68088952806c6b107",
//   configuration: {
//     baseURL: "https://api.deepseek.com",
//   },
// });

// const res = await model.invoke("你是谁");
// console.log(res);

// const scientistSchema = z
//   .object({
//     name: z.string().describe("科学家的全名"),
//     birth_year: z.number().describe("出生年份"),
//     field: z.string().describe("主要研究领域"),
//     achievements: z.array(z.string()).describe("主要成就列表"),
//   })
//   .strict();
// const structuredModel = model.withStructuredOutput(scientistSchema);

// async function testNativeJsonSchema() {
//   console.log(chalk.bgMagenta("🧪 测试原生 JSON Schema 模式...\n"));

//   const stream = await structuredModel.stream([
//     new SystemMessage("你是一个信息提取助手，请直接返回 JSON 数据。"),
//     new HumanMessage("介绍一下杨振宁"),
//   ]);

//   let finalResult = "";
//   for await (const chunk of stream) {
//     console.log("112233 收到 chunk");
//     console.log("chunk 内容：", chunk);
//     // // 结构化输出流会直接在最后返回完整对象
//     // finalResult = chunk;
//   }

//   //   console.log(chalk.green("\n✅ 收到响应 (纯净 JSON):"));
//   //   console.log(res.content);

//   //   const data = JSON.parse(res.content);
//   //   console.log(chalk.cyan("\n📋 解析后的对象:"));
//   //   console.log(data);
// }

// // testNativeJsonSchema().catch(console.error);

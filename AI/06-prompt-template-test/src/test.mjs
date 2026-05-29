// 唯一正确导入
import * as hub from "langchainhub";
import { StructuredPrompt } from "@langchain/core/prompts";

const schema = {
  title: "ResponseSchema",
  type: "object",
  properties: {
    positive_sentiment: {
      type: "boolean",
      description: "Was the user sentiment positive?",
    },
  },
  required: ["positive_sentiment"],
};

const prompt = StructuredPrompt.fromMessagesAndSchema(
  [
    ["system", "Evaluate the sentiment of the following conversation."],
    ["human", "{conversation}"],
  ],
  schema
);

// ✅ 正确方法名：upload ！！！不是 push！
const url = await hub.upload("sentiment-evaluator", prompt);
console.log("✅ 上传成功！地址：", url);

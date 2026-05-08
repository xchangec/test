import dotenv from "dotenv";
import { ChatOpenAI } from "@langchain/openai";

dotenv.config();

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.API_KEY,
  //   baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  configuration: {
    baseURL: process.env.BASE_URL,
  },
});
const response = await model.invoke("你是谁");
console.log(response);

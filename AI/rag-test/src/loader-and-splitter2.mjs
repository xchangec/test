import "cheerio";
import "dotenv/config";
import "dotenv/config";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";

const model = new ChatOpenAI({
  temperature: 0,
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.EMBEDDINGS_MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const cheerioLoader = new CheerioWebBaseLoader("https://juejin.cn/post/7584110439933100078", {
  selector: ".main-area p",
});

const documents = await cheerioLoader.load();
// console.log("documents:", documents);

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 400, // 每个分块的字符数
  chunkOverlap: 50, // 分块之间的重叠字符数
  separators: ["。", "！", "？"], // 分割符，优先使用段落分隔
});

const splitDocuments = await textSplitter.splitDocuments(documents);
// console.log("splitDocuments:", splitDocuments);

const vectorStore = await MemoryVectorStore.fromDocuments(splitDocuments, embeddings);
// console.log("vectorStore:", vectorStore);

const retriever = vectorStore.asRetriever({ k: 3 });
// console.log("retriever:", retriever);

const questions = ["为什么要封禁第三方编程软件"];

for (const question of questions) {
  console.log("=".repeat(80));
  console.log(`问题: ${question}`);
  console.log("=".repeat(80));

  // 使用 retriever 获取文档
  const retrievedDocs = await retriever.invoke(question);
  // console.log("retrievedDocs:", retrievedDocs);

  // 使用 similaritySearchWithScore 获取相似度评分
  const scoredResults = await vectorStore.similaritySearchWithScore(question, 3);
  // console.log("scoredResults:", scoredResults);

  console.log("\n【检索到的文档及相似度评分】");

  retrievedDocs.forEach((doc, i) => {
    const scoredResult = scoredResults.find(([scoredDoc]) => scoredDoc.pageContent === doc.pageContent);
    console.log("scoredResult:", scoredResult);
    const score = scoredResult ? scoredResult[1] : null;
    const similarity = score !== null ? (1 - score).toFixed(4) : "N/A";
    console.log(`\n[文档 ${i + 1}] 相似度：${similarity}`);
    console.log(`内容：${doc.pageContent}`);
    console.log(
      `元数据：章节=${doc.metadata.chapter}, 角色=${doc.metadata.character}, 类型=${doc.metadata.type}, 心情=${doc.metadata.mood}`,
    );
    console.log("doc.metadata:", doc.metadata);
  });
  const context = retrievedDocs.map((doc, i) => `[片段${i}\n${doc.pageContent}]`).join("\n\n------\n\n");
  const prompt = `你是一个文章辅助阅读助手，根据文章内容来解答：

    文章内容：
    ${context}

    问题: ${question}

    你的回答:`;

  // 直接使用 model.invoke
  console.log("\n【AI 回答】");
  const response = await model.invoke(prompt);
  console.log(response.content);
  console.log("\n");
}

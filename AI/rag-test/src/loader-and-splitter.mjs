import "dotenv/config";
import "cheerio";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

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
console.log("splitDocuments:", splitDocuments);

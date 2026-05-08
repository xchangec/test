import "dotenv/config";
import { parse } from "path";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MilvusClient, DataType, MetricType, IndexType } from "@zilliz/milvus2-sdk-node";

const VECTOR_DIM = 1024;
const COLLECTION_NAME = "ebook_collection";

const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.EMBEDDINGS_MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
  dimensions: VECTOR_DIM,
});

const client = new MilvusClient({
  address: "localhost:19530",
});

async function getEmbedding(text) {
  const result = await embeddings.embedQuery(text);
  return result;
}

async function main() {
  try {
    console.log("Connecting to Milvus...");
    await client.connectPromise;
    console.log("✓ Connected\n");

    // 确保集合已加载
    try {
      await client.loadCollection({ collection_name: COLLECTION_NAME });
      console.log("✓ 集合已加载\n");
    } catch (error) {
      // 如果已经加载，会报错，忽略即可
      if (!error.message.includes("already loaded")) {
        throw error;
      }
      console.log("✓ 集合已处于加载状态\n");
    }

    const question = `段誉会哪些武功`;
    const questionVector = await getEmbedding(question);

    const searchResult = await client.search({
      collection_name: COLLECTION_NAME,
      vector: questionVector,
      limit: 3,
      metric_type: MetricType.COSINE,
      output_fields: ["id", "book_id", "chapter_num", "index", "content"],
    });

    console.log(`Found ${searchResult.results.length} results:\n`);

    searchResult.results.forEach((item, index) => {
      console.log(`${index + 1}. [Score: ${item.score.toFixed(4)}]`);
      console.log(`   ID: ${item.id}`);
      console.log(`   Book ID: ${item.book_id}`);
      console.log(`   Chapter: 第 ${item.chapter_num} 章`);
      console.log(`   Index: ${item.index}`);
      console.log(`   Content: ${item.content}\n`);
    });
  } catch (error) {
    console.error("Error:", error.message);
  }
}
main();

import "dotenv/config";
import { parse } from "path";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { EPubLoader } from "@langchain/community/document_loaders/fs/epub";
import { MilvusClient, DataType, MetricType, IndexType } from "@zilliz/milvus2-sdk-node";

const CHUNK_SIZE = 500;
const VECTOR_DIM = 1024;
const COLLECTION_NAME = "ebook_collection";
const EPUB_FILE = "./天龙八部.epub";

// 从文件名提取书名（去掉扩展名）
const BOOK_NAME = parse(EPUB_FILE).name;

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

// 1.建立ebook表
// 2.加载电子书并分块
// 3.向量化并存入

/**
 * 获取文本的向量嵌入
 */
async function getEmbedding(text) {
  const result = await embeddings.embedQuery(text);
  return result;
}
// 创建ebook表
async function ensureCollection() {
  try {
    const hasCollection = await client.hasCollection({
      collection_name: COLLECTION_NAME,
    });
    if (!hasCollection.value) {
      // 创建集合表
      console.log("创建集合表");
      await client.createCollection({
        collection_name: COLLECTION_NAME,
        fields: [
          { name: "id", data_type: DataType.VarChar, max_length: 100, is_primary_key: true },
          { name: "book_id", data_type: DataType.VarChar, max_length: 100 },
          { name: "book_name", data_type: DataType.VarChar, max_length: 200 },
          { name: "chapter_num", data_type: DataType.Int32 },
          { name: "index", data_type: DataType.Int32 },
          { name: "content", data_type: DataType.VarChar, max_length: 10000 },
          { name: "vector", data_type: DataType.FloatVector, dim: VECTOR_DIM },
        ],
      });
      console.log("集合创建完成");

      console.log("创建索引...");
      await client.createIndex({
        collection_name: COLLECTION_NAME,
        field_name: "vector",
        index_type: IndexType.IVF_FLAT,
        metric_type: MetricType.COSINE,
        params: { nlist: 1024 },
      });
      console.log("创建索引成功");
    } else {
      console.log("集合已存在");
    }
    // 确保集合已加载
    try {
      await client.loadCollection({ collection_name: COLLECTION_NAME });
      console.log("✓ 集合已加载");
    } catch (error) {
      console.log("✓ 集合已处于加载状态");
    }
  } catch (error) {
    console.error("创建集合时出错:", error.message);
    throw error;
  }
}

/**
 * 加载 EPUB 文件并进行流式处理（边处理边插入）
 */

async function loadAndProcessEPubStreaming(bookId) {
  try {
    console.log("加载epub文件");
    const loader = new EPubLoader(EPUB_FILE, {
      splitChapters: true,
    });
    console.log(loader);

    const documents = await loader.load();
    console.log(`✓ 加载完成，共 ${documents.length} 个章节\n`);
    // console.log(documents[150]);
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: 50,
    });

    let totalInserted = 0;
    for (let chapterIndex = 0; chapterIndex < documents.length; chapterIndex++) {
      const chapter = documents[chapterIndex];
      const chapterContent = chapter.pageContent;
      console.log(`处理第 ${chapterIndex + 1}/${documents.length} 章...`);
      // 使用 splitter 进行二次拆分
      const chunks = await textSplitter.splitText(chapterContent);
      console.log(`  拆分为 ${chunks.length} 个片段`);
      if (chunks.length === 0) {
        console.log(`  跳过空章节\n`);
        continue;
      }
      console.log(`  生成向量并插入中...`);

      const insertedCount = await insertChunksBatch(chunks, bookId, chapterIndex + 1);
      totalInserted += insertedCount;
    }
  } catch (error) {
    console.error("加载 EPUB 文件时出错:", error.message);
    throw error;
  }
}

/**
 * 将文档块批量插入到 Milvus（流式处理）
 */
async function insertChunksBatch(chunks, bookId, chapterNum) {
  try {
    if (chunks.length === 0) {
      return 0;
    }
    const insertData = await Promise.all(
      chunks.map(async (chunk, chunkIndex) => {
        const vector = await getEmbedding(chunk);
        return {
          id: `${bookId}_${chapterNum}_${chunkIndex}`,
          book_id: bookId,
          book_name: BOOK_NAME,
          chapter_num: chapterNum,
          index: chunkIndex,
          content: chunk,
          vector,
        };
      }),
    );

    // 批量插入到 Milvus
    const insertResult = await client.insert({
      collection_name: COLLECTION_NAME,
      data: insertData,
    });
    return Number(insertResult.insert_cnt) || 0;
  } catch (error) {
    console.error(`插入章节 ${chapterNum} 的数据时出错:`, error.message);
    console.error("错误详情:", error);
    throw error;
  }
}

async function main() {
  try {
    console.log("=".repeat(80));
    console.log("电子书处理程序");
    console.log("=".repeat(80));

    const bookId = 1;
    await ensureCollection();

    await loadAndProcessEPubStreaming(bookId);
    console.log("=".repeat(80));
    console.log("处理完成！");
    console.log("=".repeat(80));
  } catch (error) {
    console.error("\n错误:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

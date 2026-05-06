import "dotenv/config";
import { MilvusClient, MetricType } from "@zilliz/milvus2-sdk-node";

const COLLECTION_NAME = "ai_diary";

const client = new MilvusClient({
  address: "localhost:19530",
});

/**
 * 获取文本的向量嵌入
 */
async function getEmbedding(text) {
  const result = await embeddings.embedQuery(text);
  return result;
}

async function main() {
  try {
    console.log("连接到 Milvus...");
    await client.connectPromise;
    console.log("✓ 已连接\n"); // 删除单条数据

    console.log("Deleting diary entry...");
    const deleteId = "diary_005";

    const result = await client.delete({
      collection_name: COLLECTION_NAME,
      filter: `id == "${deleteId}"`,
    });

    console.log(`✓ Deleted ${result.delete_cnt} record(s)`);
    console.log(`  ID: ${deleteId}\n`); // 批量删除

    console.log("Batch deleting diary entries...");
    const deleteIds = ["diary_002", "diary_003"];
    const idsStr = deleteIds.map((id) => `"${id}"`).join(", ");

    const batchResult = await client.delete({
      collection_name: COLLECTION_NAME,
      filter: `id in [${idsStr}]`,
    });

    console.log(`✓ Batch deleted ${batchResult.delete_cnt} record(s)`);
    console.log(`  IDs: ${deleteIds.join(", ")}\n`); // 条件删除

    console.log("Deleting by condition...");
    const conditionResult = await client.delete({
      collection_name: COLLECTION_NAME,
      filter: `mood == "sad"`,
    });

    console.log(`✓ Deleted ${conditionResult.delete_cnt} record(s) with mood="sad"\n`);
  } catch (error) {
    console.error("错误:", error.message);
  }
}

main();

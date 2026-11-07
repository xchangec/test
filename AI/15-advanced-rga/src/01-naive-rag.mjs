/**
 * 01 - 朴素 RAG（Naive RAG）示例
 *
 * 最基础的检索增强生成流程：
 *   用户问题 → 向量检索（Milvus）→ 拼接上下文 → LLM 流式生成回答
 *
 * 特点：一次性检索 Top-K 相似片段，直接交给模型回答，
 * 不做查询改写、重排序、结果评估等高级处理（后续示例会逐步引入）。
 */
import "dotenv/config"; // 从 .env 文件加载环境变量（模型名称、API Key、向量维度等）
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { Milvus } from "@langchain/community/vectorstores/milvus";

// Milvus 中已存在的集合名（需提前完成入库，见前序章节脚本）
const COLLECTION_NAME = "ebook_collection";
// 默认检索的相似片段数量（Top-K）
const TOP_K = 5;

/**
 * 定义 LangGraph 的状态结构（StateGraph）
 * 整条图谱共享这份状态，各节点读取/写入对应字段：
 * - question:   用户问题
 * - k:          检索的 Top-K 数量
 * - documents:  检索到的文档片段列表
 * - generation: 模型生成的回答
 */
const GraphState = Annotation.Root({
    question: Annotation,
    k: Annotation,
    documents: Annotation,
    generation: Annotation,
});

// 实例化 LLM：temperature=0 保证回答稳定；模型名/地址/Key 均来自环境变量
const model = new ChatOpenAI({
    temperature: 0,
    model: process.env.MODEL_NAME,
    configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
    },
    apiKey: process.env.OPENAI_API_KEY,
});

// 实例化 Embedding 模型：用于把问题转成向量，需与入库时使用的模型一致
const embeddings = new OpenAIEmbeddings({
    model: process.env.EMBEDDINGS_MODEL_NAME,
    dimensions: 1024,
});

// Milvus 向量库实例，在 main() 中初始化（延迟赋值）
let vectorStore;

/**
 * 检索与问题最相似的 Top-K 小说片段
 * @param {string} question 用户问题
 * @param {number} k       检索数量，默认 TOP_K
 * @returns {Promise<Array>} 片段数组：[{ score, content, book_id, chapter_num, index }]
 */
async function retrieveRelevantContent(question, k = TOP_K) {
    try {
        // similaritySearchWithScore 返回 [Document, score] 数组（COSINE 度量下分数越大越相似）
        const docsWithScores = await vectorStore.similaritySearchWithScore(question, k);
        // 展平为业务友好的结构，metadata 字段缺失时给默认值
        return docsWithScores.map(([doc, score]) => ({
            score,
            content: doc.pageContent,
            id: doc.metadata?.id ?? "unknown",
            book_id: doc.metadata?.book_id ?? "未知",
            chapter_num: doc.metadata?.chapter_num ?? "未知",
            index: doc.metadata?.index ?? "未知",
        }));
    } catch (error) {
        // 检索失败时返回空数组，由后续节点/主流程兜底提示
        console.error("检索内容时出错:", error.message);
        return [];
    }
}

/**
 * 图谱节点：retrieve（检索）
 * 职责：根据当前问题执行向量检索，把结果写入 state.documents
 */
const retrieveNode = async (state) => {
    const documents = await retrieveRelevantContent(state.question, state.k);
    return {
        question: state.question,
        k: state.k,
        documents,
    };
};

/**
 * 图谱节点：generate（生成）
 * 职责：把检索到的片段拼接成上下文，构造 Prompt，流式调用 LLM 生成回答
 */
const generateNode = async (state) => {
    // 将多个片段拼接为带编号、章节信息的上下文文本，片段间用分隔线隔开
    const context = state.documents
        .map(
            (item, i) =>
                `[片段 ${i + 1}]
章节: 第 ${item.chapter_num} 章
内容: ${item.content}`,
        )
        .join("\n\n━━━━━\n\n");

    // 朴素 RAG 的核心：把检索结果直接塞进 Prompt，要求模型"仅依据片段"作答
    const prompt = `你是一个专业的《天龙八部》小说助手。基于小说内容回答问题，用准确、详细的语言。

请根据以下《天龙八部》小说片段内容回答问题：
${context}

用户问题: ${state.question}

回答要求：
1. 如果片段中有相关信息，请结合小说内容给出详细、准确的回答
2. 可以综合多个片段的内容，提供完整的答案
3. 如果片段中没有相关信息，请如实告知用户
4. 回答要准确，符合小说的情节和人物设定
5. 可以引用原文内容来支持你的回答

AI 助手的回答:`;

    // 以流式方式输出回答，边生成边打印到终端，同时累积完整文本写入 state.generation
    process.stdout.write("\n【AI 回答（流式）】\n");
    let generation = "";
    const stream = await model.stream(prompt);
    for await (const chunk of stream) {
        const text = typeof chunk.content === "string" ? chunk.content : "";
        if (!text) continue; // 跳过空 chunk（如非文本内容）
        generation += text;
        process.stdout.write(text);
    }
    process.stdout.write("\n");

    // 返回更新后的状态（documents/question/k 原样透传）
    return {
        question: state.question,
        k: state.k,
        documents: state.documents,
        generation,
    };
};

/**
 * 组装并编译 LangGraph 图谱：
 *   START → retrieve → generate → END
 * 这是 Naive RAG 的标准两节点线性流程
 */
const graph = new StateGraph(GraphState)
    .addNode("retrieve", retrieveNode)
    .addNode("generate", generateNode)
    .addEdge(START, "retrieve")
    .addEdge("retrieve", "generate")
    .addEdge("generate", END)
    .compile();

/**
 * 主流程：
 * 1. 打印图谱结构（Mermaid）
 * 2. 连接 Milvus 并加载集合
 * 3. 执行图谱：检索 + 生成
 * 4. 展示检索结果摘要
 */
async function main() {
    const question = "阿朱的结局是什么？"; // 测试问题
    const kArg = 5; // 本次检索的 Top-K 数量

    // 导出为 Mermaid：可复制到 https://mermaid.live 或 Markdown 的 ```mermaid 代码块
    const drawable = await graph.getGraphAsync();
    const mermaid = drawable.drawMermaid({ withStyles: true });
    console.log(mermaid);

    // 连接已存在的 Milvus 集合（fromExistingCollection：不会新建/覆盖数据）
    console.log("连接到 Milvus...");
    vectorStore = await Milvus.fromExistingCollection(embeddings, {
        collectionName: COLLECTION_NAME,
        url: "localhost:19530",
        textField: "content", // 存原文的字段
        primaryField: "id", // 主键字段
        vectorField: "vector", // 向量字段
        // 索引与检索参数：COSINE 度量 + HNSW 索引
        indexCreateOptions: {
            metric_type: "COSINE",
            index_type: "HNSW",
            params: { M: 16, efConstruction: 200 },
            search_params: { ef: 64 },
        },
    });
    // 显式设置检索参数（ef 越大召回越准，但更慢）
    vectorStore.indexSearchParams = { metric_type: "COSINE", params: JSON.stringify({ ef: 64 }) };
    console.log("✓ 已连接\n");

    // 把集合加载进内存（Milvus 检索前必须处于 loaded 状态）；已加载则忽略报错
    try {
        await vectorStore.client.loadCollection({ collection_name: COLLECTION_NAME });
        console.log(`✓ 集合 ${COLLECTION_NAME} 已加载\n`);
    } catch (error) {
        if (!error.message.includes("already loaded")) {
            throw error;
        }
        console.log(`✓ 集合 ${COLLECTION_NAME} 已处于加载状态\n`);
    }

    console.log("=".repeat(80));
    console.log(`问题: ${question}`);
    console.log("=".repeat(80));

    // 执行图谱：state 初值传入 question/k，documents 与 generation 由节点填充
    const result = await graph.invoke({
        question,
        k: Number.isFinite(kArg) ? kArg : TOP_K, // 非法数值时回退到默认 TOP_K
        documents: [],
        generation: "",
    });

    // 展示检索到的片段摘要（相似度 + 元数据 + 前 200 字预览）
    console.log("\n【检索相关内容】");
    if (result.documents.length === 0) {
        console.log("未找到相关内容");
        console.log("\n【AI 回答】");
        console.log("抱歉，我没有找到相关的《天龙八部》内容。");
        return;
    } else {
        result.documents.forEach((item, i) => {
            console.log(`\n[片段 ${i + 1}] 相似度: ${item.score.toFixed(4)}`);
            console.log(`书籍: ${item.book_id}`);
            console.log(`章节: 第 ${item.chapter_num} 章`);
            console.log(`片段索引: ${item.index}`);
            console.log(
                `内容: ${item.content.substring(0, 200)}${item.content.length > 200 ? "..." : ""}`,
            );
        });
    }

    // 流式输出已在 generateNode 中打印，这里仅兜底提示空回答的情况
    if (!result.generation) {
        console.log("\n【AI 回答】");
        console.log("模型未返回内容。");
    }
}

main()

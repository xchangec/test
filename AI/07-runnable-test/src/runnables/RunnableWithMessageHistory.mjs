import 'dotenv/config';
// 【作用】加载 .env 环境变量，读取 API_KEY、BASE_URL、模型名等配置

// 1. 会话历史包装器：给普通链添加上下文记忆能力
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
// 2. 内存会话存储：在运行时内存中存放聊天记录（重启丢失，仅测试用）
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
// 3. 大模型客户端：对接 OpenAI 兼容接口的对话模型
import { ChatOpenAI } from "@langchain/openai";
// 4. 聊天提示词模板 + 消息占位符：构造对话格式、预留历史消息位置
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
// 5. 字符串解析器：将模型返回的结构化消息转为纯文本字符串
import { StringOutputParser } from "@langchain/core/output_parsers";

// ===================== 1. 初始化对话大模型 =====================
const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,       // 模型名称，从环境变量读取
  apiKey: process.env.OPENAI_API_KEY,      // 模型接口密钥
  temperature: 0.3,                        // 温度值：控制随机性，0=严谨，越大越发散
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,  // 自定义接口地址（代理/中转地址）
  },
});
// 【ChatOpenAI 作用】封装模型调用逻辑，负责发起请求、接收模型返回消息

// ===================== 2. 构造对话提示词模板 =====================
const prompt = ChatPromptTemplate.fromMessages([
  // 系统人设：定义助手身份、回答规则
  [
    "system",
    "你是一个简洁、有帮助的中文助手，会用 1-2 句话回答用户问题，重点给出明确、有用的信息。",
  ],
  // 【MessagesPlaceholder 作用】占位符，专门用来填充「历史聊天消息」
  // history 对应下方 historyMessagesKey，会自动把历史对话插入此处
  new MessagesPlaceholder("history"),
  // 用户当前提问占位：{question} 对应入参字段
  ["human", "{question}"],
]);
// 【ChatPromptTemplate 作用】统一管理对话上下文、系统提示、变量占位，格式化发给模型的内容

// ===================== 3. 组装基础执行链 =====================
// 串行链路：提示词模板 → 大模型 → 文本解析器
const simpleChain = prompt.pipe(model).pipe(new StringOutputParser());
// 【pipe】链式串联 Runnable，上一个输出作为下一个输入
// 【StringOutputParser】作用：把模型返回的 AIMessage 对象，提取 content 转为纯字符串

// ===================== 4. 全局会话历史容器 =====================
// Map 存储：key = sessionId(会话ID)，value = 对应会话的聊天记录实例
const messageHistories = new Map();

// 根据会话ID 获取/创建 独立的聊天历史实例
const getMessageHistory = (sessionId) => {
  // 不存在该会话，则新建一条内存聊天记录
  if (!messageHistories.has(sessionId)) {
    messageHistories.set(sessionId, new InMemoryChatMessageHistory());
  }
  // 【InMemoryChatMessageHistory 作用】单条会话的消息仓库：增删查改聊天消息
  return messageHistories.get(sessionId);
};

// ===================== 5. 包装为「带记忆的对话链」核心 =====================
// 【RunnableWithMessageHistory】核心作用：
// 1. 调用前：自动读取对应 sessionId 的历史消息，填充到 MessagesPlaceholder
// 2. 调用后：自动把「用户新提问 + 模型新回答」存入历史记录
// 3. 多会话隔离：不同 sessionId 拥有独立上下文，互不干扰
const chain = new RunnableWithMessageHistory({
  runnable: simpleChain,                // 被包装的原始执行链
  getMessageHistory: (sessionId) => getMessageHistory(sessionId), 
                                        // 回调：根据会话ID获取对应的消息历史实例
  inputMessagesKey: "question",         // 入参中「用户当前问题」的字段名
  historyMessagesKey: "history",        // 提示词里 MessagesPlaceholder 对应的名称
});

// ===================== 6. 会话调用测试 =====================
// 所有 invoke 第二个参数 { configurable: { sessionId } }
// 【sessionId 作用】会话唯一标识，用来区分不同用户/不同对话窗口，实现记忆隔离

console.log('--- 第一次对话（提供信息） ---');
const result1 = await chain.invoke(
  { question: "我的名字是神光，我来自山东，我喜欢编程、写作、金铲铲。" },
  { configurable: { sessionId: "user-123" } } // 指定当前所属会话
);
console.log('问题: 我的名字是神光，我来自山东，我喜欢编程、写作、金铲铲。');
console.log('回答:', result1);
console.log();

console.log('--- 第二次对话（询问之前的信息） ---');
const result2 = await chain.invoke(
  { question: "我刚才说我来自哪里？" },
  { configurable: { sessionId: "user-123" } } // 同一会话，复用历史记忆
);
console.log('问题: 我刚才说我来自哪里？');
console.log('回答:', result2);
console.log();

console.log('--- 第三次对话（继续询问） ---');
const result3 = await chain.invoke(
  { question: "我的爱好是什么？" },
  { configurable: { sessionId: "user-123" } } // 持续沿用同一会话上下文
);
console.log('问题: 我的爱好是什么？');
console.log('回答:', result3);
console.log();
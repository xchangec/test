import { createInterface } from "node:readline/promises";
import {
  Annotation,   // 定义状态字段类型；Annotation.Root() 组成完整状态。
  Command,       // 用于「恢复」被 interrupt 暂停的图：new Command({ resume }) 携带要传递的值继续执行。
  END,
  MemorySaver,   // 内存版检查点：保存每个 thread 的状态；interrupt 必须配合 checkpointer 才能用。
  START,
  StateGraph,    // 状态图核心类，创建/配置可执行的图。
  interrupt,     // 在节点内调用可暂停图，等待外部提供值；不配合 checkpointer 会报错。
} from "@langchain/langgraph";

// 状态结构：actionSummary 记录动作概要，userInput 记录用户在恢复时输入的内容。
const StateAnnotation = Annotation.Root({
  actionSummary: Annotation({
    reducer: (_prev, next) => next, // 「后写覆盖」式合并
    default: () => "",             // 默认空字符串
  }),
  userInput: Annotation({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
});

/** 节点1：展示一笔待确认的转账 */
const showTransfer = () => ({
  actionSummary: "向张三转账 ¥100（模拟，不会真扣款）",
});

/**
 * 节点2：waitConfirm
 * 调用 interrupt(...) 会让图在此「暂停」，并把传给它的对象挂到返回值 __interrupt__ 里。
 * 随后程序可在外部（这里用终端）征求用户输入，再用 new Command({ resume: 值 }) 恢复，
 * 恢复时 interrupt(...) 这一行的结果 text 就是 resume 传来的值，并写入 userInput。
 */
const waitConfirm = (state) => {
  const text = interrupt({
    hint: "终端里输入「确认」或备注后回车，图才会继续",
    actionSummary: state.actionSummary,
  });
  return { userInput: String(text) };
};

// 构图：入口 -> 展示转账 -> 暂停等待确认 -> 结束
const graph = new StateGraph(StateAnnotation)
  .addNode("showTransfer", showTransfer)   // 注册节点1
  .addNode("waitConfirm", waitConfirm)     // 注册节点2
  .addEdge(START, "showTransfer")          // 入口进节点1
  .addEdge("showTransfer", "waitConfirm")  // 节点1 -> 节点2
  .addEdge("waitConfirm", END)             // 节点2 -> 结束
  .compile({ checkpointer: new MemorySaver() }); // 传入 checkpointer，interrupt 才可用

// 导出为 Mermaid：可复制到 https://mermaid.live 或 Markdown 的 ```mermaid 代码块
// getGraphAsync() —— 异步获取图描述；drawMermaid() —— 渲染为 Mermaid 文本便于可视化。
const drawable = await graph.getGraphAsync();
const mermaid = drawable.drawMermaid({ withStyles: true });
console.log(mermaid);

// thread_id 唯一标识这一轮对话/会话，后面恢复时也要用同一个 config
const config = { configurable: { thread_id: "interrupt-demo" } };

// 第一次调用：图会执行到 waitConfirm 处被 interrupt 暂停，返回值中的 __interrupt__ 携带暂停信息
const paused = await graph.invoke({}, config);
console.log("\n待你确认：", paused.__interrupt__?.[0]?.value);

// 在终端里等用户输入一行内容
const rl = createInterface({ input: process.stdin, output: process.stdout });
const line = (await rl.question("> ")).trim();
await rl.close();

// 用户什么都没输入则退出
if (!line) {
  console.error("未输入，退出。");
  process.exit(1);
}

// 第二次调用：用 Command 携带用户输入，用同一个 config 恢复暂停的图，继续执行到结束
const done = await graph.invoke(new Command({ resume: line }), config);
console.log("结果：", done);

import {
  Annotation,
  END,
  MemorySaver, // 内存版检查点(checkpointer)：将每个 thread 的状态保存在内存中
  START,
  StateGraph,
} from "@langchain/langgraph";
// @langchain/langgraph 相关 API：
//   Annotation    —— 定义状态字段的类型；Annotation.Root() 组成完整状态结构。
//   StateGraph    —— 状态图核心类，创建/配置可执行的图。
//   START / END   —— 图执行的入口 / 出口特殊节点。
//   MemorySaver   —— 检查点实现，负责按 thread_id 持久化各会话的状态（保存在进程内存里）。

const StateAnnotation = Annotation.Root({
  visitCount: Annotation({
    reducer: (_prev, next) => next, // 「后写覆盖」式合并：直接用新值
    default: () => 0, // 首次进入时默认为 0
  }),
  message: Annotation({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
});

/**
 * recordVisit 节点：每跑一轮图，给「当前会话」访问次数 +1
 * 由于配置了 checkpointer，状态会按 thread_id 独立保存，
 * 所以同一个 thread 多次 invoke 时 visitCount 会不断累加。
 */
function recordVisit(state) {
  const visitCount = state.visitCount + 1;
  const message =
    visitCount === 1
      ? "这是你在本会话里第 1 次进入。"
      : `这是你在本会话里第 ${visitCount} 次进入`;
  return { visitCount, message };
}

// 构图：节点 recordVisit，入口 -> 节点 -> 结束
const graph = new StateGraph(StateAnnotation)
  .addNode("recordVisit", recordVisit)
  .addEdge(START, "recordVisit")
  .addEdge("recordVisit", END);

// 创建内存版检查器，并编译进图中（compile 的第二个参数用于传入运行配置，如 checkpointer）
const checkpointer = new MemorySaver();
const app = graph.compile({ checkpointer });

// 通过 thread_id 区分不同的「会话」/用户
const user1 = { configurable: { thread_id: "用户-小张" } };
const user2 = { configurable: { thread_id: "用户-小李" } };

// 同一 thread_id（小张）连续调用 3 次：visitCount 会依次累加为 1、2、3
const res1 = await app.invoke({}, user1);
const res2 = await app.invoke({}, user1);
const res3 = await app.invoke({}, user1);
// 切换到不同 thread_id（小李）：独立会话，visitCount 从 1 重新开始
const res4 = await app.invoke({}, user2);


// MemorySaver 不仅仅存最终输出结果，它保存**每一步节点执行后的中间快照**，LangGraph 可以：

// - `app.getState(configurable)`：读取当前 thread 最新状态
// - `app.getStateHistory(configurable)`：拿到该会话全部历史快照，可以回退到任意历史步骤重新执行，这就是 LangGraph 断点重试、人类介入 (human‑in‑the‑loop) 能力的底层基础。

console.log(res1);
console.log(res2);
console.log(res3);
console.log(res4);

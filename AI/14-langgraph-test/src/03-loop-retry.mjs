import { Annotation, END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
// @langchain/langgraph 相关 API：
//   Annotation        —— 定义状态字段的类型；Annotation.Root() 组成完整状态。
//   StateGraph        —— 状态图核心类，创建/配置可执行的图。
//   START / END       —— 图执行的入口 / 出口特殊节点。
//   MemorySaver       —— 内存版状态持久化(checkpointer)，用于「记忆」/断点续跑（本示例未实际使用）。

// 状态结构：tries 记录重试次数，ok 标记是否成功，message 保存提示文本。
// 三个字段都使用「后写覆盖」式 reducer（直接取新值）。
const StateAnnotation = Annotation.Root({
  tries: Annotation({
    reducer: (_prev, next) => next,
    default: () => 0, // 初始重试次数为 0
  }),
  ok: Annotation({
    reducer: (_prev, next) => next,
    default: () => false, // 默认未成功
  }),
  message: Annotation({
    reducer: (_prev, next) => next,
    default: () => "", // 默认空消息
  }),
});

// attempt 节点：每执行一次就累加重试次数，达到 >=3 次则标记成功。
const attempt = (state) => {
  const tries = state.tries + 1;
  const ok = tries >= 3;
  return {
    tries,
    ok,
    message: ok ? `第 ${tries} 次成功` : `第 ${tries} 次失败，继续重试`,
  };
};
MemorySaver // (该行仅是一个悬空引用，未实际使用)

const graph = new StateGraph(StateAnnotation)
  .addNode("attempt", attempt) // 注册节点 attempt
  .addEdge(START, "attempt") // 入口进入 attempt
  // addConditionalEdges —— 条件边：根据返回值动态决定下一步走向。
  // 这里 (state) => (state.ok ? "done" : "retry") 判断成功与否，
  // 映射结果：retry -> 回到 attempt（形成循环重试），done -> 结束(END)。
  .addConditionalEdges("attempt", (state) => (state.ok ? "done" : "retry"), {
    retry: "attempt",
    done: END,
  })
  .compile(); // 编译为可调用图

// 导出为 Mermaid：可复制到 https://mermaid.live 或 Markdown 的 ```mermaid 代码块
// getGraphAsync() —— 异步获取图描述；drawMermaid() —— 渲染为 Mermaid 文本便于可视化。
const drawable = await graph.getGraphAsync();
const mermaid = drawable.drawMermaid({ withStyles: true });
console.log(mermaid);

// invoke({ tries: 0 })：以初始重试次数 0 启动，attempt 会循环执行直到成功为止。
const result = await graph.invoke({ tries: 0 });
console.log("result:", result);

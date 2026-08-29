import "dotenv/config";
// @langchain/langgraph 相关 API 说明：
//   Annotation     —— 用于定义状态(State)的字段类型；Annotation.Root() 创建一组字段，构成整个状态结构。
//   StateGraph     —— 状态图核心类，用来创建/配置一张可执行的图。
//   START / END    —— 内置的特殊节点：START 是图执行的入口，END 是出口。
import { Annotation, START, END, StateGraph } from "@langchain/langgraph";

/*
 * StateAnnotation 定义了图中各节点之间共享的「状态」结构。
 * LangGraph 通过状态在节点之间传递数据，每个节点返回的部分更新会合并进状态。
 * Annotation.Root() 接受一个「键 -> Annotation」对象，返回一个完整的状态类型。
 */
const StateAnnotation = Annotation.Root({
    // text 字段：值类型为字符串
    text: Annotation({
        // reducer（规约器）：如何合并上一次状态(_prev)与节点返回的新值(next)。
        // 这里直接取新值，即“后写覆盖先写”，不累积历史。
        reducer: (_prev, next) => next,
        // default：当状态中没有 text 时返回的初始值，保证 state.text 永远是字符串
        default: () => ''
    })
})

// 注意：数组类型如列表通常用 [...prev, ...next] 累积，字符串则用覆盖方式，这里 text 是覆盖式。
const step1 = (state) => ({ text: `${state.text} -> step1` });
const step2 = (state) => ({ text: `${state.text} -> step2` });

// 构建图：节点负责执行，边决定执行顺序。
// new StateGraph(类型) —— 用状态类型创建空图。
const graph = new StateGraph(StateAnnotation)
    // addNode(id, 函数) —— 注册一个节点；节点函数接收当前 state，返回要合并进状态的部分更新。
    // 注册两个节点 step1、step2
    .addNode('step1', step1)
    .addNode('step2', step2)
    // addEdge(from, to) —— 添加一条有向边，控制执行顺序。
    // 用边把节点串起来：START -> step1 -> step2 -> END
    .addEdge(START, 'step1')
    .addEdge('step1', 'step2')
    .addEdge('step2', END)
    .compile(); // 编译成可调用的图；编译后才可 invoke。

// 导出为 Mermaid：可复制到 https://mermaid.live 或 Markdown 的 ```mermaid 代码块
// getGraphAsync() —— 异步获取图的描述对象；drawMermaid() —— 将图渲染为 Mermaid 文本，便于可视化。
const drawable = await graph.getGraphAsync();
const mermaid = drawable.drawMermaid({ withStyles: true });
console.log(mermaid);

// 以 { text: 'hello' } 作为初始状态调用整张图，返回最终状态
// invoke(初始状态) —— 从 START 开始，按边依次执行节点，返回合并后的最终状态。
const result = await graph.invoke({ text: 'hello' });
console.log("result:", result);


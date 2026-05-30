import "dotenv/config";
import { RunnablePassthrough, RunnableLambda, RunnableSequence, RunnableMap } from "@langchain/core/runnables";

// const chain = RunnableSequence.from([
//   RunnableLambda.from((input) => ({ concept: input })),
//   RunnableMap.from({
//     original: new RunnablePassthrough(),
//     processed: RunnableLambda.from((obj) => ({
//       concept: input,
//       upper: obj.concept.toUpperCase(),
//       length: obj.concept.length,
//     })),
//   }),
// ]);

// 保留原始属性，只是扩展一些属性，用 RunnablePassthrough.assign
const chain = RunnableSequence.from([
  (input) => ({ concept: input }),
  RunnablePassthrough.assign({
    original: new RunnablePassthrough(),
    processed: (obj) => ({
      concept: input,
      upper: obj.concept.toUpperCase(),
      length: obj.concept.length,
    }),
  }),
]);

const input = "神说要有光";
const result = await chain.invoke(input);
console.log(result);

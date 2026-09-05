import { createInterface } from "node:readline/promises";

// 在终端里等用户输入一行内容
const rl = createInterface({ input: process.stdin, output: process.stdout });
console.log('开始输入：');
const line = (await rl.question("> ")).trim();
console.log('输入的内容是：', line);
// await rl.close();
console.log('输入结束');

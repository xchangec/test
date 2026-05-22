import "dotenv/config";
import chalk from "chalk";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { executeCommandTool, listDirectoryTool, readFileTool, writeFileTool } from "./all-tools.mjs";

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.API_KEY,
  temperature: 0.1,
  maxRetries: 3,
  configuration: {
    baseURL: process.env.BASE_URL,
  },
  // 重点：强制关闭 Thinking Mode
  extraBody: {
    thinking: { type: "disabled" },
    enable_thinking: false,
  },
  modelKwargs: {
    thinking: { type: "disabled" }
  }
});

const tools = [readFileTool, writeFileTool, executeCommandTool, listDirectoryTool];
const modelWithTools = model.bindTools(tools);

async function runAgentWithTools(query, maxIterations = 30) {
  const messages = [
    new SystemMessage(`你必须使用非思考模式（non-thinking mode）直接回复，绝不要开启思考模式，不要输出任何 reasoning_content 或 <think> 标签。

你是一个项目管理助手，使用工具完成任务。
当前工作目录: ${process.cwd()}

工具：
1. read_file: 读取文件
2. write_file: 写入文件
3. execute_command: 执行命令（支持 workingDirectory 参数）
4. list_directory: 列出目录

重要规则 - execute_command：
- 创建 Vite 项目必须使用 --no-interactive
- 绝不要在 command 中写 cd，请使用 workingDirectory 参数切换目录
- 项目创建成功后，立即在该目录下执行 pnpm install

重要规则 - write_file：
- 写入 .tsx 文件时，如果存在对应的 .css 文件，请在 import 语句后正确引入 css`),
    new HumanMessage(query),
  ];

  for (let i = 0; i < maxIterations; i++) {
    console.log(chalk.bgGreen(`⏳ 正在等待 AI 思考... (第 ${i+1} 轮)`));

    const response = await modelWithTools.invoke(messages);

    messages.push(response);

    if (!response.tool_calls || response.tool_calls.length === 0) {
      console.log(`\n✨ AI 最终回复:\n${response.content}\n`);
      return;
    }

    // 执行所有工具调用
    for (const toolCall of response.tool_calls) {
      const foundTool = tools.find((t) => t.name === toolCall.name);
      if (foundTool) {
        try {
          const toolResult = await foundTool.invoke(toolCall.args);
          messages.push(
            new ToolMessage({
              content: String(toolResult),
              tool_call_id: toolCall.id,
            })
          );
        } catch (err) {
          console.error(`工具执行失败: ${err.message}`);
          messages.push(
            new ToolMessage({
              content: `Tool execution failed: ${err.message}`,
              tool_call_id: toolCall.id,
            })
          );
        }
      }
    }
  }
}

// ==================== 执行任务 ====================
const case1 = `创建一个功能丰富的 React TodoList 应用：
1. 使用以下命令**非交互式**创建项目：
   pnpm create vite react-todo-app --template react-ts --no-interactive

2. 进入项目目录执行：
   pnpm install

3. 修改 src/App.tsx，实现完整 TodoList 功能：
   - 添加、删除、编辑 Todo
   - 标记完成/未完成
   - 筛选：全部 / 进行中 / 已完成
   - 统计：总数量、已完成数量
   - 使用 localStorage 持久化

4. 添加美观样式和动画（使用 CSS + transition）：
   - 渐变背景（蓝到紫）
   - 卡片式设计 + 阴影 + 圆角
   - 添加/删除时的过渡动画
   - 悬停效果

5. 如果存在 App.css，在 App.tsx 中正确引入它

6. 最后执行 list_directory 确认项目结构

注意：
- 必须使用 --no-interactive 标志
- 使用 workingDirectory 参数切换目录，绝不要在 command 里写 cd
- 功能和样式要完整美观`;

try {
  await runAgentWithTools(case1);
} catch (error) {
  console.error(`\n❌ 错误: ${error.message}\n`);
}
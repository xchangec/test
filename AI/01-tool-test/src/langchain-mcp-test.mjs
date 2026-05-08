import "dotenv/config";
import chalk from "chalk";
import { ChatOpenAI } from "@langchain/openai";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";

const model = new ChatOpenAI({
  modelName: "qwen-plus",
  apiKey: process.env.API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.BASE_URL,
  },
});

const mcpClient = new MultiServerMCPClient({
  mcpServers: {
    "my-mcp-server": {
      command: "node",
      args: ["E:/project/test/AI/tool-test/src/my-mcp-server.mjs"],
    },
    "amap-maps-streamableHTTP": {
      url: `https://mcp.amap.com/mcp?key=${process.env.AMAP_MAPS_API_KEY}`,
    },
  },
});

const tools = await mcpClient.getTools();
const modelWithTools = model.bindTools(tools);

let resourceContent = "";
const resourceRes = await mcpClient.listResources();
for (const [serverName, resources] of Object.entries(resourceRes)) {
  for (const resource of resources) {
    const content = await mcpClient.readResource(serverName, resource.uri);
    // console.log("content:", content);
    resourceContent += content[0].text;
  }
}

// console.log("resourceContent:", resourceContent);

async function runAgentWithTools(query, maxIterations = 30) {
  const message = [new SystemMessage(resourceContent), new HumanMessage(query)];
  for (let i = 0; i < maxIterations; i++) {
    console.log(chalk.bgGreen(`⏳ 正在等待 AI 思考...`));
    const response = await modelWithTools.invoke(message);
    message.push(response);
    if (!response.tool_calls || response.tool_calls.length === 0) {
      return response.content;
    }
    console.log(chalk.bgBlue(`🔍 检测到 ${response.tool_calls.length} 个工具调用`));
    console.log(chalk.bgBlue(`🔍 工具调用: ${response.tool_calls.map((t) => t.name).join(", ")}`));

    for (const toolCall of response.tool_calls) {
      const foundTool = tools.find((t) => t.name === toolCall.name);
      if (foundTool) {
        const toolResult = await foundTool.invoke(toolCall.args);
        message.push(
          new ToolMessage({
            content: toolResult,
            tool_call_id: toolCall.id,
          }),
        );
      }
    }
  }
  return message[message.length - 1].content;
}

// const res = await runAgentWithTools("MCP Server 的使用文档是什么");
// console.log("res:", res);

// const res = await mcpClient.listResources();
// console.log(res);

const res = await runAgentWithTools("帮我查下徐州市中心的住宿，以及路线");
console.log("res:", res);

await mcpClient.close();

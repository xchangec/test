import { z } from "zod";
import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { tool } from "@langchain/core/tools";

// 读取文件工具
const readFileTool = tool(
  // 工具核心逻辑：接收文件路径，读取文件内容并返回（含异常处理）
  async ({ filePath }) => {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      console.log(` [工具调用] read_file(${filePath}) - 成功读取 ${content.length} 字节`);
      return `文件内容:\n${content}`;
    } catch (error) {
      console.log(`❌ [工具调用] read_file("${filePath}") - 错误： ${error.message}`);
      return `读取文件失败：${error.message}`;
    }
  },
  {
    name: "read_file",
    description: `读取指定路径的文件内容`,
    schema: z.object({
      filePath: z.string().describe("文件路径"),
    }),
  },
);

// 写入文件工具
const writeFileTool = tool(
  async ({ filePath, content }) => {
    try {
      // 返回 path 的目录名
      const dir = path.dirname(filePath);
      console.log(dir);
      // 创建目录，recursive: false 重复目录抛出异常
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, content, "utf-8");
      console.log(`[工具调用] write_file(${filePath}) - 成功写入 ${content.length} 字节`);
      return `文件写入成功：${filePath}`;
    } catch (error) {
      console.log(`❌ [工具调用] write_file("${filePath}") - 错误： ${error.message}`);
      return `读取文件失败：${error.message}`;
    }
  },
  {
    name: "write_file",
    description: `向指定路径写入文件内容，自动创建目录`,
    schema: z.object({
      filePath: z.string().describe("文件路径"),
      content: z.string().describe("要写入的文件内容"),
    }),
  },
);

// 执行命令工具
const executeCommandTool = tool(
  async ({ command, workingDirectory }) => {
    const cwd = workingDirectory || process.cwd();
    console.log(`[工具调用] execute_command(${command}) - 工作目录：${cwd}`);

    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(" ");

      const child = spawn(cmd, args, {
        cwd,
        stdio: "inherit",
        shell: true,
      });

      let errorMsg = "";

      child.on("error", (error) => {
        console.log(`on error:`, error);
        errorMsg = error.message;
      });

      child.on("close", (code) => {
        console.log(`on close`);
        if (code === 0) {
          console.log(`  [工具调用] execute_command("${command}") - 执行成功`);
          const cwdInfo = workingDirectory
            ? `\n\n重要提示：命令在目录 "${workingDirectory}" 中执行成功。如果需要在这个项目目录中继续执行命令，请使用 workingDirectory: "${workingDirectory}" 参数，不要使用 cd 命令。`
            : "";
          resolve(`命令执行成功: ${command}${cwdInfo}`);
          // process.exit(0);
        } else {
          console.log(`  [工具调用] execute_command("${command}") - 执行失败，退出码: ${code}`);
          resolve(`命令执行失败，退出码: ${code}${errorMsg ? "\n错误: " + errorMsg : ""}`);
          // process.exit(code || 1);
        }
      });
    });
  },
  {
    name: "execute_command",
    description: "执行系统命令，支持指定工作目录，实时显示输出",
    schema: z.object({
      command: z.string().describe("要执行的命令"),
      workingDirectory: z.string().optional().describe("工作目录（推荐指定）"),
    }),
  },
);

const listDirectoryTool = tool(
  async ({ directoryPath }) => {
    try {
      const files = await fs.readdir(directoryPath);
      console.log(`  [工具调用] list_directory("${directoryPath}") - 找到 ${files.length} 个项目`);
      return `目录内容:\n${files.map((f) => `- ${f}`).join("\n")}`;
    } catch (error) {
      console.log(`  [工具调用] list_directory("${directoryPath}") - 错误: ${error.message}`);
      return `列出目录失败: ${error.message}`;
    }
  },
  {
    name: "list_directory",
    description: "列出指定目录下的所有文件和文件夹",
    schema: z.object({
      directoryPath: z.string().describe("目录路径"),
    }),
  },
);

export { readFileTool, writeFileTool, executeCommandTool, listDirectoryTool };

// const cwd = process.cwd();
// console.log(cwd);
// const test = async (directoryPath) => {
//   const files = await fs.readdir(directoryPath);
//   console.log(`目录内容：\n${files.map((f) => `- ${f}`).join("\n")}}`);
// };
// test(cwd);

// const test = async (filePath, content) => {
//   const dir = path.dirname(filePath);
//   console.log(dir);
//   await fs.mkdir(dir, { recursive: true });
//   await fs.writeFile(filePath, content, "utf-8");
// };
// test(`"./src/test/project"`, "123");

import { spawn } from "node:child_process";

// console.log(process.platform);

const command = "ls -la";

const cwd = process.cwd();
console.log(`Current directory: ${cwd}`);

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
    // process.exit(0);
  } else {
    if (errorMsg) {
      console.error(`错误: ${errorMsg}`);
    }
    // process.exit(code || 1);
  }
});

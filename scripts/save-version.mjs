import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
function git(args, capture = false) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", stdio: capture ? "pipe" : "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture) process.stderr.write(result.stderr || "");
    process.exit(result.status || 1);
  }
  return result.stdout?.trim() || "";
}

const label = process.argv.slice(2).join(" ").trim();
const timestamp = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Shanghai", hour12: false });
git(["add", "--all"]);
if (!git(["diff", "--cached", "--name-only"], true)) {
  console.log("没有需要保存的新修改，当前版本已经保存。");
  process.exit(0);
}
git(["commit", "-m", label || `项目快照 ${timestamp}`]);
console.log("版本已保存在本机。可以在 VS Code 源代码管理中查看历史记录。");

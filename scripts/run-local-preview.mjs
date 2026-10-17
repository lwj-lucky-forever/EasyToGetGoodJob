import "./sites-env.mjs";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { createServer, loadEnv } from "vite";

if (!existsSync("dist/server/wrangler.json")) {
  throw new Error("Run npm.cmd run build before starting the local preview.");
}
if (!existsSync(".env.local")) {
  throw new Error("Create .env.local with OWNER_USER_ID=local_seedy for local mock sign-in.");
}
const { OWNER_USER_ID } = loadEnv("development", process.cwd(), "OWNER_USER_ID");
if (OWNER_USER_ID !== "local_seedy") {
  throw new Error("Local mock sign-in requires OWNER_USER_ID=local_seedy in .env.local.");
}

// Refuse to proxy to a different process already using the backend port.
const { createServer: createNetServer } = await import("node:net");
const probe = createNetServer();
await new Promise((resolve, reject) => {
  probe.once("error", reject);
  probe.listen(8787, "127.0.0.1", resolve);
});
await new Promise((resolve) => probe.close(resolve));

const worker = spawn(process.execPath, [
  "--no-warnings", "--experimental-vm-modules", "--import", "./scripts/sites-env.mjs",
  "./node_modules/wrangler/wrangler-dist/cli.js", "dev",
  "--config", "dist/server/wrangler.json", "--var", `OWNER_USER_ID:${OWNER_USER_ID}`,
  "--local", "--persist-to", ".wrangler/state", "--ip", "127.0.0.1",
  "--port", "8787", "--inspector-port", "0",
], { stdio: "inherit" });

let server;
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  await server?.close();
  worker.kill();
  process.exitCode = code;
}
worker.on("error", (error) => { console.error(error); void stop(1); });
worker.on("exit", (code) => { if (!stopping) void stop(code || 1); });
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());

try {
  let ready = false;
  for (let attempt = 0; attempt < 120 && !stopping; attempt++) {
    try {
      const response = await fetch("http://127.0.0.1:8787/", { signal: AbortSignal.timeout(1000) });
      await response.body?.cancel();
      if (response.ok) { ready = true; break; }
    } catch { /* Wait for Wrangler to finish starting. */ }
    await delay(500);
  }
  if (!ready) throw new Error("Local Worker did not become ready; see Wrangler output above.");
  server = await createServer({ configFile: "vite.local-preview.config.ts" });
  await server.listen();
  server.printUrls();
  console.log("Local sign-in: http://127.0.0.1:5173/signin-with-chatgpt?return_to=/");
  console.log("This serves the built app. After source changes, stop, run npm.cmd run build, then restart.");
} catch (error) {
  console.error(error);
  await stop(1);
}

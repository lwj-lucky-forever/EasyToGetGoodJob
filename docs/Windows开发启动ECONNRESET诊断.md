# Windows 开发启动 ECONNRESET 诊断（2026-10-17）

## 已确定的连接来源

原命令 `npm.cmd run dev` 会进入：

```text
scripts/run-framework.mjs dev
→ vinext/dist/cli.js：vite.createServer / server.listen
→ vite.config.ts：cloudflare({ viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] } })
→ @cloudflare/vite-plugin：configureServer → initRunners → CloudflareDevEnvironment.initRunner
→ Miniflare.dispatchFetch
→ ws.WebSocket / Node http.ClientRequest
→ 本机 workerd.exe 的动态内部端口
```

`scanning dependencies` 只是错误之前最后一条可见日志，不是 npm 正在联网下载依赖。真正捕获到的异常位于随后并行进行的开发模块运行器初始化连接。

本次原配置复现记录（北京时间）：

- 11:45:53：Node PID 31172 启动 `workerd.exe` PID 17564。
- 11:46:13：Node 的 socket 1，`127.0.0.1:54003 → 127.0.0.1:53446`，收到 `ECONNRESET: read ECONNRESET`，进程退出码 1。
- socket 创建栈为 `ws@8.18.0/lib/websocket.js → miniflare@4.20260515.0/dist/src/index.js:58970 → Miniflare.dispatchFetch`。
- Cloudflare 插件的 `initRunner` 使用 `GET /__vite_plugin_cloudflare_init__` 和 `Upgrade: websocket` 初始化两个模块运行环境。

进一步记录了同一路径的完整请求和 runtime 控制输出：`workerd.exe` PID 17312 报告 `entry` 端口 51937，Node 请求 `/__vite_plugin_cloudflare_init__`；Windows 端口表也确认 51937 的监听进程为 17312。对照运行中握手曾成功返回 101，说明该通道存在启动不稳定现象，不能把一次成功握手视为问题已根治。

动态内部端口每次启动不同，不应手动把 53446/51937 写进配置。对端是本地 Cloudflare Worker 运行时，而不是 npm registry、外部招聘网站、ChatGPT 账号服务或 Cloudflare 线上 API。沙箱外复现没有配置 HTTP/HTTPS 代理；本次连接实际也未经过外网代理。

原始诊断位于忽略目录 `.sites-runtime/dev-network.jsonl`。临时预加载脚本 `.sites-runtime/diagnose-dev-network.mjs` 只记录连接元数据、调用栈与 runtime 端口，不记录 Cookie、认证头和业务请求体，不吞掉异常，也不会被正常启动命令加载。临时关闭服务端自动依赖发现的对照配置也仅存在 `.sites-runtime/`，没有应用到正式配置。

**结论边界：** 已定位到具体连接、请求、调用栈和对端服务；尚未证实 workerd 内部哪个缺陷或 Windows 底层条件触发重置。不据此要求关闭安全软件、修改系统代理、降级 Node 或重装依赖。

## 当前恢复方式

使用项目已有的稳定入口：

```powershell
npm.cmd run local:preview
```

访问 <http://127.0.0.1:5173/signin-with-chatgpt?return_to=/> 完成本地模拟登录，之后打开 <http://127.0.0.1:5173/>。预览使用已构建 Worker 和本地数据库，绕开 Vite RSC/SSR 的动态模块初始化 WebSocket；保留 `.wrangler/state`。

如果修改了源码，先在服务终端按 `Ctrl+C`，再执行：

```powershell
npm.cmd run build
npm.cmd run local:preview
```

PowerShell 使用 `npm.cmd` 可避免 `npm.ps1` 执行策略问题。能正常执行 `npm` 的终端也可直接用 `npm run local:preview`。

## 恢复验证

本次沿用现有构建，没有安装或更新依赖、修改业务代码、修改数据库、删除缓存，也没有修改正式 Vite 配置或 `dev` 命令含义。停止了本次诊断启动的开发进程后，启动稳定预览并通过只读 HTTP 检查：

| 检查 | 结果 |
| --- | --- |
| 首页 `/` | 200，返回页面 HTML |
| `/signin-with-chatgpt?return_to=/` | 302，设置本地模拟登录 Cookie |
| `/api/jobs` | 登录后 200，JSON 可读取 |
| `/api/resumes` | 登录后 200，JSON 可读取 |
| `/api/interview-reviews` | 登录后 200，JSON 可读取 |
| `/api/data-backup` | 登录后 200，JSON 可读取 |

检查未新增、编辑或删除任何用户岗位。应用已恢复可访问；原 `npm run dev` 的热更新开发模式仍有未根治的初始化问题，`local:preview` 不提供业务代码热更新。

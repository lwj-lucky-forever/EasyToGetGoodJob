# EasyToGetGoodJob 完整源码（本地开发说明）

## 当前 Windows 工作区已验证的启动方式

本机已使用 Node.js `24.22.0`、npm `11.19.1` 完成依赖安装、构建和全部 6 个本地数据库迁移。pnpm `11.25.0` 安装在项目内，没有修改系统 PATH。

在当前项目根目录执行以下命令即可启动：

```powershell
npm.cmd run local:preview
```

浏览器首次访问本地模拟登录地址：

<http://127.0.0.1:5173/signin-with-chatgpt?return_to=/>

之后使用 <http://127.0.0.1:5173/>。保持终端运行，按 `Ctrl+C` 停止。此入口使用 5173 作为访问端口、8787 作为内部 Worker 端口，均仅监听本机。

已验证首页、登录/退出、岗位/简历/面试记录/备份接口，以及岗位新增、读取、修改和删除。本地配置 `.env.local` 为 `OWNER_USER_ID=local_seedy`，匹配项目原有模拟登录身份，无须真实 API Key 或 Cloudflare 账号。数据保存在 `.wrangler/state`，请保留该目录。

原 `npm.cmd run dev` 在这台机器上停在 Cloudflare Vite Worker 模块加载阶段；终止时出现 `runInRunnerObject` 的 `internal error`，底层原因尚未确认。新增的 `local:preview` 使用已构建的 Worker，并复用项目已有的本地模拟登录中间件，以运行应用功能。它没有业务代码热更新：修改源码后，先停止服务，再执行：

```powershell
npm.cmd run build
npm.cmd run local:preview
```

只有依赖变更或 `node_modules` 被删除时，才需要重新安装：

```powershell
node .sites-runtime/tools/node_modules/pnpm/bin/pnpm.cjs install --frozen-lockfile
```

不要重新执行下面的数据库初始化循环：当前迁移已经应用，重复执行会遇到表或列已存在的错误。后续新增迁移应只执行尚未应用的 SQL。

---

这是 EasyToGetGoodJob 当前版本的完整 Web 项目源码。项目使用 **React + TypeScript + Vinext/Vite + Tailwind CSS + Cloudflare D1**，不是传统的单个 HTML/CSS/JavaScript 页面；所有页面、样式、接口、图标和静态资源都已保留在本项目中。

## 1. 你会在源码包中看到什么

```text
EasyToGetGoodJob-source/
├─ app/                         # 页面、全局样式、服务端 API
│  ├─ page.tsx                  # 主界面：岗位看板、新增岗位、智能导入
│  ├─ globals.css               # 全局 CSS 与 Tailwind 样式入口
│  ├─ layout.tsx                # 页面布局、标题、PWA 配置
│  ├─ chatgpt-auth.ts           # ChatGPT 登录身份读取
│  └─ api/                      # 岗位、简历、题库、备份等接口
│     └─ jobs/import-url/       # 美团、Moka 与通用招聘链接导入逻辑
├─ components/                  # 业务组件
│  ├─ job-workspace-views.tsx   # 公司分组、流程、日程等视图
│  ├─ interview-library.tsx     # 面试题库
│  ├─ data-backup-panel.tsx     # 数据备份与恢复
│  └─ ui/                       # 可复用 UI 组件
├─ lib/                         # 业务规则与解析器
│  ├─ job-parser.ts             # JD 文本识别
│  ├─ job-import.ts             # 导入字段标准化
│  ├─ company-knowledge.mjs     # 公司名称/别名知识库
│  ├─ resume-matcher.ts         # 简历适配与匹配度
│  └─ interview-question-bank.ts# 面试题数据
├─ db/                          # D1 数据库表结构
├─ drizzle/                     # 数据库迁移 SQL
├─ public/                      # 图片、图标、PWA 资源
│  ├─ offer-tower-illustrated-*.png  # Offer 大楼图标
│  ├─ manifest.webmanifest      # PWA 安装配置
│  ├─ sw.js                     # 离线缓存 Service Worker
│  └─ offline.html              # 离线页面
├─ tests/                       # 解析与排序测试
├─ package.json                 # 依赖与运行命令
├─ pnpm-lock.yaml               # 固定依赖版本
├─ vite.config.ts               # 本地开发配置
└─ README-本地运行.md            # 本说明
```

> 源码包不包含 `node_modules`、`dist`、`.wrangler`：这些均为安装依赖或本地运行后自动生成的文件，不是源代码。解压后按照下面步骤即可生成。

## 2. 环境要求（Windows + VS Code）

1. 安装 **Node.js 22 LTS**。
2. 安装 Git（仅用于后续上传 GitHub；本地运行不是必须）。
3. 用 VS Code 选择“文件 → 打开文件夹”，打开解压后的 `EasyToGetGoodJob-source` 文件夹。
4. 在 VS Code 中选择“终端 → 新建终端”，确认终端目录是该项目根目录。

先验证 Node 是否安装成功：

```powershell
node -v
```

应看到 `v22.x.x`。如果出现“无法识别 node/corepack”，请先完成 Node.js 安装，然后彻底关闭并重新打开 VS Code。

## 3. 首次安装并运行

在 VS Code 终端依次运行：

```powershell
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install
```

如果 `corepack prepare` 在你的 Node 版本中不可用，可改为：

```powershell
npm install -g pnpm@11.25.0
pnpm install
```

第一次运行前，需要初始化本地 D1 数据库。继续执行：

```powershell
pnpm build
Get-ChildItem .\drizzle\*.sql | Sort-Object Name | ForEach-Object {
  node --import .\scripts\sites-env.mjs .\node_modules\wrangler\bin\wrangler.js d1 execute DB --local --config .\dist\server\wrangler.json --persist-to .\.wrangler\state --file $_.FullName
}
pnpm dev
```

终端出现本地地址后，在浏览器打开：

```text
http://localhost:5173
```

本地开发模式使用模拟登录。首次打开后，访问：

```text
http://localhost:5173/signin-with-chatgpt?return_to=/
```

即可进入本地个人工作区。你的本地数据会存储在项目的 `.wrangler/state` 目录，不会同步到线上站点。

## 4. 常用开发命令

```powershell
# 启动开发服务器（修改代码后浏览器会自动刷新）
pnpm dev

# 类型检查与构建
pnpm build

# 运行静态检查
pnpm lint

# 构建后用 Cloudflare Worker 方式本地预览
pnpm start
```

## 5. 从哪里开始改

- 想改首页布局、按钮、岗位表单：`app/page.tsx`
- 想改颜色、间距、字体等视觉样式：`app/globals.css`
- 想改智能文本识别：`lib/job-parser.ts`、`lib/job-import.ts`
- 想补充公司别名：`lib/company-knowledge.mjs`
- 想改美团、Moka 或普通网页链接导入：`app/api/jobs/import-url/route.ts`
- 想更换 APP 图标：替换 `public/offer-tower-illustrated-*.png`
- 想改数据库字段：`db/schema.ts`，然后生成新的 Drizzle 迁移

## 6. 线上版与本地版的区别

- 本地开发使用模拟登录和本地 D1 数据库。
- 线上版使用 ChatGPT 身份和 Cloudflare D1 数据库。
- `.openai/hosting.json` 是当前线上站点的部署配置；只在本地学习和开发时不需要修改它。
- 以后如果你要部署到自己的 Cloudflare 或其他平台，需要重新配置数据库、登录方式和环境变量，不能直接复用线上数据库。

## 7. 当前已包含的功能

- 岗位新增、编辑、筛选、排序、公司分组与流程看板
- 智能导入：文本识别、常见公司识别、美团/Moka 招聘链接读取、通用网页正文解析
- 岗位职责、要求、优先条件等字段的结构化整理
- 简历版本管理与岗位匹配分析
- 投递截止提醒、笔试/面试记录与准备清单
- 面试题库、数据备份与恢复
- PWA 图标、安装入口和基础离线支持

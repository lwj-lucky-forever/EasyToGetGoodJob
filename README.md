# EasyToGetGoodJob

EasyToGetGoodJob 是一个面向实习和校招求职的岗位管理 Web App。它可以保存岗位信息、按公司整理岗位、管理投递进度与提醒、匹配不同版本的简历、生成准备清单，并记录笔试、面试和复盘。

本压缩包是当前线上版本（Site v13，对应源码提交 `f1dc5356d2056e58381adfcf0463295623814fa3`）的完整可运行源码，不包含线上数据库里的个人岗位、简历和面试记录，也不包含任何密码或 API Key。

## 主要功能

- 粘贴完整岗位文字并自动识别公司、岗位、地点、性质、工作内容和岗位要求
- 从公开招聘网页尝试读取岗位信息
- 按公司聚合岗位，并支持公司和岗位分别排序
- 管理投递状态、优先级、截止日期和站内提醒
- 保存不同版本简历并进行岗位匹配分析
- 将匹配建议转为可勾选的准备清单
- 记录笔试、面试流程和复盘内容
- 面试题库与模拟练习记录
- JSON/CSV 数据导出、备份和恢复
- PWA 安装与离线页面，可安装到手机或电脑桌面

## 项目技术

- TypeScript、React 19、Next.js 16、Vinext、Vite
- Tailwind CSS 4、shadcn/ui、Lucide 图标
- Cloudflare Workers、D1 SQLite、Drizzle ORM
- PWA Manifest 与 Service Worker

这是 React 全栈项目，因此没有单独手写的 `index.html`。页面最终的 HTML 由 `app/*.tsx` 和 `components/*.tsx` 生成；全局样式在 `app/globals.css`，业务逻辑主要位于 `lib/` 和 `app/api/`。

## 项目结构

```text
EasyToGetGoodJob-source/
├─ app/
│  ├─ api/                         后端接口
│  │  ├─ data-backup/              数据导出与恢复
│  │  ├─ interview-reviews/        面试记录增删改查
│  │  ├─ jobs/                     岗位、排序、分析和网页导入
│  │  └─ resumes/                  简历版本管理
│  ├─ globals.css                  全局样式与主题
│  ├─ layout.tsx                   页面元信息和整体布局
│  ├─ page.tsx                     主工作台页面
│  └─ chatgpt-auth.ts              当前线上版本的身份读取工具
├─ components/
│  ├─ ui/                          通用界面组件
│  ├─ data-backup-panel.tsx        数据备份界面
│  ├─ interview-library.tsx        面试题库与复盘界面
│  ├─ job-workspace-views.tsx      岗位详情、流程和日程视图
│  └─ pwa-install*.tsx             App 安装入口
├─ db/
│  ├─ index.ts                     D1 数据库连接
│  └─ schema.ts                    数据表定义
├─ drizzle/                        数据库迁移 SQL 与快照
├─ lib/                            解析、匹配、排序和业务规则
├─ public/
│  ├─ offer-tower-illustrated-*.png  Offer 大楼 App 图标
│  ├─ manifest.webmanifest         PWA 配置
│  ├─ sw.js                        Service Worker
│  └─ offline.html                 离线提示页
├─ tests/                          Node 单元测试
├─ build/、scripts/、vendor/       构建与样式支持文件
├─ .env.example                   环境变量示例
├─ .openai/hosting.json           当前 Sites/D1 部署声明
├─ package.json                   命令与依赖
├─ pnpm-lock.yaml                 锁定依赖版本
└─ vite.config.ts                 本地开发与 Worker 配置
```

## Windows 本地运行

### 1. 安装基础工具

请先安装：

- Node.js 22.13 或更高版本
- Git
- VS Code（推荐）

在 PowerShell 中检查：

```powershell
node -v
git --version
```

### 2. 打开项目并安装依赖

解压源码包，在 VS Code 中选择“文件 → 打开文件夹”，打开 `EasyToGetGoodJob-source`。然后打开 VS Code 终端并运行：

```powershell
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install
```

如果 `corepack enable` 提示权限不足，可以用管理员身份打开 PowerShell，或者改用：

```powershell
npm install -g pnpm@11.25.0
pnpm install
```

### 3. 配置本地测试身份

复制本地开发变量示例：

```powershell
Copy-Item .dev.vars.example .dev.vars
```

示例中的 `OWNER_USER_ID=local_seedy` 与项目自带的本地测试身份一致。`.dev.vars` 已被 Git 忽略，不会上传到 GitHub。

### 4. 创建本地数据库

先生成一次本地 Worker 配置：

```powershell
pnpm build
```

然后按顺序执行所有数据库迁移：

```powershell
Get-ChildItem .\drizzle\*.sql | Sort-Object Name | ForEach-Object {
  pnpm exec wrangler d1 execute DB --local --config .\dist\server\wrangler.json --persist-to .\.wrangler\state --file $_.FullName
}
```

这一步只会在项目目录的 `.wrangler` 文件夹中创建本地数据库，不会连接或修改线上数据。

### 5. 启动项目

```powershell
pnpm dev
```

终端出现地址后，在浏览器打开：

```text
http://localhost:5173/signin-with-chatgpt?return_to=/
```

当前源码为了模拟线上版本，会在本地自动使用测试身份登录。该过程不需要真实 ChatGPT 账号，也不会访问你的线上岗位数据。停止项目时在终端按 `Ctrl + C`。

### 6. 再次运行

以后通常只需要：

```powershell
pnpm dev
```

只有数据库结构发生变化并新增迁移文件时，才需要重新执行新增的迁移。

## macOS / Linux 本地运行

安装 Node.js 22.13+ 和 pnpm 11.25 后，在项目根目录运行：

```bash
pnpm install
cp .dev.vars.example .dev.vars
pnpm build
for migration in drizzle/*.sql; do
  pnpm exec wrangler d1 execute DB --local \
    --config dist/server/wrangler.json \
    --persist-to .wrangler/state \
    --file "$migration"
done
pnpm dev
```

然后打开 `http://localhost:5173/signin-with-chatgpt?return_to=/`。

## 常用命令

```text
pnpm dev          启动本地开发环境
pnpm build        构建生产版本
pnpm start        本地运行已经构建的 Worker
pnpm exec tsc --noEmit   检查 TypeScript
node --test tests/*.test.mjs   运行单元测试
pnpm db:generate  修改 db/schema.ts 后生成迁移
```

## 上传到 GitHub

先在 GitHub 新建一个空仓库，例如 `EasyToGetGoodJob`。建议不要勾选自动创建 README、`.gitignore` 或 License，因为源码包里已经有 README 和 `.gitignore`。

在项目根目录的 PowerShell 中执行：

```powershell
git init
git add .
git commit -m "Initial commit: EasyToGetGoodJob"
git branch -M main
git remote add origin https://github.com/你的GitHub用户名/EasyToGetGoodJob.git
git push -u origin main
```

请把上面的仓库地址替换成你自己在 GitHub 中复制的地址。如果 GitHub 要求登录，请按照浏览器提示授权，或使用 GitHub Desktop 完成上传。

## 数据与隐私说明

- 源码包不包含线上数据库中的岗位、简历、投递和面试数据。
- 如需保存线上数据，请先在网页“数据备份”页面下载完整 JSON 备份。
- `.env`、`.env.local`、`.wrangler/`、`node_modules/` 和构建产物已在 `.gitignore` 中排除，不应上传到 GitHub。
- 不要把 API Key、数据库密钥或账号密码写入代码并提交到公开仓库。

## 关于独立 App 迁移

这一份代码忠实保留了当前线上版本，所以仍包含 ChatGPT Sites 身份头和 D1 部署配置。它可以在本地通过测试身份运行，也可以作为后续独立化改造的基础。如果要彻底取消 ChatGPT 登录并部署到自己的域名，需要进一步替换 `app/chatgpt-auth.ts`、`lib/owner-auth.ts` 和数据库连接方式；仅删除登录按钮会导致写入接口无法正常工作。

原始 Sites starter 的技术说明保存在 `docs/README_SITES_STARTER.md`。

# 招聘岗位 URL 导入：实现与验证

> 本文保留上一轮三站修复的实现和实测记录。后续适配器注册表、URL 标准化及完整扩展说明见 [URL 岗位导入架构与扩展指南](URL岗位导入架构与扩展指南.md)。

验证日期：2026-10-16（Asia/Shanghai）。测试使用用户提供的三条原链接，未使用浏览器 Cookie、登录凭据或私有 API Key。

## 数据流程

1. `app/page.tsx` 把表单链接提交到 `POST /api/jobs/import-url`。
2. 路由先检查登录身份与工作区所有者，再调用 `readJobUrl`；导入本身不写数据库。
3. `job-web-fetch.ts` 校验公开 HTTP(S) 地址，手动处理并逐跳校验重定向，限制超时和解压后的响应体大小。
4. `job-web-extract.ts` 优先查找 JSON-LD `JobPosting`；其次读取 JSON hydration 数据或白名单全局变量赋值中的 JSON 字面量。不会执行远程 JavaScript。
5. 只选择与链接岗位 ID 一致的详情对象；无法区分的多岗位集合直接拒绝。百度只读取 `detailData.postInfo`，忽略同一 store 的列表、菜单和宣传配置。
6. 对动态外壳调用已适配的公开岗位接口。字节与小米共用飞书招聘适配器，接口路径由 URL 的岗位 ID 推导。原美团、Moka 接口继续保留；这两类既有适配器保持接口优先以兼容原来的 hash 路由。
7. 没有可用结构化详情时，使用 HTML DOM 定位岗位详情区域、标签/值表格、微数据、`main/article`；最后仅尝试标题与职责/要求分节组成的有限正文。不会再把整页 body、meta 摘要、任意脚本字符串拼成 JD。
8. 只抽取明确字段，生成干净 `rawText`，再使用现有 `parseJobText` 和 `normalizeImportedJob` 统一处理；结构化字段覆盖启发式推断。`FULL_TIME` 不再等同于校招。
9. 前端展示可确认的字段及 `webDetails` 补充信息，用户确认后填表；保存仍走原 `/api/jobs`。现有数据库结构不变。补充信息随清理后的岗位原文保留，学历/经验等也保留于要求中，不新增数据库列。

粘贴 JD 文本仍调用原 `safelyParseJobText → parseJobText`，没有改写该解析器的业务规则。

## 原问题的主要原因

实测并非所有失败都会产生 HTTP 错误。旧接口对这三条链接都可能返回 200，却把错误文本当成岗位，属于误报成功：

- 字节：HTML 是动态外壳，真实详情在 `/api/v1/job/posts/{id}`；原代码没有适配，反而扫描站点配置字符串，出现无关英文要求及“兼职”误判。
- 小米：用户提供的是 `xiaomi.jobs.f.mioffice.cn`，而非旧 `hr.xiaomi.com`。它同样使用飞书招聘动态详情接口；原逻辑把“实习生招聘”和平台功能开关当作岗位文本。
- 百度：页面已经服务端渲染，且 `window.__INITIAL_DATA__` 含有完整详情；主要问题不是缺浏览器，而是没有按岗位选择对象。全局数据中还含其他职位和宣传文案，旧逻辑混合抽取后把宣传语识别成岗位名称。
- 即使找到 JSON-LD，旧 `buildReadableJob` 仍追加整页文本，结构化数据的优势被噪声抵消。原脚本扫描还会抽出配置中的任意字符串。

本次公开请求未发现必须登录、验证码或 Cookie 的阻塞，因此没有引入 Playwright、Puppeteer 或 Headless Browser，也没有实现验证码绕过或签名模拟。

## 修改范围

| 文件 | 职责 / 修改目的 |
| --- | --- |
| `app/api/jobs/import-url/route.ts` | 保留鉴权与响应约定，委托抽取模块；无有效岗位正文时明确失败 |
| `lib/job-web-fetch.ts` | HTML/JSON 共用的有界传输、重定向及 URL 校验 |
| `lib/job-web-extract.ts` | 结构化对象选择、DOM 岗位区域定位、字段白名单、宣传与推荐内容过滤 |
| `lib/job-web-platforms.ts` | 动态招聘平台适配与读取优先级；保留美团/Moka |
| `lib/job-import.ts` | 补充字段白名单与长度限制；合法中文日期规范化；无效截止日期留空 |
| `lib/company-knowledge.mjs` | 识别小米当前招聘域名 |
| `app/page.tsx` | 展示招聘类型、发布时间、学历、专业、经验等补充预览 |
| `package.json`、`pnpm-lock.yaml` | 固定新增 `parse5@8.0.0`；仅增加它及 `entities`，未升级原有依赖 |
| `tsconfig.json` | 允许显式 `.ts` 导入，以便 Node 直接执行抽取回归测试；项目仍为 `noEmit` |
| `tests/job-web-import.test.mjs`、`tests/fixtures/job-web/*` | 固定样例及错误场景回归测试；样例只保留测试需要的公开岗位字段 |

`parse5` 只做 HTML 语法树解析，不联网、不运行脚本、不提供浏览器。引入它是为了正确处理嵌套标签、HTML 实体、表格等，避免用正则模拟 DOM。

## 三条原链接的端到端结果

测试经过：本地模拟登录 → 真实导入 HTTP 接口 → 公开招聘网页/接口 → 校验字段 → 保存临时岗位 → 读取校验 → 删除临时岗位。没有修改已有岗位记录。

| 公司 / 原链接 | 获取结果 | 提取字段 | 未提供的字段 / 兼容性说明 |
| --- | --- | --- | --- |
| [字节](https://jobs.bytedance.com/campus/position/7476301700300933383/detail) | HTTP 200；大模型产品实习生 - TikTok AI创新中心 | 字节跳动、北京、日常实习、招聘类型“实习”、发布时间 2025-02-28、职责、要求、本科及以上学历、计算机/人工智能/软件工程/数学/统计相关专业、相关项目经验、每周至少4天且连续至少6个月 | 无明确截止时间，留空；日期来自接口原始发布时间，不代表今年新发布 |
| [百度](https://talent.baidu.com/jobs/detail/INTERN/73a0bb97-087b-4b07-ba06-bfecc9b97d8f) | HTTP 200；Dumate AI生态产品经理（J106615） | 百度、北京市、日常实习、日常实习项目、发布时间 2026-10-16、职责、要求、本科及以上学历、2年以上互联网产品实习经验、ACG 部门信息 | 无明确专业与截止时间，留空；原文中的实习经验年限保留，没有自行纠正 |
| [小米](https://xiaomi.jobs.f.mioffice.cn/internship/position/7694244084009421092/detail?spread=6AA3R7B) | HTTP 200；产品经理实习生-2027届 | 小米、北京、日常实习、招聘类型“实习”、发布时间 2026-10-08、职责、要求、不少于2家互联网公司产品实习经验、实习4–6个月且不接受低于3个月 | 无明确学历、专业和截止时间，留空；标题“2027届”与要求中的“2028届优先”来自原接口，均照实保留，请用户核对 |

三条结果均未发现导航、页脚、登录提示、隐私政策、推荐岗位、平台功能开关混入。字节职责中的公司/团队通用宣传前言已移除，具体任务与任职要求保留。岗位补充字段在 `parsed.webDetails` 可见，原文中也可查阅。

## 自动化验证

- 41 项测试全部通过，包含原有文本解析、公司识别、排序与可选浏览器集成测试。
- 新增测试覆盖：JSON-LD 优先级、多脚本/@graph 选岗、错误 ID、列表页、挑战页、百度 undefined 字面量、飞书接口、既有美团/Moka、DOM 噪声、数据大小限制、不安全 URL/重定向、缺失字段与日期、粘贴文本不回归。
- TypeScript 检查通过；新增/调整的服务端模块 ESLint 检查通过；项目构建通过。
- `app/page.tsx` 全文件 ESLint 仍报告原有的两处 `react-hooks/set-state-in-effect` 错误及两处图片警告，位于未修改的其他功能。本次没有重构这些业务代码。

重跑：

```powershell
node --test tests/company-knowledge.test.mjs tests/job-parser.test.mjs tests/job-order.test.mjs tests/optional-browser-tools.test.mjs tests/job-web-import.test.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd run build
```

本地运行仍使用 `npm.cmd run local:preview`，访问 `http://127.0.0.1:5173/`。修改代码后需停止服务、重新构建再启动。

## 限制与扩展方式

- 已验证的是上述三条链接，不代表三家公司所有历史域名、短链接、移动端入口或私有岗位均已覆盖。
- 登录态、验证码、频控、岗位下线或公开接口变更时，服务会明确失败并建议粘贴 JD；不把验证页当岗位导入。
- 通用 DOM 仍依赖语义结构；高度特殊或只有执行 JavaScript 才能得到数据且没有公开结构化详情的网站，可能无法自动提取。没有充分证据时宁可要求手动粘贴。
- 发布时间、截止时间、学历和专业缺失时留空；从要求句子抽取的专业/经验是规则识别，保留来源措辞，用户仍应确认。
- 补充字段目前没有独立数据库列或额外筛选条件，保存在岗位原文及相应要求中；如需按学历/发布时间筛选，应另行设计字段迁移。
- 网络校验会拦截明显内网地址并逐跳检查 URL；沿用 Worker 的 HTTP 网络能力，没有额外引入 DNS 解析服务。
- 新增网站时先检查真实页面及目标岗位的数据源：可用通用 JSON-LD/内嵌详情就无需专用适配；同一招聘平台优先复用适配器；确有新协议时在 `job-web-platforms.ts` 添加小型、固定端点适配，复用有界传输与字段规范化，同时增加去噪、错 ID、失效/受限场景测试。

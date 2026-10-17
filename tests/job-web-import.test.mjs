import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extractStructuredJob, extractJobRegion, recordToJob, selectJobRecord } from "../lib/job-web-extract.ts";
import { readJobUrl } from "../lib/job-web-platforms.ts";
import { fetchJobJson, fetchJobPage, validateJobUrl } from "../lib/job-web-fetch.ts";
import { normalizeImportedJob, normalizeDeadline, safelyParseJobText } from "../lib/job-import.ts";

const urls = {
  bytedance: "https://jobs.bytedance.com/campus/position/7476301700300933383/detail",
  xiaomi: "https://xiaomi.jobs.f.mioffice.cn/internship/position/7694244084009421092/detail?spread=6AA3R7B",
  baidu: "https://talent.baidu.com/jobs/detail/INTERN/73a0bb97-087b-4b07-ba06-bfecc9b97d8f",
};
const jsonHtml = (value) => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
const htmlResponse = (body) => new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
const posting = { "@type": "JobPosting", title: "平台开发工程师", hiringOrganization: { name: "星河科技" }, description: "负责平台功能开发、系统维护与性能优化。", qualifications: "本科及以上学历，计算机相关专业，3年以上开发经验。", employmentType: "FULL_TIME", datePosted: "2026-10-01", validThrough: "2026-11-01", jobLocation: { address: { addressLocality: "杭州" } } };

test("JSON-LD wins without appending navigation, meta or recommended roles", async () => {
  const result = await readJobUrl("https://careers.example.com/jobs/platform", async () => htmlResponse(`${jsonHtml(posting)}<meta name="description" content="暑期招聘宣传"><nav>兼职机会</nav><main>推荐职位：游戏运营实习生</main><footer>隐私政策 联系我们</footer>`));
  assert.equal(result.extractionMethod, "JSON-LD JobPosting");
  assert.equal(result.parsed.role, "平台开发工程师");
  assert.equal(result.parsed.nature, "待确认", "full time does not imply campus recruitment");
  assert.equal(result.parsed.webDetails.datePosted, "2026-10-01");
  assert.equal(result.parsed.applicationDeadline, "2026-11-01");
  assert.equal(result.parsed.location, "杭州");
  assert.doesNotMatch(result.parsed.rawText, /兼职机会|宣传|推荐职位|游戏运营|隐私政策|联系我们/);
});

test("JSON-LD selects the target ID across multiple scripts and @graph", () => {
  const html = jsonHtml({ ...posting, identifier: "9999", title: "其他岗位" }) + jsonHtml({ "@graph": [{ ...posting, identifier: { value: "1234" } }] });
  assert.equal(extractStructuredJob(html, "https://careers.example.com/position/1234/detail").parsed.role, posting.title);
});

test("an unidentified collection of multiple postings is rejected", () => {
  const html = jsonHtml([posting, { ...posting, title: "其他岗位" }]);
  assert.equal(extractStructuredJob(html, "https://careers.example.com/jobs"), null);
});

test("wrong-ID recommendations do not become the requested position", () => {
  assert.equal(selectJobRecord([{ id: "9999", title: "推荐岗位", description: "负责其他推荐职位的用户运营与数据分析。" }], "1234"), null);
});

test("Baidu hydration extracts only detailData.postInfo, safely handling undefined", async () => {
  const row = { name: "Dumate AI生态产品经理（J106615）", postId: "73a0bb97-087b-4b07-ba06-bfecc9b97d8f", workContent: "负责百度搭子产品 Skill 生态的规划与建设，持续优化产品体验。", serviceCondition: "本科及以上学历，2年以上互联网产品实习经验；擅长使用figma。", workPlace: "北京市", publishDate: "2026-10-16", projectType: "日常实习项目" };
  const store = { detailData: { postInfo: row, recruitType: "INTERN", isValid: true }, listData: { listDetailData: [{ ...row, postId: "other", name: "推荐岗位工程师", workPlace: "上海" }] } };
  const html = `<nav>登录 百度校园招聘</nav><script>window.__INITIAL_DATA__=${JSON.stringify(store).replace('"isValid":true', '"isValid":true,"projectType":undefined')};window.evilExecuted=true;</script><footer>隐私政策</footer>`;
  const result = await readJobUrl(urls.baidu, async () => htmlResponse(html));
  assert.equal(result.parsed.company, "百度");
  assert.equal(result.parsed.role, row.name);
  assert.equal(result.parsed.location, "北京市");
  assert.equal(result.parsed.nature, "日常实习");
  assert.equal(result.parsed.webDetails.education, "本科及以上学历");
  assert.doesNotMatch(result.parsed.rawText, /推荐岗位|上海|登录|隐私政策|evilExecuted/);
  assert.equal(globalThis.evilExecuted, undefined);
});

for (const [name, company] of [["bytedance", "字节跳动"], ["xiaomi", "小米"]]) {
  test(`${name}: public ATS detail API, exact ID and only job fields`, async () => {
    const payload = JSON.parse(await readFile(new URL(`./fixtures/job-web/${name}.json`, import.meta.url), "utf8"));
    const requests = [];
    const mock = async (input, options) => {
      requests.push({ url: new URL(input).toString(), options });
      return requests.length === 1 ? htmlResponse(`<title>实习生招聘</title><script id="js-websiteInfo" type="text/json">{"tenant_info":{"name":"网站配置","features":["EmployeeTransferAndInternMigrate"]}}</script><nav>兼职机会</nav>`) : Response.json(payload);
    };
    const result = await readJobUrl(urls[name], mock);
    assert.equal(requests.length, 2);
    assert.match(requests[1].url, new RegExp(`/api/v1/job/posts/${payload.data.job_post_detail.id}$`));
    assert.equal(result.parsed.company, company);
    assert.equal(result.parsed.role, payload.data.job_post_detail.title);
    assert.equal(result.parsed.location, "北京");
    assert.equal(result.parsed.nature, "日常实习");
    assert.ok(result.parsed.webDetails.datePosted);
    assert.ok(result.parsed.webDetails.experience);
    assert.doesNotMatch(result.parsed.rawText, /团队介绍|覆盖150个国家|网站配置|EmployeeTransfer|兼职机会|隐私/);
    assert.equal(result.parsed.applicationDeadline, undefined, "missing deadlines stay empty");
    assert.ok(result.warnings.some((w) => w.includes("截止日期")));
  });
}

test("ATS refuses an expired, unrelated, or restricted position instead of importing its shell", async () => {
  for (const payload of [{ code: -1 }, { code: 0, data: { job_post_detail: { id: "wrong", title: "其他岗位" } } }, { code: 0, data: { job_post_detail: { id: "7476301700300933383", channel_online_status: 0 } } }]) {
    let count = 0;
    await assert.rejects(readJobUrl(urls.bytedance, async () => ++count === 1 ? htmlResponse("<title>字节招聘</title>") : Response.json(payload)), /未返回有效岗位|不一致|已下线/);
  }
});

test("legacy Meituan adapter still reads split duties and requirements", async () => {
  const result = await readJobUrl("https://zhaopin.meituan.com/web/position?jobUnionId=123456", async (_url, opts) => {
    if (new URL(_url).pathname !== "/api/official/job/getJobDetail") return htmlResponse("<title>美团招聘</title>");
    assert.equal(JSON.parse(opts.body).jobUnionId, "123456");
    return Response.json({ data: { jobUnionId: "123456", jobName: "产品运营实习生", jobDuty: "负责用户调研、数据分析、产品运营和活动设计。", jobRequirement: "本科及以上学历，每周实习4天，连续3个月。", jobType: 2, cityList: [{ name: "北京" }] } });
  });
  assert.equal(result.parsed.company, "美团");
  assert.equal(result.parsed.nature, "日常实习");
  assert.match(result.parsed.requirements, /本科/);
});

test("legacy Moka hash routing still uses the selected job", async () => {
  const result = await readJobUrl("https://app.mokahr.com/campus-recruitment/didiglobal/1#/job/abcd-1234", async (url) => {
    if (url.hostname !== "api.mokahr.com") return htmlResponse("<title>Moka 招聘</title>");
    assert.equal(url.pathname, "/api-platform/v1/jobs/didiglobal/abcd-1234");
    return Response.json({ data: { id: "abcd-1234", title: "产品经理实习生", description: "岗位职责：负责用户需求分析、产品设计与产品迭代。\n任职要求：本科及以上学历，每周实习4天。", locations: [{ name: "北京" }] } });
  });
  assert.equal(result.parsed.company, "滴滴");
  assert.match(result.parsed.requirements, /本科/);
});

test("semantic detail table preserves one job, excluding surrounding menus and related cards", () => {
  const html = `<nav>前端开发工程师（实习）</nav><aside><div class="job-detail"><h1>推荐工程师</h1>岗位职责：负责其他产品的开发维护工作。</div></aside><table class="job-information"><tr><td>职位名称：</td><td>字体内容编辑</td><td>工作地点：</td><td>北京</td></tr><tr><td>招聘渠道：</td><td>社会招聘</td></tr><tr><td>工作职责：</td><td><p>负责字体内容推荐、活动设计与运营数据分析。</p></td></tr><tr><td>工作要求：</td><td>本科及以上学历，一年以上相关产品运营经验。</td></tr></table><footer>隐私政策 联系我们</footer>`;
  const result = extractJobRegion(html, "https://hr.xiaomi.com/job/view/515");
  assert.equal(result.parsed.role, "字体内容编辑");
  assert.equal(result.parsed.location, "北京");
  assert.equal(result.parsed.nature, "其他");
  assert.doesNotMatch(result.parsed.rawText, /前端|推荐工程师|隐私政策|联系我们/);
});

test("generic main detail excludes nested recommendations and login dialogs", () => {
  const html = `<main><h1>算法工程师</h1><section><h2>岗位职责</h2><p>负责算法模型训练、推理优化及业务落地工作。</p><h2>任职要求</h2><p>硕士及以上学历，数学相关专业。</p></section><div class="recommended-jobs"><p>招聘其他岗位</p><div class="job-content">岗位要求：擅长游戏运营</div></div><div role="dialog">请先登录</div></main>`;
  const result = extractJobRegion(html, "https://example.com/jobs/algorithm");
  assert.equal(result.parsed.role, "算法工程师");
  assert.doesNotMatch(result.parsed.rawText, /其他岗位|游戏运营|请先登录/);
});

test("listing and challenge pages fail clearly instead of creating a fake job", async () => {
  for (const body of ["<main><h1>职位列表</h1><p>产品实习生 开发工程师 数据分析师</p></main>", "<h1>安全验证</h1><p>请先登录</p>"]) {
    await assert.rejects(readJobUrl("https://example.com/jobs", async () => htmlResponse(body)), /详情链接|安全验证/);
  }
});

test("malformed JSON-LD falls through without evaluating JavaScript", () => {
  const html = `<script type="application/ld+json">(function(){globalThis.evilExecuted=true})()</script>`;
  assert.equal(extractStructuredJob(html, "https://example.com/jobs"), null);
  assert.equal(globalThis.evilExecuted, undefined);
});

test("company metadata and a site description do not qualify as a job", () => {
  for (const store of [{ name: "公司名称", description: "我们是一家致力于人工智能产品创新与平台服务的科技企业。" }, { "@type": "WebSite", title: "招聘官网", description: "我们诚挚邀请来自社会、校园以及海外的优秀人才加入我们。" }]) {
    assert.equal(extractStructuredJob(`<script type="application/json">${JSON.stringify(store)}</script>`, "https://example.com/position/1234/detail"), null);
  }
});

test("Chinese deadlines are normalized and impossible calendar dates are rejected", () => {
  assert.equal(normalizeDeadline("2026年10月31日"), "2026-10-31");
  assert.equal(normalizeDeadline("2026-02-30"), "");
});

test("SSRF checks run before requests and on redirects", async () => {
  for (const url of ["http://127.0.0.1", "http://2130706433", "http://[::1]", "http://10.0.0.1", "https://x.localhost", "file:///etc/passwd", "https://user:pass@example.com", "https://example.com:8080"]) assert.throws(() => validateJobUrl(url));
  let requests = 0;
  await assert.rejects(fetchJobPage("https://example.com/job", async () => { requests++; return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }); }), /地址不受支持/);
  assert.equal(requests, 1);
});

test("HTML and JSON transports bound streamed bodies even without content-length", async () => {
  const oversized = () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(1_500_001)); c.close(); } }), { headers: { "content-type": "text/html" } });
  await assert.rejects(fetchJobPage("https://example.com/job", async () => oversized()), /内容过大/);
  await assert.rejects(fetchJobJson(new URL("https://example.com/api"), "https://example.com", async () => oversized()), /内容过大/);
});

test("API redirects are never followed to an untrusted endpoint", async () => {
  await assert.rejects(fetchJobJson(new URL("https://example.com/api"), "https://example.com", async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1" } })), /意外跳转/);
});

test("web metadata is allowlisted; missing facts are not invented", () => {
  const parsed = normalizeImportedJob({ webDetails: { education: "本科", arbitrary: "ignored", major: 42 }, applicationDeadline: "not-a-date" });
  assert.deepEqual(parsed.webDetails, { education: "本科" });
  assert.equal(parsed.applicationDeadline, undefined);
  const result = recordToJob({ title: "产品实习生", description: "负责产品需求研究、产品设计与日常数据分析。" }, "https://example.com/job", "test");
  assert.equal(result.parsed.webDetails.datePosted, undefined);
});

test("paste JD import retains its established behavior and has no web-only metadata", () => {
  const parsed = safelyParseJobText("公司：星河科技\n岗位：产品实习生\n工作地点：北京\n岗位职责：负责用户调研和产品需求分析\n岗位要求：本科及以上学历，每周实习4天");
  assert.equal(parsed.company, "星河科技");
  assert.equal(parsed.role, "产品实习生");
  assert.equal(parsed.nature, "日常实习");
  assert.equal(parsed.webDetails, undefined);
});

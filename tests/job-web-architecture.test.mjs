import test from "node:test";
import assert from "node:assert/strict";
import { normalizeJobUrl, fetchJobPage } from "../lib/job-web-fetch.ts";
import { identifyJobSite } from "../lib/job-web-sites.ts";
import { recordToJob, splitWebJobSections, extractJobRegion } from "../lib/job-web-extract.ts";
import { readJobUrl } from "../lib/job-web-platforms.ts";

const page = (text) => new Response(text, { headers: { "content-type": "text/html" } });
const job = { title: "平台产品经理", description: "负责平台需求研究、产品设计、项目推进和数据分析。", requirement: "本科及以上学历，计算机相关专业，熟悉产品设计工作。" };

test("normalization removes tracking but preserves unknown job parameters and hash routes", () => {
  const url = normalizeJobUrl(" HTTPS://ZHAOPIN.MEITUAN.COM:443/web/position?jobUnionId=123456&jobShareType=1&utm_source=wechat&source=campus&token=opaque&fbclid=abc ");
  assert.equal(url.hostname, "zhaopin.meituan.com");
  assert.equal(url.port, "");
  assert.equal(url.searchParams.get("jobUnionId"), "123456");
  assert.equal(url.searchParams.get("jobShareType"), "1");
  assert.equal(url.searchParams.get("source"), "campus");
  assert.equal(url.searchParams.get("token"), "opaque");
  assert.equal(url.searchParams.has("utm_source"), false);
  assert.equal(url.searchParams.has("fbclid"), false);
  const moka = normalizeJobUrl("https://app.mokahr.com/apply/acme/1#/job/abcd-1234?jobId=keep&utm_campaign=drop");
  assert.equal(moka.hash, "#/job/abcd-1234?jobId=keep");
  assert.equal(normalizeJobUrl("https://jobs.bytedance.com/campus/position/7476301700300933383/detail?spread=ref&projectId=keep").search, "?projectId=keep");
  assert.equal(normalizeJobUrl("https://example.com/job?spread=possibly-job-key").searchParams.get("spread"), "possibly-job-key");
});

test("short-link redirects are normalized and dispatch using the final site's identity", async () => {
  const seen = [];
  const custom = { id: "test-tencent", canHandle: (url) => url.hostname === "careers.tencent.com", async parse({ url, stage }) {
    return stage === "api" ? recordToJob(job, url.toString(), "test API") : null;
  } };
  const result = await readJobUrl("https://short.example/r?utm_source=drop", async (url) => {
    seen.push(url.toString());
    return seen.length === 1 ? new Response(null, { status: 302, headers: { location: "https://careers.tencent.com/jobdesc.html?postId=123456&utm_source=share" } }) : page("<title>招聘页</title>");
  }, [custom]);
  assert.equal(seen[0], "https://short.example/r");
  assert.equal(seen[1], "https://careers.tencent.com/jobdesc.html?postId=123456");
  assert.equal(result.parsed.company, "腾讯");
  assert.equal(result.importSource.adapterId, "test-tencent");
  assert.equal(result.sourceUrl, seen[1]);
});

test("redirects preserve a Moka position fragment when Location omits it", async () => {
  let calls = 0;
  const result = await fetchJobPage("https://short.example/app#/job/abcd-1234", async () => ++calls === 1 ? new Response(null, { status: 302, headers: { location: "https://app.mokahr.com/apply/acme/1" } }) : page("hello"));
  assert.equal(new URL(result.finalUrl).hash, "#/job/abcd-1234");
});

test("adding an adapter requires no change to the pipeline and generic JSON-LD still wins", async () => {
  let specialCalls = 0;
  const custom = { id: "new-platform", canHandle: () => true, async parse({ url, stage }) { specialCalls++; return stage === "api" ? recordToJob(job, url.toString(), "new API") : null; } };
  const result = await readJobUrl("https://new.example/job", async () => page("<div>dynamic shell</div>"), [custom]);
  assert.equal(result.importSource.adapterId, "new-platform");
  assert.equal(result.parsed.role, job.title);
  specialCalls = 0;
  const schema = { "@type": "JobPosting", ...job, hiringOrganization: { name: "星河科技" } };
  const generic = await readJobUrl("https://new.example/job", async () => page(`<script type="application/ld+json">${JSON.stringify(schema)}</script>`), [custom]);
  assert.equal(specialCalls, 0);
  assert.equal(generic.importSource.adapterId, "generic-jsonld");
});

test("identity hints cover target employers without promising their dynamic APIs", () => {
  for (const [host, company] of [["jobs.bytedance.com", "字节跳动"], ["talent.baidu.com", "百度"], ["xiaomi.jobs.f.mioffice.cn", "小米"], ["zhaopin.meituan.com", "美团"], ["talent.alibaba.com", "阿里巴巴"], ["careers.tencent.com", "腾讯"], ["campus.jd.com", "京东"], ["talent.didiglobal.com", "滴滴"], ["jobs.xiaohongshu.com", "小红书"], ["career.huawei.com", "华为"]]) {
    const site = identifyJobSite(new URL(`https://${host}/job`));
    assert.equal(site.company, company);
    assert.notEqual(site.id, "generic");
    assert.equal(recordToJob({ ...job, hiringOrganization: { name: "页面中的其他名称" } }, `https://${host}/job`, "generic").parsed.company, company);
  }
  assert.equal(identifyJobSite(new URL("https://careers.tencent.com.evil.example/job")).company, undefined);
});

test("third-party platform names never replace the actual employer or tenant data", () => {
  const source = "https://app.mokahr.com/apply/didiglobal/1#/job/abcd-1234";
  assert.equal(identifyJobSite(new URL(source)).platform, "moka");
  assert.equal(identifyJobSite(new URL(source)).company, undefined);
  const result = recordToJob({ ...job, hiringOrganization: { name: "星河科技" } }, source, "test", { company: "滴滴" });
  assert.equal(result.parsed.company, "星河科技");
  assert.equal(recordToJob({ ...job, company: "Moka" }, "https://app.mokahr.com/apply/acme/1", "test").parsed.company, undefined);
  assert.equal(identifyJobSite(new URL("https://acme.jobs.feishu.cn/internship/position/1234567890123456789/detail")).company, undefined);
});

test("English and Chinese headings separate duties and requirements in a combined description", () => {
  for (const [duties, requirements] of [["职位职责", "任职资格"], ["工作职责", "职位要求"], ["Responsibilities", "Qualifications"], ["Responsibilities", "Requirements"]]) {
    const result = recordToJob({ title: "产品经理", description: `${duties}\n负责产品设计、需求管理、项目推进和效果分析。\n${requirements}\n本科及以上学历，计算机相关专业，熟练使用分析工具。` }, "https://example.com/job", "test");
    assert.match(result.parsed.responsibilities, /负责产品设计/);
    assert.doesNotMatch(result.parsed.responsibilities, /本科|计算机相关专业/);
    assert.match(result.parsed.requirements, /本科及以上学历/);
    assert.doesNotMatch(result.parsed.requirements, /负责产品设计/);
  }
});

test("semantic fallback is web-only and preserves ordering within each section", () => {
  const split = splitWebJobSections("负责需求分析与产品规划。\n深入研究用户场景。\n参与设计评审和上线跟进。\n本科及以上学历，熟悉数据分析。");
  assert.ok(split.responsibilities.indexOf("深入研究") < split.responsibilities.indexOf("参与设计"));
  assert.doesNotMatch(split.responsibilities, /本科/);
  assert.match(split.requirements, /本科/);
});

test("JSON-LD salary, attendance and duration survive canonical text generation", () => {
  const result = recordToJob({ ...job, requirement: "本科及以上学历，每周出勤4天，实习期至少6个月。", baseSalary: { currency: "CNY", value: { minValue: 200, maxValue: 300, unitText: "DAY" } } }, "https://example.com/job", "test");
  assert.equal(result.parsed.webDetails.salary, "CNY 200–300 DAY");
  assert.match(result.parsed.webDetails.weeklyAttendance, /4天/);
  assert.match(result.parsed.webDetails.internshipDuration, /6个月/);
  assert.match(result.parsed.rawText, /薪资待遇：CNY 200–300 DAY/);
});

test("DOM headings outside the inner job-content block keep the real job title and salary", () => {
  const result = extractJobRegion(`<main><h1>产品经理实习生</h1><p>薪资待遇：200–300元/天</p><p>发布时间：2026-10-16</p><div class="job-content"><h2>Responsibilities</h2><p>负责产品需求研究、产品设计和数据分析。</p><h2>Qualifications</h2><p>本科及以上学历，每周至少4天，实习6个月。</p></div><aside>热门岗位 开发工程师</aside><div class="social-links">关注我们</div><footer>隐私政策 联系客服</footer></main>`, "https://example.com/job");
  assert.equal(result.parsed.role, "产品经理实习生");
  assert.equal(result.parsed.webDetails.salary, "200–300元/天");
  assert.equal(result.parsed.webDetails.datePosted, "2026-10-16");
  assert.match(result.parsed.requirements, /本科/);
  assert.doesNotMatch(result.parsed.responsibilities, /本科/);
  assert.doesNotMatch(result.parsed.rawText, /热门岗位|开发工程师|隐私政策|关注我们|联系客服/);
});

test("branding and recommendation tails are excluded while internship eligibility is kept", () => {
  const result = recordToJob({ title: "产品实习生", description: "团队介绍：我们是一家全球领先的品牌。\n品牌宣传内容。\n日常实习：面向在校生，提供至少3个月实践机会。\n岗位职责\n负责需求分析、产品设计与产品效果复盘。\n岗位要求\n本科在读，每周出勤4天。\n你可能还喜欢\n其他岗位：销售经理", salary: "200元/天" }, "https://example.com/job", "test");
  assert.doesNotMatch(result.parsed.rawText, /全球领先|品牌宣传|你可能还喜欢|销售经理/);
  assert.match(result.parsed.webDetails.otherInformation, /至少3个月/);
  assert.match(result.parsed.webDetails.salary, /200元/);
});

test("an English careers listing with several detail cards is not one job", () => {
  const card = (title) => `<article class="job-detail"><h2>${title}</h2><h3>Responsibilities</h3><p>负责产品需求研究、产品设计和数据分析。</p><h3>Qualifications</h3><p>本科及以上学历，熟悉产品分析方法。</p></article>`;
  assert.equal(extractJobRegion(`<main><h1>Careers</h1>${card("Product manager")}${card("Software engineer")}</main>`, "https://example.com/jobs"), null);
});

test("explicit company in a detail table wins over competitor mentions in requirements", () => {
  const result = extractJobRegion(`<table class="job-information"><tr><td>公司：</td><td>星河科技</td></tr><tr><td>岗位名称：</td><td>产品运营实习生</td></tr><tr><td>岗位职责：</td><td>负责客户需求分析、产品设计与数据复盘。</td></tr><tr><td>任职要求：</td><td>熟悉腾讯、百度产品生态，本科及以上学历。</td></tr></table>`, "https://thirdparty.example/job/1234");
  assert.equal(result.parsed.company, "星河科技");
});

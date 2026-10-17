import test from "node:test";
import assert from "node:assert/strict";
import { readJobUrl } from "../lib/job-web-platforms.ts";
import { alibabaAdapter } from "../lib/job-web-adapters/alibaba.ts";

const source = "https://campus-talent.alibaba.com/campus/position/199904160010?deptCodes=";
const id = "199904160010";
const html = `<nav>登录 推荐岗位</nav><script>window.__sysconfig = {
  __token__: "csrf-for-test", circle: {"portalCampusChannel":"new_campus_group_official_site","portalOfficialChannel":"group_official_site","portalDomain":"https://untrusted.example"}
};window.untrustedExecuted=true;</script><div id="root"></div><footer>公司宣传 隐私政策</footer>`;
const cookies = "XSRF-TOKEN=csrf-for-test; SESSION=session-for-test";
const detail = {
  id: Number(id), name: "平台产品经理（AI应用）", status: "recruit", workLocations: ["北京"],
  description: "负责地图数据和AI应用相关产品的规划与设计，持续优化产品体验。",
  requirement: "计算机、人工智能相关专业优先，熟悉产品设计工具，具备良好沟通能力。",
  batchName: "阿里巴巴日常实习生", circleNames: ["高德地图"], degree: null, publishTime: null,
  graduationTime: { from: Date.parse("2027-06-01T00:00:00+08:00"), to: Date.parse("2030-01-01T00:00:00+08:00") },
  recommendations: [{ name: "其他推荐岗位" }], hrEmail: "HR_PRIVATE@example.com", operations: ["立即投递"],
};
function mock(payload, { pageHtml = html, cookie = cookies, redirect = false } = {}) {
  const calls = [];
  const fetcher = async (input, init) => {
    const url = new URL(input);calls.push({ url, init });
    if (url.pathname === "/position/detail") return Response.json(payload);
    if (url.hostname === "short.example" && redirect) return new Response(null, { status: 302, headers: { location: source, "set-cookie": "FOREIGN_SESSION=do-not-forward; Path=/" } });
    return new Response(pageHtml, { headers: { "content-type": "text/html", ...(cookie ? { "set-cookie": cookie.replace("; SESSION=", "; Path=/, SESSION=") + "; Path=/" } : {}) } });
  };
  return { fetcher, calls };
}

test("Alibaba reads the user's campus ID using its anonymous page session and configured channel", async () => {
  const { fetcher, calls } = mock({ success: true, content: detail });
  const result = await readJobUrl(source, fetcher);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url.origin, new URL(source).origin);
  assert.equal(calls[1].url.pathname, "/position/detail");
  assert.equal(calls[1].url.searchParams.get("_csrf"), "csrf-for-test");
  assert.deepEqual(JSON.parse(calls[1].init.body), { id, channel: "new_campus_group_official_site", language: "zh" });
  assert.equal(calls[1].init.headers.Cookie, cookies);
  assert.equal(result.parsed.company, "阿里巴巴");
  assert.equal(result.parsed.role, detail.name);
  assert.equal(result.parsed.location, "北京");
  assert.equal(result.parsed.nature, "日常实习");
  assert.equal(result.parsed.responsibilities, detail.description);
  assert.equal(result.parsed.requirements, detail.requirement);
  assert.equal(result.parsed.webDetails.department, "高德地图");
  assert.match(result.parsed.webDetails.otherInformation, /2027-06-01 至 2030-01-01/);
  assert.equal(result.parsed.applicationDeadline ?? "", "", "graduation end date is not an application deadline");
  assert.equal(result.parsed.sourceUrl, source);
  assert.equal(result.importSource.adapterId, "alibaba");
  assert.doesNotMatch(JSON.stringify(result), /csrf-for-test|session-for-test|FOREIGN_SESSION|SESSION|HR_PRIVATE|其他推荐岗位|公司宣传|隐私政策|立即投递|untrustedExecuted/);
});

test("Alibaba supports only known hosts and detail routes with an unambiguous numeric ID", () => {
  for (const url of [source, "https://talent-holding.alibaba.com/off-campus/position-detail?positionId=100031360010", "https://talent.taotian.com/campus/position-detail?positionId=199904160010", "https://talent.alibaba.com/campus/position/199904160010"]) assert.equal(alibabaAdapter.canHandle(new URL(url)), true, url);
  for (const url of ["https://campus-talent.alibaba.com/campus/position", "https://campus-talent.alibaba.com/campus/position?batchId=1001", source.replace("campus-talent.alibaba.com", "campus-talent.alibaba.com.evil.example"), source + "&positionId=11111111", "https://talent.alibaba.com/off-campus/position-detail?positionId=https://evil.example/"]) assert.equal(alibabaAdapter.canHandle(new URL(url)), false, url);
});

test("Anonymous cookies from a short-link host never reach the Alibaba API", async () => {
  const { fetcher, calls } = mock({ success: true, content: detail }, { redirect: true });
  await readJobUrl("https://short.example/share", fetcher);
  const request = calls.at(-1);
  assert.equal(request.url.origin, new URL(source).origin);
  assert.equal(request.init.headers.Cookie, cookies);
  assert.doesNotMatch(JSON.stringify(request.init), /FOREIGN_SESSION|do-not-forward/);
});

test("Missing page config or session fails before a guessed API request", async () => {
  for (const options of [{ pageHtml: "<main>请完成安全验证</main>" }, { cookie: "" }]) {
    const { fetcher, calls } = mock({ success: true, content: detail }, options);
    await assert.rejects(readJobUrl(source, fetcher), /阿里.*匿名会话/);
    assert.equal(calls.length, 1);
  }
});

test("Alibaba refuses wrong IDs, unavailable jobs, login responses and missing content", async () => {
  for (const patch of [{ id: 999999 }, { status: "closed" }, { description: "", requirement: "" }, { name: "" }]) {
    const { fetcher } = mock({ success: true, content: { ...detail, ...patch } });
    await assert.rejects(readJobUrl(source, fetcher), /阿里/);
  }
  for (const payload of [{ success: false, content: detail }, { success: true, content: null }, { relogin: true, success: false }]) {
    await assert.rejects(readJobUrl(source, mock(payload).fetcher), /阿里/);
  }
});

test("Alibaba social jobs use the social channel, explicit degree and real publication date", async () => {
  const url = "https://talent-holding.alibaba.com/off-campus/position-detail?positionId=100031360010";
  const { fetcher, calls } = mock({ success: true, content: { ...detail, id: 100031360010, status: null, name: "平台产品经理", batchName: null, degree: "bachelor", workLocations: ["北京", "杭州"], publishTime: Date.parse("2026-10-10T00:30:00+08:00") } });
  const result = await readJobUrl(url, fetcher);
  assert.equal(JSON.parse(calls.at(-1).init.body).channel, "group_official_site");
  assert.equal(result.parsed.webDetails.recruitmentType, "社招");
  assert.equal(result.parsed.webDetails.education, "本科");
  assert.equal(result.parsed.webDetails.datePosted, "2026-10-10");
  assert.equal(result.parsed.location, "北京、杭州");
});

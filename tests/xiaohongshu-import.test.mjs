import test from "node:test";
import assert from "node:assert/strict";
import { readJobUrl } from "../lib/job-web-platforms.ts";
import { xiaohongshuAdapter } from "../lib/job-web-adapters/xiaohongshu.ts";

const source = "https://job.xiaohongshu.com/campus/intern/position/21729";
const detail = {
  positionId: 21729, positionName: "AI策略产品经理实习", duty: "负责大模型智能体的产品策略设计，输出产品需求，持续优化用户体验。",
  qualification: "计算机相关专业优先。\n每周到岗5天，可连续实习6个月及以上。",
  recruitType: "intern_recruit", workplace: "北京市", workExperience: "no_limit", recruitStatus: "in_recruitment",
  recruitHRName: "HR_PRIVATE", recruitHREmail: "PRIVATE@example.com",
  recommendations: [{ positionName: "其他推荐岗位" }],
};
function mockFetch(data, calls = []) {
  return async (url) => {
    calls.push(String(url));
    if (String(url).includes("queryPositionDetail")) return Response.json(data);
    return new Response('<nav>登录注册</nav><div id="app"></div><footer>隐私政策</footer>', { headers: { "content-type": "text/html" } });
  };
}

test("Xiaohongshu uses the exact public detail ID, separates duties and requirements, and filters API noise", async () => {
  const calls = [];
  const result = await readJobUrl(source, mockFetch({ success: true, statusCode: 200, data: detail }, calls));
  assert.deepEqual(calls, [source, "https://job.xiaohongshu.com/websiterecruit/position/queryPositionDetail?positionId=21729"]);
  assert.equal(result.importSource.adapterId, "xiaohongshu");
  assert.equal(result.parsed.company, "小红书");
  assert.equal(result.parsed.role, detail.positionName);
  assert.equal(result.parsed.location, "北京市");
  assert.equal(result.parsed.nature, "日常实习");
  assert.equal(result.parsed.responsibilities, detail.duty);
  assert.match(result.parsed.requirements, /每周到岗5天/);
  assert.match(result.parsed.webDetails.weeklyAttendance, /每周到岗5天/);
  assert.match(result.parsed.webDetails.internshipDuration, /6个月/);
  assert.doesNotMatch(result.parsed.rawText, /HR_PRIVATE|PRIVATE@|推荐岗位|隐私政策|登录注册|no_limit|intern_recruit/);
  assert.equal(result.parsed.applicationDeadline ?? "", "");
});

test("Xiaohongshu accepts official campus, social and share detail routes, but excludes lists and lookalike domains", () => {
  for (const path of ["/social/position/21729", "/campus/position/21729", "/campus/intern/position/21729", "/campus/share/position/21729", "/campus/theme/position/21729", "/campus/intern/theme/position/21729"]) assert.equal(xiaohongshuAdapter.canHandle(new URL(path, source)), true, path);
  for (const url of ["https://job.xiaohongshu.com/campus/intern/position", "https://job.xiaohongshu.com/social/position?positionName=21729", "https://job.xiaohongshu.com.evil.example/campus/position/21729", "https://www.xiaohongshu.com/explore/21729"]) assert.equal(xiaohongshuAdapter.canHandle(new URL(url)), false, url);
});

test("Xiaohongshu refuses wrong IDs, offline jobs, failure payloads and incomplete details", async () => {
  for (const patch of [{ positionId: 12345 }, { recruitStatus: "closed" }, { recruitStatus: null }, { duty: "", qualification: "" }, { positionName: "" }]) {
    await assert.rejects(readJobUrl(source, mockFetch({ success: true, statusCode: 200, data: { ...detail, ...patch } })), /小红书/);
  }
  await assert.rejects(readJobUrl(source, mockFetch({ success: false, statusCode: 500, data: detail })), /小红书/);
});

test("Xiaohongshu recruitment type comes from the detail payload rather than the shared URL channel", async () => {
  const result = await readJobUrl(source, mockFetch({ success: true, statusCode: 200, data: { ...detail, positionName: "AI产品经理", recruitType: "school_recruit" } }));
  assert.equal(result.parsed.nature, "校招");
  assert.equal(result.parsed.webDetails.recruitmentType, "校招");
});

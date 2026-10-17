import test from "node:test";
import assert from "node:assert/strict";
import { parseJobText } from "../lib/job-parser.ts";

test("recognizes 岗位基本要求 as requirements", () => {
  const parsed = parseJobText(`美团｜产品运营实习生
工作地点：北京
工作内容：
1. 负责用户调研和竞品分析
岗位基本要求：
1. 本科及以上学历
2. 熟练使用 Excel，每周实习 4 天`);
  assert.equal(parsed.company, "美团");
  assert.equal(parsed.role, "产品运营实习生");
  assert.match(parsed.requirements ?? "", /本科及以上学历/);
  assert.match(parsed.responsibilities ?? "", /用户调研/);
});

test("infers an unstated internship nature from availability language", () => {
  const parsed = parseJobText(`招聘岗位：数据分析实习生
基本任职要求：每周到岗4天，可连续实习3个月
工作职责：负责经营数据分析`);
  assert.equal(parsed.nature, "日常实习");
});

test("parses compact webpage text without colon after section headings", () => {
  const parsed = parseJobText("字节跳动 产品运营实习生  工作地点：北京  岗位职责  1. 负责用户调研  2. 分析产品数据  岗位基本要求  1. 本科及以上  2. 每周实习4天，连续3个月");
  assert.equal(parsed.company, "字节跳动");
  assert.equal(parsed.role, "产品运营实习生");
  assert.equal(parsed.location, "北京");
  assert.match(parsed.responsibilities ?? "", /负责用户调研/);
  assert.match(parsed.requirements ?? "", /本科及以上/);
});

test("malformed input never throws", () => {
  assert.deepEqual(parseJobText(null), {});
  assert.deepEqual(parseJobText({ requirements: ["unexpected"] }), {});
});

test("recognizes common company names even when the heading is omitted", () => {
  const parsed = parseJobText(`2027届校园招聘\n百度\nAI产品经理实习生\n岗位职责\n负责AI产品需求分析`);
  assert.equal(parsed.company, "百度");
  assert.equal(parsed.role, "AI产品经理实习生");
});

test("normalizes a common employer legal entity to its brand", () => {
  const parsed = parseJobText(`公司名称：北京三快在线科技有限公司\n职位名称：产品运营实习生`);
  assert.equal(parsed.company, "美团");
});

test("keeps trailing webpage metadata out of job requirements", () => {
  const parsed = parseJobText(`滴滴\n产品实习生\n岗位要求\n2027届在校生，本科及以上学历\n熟练使用产品设计工具与AI工具\n每周不少于4天，能实习6个月以上\n职位信息\n学历要求\n本科\n发布日期\n2026-09-21\n职位性质\n实习\n所属部门\n实习生招聘项目`);
  assert.equal(parsed.company, "滴滴");
  assert.equal(parsed.nature, "日常实习");
  assert.match(parsed.requirements ?? "", /本科及以上学历/);
  assert.match(parsed.requirements ?? "", /学历要求：本科/);
  assert.doesNotMatch(parsed.requirements ?? "", /发布日期|2026-09-21|职位性质|所属部门|实习生招聘项目/);
});

test("splits compact inline metadata after requirements", () => {
  const parsed = parseJobText("美团 产品经理实习生  岗位要求：本科及以上，熟悉数据分析 发布日期：2026-10-10 职位性质：日常实习 投递截止日期：2026-10-31");
  assert.equal(parsed.company, "美团");
  assert.equal(parsed.nature, "日常实习");
  assert.equal(parsed.applicationDeadline, "2026-10-31");
  assert.match(parsed.requirements ?? "", /熟悉数据分析/);
  assert.doesNotMatch(parsed.requirements ?? "", /发布日期|2026-10-10|职位性质|投递截止/);
});

test("an explicit unknown employer wins over a competitor mentioned in requirements", () => {
  const parsed = parseJobText(`公司：星河科技\n岗位：策略产品实习生\n岗位要求：熟悉美团、百度和滴滴等本地生活产品`);
  assert.equal(parsed.company, "星河科技");
});

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

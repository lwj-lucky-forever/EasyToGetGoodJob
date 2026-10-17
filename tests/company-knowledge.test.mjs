import test from "node:test";
import assert from "node:assert/strict";
import { inferKnownCompany, normalizeKnownCompany } from "../lib/company-knowledge.mjs";

test("normalizes common brand aliases and legal entities", () => {
  assert.equal(normalizeKnownCompany("美团点评"), "美团");
  assert.equal(normalizeKnownCompany("北京百度网讯科技有限公司"), "百度");
  assert.equal(normalizeKnownCompany("滴滴出行"), "滴滴");
});

test("recognizes an employer from an official recruiting domain", () => {
  assert.equal(inferKnownCompany("", "https://zhaopin.meituan.com/job/123"), "美团");
  assert.equal(inferKnownCompany("", "https://talent.didiglobal.com/campus"), "滴滴");
});

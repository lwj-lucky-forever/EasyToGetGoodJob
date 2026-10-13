import test from "node:test";
import assert from "node:assert/strict";
import { groupJobsByCompany, numberGroupedJobs } from "../lib/job-order.ts";

test("groups company jobs and preserves custom order", () => {
  const jobs = [
    { id: 1, company: "百度", companyOrder: 1, jobOrder: 1 },
    { id: 2, company: "美团", companyOrder: 0, jobOrder: 1 },
    { id: 3, company: "美团 ", companyOrder: 0, jobOrder: 0 },
  ];
  const groups = groupJobsByCompany(jobs);
  assert.deepEqual(groups.map((group) => group.company), ["美团", "百度"]);
  assert.deepEqual(groups[0].jobs.map((job) => job.id), [3, 2]);
});

test("renumbers company and job order after a move", () => {
  const groups = groupJobsByCompany([
    { id: 2, company: "美团", companyOrder: 0, jobOrder: 1 },
    { id: 3, company: "美团", companyOrder: 0, jobOrder: 0 },
    { id: 1, company: "百度", companyOrder: 1, jobOrder: 0 },
  ]);
  groups.reverse();
  const numbered = numberGroupedJobs(groups);
  assert.deepEqual(numbered.map(({ id, companyOrder, jobOrder }) => ({ id, companyOrder, jobOrder })), [
    { id: 1, companyOrder: 0, jobOrder: 0 },
    { id: 3, companyOrder: 1, jobOrder: 0 },
    { id: 2, companyOrder: 1, jobOrder: 1 },
  ]);
});

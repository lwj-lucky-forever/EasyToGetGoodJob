import test from "node:test";
import assert from "node:assert/strict";
import { groupJobsByCompany, numberGroupedJobs, orderJobGroups, hasStoredCustomOrder } from "../lib/job-order.ts";

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

const sample = () => [
  { id: 1, company: "百度", companyOrder: 0, jobOrder: 0, matchScore: 30 },
  { id: 2, company: "百度", companyOrder: 0, jobOrder: 1, matchScore: 85 },
  { id: 3, company: "美团", companyOrder: 1, jobOrder: 0, matchScore: 95 },
];
test("default order ranks company groups and their jobs by match without mutating saved positions", () => {
  const jobs = sample(), before = structuredClone(jobs);
  const groups = orderJobGroups(jobs, "match");
  assert.deepEqual(groups.map((g) => g.company), ["美团", "百度"]);
  assert.deepEqual(groups[1].jobs.map((j) => j.id), [2, 1]);
  assert.deepEqual(jobs, before);
});

test("automatically allocated nonzero orders do not imply manual reordering", () => {
  assert.equal(hasStoredCustomOrder(sample()), false);
  assert.equal(hasStoredCustomOrder([...sample()].reverse()), false);
  assert.equal(hasStoredCustomOrder(sample().map((j) => ({ ...j, companyOrder: 0, jobOrder: 0 }))), false);
});

test("legacy saved job or company moves are conservatively preserved", () => {
  assert.equal(hasStoredCustomOrder(sample().map((j) => j.company === "百度" ? { ...j, jobOrder: 1 - j.jobOrder } : j)), true);
  assert.equal(hasStoredCustomOrder(sample().map((j) => ({ ...j, companyOrder: 1 - j.companyOrder }))), true);
});

test("a first manual move is based on the visible match order, not old insertion positions", () => {
  const groups = orderJobGroups(sample(), "match");
  const group = groups.find((g) => g.company === "百度");
  [group.jobs[0], group.jobs[1]] = [group.jobs[1], group.jobs[0]];
  const saved = numberGroupedJobs(groups);
  assert.deepEqual(orderJobGroups(saved, "custom").flatMap((g) => g.jobs.map((j) => j.id)), [3, 1, 2]);
});

test("new high-score jobs auto-insert by match but append without disturbing custom positions", () => {
  const added = { id: 4, company: "百度", companyOrder: 0, jobOrder: 2, matchScore: 100 };
  const jobs = [added, ...sample()];
  assert.deepEqual(orderJobGroups(jobs, "match")[0].jobs.map((j) => j.id), [4, 2, 1]);
  assert.deepEqual(orderJobGroups(jobs, "custom")[0].jobs.map((j) => j.id), [1, 2, 4]);
  const newCompany = { ...added, company: "小米", companyOrder: 2, jobOrder: 0 };
  assert.deepEqual(orderJobGroups([newCompany, ...sample()], "custom").map((g) => g.company), ["百度", "美团", "小米"]);
});

test("match-score changes and filtering never overwrite custom positions", () => {
  const jobs = sample().map((j) => ({ ...j, matchScore: 100 - j.matchScore }));
  const order = orderJobGroups(jobs, "custom").flatMap((g) => g.jobs);
  assert.deepEqual(order.map((j) => j.id), [1, 2, 3]);
  assert.deepEqual(order.filter((j) => j.id !== 1).map((j) => j.id), [2, 3]);
});

test("equal match scores have a deterministic order regardless of arrival order", () => {
  const jobs = sample().map((j) => ({ ...j, matchScore: 80 }));
  assert.deepEqual(orderJobGroups(jobs, "match"), orderJobGroups([...jobs].reverse(), "match"));
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

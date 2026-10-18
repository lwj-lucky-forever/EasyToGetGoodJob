import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeJob, analysisInputKey, presentJob, generatePrepChecklist } from '../lib/resume-matcher.ts';
import { resolveResumeProfile } from '../lib/resume-profiles.ts';

const job = { role: '数据分析实习生', responsibilities: '', requirements: '熟练使用 Python 和 SQL\n掌握 Excel 数据分析', competencies: '', rawText: '', resumeVersion: '数据分析版' };
const resumeA = { name: '通用版', content: '测试简历甲：本科。使用 Python 和 SQL 完成数据分析，使用 Excel 制作报表。', updatedAt: '2026-10-01T10:00:00Z' };
const resumeB = { name: '通用版', content: '测试简历乙：本科。负责校园活动宣传、文案写作与用户访谈。', updatedAt: '2026-10-18T10:00:00Z' };

test('missing version uses saved general, then latest actual resume, never a personal default', () => {
  assert.equal(resolveResumeProfile([resumeA], '产品版').content, resumeA.content);
  const product = { ...resumeB, name: '产品版' };
  assert.equal(resolveResumeProfile([resumeA, product], '产品版').content, product.content);
  assert.equal(resolveResumeProfile([product], '数据分析版').name, '产品版');
  assert.equal(resolveResumeProfile([{ ...resumeA, name: '运营版' }, product], '数据分析版').name, '产品版');
  assert.deepEqual(resolveResumeProfile([], '通用版'), { name: null, content: '', updatedAt: '' });
});

test('changing resumes changes score, evidence, strengths and preparation, without old-person claims', () => {
  const a = analyzeJob(job, resumeA);
  const b = analyzeJob(job, resumeB);
  assert.equal(a.score, 100);
  assert.equal(b.score, 0);
  assert.match(a.requirements[0].evidence, /Python/);
  assert.doesNotMatch(b.requirements[0].evidence, /当前简历原文/);
  assert.notDeepEqual(a.strengths, b.strengths);
  assert.equal(generatePrepChecklist(a).length, 0);
  assert.ok(generatePrepChecklist(b).length > 0);
  assert.doesNotMatch(JSON.stringify(b), /刘尉婕|6\/74|北京航空航天大学|灭火效能|研学带队/);
});

test('version name alone never boosts a score', () => {
  assert.equal(analyzeJob(job, resumeA).score, analyzeJob({ ...job, resumeVersion: '运营版' }, resumeA).score);
});

test('no resume or missing requirements are unassessed, not fabricated baseline scores', () => {
  const empty = analyzeJob(job, resolveResumeProfile([], '通用版'));
  assert.equal(empty.score, 0);
  assert.ok(empty.requirements.every(item => item.fit === '待确认'));
  assert.match(empty.summary, /尚未保存简历/);
  assert.equal(analyzeJob({ ...job, requirements: '' }, resumeA).score, 0);
});

test('education, time and negated skill evidence are based on the actual resume', () => {
  const single = requirements => ({ ...job, requirements });
  assert.equal(analyzeJob(single('硕士及以上学历'), resumeB).score, 0);
  assert.equal(analyzeJob(single('本科及以上学历'), { ...resumeA, content: '教育：博士在读。' }).score, 100);
  assert.equal(analyzeJob(single('每周到岗4天，连续实习6个月'), { ...resumeA, content: '每周到岗3天，连续实习3个月。' }).score, 0);
  assert.equal(analyzeJob(single('熟练使用 SQL'), { ...resumeA, content: '尚未掌握 SQL，负责校园活动。' }).score, 0);
  assert.equal(analyzeJob(single('熟练使用 Java'), { ...resumeA, content: '使用 JavaScript 开发网站。' }).score, 0);
});

test('fingerprint changes for text even with the same timestamp, source version, JD or selected version', async () => {
  const key = await analysisInputKey(job, resumeA);
  for (const [j, r] of [[job, { ...resumeA, content: resumeB.content }], [job, { ...resumeA, name: '产品版' }], [{ ...job, requirements: '熟悉 Figma 原型设计' }, resumeA], [{ ...job, resumeVersion: '产品版' }, resumeA]]) {
    assert.notEqual(await analysisInputKey(j, r), key);
  }
});

test('read path invalidates old caches and replaces old checklist; valid cache is reused', async () => {
  const keyA = await analysisInputKey(job, resumeA);
  const a = analyzeJob(job, resumeA, keyA);
  const stored = { ...job, analysisJson: JSON.stringify(a), prepChecklistJson: '[]', processRecordsJson: '[]', jobOrder: 9 };
  assert.equal(presentJob(stored, resumeA, keyA).matchAnalysis.analyzedAt, a.analyzedAt);
  const b = presentJob(stored, resumeB, await analysisInputKey(job, resumeB));
  assert.equal(b.matchScore, 0);
  assert.equal(b.jobOrder, 9);
  assert.ok(b.prepChecklist.length);
  assert.equal(b.matchAnalysis.resumeSource.updatedAt, resumeB.updatedAt);
  const legacy = presentJob({ ...stored, analysisJson: JSON.stringify({ ...a, version: 4 }), prepChecklistJson: JSON.stringify([{ id: 'old', text: '旧个人建议', done: false, category: '行动' }]) }, resumeA, keyA);
  assert.doesNotMatch(JSON.stringify(legacy), /旧个人建议/);
  assert.equal(legacy.matchAnalysis.version, 5);
});

test('recalculation preserves completed tasks that still apply and process records', async () => {
  const a = analyzeJob(job, resumeB);
  const checklist = generatePrepChecklist(a).map(item => ({ ...item, done: true }));
  const records = [{ id: 'interview', type: '一面', scheduledAt: '2026-10-20T10:00', status: '待进行', notes: '真实记录', result: '' }];
  const presented = presentJob({ ...job, analysisJson: '', prepChecklistJson: JSON.stringify(checklist), processRecordsJson: JSON.stringify(records) }, resumeB, await analysisInputKey(job, resumeB));
  assert.ok(presented.prepChecklist.every(item => item.done));
  assert.deepEqual(presented.processRecords, records);
});

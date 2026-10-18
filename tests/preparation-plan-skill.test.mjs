import test from 'node:test';
import assert from 'node:assert/strict';
import { buildJobAnalysisInput } from '../lib/job-analysis-skill.ts';
import { buildResumeTailoringInput, createResumeTailoringResult } from '../lib/resume-tailoring-skill.ts';
import { buildPreparationPlanInput, validatePreparationPlanOutput, prepareChecklistMerge } from '../lib/preparation-plan-skill.ts';
import { sanitizePrepChecklist } from '../lib/job-workflow.ts';

// Synthetic source material and handwritten plans; no model calls or personal data.
const quote = (text) => ({ source_field: 'requirements', quote: text });
const claim = (text) => ({ text, basis: 'explicit', reason: '岗位明确要求。', evidence: [quote(text)] });
async function fixture({ existingChecklist = [], planning = {}, resumeExtra = '' } = {}) {
  const jobInput = buildJobAnalysisInput({ requirements: '熟悉 SQL。硕士及以上学历。熟悉 Figma 者优先。' });
  const jobAnalysis = {
    summary: '测试岗位', core_responsibilities: [], must_have: [claim('熟悉 SQL'), claim('硕士及以上学历')],
    nice_to_have: [claim('熟悉 Figma')], implicit_requirements: [], skills: [],
    constraints: Object.fromEntries(['education','major','city','internship_duration','weekly_attendance','language','experience','salary','start_date','recruitment_type'].map((key) => [key, null])),
    top_hiring_signals: [claim('熟悉 SQL')], uncertainties: [],
  };
  const tailoringInput = await buildResumeTailoringInput({ jobInput, jobAnalysis, resume: { name: '通用版', updatedAt: '2026-10-18T00:00:00Z', content: `本科在读。熟悉 Figma，做过课程原型。${resumeExtra}` } });
  const degree = [{ resume_section: '未分段', quote: '本科在读。' }];
  const tailoringResult = createResumeTailoringResult({
    overall_assessment: 'SQL 证据待核实，学历与门槛存在冲突。',
    requirement_evidence_map: [
      { requirement_ref: '/must_have/0', related_job_requirement: '熟悉 SQL', status: 'gap', reason: '未写 SQL。', needs_confirmation: true, evidence_source: [] },
      { requirement_ref: '/must_have/1', related_job_requirement: '硕士及以上学历', status: 'gap', reason: '本科在读与硕士要求冲突。', needs_confirmation: false, evidence_source: degree },
      { requirement_ref: '/nice_to_have/0', related_job_requirement: '熟悉 Figma', status: 'matched', reason: '有课程原型证据。', needs_confirmation: false, evidence_source: [{ resume_section: '未分段', quote: '熟悉 Figma，做过课程原型。' }] },
    ], rewrite_suggestions: [],
    gaps: [
      { requirement_ref: '/must_have/0', type: 'evidence_gap', reason: '请核实是否有真实案例。', needs_confirmation: true, evidence_source: [] },
      { requirement_ref: '/must_have/1', type: 'qualification_gap', reason: '学历存在明确冲突。', needs_confirmation: false, evidence_source: degree },
    ], final_notes: ['按已有材料判断。'],
  }, tailoringInput);
  const options = { tailoringInput, tailoringResult, existingChecklist, planning: { today: '2026-10-18', target_date: null, available_minutes: null, ...planning } };
  return { input: await buildPreparationPlanInput(options), options };
}
function plan() {
  return {
    plan_summary: '先核实资格风险，仅保留当前最有价值的一项准备，不凑足五项。',
    tasks: [{ title: '整理 Figma 课程原型讲解提纲', type: 'interview', description: '对照已有课程原型，整理设计目标、操作流程和反思，练习一次讲解。', deliverable: '一份课程原型讲解提纲', reason: '已有工具使用证据，可准备具体案例。', related_requirement: '/nice_to_have/0', priority: 'low', estimated_time_minutes: 30, due_date: null, status: 'pending', source: { kind: 'requirement', ref: '/nice_to_have/0' }, needs_confirmation: false }],
    risks: [{ requirement_ref: '/must_have/1', gap_ref: '/gaps/1', description: '学历与门槛冲突，需核实招聘条件，不能通过改写补足。' }],
  };
}
function sqlTask() {
  return { title: '核实 SQL 案例并整理练习提纲', type: 'knowledge', description: '先核实是否有真实 SQL 案例，再列出需要练习的查询题，不宣称已经掌握。', deliverable: '一份待核实案例及查询练习提纲', reason: '必要条件尚缺支持证据。', related_requirement: '/must_have/0', priority: 'high', estimated_time_minutes: 45, due_date: null, status: 'pending', source: { kind: 'gap', ref: '/gaps/0' }, needs_confirmation: true };
}

test('input validates upstream versions and excludes full resume/JD without changing sources', async () => {
  const { input, options } = await fixture();
  assert.equal('resume' in input, false); assert.equal('jobInput' in input, false);
  assert.deepEqual(input.job_analysis, options.tailoringInput.job_analysis);
  assert.equal(input.context.input_key.length, 64);
  const newer = await fixture({ resumeExtra: '新增经历。' });
  await assert.rejects(buildPreparationPlanInput({ ...options, tailoringInput: newer.options.tailoringInput }), /已变化/);
  const bad = structuredClone(options); bad.tailoringResult.output.gaps[0].requirement_ref = '/must_have/99';
  await assert.rejects(buildPreparationPlanInput(bad), /无效/);
});

test('valid plan converts to existing checklist format and round-trips through sanitizer', async () => {
  const { input } = await fixture(); const value = plan();
  assert.equal(validatePreparationPlanOutput(JSON.stringify(value), input).success, true);
  const merged = await prepareChecklistMerge(value, input);
  assert.equal(merged.added.length, 1); assert.equal(merged.checklist[0].done, false);
  assert.equal(merged.checklist[0].category, '行动');
  assert.deepEqual(sanitizePrepChecklist(merged.checklist), merged.checklist);
  assert.match(merged.checklist[0].text, /交付物：|预计 30 分钟/);
  assert.equal(input.existing_checklist.length, 0);
});

test('completed legacy tasks and stable IDs are deduplicated without changing completion or order', async () => {
  const old = { id: 'legacy', text: plan().tasks[0].title, done: true, category: '行动' };
  const { input } = await fixture({ existingChecklist: [old] });
  const merged = await prepareChecklistMerge(plan(), input);
  assert.deepEqual(merged.checklist, [old]); assert.equal(merged.skipped.length, 1);
  const first = await prepareChecklistMerge(plan(), (await fixture()).input);
  first.checklist[0].done = true;
  const next = await fixture({ existingChecklist: first.checklist });
  const changedWording = plan(); changedWording.tasks[0].title = '编写原型展示提纲';
  const second = await prepareChecklistMerge(changedWording, next.input);
  assert.equal(second.added.length, 0); assert.equal(second.checklist[0].done, true);
});

test('pending confirmation is separated and adopted explicitly; must-have sorts before nice-to-have', async () => {
  const { input } = await fixture(); const value = plan(); value.tasks.push(sqlTask());
  const before = await prepareChecklistMerge(value, input);
  assert.equal(before.added.length, 1); assert.equal(before.pending_confirmation.length, 1);
  const after = await prepareChecklistMerge(value, input, [before.pending_confirmation[0].id]);
  assert.equal(after.added[0].category, '知识'); assert.match(after.added[0].text, /SQL/);
  assert.equal(after.added[1].category, '行动');
  await assert.rejects(prepareChecklistMerge(value, input, ['unknown']), /以外/);
});

test('expression gaps reuse validated mapping and produce resume preparation without rematching', async () => {
  const { options } = await fixture();
  const updated = structuredClone(options.tailoringResult.output);
  updated.requirement_evidence_map[2].status = 'weak_match';
  updated.gaps.push({ requirement_ref: '/nice_to_have/0', type: 'expression_gap', reason: '课程原型的个人贡献表达不足。', needs_confirmation: false, evidence_source: structuredClone(updated.requirement_evidence_map[2].evidence_source) });
  const tailoringResult = createResumeTailoringResult(updated, options.tailoringInput);
  const input = await buildPreparationPlanInput({ ...options, tailoringResult });
  const value = plan(); value.tasks[0].type = 'resume'; value.tasks[0].source = { kind: 'gap', ref: '/gaps/2' };
  assert.equal(validatePreparationPlanOutput(value, input).success, true);
  const merged = await prepareChecklistMerge(value, input);
  assert.equal(merged.added.length, 1);
  assert.equal(input.resume_tailoring.requirement_evidence_map[2].status, 'weak_match');
});

test('rejects generic, duplicate, fabricated requirement and ungrounded priority tasks', async () => {
  const { input } = await fixture();
  for (const change of [
    (p) => { p.tasks[0].title = '多了解公司'; p.tasks[0].description = '多了解公司，多准备面试。'; p.tasks[0].deliverable = '提升能力'; },
    (p) => { p.tasks.push(structuredClone(p.tasks[0])); },
    (p) => { p.tasks.push({ ...p.tasks[0], title: '编写另一种说法的同一任务' }); },
    (p) => { p.tasks[0].related_requirement = '/must_have/99'; },
    (p) => { p.tasks[0].priority = 'high'; },
    (p) => { p.tasks[0].source = { kind: 'hiring_signal', ref: '/top_hiring_signals/0' }; p.tasks[0].priority = 'high'; },
    (p) => { p.tasks[0].source = { kind: 'gap', ref: '/gaps/0' }; },
    (p) => { p.tasks[0].status = 'completed'; },
    (p) => { p.tasks.push({ ...sqlTask(), needs_confirmation: false }); },
  ]) { const value = plan(); change(value); assert.equal(validatePreparationPlanOutput(value, input).success, false); }
});

test('dates require an explicit valid target; budget is total available time and zero is allowed', async () => {
  const value = plan(); value.tasks[0].due_date = '2026-10-20';
  assert.equal(validatePreparationPlanOutput(value, (await fixture()).input).success, false);
  for (const description of ['请在2026-10-20完成原型提纲并录制讲解。', '请在10月20日完成原型提纲并录制讲解。']) {
    const hiddenDate = plan(); hiddenDate.tasks[0].description = description;
    assert.equal(validatePreparationPlanOutput(hiddenDate, (await fixture()).input).success, false);
  }
  const { input } = await fixture({ planning: { target_date: '2026-10-21', available_minutes: 30 } });
  assert.equal(validatePreparationPlanOutput(value, input).success, true);
  for (const date of ['2026-10-17', '2026-10-22', '2026-02-30']) { value.tasks[0].due_date = date; assert.equal(validatePreparationPlanOutput(value, input).success, false); }
  assert.equal(validatePreparationPlanOutput(plan(), (await fixture({ planning: { available_minutes: 20 } })).input).success, false);
  const empty = plan(); empty.tasks = [];
  assert.equal(validatePreparationPlanOutput(empty, (await fixture({ planning: { available_minutes: 0 } })).input).success, true);
  await assert.rejects(fixture({ planning: { target_date: '2026-10-17' } }), /日期/);
  await assert.rejects(fixture({ planning: { available_minutes: -1 } }), /可用时间/);
  for (const minutes of [0, -1, 1.5, NaN, 481]) { const invalid = plan(); invalid.tasks[0].estimated_time_minutes = minutes; assert.equal(validatePreparationPlanOutput(invalid, input).success, false); }
});

test('qualification gap remains a risk and can only produce a confirmation follow-up', async () => {
  const { input } = await fixture();
  const missing = plan(); missing.risks = []; assert.equal(validatePreparationPlanOutput(missing, input).success, false);
  const falseRisk = plan(); falseRisk.risks[0].gap_ref = '/gaps/0'; assert.equal(validatePreparationPlanOutput(falseRisk, input).success, false);
  const task = { ...sqlTask(), title: '核实学历资格条件', type: 'follow_up', description: '核对岗位学历门槛，整理需要向招聘方确认的问题，不承诺已经满足条件。', deliverable: '一份学历条件核实问题清单', related_requirement: '/must_have/1', source: { kind: 'gap', ref: '/gaps/1' } };
  const valid = plan(); valid.tasks = [task];
  const merged = await prepareChecklistMerge(valid, input); assert.equal(merged.pending_confirmation.length, 1); assert.equal(merged.added.length, 0);
  valid.tasks[0] = { ...task, type: 'knowledge', title: '完成硕士资格补齐' };
  assert.equal(validatePreparationPlanOutput(valid, input).success, false);
});

test('capacity and malformed plans fail explicitly instead of truncating existing tasks', async () => {
  const old = Array.from({ length: 40 }, (_, i) => ({ id: `old-${i}`, text: `已有任务${i}`, done: i % 2 === 0, category: '行动' }));
  const before = structuredClone(old); const { input } = await fixture({ existingChecklist: old });
  await assert.rejects(prepareChecklistMerge(plan(), input), /超过 40/); assert.deepEqual(old, before);
  await assert.rejects(fixture({ existingChecklist: [{ id: 'long', text: 'a'.repeat(1001), done: false, category: '行动' }] }), /不会静默截断/);
  for (const value of [null, {}, [], '```json\n{}\n```', { ...plan(), unknown: true }]) assert.equal(validatePreparationPlanOutput(value, input).success, false);
  const excess = plan(); excess.tasks = Array.from({ length: 9 }, (_, i) => ({ ...excess.tasks[0], title: `整理第${i}个主题`, deliverable: `第${i}份独立主题讲解稿` }));
  assert.equal(validatePreparationPlanOutput(excess, input).success, false);
});

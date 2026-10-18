import test from 'node:test';
import assert from 'node:assert/strict';

// Opt-in only: run against a fresh Wrangler database, never the user's local state.
const base = process.env.RESUME_TEST_URL;
test('resume save, fallback, scope, persistent recalculation and job edits through real APIs', { skip: !base }, async () => {
  assert.equal(base, 'http://127.0.0.1:8788');
  const owner = 'resume-regression-test';
  async function api(path, method = 'GET', body) {
    const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', 'oai-authenticated-user-id': owner }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    assert.ok(response.ok, `${method} ${path}: ${response.status} ${data.error ?? ''}`);
    return data;
  }
  assert.equal((await api('/api/jobs')).jobs.length, 0, 'requires a fresh isolated test database');
  assert.ok((await api('/api/resumes')).profiles.every(profile => !profile.content));
  assert.equal((await fetch(`${base}/api/jobs`)).status, 401);
  const template = { company: '回归测试公司', role: '数据分析实习生', requirements: '熟练使用 Python 和 SQL\n掌握 Excel 数据分析', status: '准备中' };
  const ids = [];
  for (const resumeVersion of ['通用版', '产品版']) {
    const { job } = await api('/api/jobs', 'POST', { ...template, resumeVersion });
    ids.push(job.id);
    assert.equal(job.matchScore, 0);
    assert.equal(job.matchAnalysis.resumeSource.name, null);
  }
  const before = (await api('/api/jobs')).jobs;
  const strong = '测试简历甲：本科，使用 Python 和 SQL 完成数据分析，使用 Excel 制作报表。';
  const weak = '测试简历乙：本科，负责校园活动宣传、文案写作与用户访谈。';
  const savedA = await api('/api/resumes', 'PUT', { name: '通用版', content: strong });
  assert.equal(savedA.updatedJobs, 2);
  assert.equal(savedA.refreshPending, false);
  assert.ok((await api('/api/jobs')).jobs.every(job => job.matchScore === 100));
  const savedB = await api('/api/resumes', 'PUT', { name: '通用版', content: weak });
  assert.equal(savedB.updatedJobs, 2);
  const afterB = (await api('/api/jobs')).jobs;
  for (const job of afterB) {
    assert.equal(job.matchScore, 0);
    assert.ok(job.prepChecklist.length);
    assert.equal(job.matchAnalysis.resumeSource.updatedAt, savedB.profile.updatedAt);
    assert.doesNotMatch(JSON.stringify(job.matchAnalysis), /刘尉婕|6\/74|北京航空航天大学/);
    const original = before.find(item => item.id === job.id);
    for (const field of ['companyOrder', 'jobOrder', 'updatedAt', 'status']) assert.equal(job[field], original[field]);
  }
  // A real saved named version stays selected when apply-to-all is unchecked.
  await api('/api/resumes', 'PUT', { name: '产品版', content: strong, applyToAllJobs: false });
  const mixed = (await api('/api/jobs')).jobs;
  assert.equal(mixed.find(job => job.id === ids[0]).matchScore, 0);
  assert.equal(mixed.find(job => job.id === ids[1]).matchScore, 100);
  // Opting in switches all jobs without overwriting the other saved resume.
  await api('/api/resumes', 'PUT', { name: '通用版', content: weak, applyToAllJobs: true });
  assert.ok((await api('/api/jobs')).jobs.every(job => job.resumeVersion === '通用版' && job.matchScore === 0));
  assert.equal((await api('/api/resumes')).profiles.find(profile => profile.name === '产品版').content, strong);
  const current = (await api('/api/jobs')).jobs.find(job => job.id === ids[0]);
  const records = [{ id: 'test-interview', type: '一面', scheduledAt: '2026-11-01T10:00', status: '待进行', notes: '保留面试记录', result: '' }];
  await api(`/api/jobs/${ids[0]}`, 'PATCH', { prepChecklist: current.prepChecklist.map(item => ({ ...item, done: true })), processRecords: records });
  const reanalyzed = (await api(`/api/jobs/${ids[0]}/analyze`, 'POST')).job;
  assert.equal(reanalyzed.matchScore, 0);
  assert.ok(reanalyzed.prepChecklist.every(item => item.done));
  assert.deepEqual(reanalyzed.processRecords, records);
  const edited = (await api(`/api/jobs/${ids[0]}`, 'PATCH', { requirements: '具有文案写作经验\n熟悉用户访谈' })).job;
  assert.equal(edited.matchScore, 100);
  assert.notEqual(edited.matchAnalysis.inputKey, reanalyzed.matchAnalysis.inputKey);
  const persisted = (await api('/api/jobs')).jobs.find(job => job.id === edited.id);
  assert.equal(persisted.matchAnalysis.inputKey, edited.matchAnalysis.inputKey);
  assert.deepEqual(persisted.processRecords, records);
  for (const id of ids) await api(`/api/jobs/${id}`, 'DELETE');
});

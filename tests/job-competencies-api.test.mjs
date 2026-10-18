import test from 'node:test';
import assert from 'node:assert/strict';

const base = process.env.RESUME_TEST_URL;
test('legacy empty abilities are filled and persisted, preserving manual text and job records', { skip: !base }, async () => {
  assert.equal(base, 'http://127.0.0.1:8788', 'use only the isolated test Worker');
  const company = '能力字段回归测试专用公司';
  async function api(path, method = 'GET', body) {
    const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', 'oai-authenticated-user-id': 'resume-regression-test' }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    assert.ok(response.ok, `${method} ${path}: ${response.status}`);
    return data;
  }
  assert.ok(!(await api('/api/data-backup')).jobs.some(job => job.company === company));
  const records = [{ id: 'real-interview', type: '一面', scheduledAt: '2026-11-01T10:00', status: '待进行', notes: '需要保留的面试记录', result: '' }];
  const legacy = { company, role: '产品实习生', responsibilities: '负责用户访谈和需求分析，使用 Figma 完成原型设计。', requirements: '本科在读，熟悉 SQL 数据分析，具备沟通协调能力。', competencies: '', status: '面试', resumeVersion: '通用版', jobOrder: 7, companyOrder: 3, processRecordsJson: JSON.stringify(records), updatedAt: '2026-10-01T00:00:00Z' };
  let ids = [];
  try {
    await api('/api/data-backup', 'POST', { mode: 'merge', snapshot: { app: 'EasyToGetGoodJob', schemaVersion: 1, jobs: [legacy, { ...legacy, role: '手动填写的测试岗位', competencies: '手动保留的专项考察能力' }], resumes: [], interviewReviews: [] } });
    const before = (await api('/api/data-backup')).jobs.filter(job => job.company === company);
    ids = before.map(job => job.id);
    assert.equal(before.length, 2);
    assert.equal(before.find(job => job.role === legacy.role).competencies, '');
    const displayed = (await api('/api/jobs')).jobs.filter(job => job.company === company);
    const derived = displayed.find(job => job.role === legacy.role);
    assert.match(derived.competencies, /用户研究与需求分析/);
    assert.match(derived.competencies, /数据处理与分析/);
    assert.match(derived.competencies, /产品设计与原型/);
    const exported = (await api('/api/data-backup')).jobs.filter(job => job.company === company);
    assert.equal(exported.find(job => job.id === derived.id).competencies, derived.competencies, 'raw database export confirms persistence');
    assert.equal(exported.find(job => job.role !== legacy.role).competencies, '手动保留的专项考察能力');
    for (const row of exported) {
      const original = before.find(job => job.id === row.id);
      for (const key of ['status', 'jobOrder', 'companyOrder', 'processRecordsJson', 'updatedAt', 'resumeVersion', 'requirements', 'responsibilities']) assert.equal(row[key], original[key], key);
    }
    assert.deepEqual(derived.processRecords, records);
  } finally {
    for (const id of ids) await api(`/api/jobs/${id}`, 'DELETE');
  }
});

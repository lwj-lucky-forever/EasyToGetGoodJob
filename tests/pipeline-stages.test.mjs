import test from 'node:test';
import assert from 'node:assert/strict';
import { PIPELINE_STAGES, pipelineStageFor, readPipelineNotes, writePipelineNotes } from '../lib/pipeline-stages.ts';
import { sanitizeProcessRecords } from '../lib/job-workflow.ts';

test('six stages retain every legacy job without a migration', () => {
  assert.deepEqual(PIPELINE_STAGES.map(item => item.title), ['待投递','准备中','笔试','面试','Offer','未通过']);
  for (const status of ['未投递','准备中','已投递','笔试','面试','Offer','暂停']) assert.ok(PIPELINE_STAGES.some(item => item.slug === pipelineStageFor(status)));
  assert.equal(pipelineStageFor('已投递'), 'prepare');
});
test('stage details survive existing server sanitizer and JSON backup roundtrip', () => {
  const existing = [{ id:'original',type:'一面',scheduledAt:'2026-11-01T10:00',status:'待进行',notes:'原有笔记',result:'' }];
  const before=structuredClone(existing);
  const offer={location:'北京海淀区',salary:'200元/天',hours:'9:30–18:30，至少3个月',days:'每周4天',startDate:'2026-11-01'};
  const saved=writePipelineNotes(existing,'offer',offer);
  const recovered=sanitizeProcessRecords(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(readPipelineNotes(recovered,'offer'), offer);
  assert.deepEqual(existing,before);
  assert.deepEqual(recovered[0],before[0]);
  assert.equal(recovered[1].scheduledAt,'');
  const updated=writePipelineNotes(recovered,'offer',{...offer,salary:'250元/天'});
  assert.equal(updated.length,2);
  assert.equal(readPipelineNotes(updated,'offer').salary,'250元/天');
});
test('resume and rejection notes remain job-specific stage records', () => {
  let records=writePipelineNotes([],'apply',{resume:'只包含真实经历的岗位专属简历'});
  records=writePipelineNotes(records,'closed',{reason:'暂未收到明确反馈',nextAction:'补充项目指标'});
  assert.equal(readPipelineNotes(records,'apply').resume,'只包含真实经历的岗位专属简历');
  assert.equal(readPipelineNotes(records,'closed').reason,'暂未收到明确反馈');
  assert.deepEqual(readPipelineNotes([],'apply'),{});
});
test('size and record-count limits fail before silently truncating user content', () => {
  assert.throws(()=>writePipelineNotes([],'apply',{resume:'a'.repeat(4000)}),/内容过长/);
  const records=Array.from({length:50},(_,index)=>({id:`original-${index}`,type:'其他',scheduledAt:'',status:'已完成',notes:'',result:''}));
  assert.throws(()=>writePipelineNotes(records,'offer',{salary:'200/天'}),/50 条/);
  records[0].id='pipeline-offer';
  assert.equal(writePipelineNotes(records,'offer',{salary:'200/天'}).length,50);
});

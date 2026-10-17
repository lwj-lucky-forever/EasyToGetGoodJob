import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleEvents, completeScheduleEvent, scheduleFieldDone } from '../lib/schedule-events.ts';
import { sanitizeProcessRecords } from '../lib/job-workflow.ts';
const job=()=>({id:1,applicationDeadline:'2026-11-01',reminderAt:'2026-10-30T09:00',processRecords:[{id:'interview',type:'一面',scheduledAt:'2026-11-02T10:00',status:'待进行',notes:'项目案例',result:'已有反馈'}]});
test('process completion persists and can be undone without losing notes',()=>{
 const source=job(),event=scheduleEvents([source]).find(e=>e.source==='process');
 const done={...source,processRecords:sanitizeProcessRecords(completeScheduleEvent(event,true))};
 const next=scheduleEvents([done]).find(e=>e.source==='process');assert.equal(next.done,true);
 assert.equal(done.processRecords[0].result,'已有反馈');assert.equal(source.processRecords[0].status,'待进行');
 assert.equal(completeScheduleEvent(next,false)[0].status,'待进行');
});
test('deadline and reminder completions survive roundtrip and changing date resets completion',()=>{
 for(const sourceType of ['deadline','reminder']){
  let source=job(); const event=scheduleEvents([source]).find(e=>e.source===sourceType);
  source={...source,processRecords:sanitizeProcessRecords(JSON.parse(JSON.stringify(completeScheduleEvent(event,true))))};
  assert.equal(scheduleFieldDone(source,sourceType),true);assert.equal(scheduleEvents([source]).length,3);
  const next=scheduleEvents([source]).find(e=>e.source===sourceType);
  assert.equal(scheduleFieldDone({...source,processRecords:completeScheduleEvent(next,false)},sourceType),false);
  assert.equal(scheduleFieldDone({...source,applicationDeadline:'2026-12-01',reminderAt:'2026-12-01T09:00'},sourceType),false);
 }
});
test('cancelled and undated records do not become schedule events',()=>{
 const source=job();source.processRecords[0].status='已取消';
 source.processRecords.push({id:'pipeline-offer',type:'其他',scheduledAt:'',status:'已完成',notes:'{}',result:''});
 assert.equal(scheduleEvents([source]).length,2);
});
test('capacity guard prevents silently dropped completions',()=>{
 const source=job();source.processRecords=Array.from({length:50},(_,i)=>({id:String(i),type:'其他',scheduledAt:'',status:'已完成',notes:'',result:''}));
 assert.throws(()=>completeScheduleEvent(scheduleEvents([source])[0],true),/上限/);
});

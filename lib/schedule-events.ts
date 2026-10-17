import type { ProcessRecord } from "./job-workflow";
export type ScheduleSource = { id: number; applicationDeadline: string; reminderAt: string; processRecords: ProcessRecord[] };
export type ScheduleEvent<T extends ScheduleSource = ScheduleSource> = { key: string; date: string; kind: string; title: string; done: boolean; source: "deadline" | "reminder" | "process"; recordId?: string; job: T };
export function scheduleFieldDone(job: ScheduleSource, field: "deadline" | "reminder") {
  const date = field === "deadline" ? job.applicationDeadline : job.reminderAt;
  return Boolean(date && job.processRecords.some(record => record.id === `schedule-${field}` && record.status === "已完成" && record.notes === date));
}
export function scheduleEvents<T extends ScheduleSource>(jobs: T[]): ScheduleEvent<T>[] {
  return jobs.flatMap(job => {
    const rows: ScheduleEvent<T>[] = [];
    if (job.applicationDeadline) rows.push({ key: `deadline-${job.id}`, date: `${job.applicationDeadline}T23:59`, kind: "投递截止", title: "完成投递与材料检查", source: "deadline", done: scheduleFieldDone(job, "deadline"), job });
    if (job.reminderAt) rows.push({ key: `reminder-${job.id}`, date: job.reminderAt, kind: "岗位提醒", title: "处理岗位提醒", source: "reminder", done: scheduleFieldDone(job, "reminder"), job });
    for (const record of job.processRecords) if (record.scheduledAt && record.status !== "已取消") rows.push({ key: `process-${job.id}-${record.id}`, date: record.scheduledAt, kind: record.type, title: record.notes || `准备${record.type}`, source: "process", recordId: record.id, done: record.status === "已完成", job });
    return rows;
  }).sort((a,b) => a.date.localeCompare(b.date));
}
export function completeScheduleEvent(event: ScheduleEvent, done: boolean): ProcessRecord[] {
  const records = event.job.processRecords;
  if (event.source === "process") return records.map(record => record.id === event.recordId ? { ...record, status: done ? "已完成" : "待进行" } : record);
  const id = `schedule-${event.source}`;
  if (!done) return records.filter(record => record.id !== id);
  if (!records.some(record => record.id === id) && records.length >= 50) throw new Error("该岗位流程记录已达上限，请先整理已有记录。");
  const marker: ProcessRecord = { id, type: "其他", status: "已完成", scheduledAt: "", notes: event.source === "deadline" ? event.job.applicationDeadline : event.job.reminderAt, result: `${event.kind}已完成` };
  return records.some(record => record.id === id) ? records.map(record => record.id === id ? marker : record) : [...records, marker];
}

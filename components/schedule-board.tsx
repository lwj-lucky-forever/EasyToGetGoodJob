"use client";
import { useMemo, useState } from "react";
import { CalendarCheck2, CalendarDays, CheckCheck, Clock3 } from "lucide-react";
import { toast } from "sonner";
import type { WorkspaceJobView } from "./job-workspace-views";
import { completeScheduleEvent, scheduleEvents, type ScheduleEvent } from "@/lib/schedule-events";
import type { ProcessRecord } from "@/lib/job-workflow";
import "./schedule.css";

export function ScheduleView({ jobs, onOpenDetail, onUpdate }: { jobs: WorkspaceJobView[]; onOpenDetail: (job: WorkspaceJobView) => void; onUpdate: (id: number, patch: { processRecords: ProcessRecord[] }) => Promise<unknown> }) {
  const events = useMemo(() => scheduleEvents(jobs), [jobs]);
  const [saving, setSaving] = useState<string | null>(null);
  const pending = events.filter(event => !event.done), completed = events.filter(event => event.done).reverse();
  async function toggle(event: ScheduleEvent<WorkspaceJobView>) {
    setSaving(event.key);
    try { await onUpdate(event.job.id, { processRecords: completeScheduleEvent(event, !event.done) }); toast.success(event.done ? "已恢复为待完成" : "日程已完成"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "保存失败，请重试"); }
    finally { setSaving(null); }
  }
  function renderEvent(event: ScheduleEvent<WorkspaceJobView>) {
    const date = new Date(event.date);
    const valid = Number.isFinite(date.getTime());
    const overdue = !event.done && valid && date.getTime() < Date.now();
    return <article key={event.key} className={`schedule-row ${event.done ? "is-complete" : ""}`}>
      <input type="checkbox" checked={event.done} disabled={saving !== null} onChange={() => void toggle(event)} aria-label={`${event.done ? "恢复待完成" : "标记完成"}：${event.job.company} ${event.job.role} ${event.kind}`} />
      <div className="schedule-date"><strong>{valid ? date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" }) : event.date}</strong><span>{event.source === "deadline" ? "当天截止" : valid ? date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "时间待确认"}</span></div>
      <div className="schedule-content"><span className="schedule-kind">{event.kind}</span><button type="button" onClick={() => onOpenDetail(event.job)}>{event.job.company} · {event.job.role}</button><p>{event.title}</p></div>
      <span className={`schedule-state ${overdue ? "is-overdue" : ""}`}>{saving === event.key ? "保存中…" : event.done ? "已完成" : overdue ? "已到时间" : "待完成"}</span>
    </article>;
  }
  return <div className="schedule-board">
    <header className="schedule-intro"><span className="schedule-intro-icon"><CalendarCheck2 /></span><div><h2>把重要的时间，安排妥当</h2><p>勾选完成事项，留出时间专注下一步。完成后也可以取消勾选。</p></div><span className="schedule-progress">已完成 {completed.length} / {events.length}</span></header>
    <section className="schedule-section"><div className="schedule-section-title"><Clock3 className="size-4" /><h3>待完成</h3><span>{pending.length}</span></div>{pending.length ? <div className="space-y-3">{pending.map(renderEvent)}</div> : <div className="schedule-empty"><CalendarDays className="mx-auto mb-3 size-8" /><p>{events.length ? "当前日程全部完成，做得不错。" : "还没有日程，给岗位设置截止日期、提醒或笔试面试时间后，会显示在这里。"}</p></div>}</section>
    <details className="schedule-completed"><summary><CheckCheck className="size-4" /><span>已完成</span><span>{completed.length}</span><small>展开查看 · 可取消勾选</small></summary><div className="mt-4 space-y-3">{completed.length ? completed.map(renderEvent) : <p className="px-2 py-4 text-sm text-slate-400">完成的日程会保留在这里。</p>}</div></details>
    <p className="schedule-footnote">勾选笔试或面试会同步更新对应流程记录；不会自动改变岗位的求职阶段。</p>
  </div>;
}

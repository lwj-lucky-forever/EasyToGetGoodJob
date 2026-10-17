"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, BriefcaseBusiness, CalendarClock, CalendarDays, ExternalLink, FileText, MapPin, Save, ScrollText, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CompanyLogo } from "@/components/company-logo";
import { JobStatusMenu } from "@/components/job-status-menu";
import { JOB_STATUSES, PIPELINE_STATUSES, jobStatusLabel, type JobStatus } from "@/lib/job-status";
import { RESUME_VERSIONS, type ProcessRecord, type ResumeVersion } from "@/lib/job-workflow";
import { readResumePdf } from "@/lib/pdf-resume";

export const WORKFLOW_STATUSES = JOB_STATUSES;
export type WorkflowStatus = JobStatus;

export type WorkspaceJobView = {
  id: number;
  company: string;
  role: string;
  location: string;
  nature: string;
  status: WorkflowStatus;
  responsibilities: string;
  requirements: string;
  competencies: string;
  sourceUrl: string;
  priority: string;
  applicationDeadline: string;
  reminderAt: string;
  resumeVersion: ResumeVersion;
  matchScore: number;
  matchLevel: string;
  processRecords: ProcessRecord[];
};

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", hour: value.includes("T") ? "2-digit" : undefined, minute: value.includes("T") ? "2-digit" : undefined }).format(date);
}

function DetailSection({ title, value, empty }: { title: string; value: string; empty: string }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h3 className="flex items-center gap-2 font-bold text-slate-900"><FileText className="size-4 text-indigo-600" />{title}</h3><p className={`mt-3 whitespace-pre-line text-base leading-7 ${value ? "text-slate-700" : "text-slate-400"}`}>{value || empty}</p></section>;
}

export function JobDetailDialog({ job, open, onOpenChange, onEdit, onPrepare }: { job: WorkspaceJobView | null; open: boolean; onOpenChange: (open: boolean) => void; onEdit: (job: WorkspaceJobView) => void; onPrepare: (job: WorkspaceJobView) => void }) {
  if (!job) return null;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="[&>[data-slot=dialog-close]]:z-20 max-h-[94vh] overflow-y-auto rounded-[1.75rem] p-0 sm:max-w-4xl"><DialogHeader className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur"><DialogTitle className="text-xl">{job.role}</DialogTitle><DialogDescription>{job.company} · 岗位完整信息</DialogDescription></DialogHeader><div className="space-y-4 bg-slate-50/70 px-5 py-5 sm:px-6"><section className="rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-800 p-5 text-white"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2.5"><CompanyLogo company={job.company} className="size-9" /><p className="text-sm font-semibold text-sky-200">{job.company}</p></div><h2 className="mt-1 text-2xl font-bold">{job.role}</h2><div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-200"><span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><MapPin className="size-4" />{job.location || "地点待确认"}</span><span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><BriefcaseBusiness className="size-4" />{job.nature}</span>{job.applicationDeadline && <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><CalendarDays className="size-4" />{formatDate(job.applicationDeadline)}截止</span>}</div></div><button type="button" onClick={() => onPrepare(job)} className="rounded-2xl bg-white px-4 py-3 text-left text-slate-950 shadow-lg"><span className="block text-2xl font-bold">{job.matchScore}%</span><span className="text-xs font-semibold text-slate-500">{job.matchLevel}匹配 · {job.resumeVersion}</span></button></div></section><DetailSection title="工作内容" value={job.responsibilities} empty="尚未录入工作内容，可点击编辑补充。" /><DetailSection title="岗位要求" value={job.requirements} empty="尚未录入岗位要求，可点击编辑补充。" /><DetailSection title="重点考察能力" value={job.competencies} empty="尚未单独识别考察能力。" /></div><DialogFooter className="sticky bottom-0 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur"><Button variant="outline" onClick={() => onEdit(job)}>编辑岗位</Button>{job.sourceUrl && <Button asChild variant="outline"><a href={job.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />打开原网页</a></Button>}<Button onClick={() => onPrepare(job)} className="bg-indigo-600 hover:bg-indigo-700">查看匹配与准备</Button></DialogFooter></DialogContent></Dialog>;
}

export function PipelineBoard({ jobs, onStatusChange, onOpenDetail, renderCard: renderCustomCard }: { jobs: WorkspaceJobView[]; onStatusChange: (job: WorkspaceJobView, status: WorkflowStatus) => void; onOpenDetail: (job: WorkspaceJobView) => void; renderCard?: (job: WorkspaceJobView) => ReactNode }) {
  const ended = jobs.filter((job) => job.status === "暂停");
  const renderCard = (job: WorkspaceJobView) => {
    if (renderCustomCard) return renderCustomCard(job);
    const nextProcess = job.processRecords.filter((record) => record.status === "待进行").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
    return <article key={job.id} className="flex h-72 w-full flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md">
    <button type="button" onClick={() => onOpenDetail(job)} className="block w-full text-left focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-500">
      <div className="flex items-center gap-2"><CompanyLogo company={job.company} className="size-8 rounded-lg p-1" /><span className="truncate text-sm font-semibold text-slate-500">{job.company}</span></div>
      <h3 className="mt-3 line-clamp-2 h-12 font-bold leading-6 text-slate-900">{job.role}</h3>
      <p className="mt-2 truncate text-xs text-slate-500">{job.location || "地点待确认"} · {job.nature}</p>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs"><span className={`rounded-md px-2 py-1 font-medium ${job.priority === "高" ? "bg-rose-50 text-rose-700" : job.priority === "中" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{job.priority}优先级</span><span className="font-semibold text-indigo-600">匹配度 {job.matchScore}%</span></div>
      <p className="mt-2 flex h-4 items-center gap-1.5 text-xs text-slate-500">{job.applicationDeadline && <><CalendarDays className="size-3.5" />{formatDate(job.applicationDeadline)}截止</>}</p>
    </button>
    <div className={`mt-2 flex h-8 shrink-0 items-center gap-2 rounded-lg px-2.5 text-xs ${nextProcess ? "bg-violet-50 text-violet-700" : "bg-slate-50 text-slate-400"}`}><CalendarClock className="size-3.5 shrink-0" /><span className="truncate" title={nextProcess ? `下一项：${nextProcess.type} · ${formatDate(nextProcess.scheduledAt)}` : "下一项：暂无安排"}>{nextProcess ? `下一项：${nextProcess.type} · ${formatDate(nextProcess.scheduledAt)}` : "下一项：暂无安排"}</span></div>
    <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={() => onOpenDetail(job)} className="text-xs font-medium text-slate-500 hover:text-indigo-600">查看详情</button><JobStatusMenu value={job.status} onValueChange={(status) => onStatusChange(job, status)} label={`${job.role}的投递状态`} /></div>
  </article>;
  };
  return <div className="space-y-6">
    <div className="flex flex-col gap-1.5 px-1 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-500">按投递阶段推进，点击状态标签即可调整</p><span className="shrink-0 text-xs text-slate-400">左右滚动查看全部阶段 →</span></div>
    <div role="region" aria-label="求职进度看板，可横向滚动" tabIndex={0} className="overflow-x-auto overscroll-x-contain rounded-2xl pb-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
      <div className="flex min-w-max items-stretch gap-4">
        {PIPELINE_STATUSES.map((status, index) => { const items = jobs.filter((job) => job.status === status); return <section key={status} aria-label={`${jobStatusLabel(status)}阶段`} className="workspace-surface w-[352px] shrink-0 rounded-2xl border border-slate-200/60 bg-white/80 p-3">
          <header className="mb-4 flex items-center justify-between gap-2 px-1 pt-1"><div className="flex items-center gap-2"><span className={`size-2 rounded-full ${status === "Offer" ? "bg-emerald-500" : "bg-indigo-400"}`} /><h2 className="font-bold text-slate-900">{jobStatusLabel(status)}</h2><span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-500">{items.length}</span></div>{index < PIPELINE_STATUSES.length - 1 && <ArrowRight aria-hidden="true" className="size-4 text-slate-300" />}</header>
          <div className="min-h-64 space-y-3">{items.length ? items.map(renderCard) : <p className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-xs text-slate-400">暂无岗位</p>}</div>
        </section>; })}
      </div>
    </div>
    <section aria-label="已结束岗位" className="rounded-2xl border border-slate-200/60 bg-slate-100/60 p-4 sm:p-5"><header className="mb-4 flex items-center gap-2"><h2 className="font-bold text-slate-700">已结束</h2><span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">{ended.length}</span><p className="ml-1 text-xs text-slate-400">未通过的岗位，保留记录便于复盘</p></header>{ended.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{ended.map(renderCard)}</div> : <p className="py-3 text-sm text-slate-400">暂无未通过岗位</p>}</section>
  </div>;
}

type ScheduleEvent = { key: string; date: string; kind: string; title: string; job: WorkspaceJobView };

export function ScheduleView({ jobs, onOpenDetail }: { jobs: WorkspaceJobView[]; onOpenDetail: (job: WorkspaceJobView) => void }) {
  const events = useMemo(() => jobs.flatMap((job) => {
    const rows: ScheduleEvent[] = [];
    if (job.applicationDeadline) rows.push({ key: `deadline-${job.id}`, date: `${job.applicationDeadline}T23:59`, kind: "投递截止", title: "完成投递与材料检查", job });
    if (job.reminderAt) rows.push({ key: `reminder-${job.id}`, date: job.reminderAt, kind: "岗位提醒", title: "处理岗位提醒", job });
    for (const record of job.processRecords) if (record.scheduledAt && record.status === "待进行") rows.push({ key: `process-${job.id}-${record.id}`, date: record.scheduledAt, kind: record.type, title: record.notes || `准备${record.type}`, job });
    return rows;
  }).sort((a, b) => a.date.localeCompare(b.date)), [jobs]);
  const now = Date.now();
  return <section className="workspace-surface rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-5"><header className="mb-4 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-indigo-50 text-indigo-500"><CalendarClock className="size-5" /></span><div><h2 className="text-lg font-bold">日程安排</h2><p className="text-sm text-slate-500">截止日期、提醒、笔试和面试统一显示</p></div></header><div className="space-y-3">{events.length ? events.map((event) => { const overdue = new Date(event.date).getTime() < now; return <button type="button" key={event.key} onClick={() => onOpenDetail(event.job)} className="grid w-full gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-200 sm:grid-cols-[120px_100px_1fr] sm:items-center"><div><p className={`font-bold ${overdue ? "text-rose-600" : "text-slate-900"}`}>{formatDate(event.date)}</p><p className="mt-1 text-xs text-slate-400">{overdue ? "已到时间" : "待处理"}</p></div><span className="w-fit rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{event.kind}</span><div><p className="font-semibold text-slate-900">{event.job.company} · {event.job.role}</p><p className="mt-1 text-sm text-slate-500">{event.title}</p></div></button>; }) : <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-12 text-center"><CalendarDays className="mx-auto size-8 text-slate-300" /><p className="mt-3 font-semibold text-slate-600">暂无日程安排</p><p className="mt-1 text-sm text-slate-400">为岗位填写截止日期、提醒或笔试面试时间后会显示在这里。</p></div>}</div></section>;
}

type ResumeProfile = { name: ResumeVersion; content: string; updatedAt: string };

export function ResumeManagerDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved?: (version: ResumeVersion) => Promise<number> }) {
  const [profiles, setProfiles] = useState<ResumeProfile[]>([]);
  const [selected, setSelected] = useState<ResumeVersion>("通用版");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [fileName, setFileName] = useState("");
  useEffect(() => { if (!open) return; setLoading(true); void fetch("/api/resumes", { cache: "no-store" }).then(async (response) => { const data = await response.json() as { profiles?: ResumeProfile[]; error?: string }; if (!response.ok || !data.profiles) throw new Error(data.error || "简历读取失败"); setProfiles(data.profiles); const current = data.profiles.find((item) => item.name === selected) ?? data.profiles[0]; if (current) { setSelected(current.name); setContent(current.content); } }).catch((error) => toast.error(error instanceof Error ? error.message : "简历读取失败")).finally(() => setLoading(false)); }, [open]);
  function selectVersion(value: ResumeVersion) { setSelected(value); setContent(profiles.find((item) => item.name === value)?.content ?? ""); setFileName(""); }
  async function readFile(file?: File) {
    if (!file) return;
    setReading(true);
    try { setContent(await readResumePdf(file)); setFileName(file.name); toast.success("PDF 文字已读取，请核对后保存"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "PDF 读取失败"); }
    finally { setReading(false); }
  }
  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/resumes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: selected, content }) });
      const data = await response.json() as { profile?: ResumeProfile; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || "简历保存失败");
      setProfiles((current) => current.map((item) => item.name === selected ? data.profile! : item));
      if (onSaved) {
        try { const count = await onSaved(selected); toast.success(`${selected}已保存，已更新 ${count} 个岗位的匹配分析`); }
        catch { toast.warning(`${selected}已保存，但部分岗位更新失败；可在岗位匹配页点击“重新分析”`); }
      } else toast.success(`${selected}已保存`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "简历保存失败"); }
    finally { setSaving(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="[&>[data-slot=dialog-close]]:z-20 max-h-[92vh] overflow-y-auto rounded-[1.75rem] p-0 sm:max-w-3xl">
    <DialogHeader className="border-b border-slate-100 px-6 py-5"><DialogTitle className="flex items-center gap-2"><ScrollText className="size-5 text-indigo-600" />上传简历</DialogTitle><DialogDescription>选择简历版本并上传 PDF。文字只在浏览器中提取，核对后保存，用于与该版本关联的岗位匹配。</DialogDescription></DialogHeader>
    <div className="space-y-4 px-6 py-5">
      <Select value={selected} onValueChange={(value) => selectVersion(value as ResumeVersion)} disabled={loading || saving || reading}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{RESUME_VERSIONS.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 px-4 py-3 text-sm font-medium text-indigo-700 hover:bg-indigo-50"><Upload className="size-5" /><span>{reading ? "正在读取 PDF…" : fileName || "选择 PDF 简历（最大 10 MB）"}</span><input type="file" accept=".pdf,application/pdf" disabled={loading || saving || reading} className="sr-only" onChange={(event) => { void readFile(event.target.files?.[0]); event.target.value = ""; }} /></label>
      <Textarea value={content} onChange={(event) => setContent(event.target.value)} disabled={loading || saving || reading} aria-label="提取的简历文字" placeholder="上传 PDF 后在这里核对提取内容；也可以直接粘贴简历文字。" className="min-h-[350px] resize-y text-base leading-7" />
      <p className="text-xs leading-5 text-slate-500">保存会覆盖所选版本的原有文字，并更新使用该版本的岗位匹配度；扫描图片 PDF 需要先做文字识别。</p>
    </div>
    <DialogFooter className="border-t border-slate-100 px-6 py-4"><Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>关闭</Button><Button onClick={() => void save()} disabled={loading || saving || reading || content.trim().length < 20} className="bg-indigo-600 hover:bg-indigo-700"><Save className="size-4" />{saving ? "保存并匹配中…" : "保存并匹配岗位"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

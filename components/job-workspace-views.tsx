"use client";

import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, CalendarClock, CalendarDays, ExternalLink, FileText, MapPin, Save, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RESUME_VERSIONS, type ProcessRecord, type ResumeVersion } from "@/lib/job-workflow";

export const WORKFLOW_STATUSES = ["未投递", "准备中", "已投递", "笔试", "面试", "Offer", "暂停"] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

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
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="[&>[data-slot=dialog-close]]:z-20 max-h-[94vh] overflow-y-auto rounded-[1.75rem] p-0 sm:max-w-4xl"><DialogHeader className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur"><DialogTitle className="text-xl">{job.role}</DialogTitle><DialogDescription>{job.company} · 岗位完整信息</DialogDescription></DialogHeader><div className="space-y-4 bg-slate-50/70 px-5 py-5 sm:px-6"><section className="rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-800 p-5 text-white"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-sky-200">{job.company}</p><h2 className="mt-1 text-2xl font-bold">{job.role}</h2><div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-200"><span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><MapPin className="size-4" />{job.location || "地点待确认"}</span><span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><BriefcaseBusiness className="size-4" />{job.nature}</span>{job.applicationDeadline && <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><CalendarDays className="size-4" />{formatDate(job.applicationDeadline)}截止</span>}</div></div><button type="button" onClick={() => onPrepare(job)} className="rounded-2xl bg-white px-4 py-3 text-left text-slate-950 shadow-lg"><span className="block text-2xl font-bold">{job.matchScore}%</span><span className="text-xs font-semibold text-slate-500">{job.matchLevel}匹配 · {job.resumeVersion}</span></button></div></section><DetailSection title="工作内容" value={job.responsibilities} empty="尚未录入工作内容，可点击编辑补充。" /><DetailSection title="岗位要求" value={job.requirements} empty="尚未录入岗位要求，可点击编辑补充。" /><DetailSection title="重点考察能力" value={job.competencies} empty="尚未单独识别考察能力。" /></div><DialogFooter className="sticky bottom-0 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur"><Button variant="outline" onClick={() => onEdit(job)}>编辑岗位</Button>{job.sourceUrl && <Button asChild variant="outline"><a href={job.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />打开原网页</a></Button>}<Button onClick={() => onPrepare(job)} className="bg-indigo-600 hover:bg-indigo-700">查看匹配与准备</Button></DialogFooter></DialogContent></Dialog>;
}

export function PipelineBoard({ jobs, onStatusChange, onOpenDetail }: { jobs: WorkspaceJobView[]; onStatusChange: (job: WorkspaceJobView, status: WorkflowStatus) => void; onOpenDetail: (job: WorkspaceJobView) => void }) {
  return <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">{WORKFLOW_STATUSES.map((status) => { const items = jobs.filter((job) => job.status === status); return <section key={status} className="rounded-[1.35rem] border border-white/90 bg-white/70 p-3 shadow-[0_18px_45px_-30px_rgba(15,23,42,.45)]"><header className="mb-3 flex items-center justify-between px-1"><h2 className="font-bold text-slate-900">{status}</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{items.length}</span></header><div className="space-y-2.5">{items.length ? items.map((job) => <article key={job.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm"><button type="button" onClick={() => onOpenDetail(job)} className="w-full text-left"><p className="text-sm font-semibold text-indigo-600">{job.company}</p><h3 className="mt-1 line-clamp-2 font-bold leading-6 text-slate-900">{job.role}</h3><div className="mt-2 flex items-center justify-between text-xs text-slate-500"><span>{job.priority}优先级</span><span className="font-bold text-indigo-600">{job.matchScore}%</span></div></button><Select value={job.status} onValueChange={(value) => onStatusChange(job, value as WorkflowStatus)}><SelectTrigger className="mt-3 h-8 w-full rounded-lg bg-slate-50 text-xs"><SelectValue /></SelectTrigger><SelectContent>{WORKFLOW_STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></article>) : <p className="rounded-xl border border-dashed border-slate-200 px-3 py-7 text-center text-sm text-slate-400">暂无岗位</p>}</div></section>; })}</div>;
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
  return <section className="rounded-[1.5rem] border border-white/90 bg-white/75 p-4 shadow-[0_18px_48px_-32px_rgba(15,23,42,.45)] sm:p-5"><header className="mb-4 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-white"><CalendarClock className="size-5" /></span><div><h2 className="text-lg font-bold">求职日程</h2><p className="text-sm text-slate-500">截止日期、提醒、笔试和面试统一显示</p></div></header><div className="space-y-3">{events.length ? events.map((event) => { const overdue = new Date(event.date).getTime() < now; return <button type="button" key={event.key} onClick={() => onOpenDetail(event.job)} className="grid w-full gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-200 sm:grid-cols-[120px_100px_1fr] sm:items-center"><div><p className={`font-bold ${overdue ? "text-rose-600" : "text-slate-900"}`}>{formatDate(event.date)}</p><p className="mt-1 text-xs text-slate-400">{overdue ? "已到时间" : "待处理"}</p></div><span className="w-fit rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{event.kind}</span><div><p className="font-semibold text-slate-900">{event.job.company} · {event.job.role}</p><p className="mt-1 text-sm text-slate-500">{event.title}</p></div></button>; }) : <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-12 text-center"><CalendarDays className="mx-auto size-8 text-slate-300" /><p className="mt-3 font-semibold text-slate-600">暂无日程</p><p className="mt-1 text-sm text-slate-400">为岗位填写截止日期、提醒或笔试面试时间后会显示在这里。</p></div>}</div></section>;
}

type ResumeProfile = { name: ResumeVersion; content: string; updatedAt: string };

export function ResumeManagerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [profiles, setProfiles] = useState<ResumeProfile[]>([]);
  const [selected, setSelected] = useState<ResumeVersion>("通用版");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!open) return; setLoading(true); void fetch("/api/resumes", { cache: "no-store" }).then(async (response) => { const data = await response.json() as { profiles?: ResumeProfile[]; error?: string }; if (!response.ok || !data.profiles) throw new Error(data.error || "简历读取失败"); setProfiles(data.profiles); const current = data.profiles.find((item) => item.name === selected) ?? data.profiles[0]; if (current) { setSelected(current.name); setContent(current.content); } }).catch((error) => toast.error(error instanceof Error ? error.message : "简历读取失败")).finally(() => setLoading(false)); }, [open]);
  function selectVersion(value: ResumeVersion) { setSelected(value); setContent(profiles.find((item) => item.name === value)?.content ?? ""); }
  async function save() { setSaving(true); try { const response = await fetch("/api/resumes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: selected, content }) }); const data = await response.json() as { profile?: ResumeProfile; error?: string }; if (!response.ok || !data.profile) throw new Error(data.error || "简历保存失败"); setProfiles((current) => current.map((item) => item.name === selected ? data.profile! : item)); toast.success(`${selected}已保存，相关岗位可点击“重新分析”更新匹配度`); } catch (error) { toast.error(error instanceof Error ? error.message : "简历保存失败"); } finally { setSaving(false); } }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="[&>[data-slot=dialog-close]]:z-20 max-h-[92vh] overflow-y-auto rounded-[1.75rem] p-0 sm:max-w-3xl"><DialogHeader className="border-b border-slate-100 px-6 py-5"><DialogTitle className="flex items-center gap-2"><ScrollText className="size-5 text-indigo-600" />简历版本管理</DialogTitle><DialogDescription>粘贴每个版本的真实简历文字，岗位匹配会优先依据该版本内容，而不是只看版本名称。</DialogDescription></DialogHeader><div className="space-y-4 px-6 py-5"><Select value={selected} onValueChange={(value) => selectVersion(value as ResumeVersion)} disabled={loading}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{RESUME_VERSIONS.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select><Textarea value={content} onChange={(event) => setContent(event.target.value)} disabled={loading} placeholder="粘贴该版本的完整简历文字，包括教育经历、项目经历、实习经历和技能。" className="min-h-[420px] resize-y text-base leading-7" /><p className="text-xs leading-5 text-slate-400">保存后，已存在岗位不会自动改分；在岗位匹配页点击“重新分析”即可按新简历更新。</p></div><DialogFooter className="border-t border-slate-100 px-6 py-4"><Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button><Button onClick={() => void save()} disabled={loading || saving || content.trim().length < 20} className="bg-indigo-600 hover:bg-indigo-700"><Save className="size-4" />{saving ? "保存中…" : "保存当前版本"}</Button></DialogFooter></DialogContent></Dialog>;
}

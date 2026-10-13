"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, ArrowUpDown, Bell, BriefcaseBusiness, Building2, CalendarClock, CalendarDays, ChevronDown,
  CircleAlert, CircleCheckBig, CircleHelp, ClipboardCheck, Clock3, ExternalLink, FileText,
  Filter, Gauge, GraduationCap, Link2, ListChecks, Loader2, LockKeyhole, LogIn, MapPin,
  NotebookPen, Pencil, Plus, RefreshCw, Search, ShieldCheck, Sparkles, Target, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { JobDetailDialog, PipelineBoard, ResumeManagerDialog, ScheduleView } from "@/components/job-workspace-views";
import { DataBackupPanel } from "@/components/data-backup-panel";
import { InterviewLibrary } from "@/components/interview-library";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { JOB_NATURES, mergeParsedJob, parseJobText } from "@/lib/job-parser";
import { normalizeImportedJob, recognizedImportKeys, safelyParseJobText, type ImportedJob } from "@/lib/job-import";
import { groupJobsByCompany, numberGroupedJobs } from "@/lib/job-order";
import { getOptionalBrowserContext, registerOptionalBrowserTools, type BrowserToolDefinition } from "@/lib/optional-browser-tools";
import {
  JOB_PRIORITIES, PROCESS_STATUSES, PROCESS_TYPES, RESUME_VERSIONS, recommendResumeVersion,
  type PrepChecklistItem, type ProcessRecord, type ProcessStatus, type ProcessType, type ResumeVersion,
} from "@/lib/job-workflow";

const STATUSES = ["未投递", "准备中", "已投递", "笔试", "面试", "Offer", "暂停"] as const;
const NATURES = JOB_NATURES;
type Status = (typeof STATUSES)[number];
type RequirementFit = "匹配" | "部分匹配" | "需补充" | "待确认";

type RequirementAnalysis = { requirement: string; fit: RequirementFit; score: number; evidence: string; action: string; knowledge: string };
type MatchAnalysis = {
  score: number; level: "高" | "中高" | "中等" | "较低"; summary: string; requirements: RequirementAnalysis[];
  strengths: string[]; priorities: string[]; basis: string; resumeVersion: ResumeVersion;
  recommendedResumeVersion: ResumeVersion; version: number; analyzedAt: string;
};
type Job = {
  id: number; company: string; role: string; location: string; nature: string; status: Status;
  responsibilities: string; requirements: string; competencies: string; sourceUrl: string; rawText: string;
  priority: string; applicationDeadline: string; reminderAt: string; resumeVersion: ResumeVersion;
  companyOrder: number; jobOrder: number;
  processRecords: ProcessRecord[]; prepChecklist: PrepChecklistItem[]; matchScore: number; matchLevel: string;
  matchAnalysis: MatchAnalysis; appliedAt: string | null; createdAt: string; updatedAt: string;
};
type JobDraft = Pick<Job,
  "company" | "role" | "location" | "nature" | "status" | "responsibilities" | "requirements" |
  "competencies" | "sourceUrl" | "rawText" | "priority" | "applicationDeadline" | "reminderAt" | "resumeVersion"
>;
type JobUpdate = Partial<JobDraft> & { processRecords?: ProcessRecord[]; prepChecklist?: PrepChecklistItem[] };
type TextDraftKey = Exclude<keyof JobDraft, "status" | "priority" | "applicationDeadline" | "reminderAt" | "resumeVersion">;

const EMPTY_DRAFT: JobDraft = {
  company: "", role: "", location: "", nature: "待确认", status: "未投递", responsibilities: "",
  requirements: "", competencies: "", sourceUrl: "", rawText: "", priority: "中",
  applicationDeadline: "", reminderAt: "", resumeVersion: "通用版",
};

const STATUS_STYLE: Record<Status, string> = {
  未投递: "border-slate-200 bg-slate-50 text-slate-600", 准备中: "border-amber-200 bg-amber-50 text-amber-700",
  已投递: "border-blue-200 bg-blue-50 text-blue-700", 笔试: "border-violet-200 bg-violet-50 text-violet-700",
  面试: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700", Offer: "border-emerald-200 bg-emerald-50 text-emerald-700",
  暂停: "border-rose-200 bg-rose-50 text-rose-700",
};
const PRIORITY_STYLE: Record<string, string> = {
  高: "border-rose-200 bg-rose-50 text-rose-700", 中: "border-amber-200 bg-amber-50 text-amber-700", 低: "border-slate-200 bg-slate-50 text-slate-500",
};

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: value.includes("T") ? "2-digit" : undefined, minute: value.includes("T") ? "2-digit" : undefined }).format(date);
}

function deadlineMeta(job: Job, now: number) {
  if (!job.applicationDeadline || !now) return null;
  const deadline = new Date(`${job.applicationDeadline}T23:59:59`).getTime();
  const days = Math.ceil((deadline - now) / 86_400_000);
  if (days < 0) return { label: `已截止${Math.abs(days)}天`, className: "border-rose-200 bg-rose-50 text-rose-700", urgent: true };
  if (days === 0) return { label: "今天截止", className: "border-rose-200 bg-rose-50 text-rose-700", urgent: true };
  if (days <= 3) return { label: `${days}天后截止`, className: "border-amber-200 bg-amber-50 text-amber-700", urgent: true };
  return { label: `${formatDate(job.applicationDeadline)}截止`, className: "border-slate-200 bg-slate-50 text-slate-600", urgent: days <= 7 };
}

function JobForm({ draft, setDraft }: { draft: JobDraft; setDraft: React.Dispatch<React.SetStateAction<JobDraft>> }) {
  const [pasteOpen, setPasteOpen] = useState(Boolean(draft.rawText || draft.sourceUrl));
  const [recognized, setRecognized] = useState<TextDraftKey[]>([]);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportedJob | null>(null);
  function update<K extends keyof JobDraft>(key: K, value: JobDraft[K]) { setDraft((current) => ({ ...current, [key]: value })); }

  function applyRecognized(parsed: ImportedJob, originalRawText?: string) {
    const keys = recognizedImportKeys(parsed) as TextDraftKey[];
    if (!keys.length) return 0;
    setDraft((current) => {
      const next: JobDraft = { ...current };
      for (const key of keys) {
        const value = parsed[key];
        if (typeof value === "string" && value) next[key] = value;
      }
      if (typeof parsed.applicationDeadline === "string" && parsed.applicationDeadline) next.applicationDeadline = parsed.applicationDeadline;
      if (originalRawText !== undefined) next.rawText = originalRawText;
      next.resumeVersion = recommendResumeVersion(next);
      return next;
    });
    setRecognized(keys);
    return keys.length;
  }

  function analyze() {
    try {
      const parsed = safelyParseJobText(draft.rawText);
      const keys = recognizedImportKeys(parsed) as TextDraftKey[];
      if (!keys.length) { toast.info("已保留原文，但没有识别到明确字段；请检查文本是否包含岗位名称、职责或要求"); return; }
      setImportPreview({ ...parsed, rawText: draft.rawText }); setRecognized(keys);
      toast.success(`已识别${keys.length}项信息，请确认后应用`);
    } catch {
      toast.error("文本识别没有完成，原文已保留，可手动填写或稍后重试");
    }
  }

  async function importFromUrl() {
    if (!draft.sourceUrl.trim()) { toast.error("请先粘贴招聘网页链接"); return; }
    setImporting(true);
    try {
      const response = await fetch("/api/jobs/import-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: normalizeUrl(draft.sourceUrl) }) });
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) throw new Error("网页读取服务返回异常，请稍后重试");
      const data = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "网页读取失败");
      const parsed = normalizeImportedJob({
        ...(data.parsed && typeof data.parsed === "object" && !Array.isArray(data.parsed) ? data.parsed : {}),
        sourceUrl: typeof data.sourceUrl === "string" ? data.sourceUrl : draft.sourceUrl,
        rawText: typeof data.rawText === "string" ? data.rawText : "",
        applicationDeadline: data.applicationDeadline,
      });
      const keys = recognizedImportKeys(parsed) as TextDraftKey[];
      if (!keys.length) throw new Error("网页已读取，但没有识别到有效岗位字段；请改用文本粘贴");
      setImportPreview(parsed); setRecognized(keys);
      toast.success(`已从网页识别${keys.length}项岗位信息，请确认后应用`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "网页读取失败，请改用文本粘贴"); }
    finally { setImporting(false); }
  }

  const recognitionLabels: Partial<Record<TextDraftKey, string>> = {
    company: "公司", role: "岗位", location: "地点", nature: "岗位性质", responsibilities: "工作内容",
    requirements: "岗位要求", competencies: "考察能力", sourceUrl: "岗位链接",
  };

  return <div className="space-y-5">
    <section className="overflow-hidden rounded-[1.35rem] border border-indigo-200/70 bg-gradient-to-br from-indigo-50 via-white to-sky-50 shadow-sm shadow-indigo-100/60">
      <button type="button" onClick={() => setPasteOpen((open) => !open)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"><span className="flex items-center gap-3 text-sm font-bold text-slate-900"><span className="grid size-8 place-items-center rounded-xl bg-indigo-600 text-white"><Sparkles className="size-4" /></span><span>智能导入岗位<span className="ml-2 hidden text-xs font-medium text-slate-500 sm:inline">支持网页链接或完整文本</span></span></span><ChevronDown className={`size-4 text-indigo-600 transition ${pasteOpen ? "rotate-180" : ""}`} /></button>
      {pasteOpen && <div className="space-y-4 border-t border-indigo-100/80 p-4 sm:p-5">
        <div className="space-y-2"><Label htmlFor="import-url" className="flex items-center gap-2"><Link2 className="size-4 text-indigo-500" />招聘网页链接</Label><div className="flex flex-col gap-2 sm:flex-row"><Input id="import-url" value={draft.sourceUrl} onChange={(event) => update("sourceUrl", event.target.value)} placeholder="粘贴招聘官网、招聘平台的岗位网页" className="h-11 rounded-xl bg-white" /><Button type="button" onClick={() => void importFromUrl()} disabled={importing || !draft.sourceUrl.trim()} className="h-11 shrink-0 rounded-xl bg-slate-950 hover:bg-indigo-700">{importing ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}{importing ? "读取中" : "读取网页"}</Button></div><p className="text-xs leading-5 text-slate-500">需要登录、限制自动访问或仅动态加载的页面可能无法读取，可改用下方文本粘贴。</p></div>
        <div className="flex items-center gap-3 text-xs font-medium text-slate-400"><span className="h-px flex-1 bg-indigo-100" />或粘贴岗位文字<span className="h-px flex-1 bg-indigo-100" /></div>
        <Textarea value={draft.rawText} onChange={(event) => { update("rawText", event.target.value); setRecognized([]); setImportPreview(null); }} placeholder={"直接粘贴完整招聘信息，无需整理格式。\n系统会识别公司、岗位、地点、岗位性质、工作内容和岗位要求。"} className="min-h-36 resize-y rounded-2xl border-indigo-100 bg-white/90 text-base leading-7" />
        {importPreview && recognized.length > 0 && <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4"><div><p className="font-bold text-emerald-900">识别结果预览</p><p className="mt-1 text-xs text-emerald-700">确认后才会覆盖下方表单，请先检查关键信息。</p></div><div className="grid gap-2 sm:grid-cols-2">{recognized.map((key) => <div key={key} className="rounded-xl bg-white px-3 py-2 shadow-sm"><p className="text-xs font-semibold text-slate-400">{recognitionLabels[key] ?? key}</p><p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-700">{String(importPreview[key] ?? "")}</p></div>)}</div><div className="flex justify-end gap-2"><Button type="button" size="sm" variant="outline" onClick={() => { setImportPreview(null); setRecognized([]); }}>取消</Button><Button type="button" size="sm" onClick={() => { const count = applyRecognized(importPreview, importPreview.rawText ?? draft.rawText); setImportPreview(null); toast.success(`已应用${count}项信息，请继续检查和保存`); }} className="bg-emerald-600 hover:bg-emerald-700">确认并应用</Button></div></div>}
        <div className="flex justify-end"><Button type="button" size="sm" onClick={analyze} disabled={!draft.rawText.trim()} className="rounded-xl bg-indigo-600 hover:bg-indigo-700"><Sparkles className="size-4" />识别文本并填充</Button></div>
      </div>}
    </section>

    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="company">公司名称 *</Label><Input id="company" value={draft.company} onChange={(e) => update("company", e.target.value)} placeholder="如：美团" /></div>
      <div className="space-y-2"><Label htmlFor="role">岗位名称 *</Label><Input id="role" value={draft.role} onChange={(e) => update("role", e.target.value)} placeholder="如：产品运营实习生" /></div>
      <div className="space-y-2"><Label htmlFor="location">工作地点</Label><Input id="location" value={draft.location} onChange={(e) => update("location", e.target.value)} placeholder="如：北京 · 朝阳区" /></div>
      <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>岗位性质</Label><Select value={draft.nature} onValueChange={(value) => update("nature", value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{NATURES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>投递状态</Label><Select value={draft.status} onValueChange={(value) => update("status", value as Status)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div></div>
      <div className="space-y-2"><Label>岗位优先级</Label><Select value={draft.priority} onValueChange={(value) => update("priority", value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{JOB_PRIORITIES.map((item) => <SelectItem key={item} value={item}>{item}优先级</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="deadline">投递截止日期</Label><Input id="deadline" type="date" value={draft.applicationDeadline} onChange={(event) => update("applicationDeadline", event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="reminder">提醒时间</Label><Input id="reminder" type="datetime-local" value={draft.reminderAt} onChange={(event) => update("reminderAt", event.target.value)} /><p className="text-xs text-slate-400">到时间后在首页显示站内提醒</p></div>
      <div className="space-y-2"><Label>使用简历版本</Label><Select value={draft.resumeVersion} onValueChange={(value) => update("resumeVersion", value as ResumeVersion)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{RESUME_VERSIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><p className="text-xs text-slate-400">当前推荐：{recommendResumeVersion(draft)}</p></div>
    </div>
    <div className="space-y-2"><Label htmlFor="responsibilities">工作内容</Label><Textarea id="responsibilities" value={draft.responsibilities} onChange={(e) => update("responsibilities", e.target.value)} placeholder="粘贴或概括岗位职责" className="min-h-24 text-base leading-6" /></div>
    <div className="space-y-2"><Label htmlFor="requirements">岗位要求</Label><Textarea id="requirements" value={draft.requirements} onChange={(e) => update("requirements", e.target.value)} placeholder="学历、专业、实习时长、技能等" className="min-h-24 text-base leading-6" /></div>
    <div className="space-y-2"><Label htmlFor="competencies">重点考察能力</Label><Textarea id="competencies" value={draft.competencies} onChange={(e) => update("competencies", e.target.value)} placeholder="如：数据分析、沟通协调、产品思维、英语能力" className="min-h-20 text-base leading-6" /></div>
  </div>;
}

const FIT_STYLE: Record<RequirementFit, { className: string; icon: typeof CircleCheckBig }> = {
  匹配: { className: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: CircleCheckBig },
  部分匹配: { className: "border-blue-200 bg-blue-50 text-blue-700", icon: CircleHelp },
  需补充: { className: "border-rose-200 bg-rose-50 text-rose-700", icon: CircleAlert },
  待确认: { className: "border-amber-200 bg-amber-50 text-amber-700", icon: CircleHelp },
};

function AccessGate({ forbidden = false, onRetry }: { forbidden?: boolean; onRetry: () => void }) {
  return <main className="workspace-bg min-h-screen text-slate-950"><header className="border-b border-white/10 bg-slate-950 text-white"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4"><div className="flex min-w-0 items-center gap-3"><div className="size-10 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-slate-900"><img src="/offer-tower-illustrated-192.png" alt="" className="size-full object-cover" /></div><div className="min-w-0"><h1 className="truncate font-bold">EasyToGetGoodJob</h1><p className="text-sm text-slate-400">公开入口 · 个人数据受保护</p></div></div><PwaInstallButton /></div></header><div className="mx-auto grid min-h-[calc(100vh-73px)] max-w-5xl place-items-center px-5 py-12"><section className="w-full max-w-xl rounded-[2rem] border border-white bg-white/95 p-7 text-center shadow-2xl shadow-slate-300/50 sm:p-10"><div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-indigo-50 to-sky-100 text-indigo-600">{forbidden ? <ShieldCheck className="size-7" /> : <LockKeyhole className="size-7" />}</div><h2 className="text-2xl font-bold tracking-tight">{forbidden ? "这是刘尉婕的个人工作区" : "登录后进入个人工作区"}</h2><p className="mt-3 text-base leading-7 text-slate-500">{forbidden ? "网站可以公开访问，但简历、岗位记录和匹配分析仅对工作区所有者开放。" : "为保护简历和求职记录，公开页面不会展示任何个人数据。使用你的ChatGPT账号登录后即可继续。"}</p><Button asChild className="mt-7 h-11 rounded-xl bg-indigo-600 px-5 hover:bg-indigo-700"><a href={forbidden ? "/signout-with-chatgpt?return_to=/" : "/signin-with-chatgpt?return_to=/"} target="_top"><LogIn className="size-4" />{forbidden ? "切换账号" : "登录并进入"}</a></Button><Button variant="outline" onClick={onRetry} className="ml-3 mt-7 h-11 rounded-xl">我已登录，重新检查</Button><div className="mt-7 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-sm text-slate-400"><ShieldCheck className="size-4" />岗位与简历内容不会公开展示</div></section></div></main>;
}

function MatchDialog({ job, open, onOpenChange, onReanalyze, onChecklistToggle, analyzing, checklistSavingId }: {
  job: Job | null; open: boolean; onOpenChange: (open: boolean) => void; onReanalyze: (job: Job) => void;
  onChecklistToggle: (job: Job, itemId: string) => void; analyzing: boolean; checklistSavingId: string;
}) {
  if (!job) return null;
  const analysis = job.matchAnalysis;
  const completed = job.prepChecklist.filter((item) => item.done).length;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="[&>[data-slot=dialog-close]]:z-20 max-h-[94vh] overflow-y-auto rounded-[1.75rem] border-slate-200 p-0 shadow-2xl sm:max-w-4xl">
    <DialogHeader className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur"><div className="flex items-start justify-between gap-4 pr-8"><div><DialogTitle className="text-xl">岗位匹配与准备</DialogTitle><DialogDescription className="mt-1">{job.company} · {job.role}</DialogDescription></div><Button variant="outline" size="sm" onClick={() => onReanalyze(job)} disabled={analyzing || Boolean(checklistSavingId)} className="rounded-xl"><RefreshCw className={`size-4 ${analyzing ? "animate-spin" : ""}`} />重新分析</Button></div></DialogHeader>
    <div className="space-y-6 px-6 py-6">
      <section className="relative grid gap-4 overflow-hidden rounded-[1.4rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-800 p-6 text-white shadow-xl shadow-indigo-200/40 sm:grid-cols-[150px_1fr] sm:items-center"><div className="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full bg-sky-400/15 blur-2xl" /><div className="text-center sm:border-r sm:border-white/15"><p className="text-5xl font-bold tracking-tight">{analysis.score}<span className="text-xl text-white/60">%</span></p><p className="mt-2 text-sm font-semibold text-sky-200">{analysis.level}匹配</p></div><div><p className="text-base font-semibold">整体判断</p><p className="mt-2 text-sm leading-6 text-slate-300">{analysis.summary}</p><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white/10 px-2.5 py-1">当前：{job.resumeVersion}</span><span className="rounded-full bg-sky-400/15 px-2.5 py-1 text-sky-100">推荐：{analysis.recommendedResumeVersion}</span></div></div></section>
      <section className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 font-bold text-slate-900"><ListChecks className="size-5 text-indigo-600" />岗位准备清单</h3><p className="mt-1 text-sm text-slate-500">由匹配差距自动生成，勾选状态会持续保存。</p></div><span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-indigo-700 shadow-sm">{completed}/{job.prepChecklist.length} 已完成</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all" style={{ width: `${job.prepChecklist.length ? Math.round(completed / job.prepChecklist.length * 100) : 0}%` }} /></div><div className="mt-4 space-y-2">{job.prepChecklist.length ? job.prepChecklist.map((item) => <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${item.done ? "border-emerald-100 bg-emerald-50/70" : "border-slate-200 bg-white hover:border-indigo-200"}`}><Checkbox checked={item.done} disabled={Boolean(checklistSavingId) || analyzing} onCheckedChange={() => onChecklistToggle(job, item.id)} className="mt-0.5" /><span className="min-w-0 flex-1"><span className={`text-sm leading-6 ${item.done ? "text-slate-400 line-through" : "text-slate-700"}`}>{item.text}</span><span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{item.category}</span></span></label>) : <p className="rounded-xl bg-white px-4 py-5 text-center text-sm text-slate-500">当前没有需要额外补充的清单项。</p>}</div></section>
      <section className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"><p className="flex items-center gap-2 font-semibold text-emerald-800"><CircleCheckBig className="size-4" />你的主要优势</p><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">{analysis.strengths.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-500" />{item}</li>)}</ul></div><div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4"><p className="flex items-center gap-2 font-semibold text-amber-800"><GraduationCap className="size-4" />优先补充方向</p><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">{analysis.priorities.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-500" />{item}</li>)}</ul></div></section>
      <section><div className="mb-3"><h3 className="text-lg font-bold">逐条岗位要求解读</h3><p className="mt-1 text-sm text-slate-500">每一条都给出简历证据、行动建议与需要补充的知识。</p></div><div className="space-y-3">{analysis.requirements.map((item, index) => { const config = FIT_STYLE[item.fit]; const FitIcon = config.icon; return <article key={`${item.requirement}-${index}`} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-bold text-slate-500">{index + 1}</span><p className="font-semibold leading-6 text-slate-900">{item.requirement}</p></div><span className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${config.className}`}><FitIcon className="size-3.5" />{item.fit}</span></div><div className="mt-4 grid gap-3 text-sm leading-6 md:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><p className="mb-1 font-semibold text-slate-500">简历证据</p><p className="text-slate-700">{item.evidence}</p></div><div className="rounded-xl bg-indigo-50/80 p-3"><p className="mb-1 font-semibold text-indigo-600">你应该怎么做</p><p className="text-slate-700">{item.action}</p></div><div className="rounded-xl bg-amber-50/70 p-3"><p className="mb-1 font-semibold text-amber-700">需要补充</p><p className="text-slate-700">{item.knowledge}</p></div></div></article>; })}</div></section>
      <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">分析依据：{analysis.basis} 匹配度用于决定准备优先级，不等同于企业筛选结果。</p>
    </div>
  </DialogContent></Dialog>;
}

function ProcessDialog({ job, open, onOpenChange, onSave }: { job: Job | null; open: boolean; onOpenChange: (open: boolean) => void; onSave: (job: Job, records: ProcessRecord[]) => Promise<void> }) {
  const [records, setRecords] = useState<ProcessRecord[]>([]);
  const [type, setType] = useState<ProcessType>("笔试");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (job) setRecords(job.processRecords); }, [job]);
  if (!job) return null;
  const currentJob = job;
  function addRecord() { if (!scheduledAt) { toast.error("请填写笔试或面试时间"); return; } setRecords((current) => [...current, { id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `record-${Date.now()}-${Math.random().toString(36).slice(2)}`, type, scheduledAt, status: "待进行", notes: notes.trim(), result: "" }]); setScheduledAt(""); setNotes(""); }
  function updateRecord(id: string, value: Partial<ProcessRecord>) { setRecords((current) => current.map((record) => record.id === id ? { ...record, ...value } : record)); }
  async function save() { setSaving(true); try { await onSave(currentJob, records); onOpenChange(false); } catch { /* The caller displays the save error; keep this dialog open. */ } finally { setSaving(false); } }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="[&>[data-slot=dialog-close]]:z-20 max-h-[92vh] overflow-y-auto rounded-[1.75rem] p-0 sm:max-w-3xl"><DialogHeader className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur"><DialogTitle className="flex items-center gap-2"><NotebookPen className="size-5 text-indigo-600" />笔试/面试记录</DialogTitle><DialogDescription>{job.company} · {job.role}</DialogDescription></DialogHeader><div className="space-y-5 px-6 py-5"><section className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4"><p className="mb-3 font-semibold text-slate-900">新增流程记录</p><div className="grid gap-3 sm:grid-cols-[140px_1fr]"><Select value={type} onValueChange={(value) => setType(value as ProcessType)}><SelectTrigger className="bg-white"><SelectValue /></SelectTrigger><SelectContent>{PROCESS_TYPES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Input type="datetime-local" aria-label="笔试或面试时间" value={scheduledAt} onInput={(event) => setScheduledAt(event.currentTarget.value)} onChange={(event) => setScheduledAt(event.target.value)} className="bg-white" /></div><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="准备重点、面试官信息或其他备注" className="mt-3 min-h-20 bg-white" /><Button type="button" size="sm" onClick={addRecord} className="mt-3 rounded-xl bg-indigo-600 hover:bg-indigo-700"><Plus className="size-4" />加入记录</Button></section><section className="space-y-3">{records.length ? [...records].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)).map((record) => <article key={record.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold text-slate-900">{record.type}</p><p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><CalendarClock className="size-4" />{formatDate(record.scheduledAt)}</p></div><Select value={record.status} onValueChange={(value) => updateRecord(record.id, { status: value as ProcessStatus })}><SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger><SelectContent>{PROCESS_STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><Textarea value={record.notes} onChange={(event) => updateRecord(record.id, { notes: event.target.value })} placeholder="准备重点或过程记录" className="mt-3 min-h-16" /><Input value={record.result} onChange={(event) => updateRecord(record.id, { result: event.target.value })} placeholder="结果或下一步，如：通过，等待二面" className="mt-2" /></article>) : <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-500">还没有流程记录，可先添加笔试或面试安排。</div>}</section></div><DialogFooter className="sticky bottom-0 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur"><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button onClick={() => void save()} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">{saving ? "保存中…" : "保存记录"}</Button></DialogFooter></DialogContent></Dialog>;
}

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessState, setAccessState] = useState<"checking" | "ready" | "anonymous" | "forbidden">("checking");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("全部状态");
  const [sortBy, setSortBy] = useState("自定义顺序");
  const [boardView, setBoardView] = useState<"公司分组" | "流程看板" | "日程" | "面试题库" | "数据备份">("公司分组");
  const [now, setNow] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<JobDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Job | null>(null);
  const [reordering, setReordering] = useState(false);
  const [analysisJob, setAnalysisJob] = useState<Job | null>(null);
  const [processJob, setProcessJob] = useState<Job | null>(null);
  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [resumeManagerOpen, setResumeManagerOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [checklistSavingId, setChecklistSavingId] = useState("");
  const jobsRef = useRef(jobs);
  const loadRequestId = useRef(0);
  useEffect(() => { jobsRef.current = jobs; }, [jobs]);

  const loadJobs = useCallback(async () => {
    const requestId = ++loadRequestId.current;
    setError("");
    setLoading(true);
    try {
      let response = await fetch("/api/jobs", { cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(15_000) });
      if ([401, 502, 503, 504].includes(response.status)) {
        await new Promise((resolve) => setTimeout(resolve, 700));
        if (requestId !== loadRequestId.current) return;
        response = await fetch("/api/jobs", { cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(15_000) });
      }
      if (requestId !== loadRequestId.current) return;
      if (response.status === 401) { setJobs([]); setAccessState("anonymous"); return; }
      if (response.status === 403) { setJobs([]); setAccessState("forbidden"); return; }
      if (!(response.headers.get("content-type") ?? "").includes("application/json")) throw new Error("暂时无法连接岗位服务，请点击重新加载。");
      const data = await response.json() as { jobs?: Job[]; error?: string };
      if (requestId !== loadRequestId.current) return;
      if (!response.ok) throw new Error(data.error || "岗位加载失败");
      if (!Array.isArray(data.jobs)) throw new Error("岗位返回格式异常，请重试。");
      setJobs(data.jobs); setAccessState("ready");
    } catch (loadError) {
      if (requestId === loadRequestId.current) setError(loadError instanceof Error && !/abort|timeout/i.test(loadError.name) ? loadError.message : "连接超时，请点击重新加载；已保存的岗位不会被清空。");
    } finally { if (requestId === loadRequestId.current) setLoading(false); }
  }, []);
  useEffect(() => { void loadJobs(); setNow(Date.now()); const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => { loadRequestId.current += 1; window.clearInterval(timer); }; }, [loadJobs]);

  const createJob = useCallback(async (input: JobDraft) => {
    const response = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    const data = await response.json() as { job?: Job; error?: string };
    if (!response.ok || !data.job) throw new Error(data.error || "岗位保存失败");
    setJobs((current) => [data.job!, ...current]); return data.job;
  }, []);
  const updateJob = useCallback(async (id: number, input: JobUpdate) => {
    const response = await fetch(`/api/jobs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    const data = await response.json() as { job?: Job; error?: string };
    if (!response.ok || !data.job) throw new Error(data.error || "岗位更新失败");
    setJobs((current) => current.map((item) => item.id === id ? data.job! : item)); return data.job;
  }, []);

  useEffect(() => {
    if (accessState !== "ready") return;
    const context = getOptionalBrowserContext();
    const definitions: BrowserToolDefinition[] = [];
    const register = (tool: BrowserToolDefinition) => { definitions.push(tool); };
    void register({ name: "list_jobs", title: "查看岗位", description: "查看岗位、投递状态、优先级、截止日期与简历匹配度。", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: () => ({ jobs: jobsRef.current.map(({ id, company, role, status, priority, applicationDeadline, matchScore }) => ({ id, company, role, status, priority, applicationDeadline, matchScore })) }) });
    void register({ name: "create_job", title: "新增岗位", description: "向岗位库新增一个实习或求职岗位。", inputSchema: { type: "object", properties: { company: { type: "string" }, role: { type: "string" }, location: { type: "string" }, status: { type: "string", enum: STATUSES }, responsibilities: { type: "string" }, requirements: { type: "string" }, sourceUrl: { type: "string" }, priority: { type: "string", enum: JOB_PRIORITIES }, applicationDeadline: { type: "string" }, resumeVersion: { type: "string", enum: RESUME_VERSIONS } }, required: ["company", "role"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: true }, execute: async (input) => { const value = input as Partial<JobDraft>; if (!value.company?.trim() || !value.role?.trim()) throw new Error("公司名称和岗位名称不能为空"); const job = await createJob({ ...EMPTY_DRAFT, ...value, status: (value.status as Status) ?? "未投递" }); return { id: job.id, company: job.company, role: job.role, status: job.status, priority: job.priority, matchScore: job.matchScore }; } });
    void register({ name: "update_job_status", title: "更新投递状态", description: "更新一个已有岗位的投递状态。", inputSchema: { type: "object", properties: { id: { type: "number" }, status: { type: "string", enum: STATUSES } }, required: ["id", "status"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: async (input) => { const value = input as { id?: number; status?: Status }; if (!Number.isInteger(value.id) || !value.status || !STATUSES.includes(value.status)) throw new Error("岗位编号或状态无效"); const job = await updateJob(value.id!, { status: value.status }); return { id: job.id, company: job.company, role: job.role, status: job.status }; } });
    return registerOptionalBrowserTools(context, definitions);
  }, [accessState, createJob, updateJob]);

  const reminderJobs = useMemo(() => jobs.filter((job) => {
    if (["Offer", "暂停"].includes(job.status) || !now) return false;
    const reminderDue = job.reminderAt && new Date(job.reminderAt).getTime() <= now;
    return Boolean(reminderDue || deadlineMeta(job, now)?.urgent);
  }), [jobs, now]);

  const filteredJobs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesStatus = statusFilter === "全部状态" || job.status === statusFilter;
      const haystack = [job.company, job.role, job.location, job.nature, job.responsibilities, job.requirements, job.competencies].join(" ").toLowerCase();
      return matchesStatus && (!normalized || haystack.includes(normalized));
    });
  }, [jobs, query, statusFilter]);

  const groupedJobs = useMemo(() => {
    const priorityRank: Record<string, number> = { 高: 0, 中: 1, 低: 2 };
    const compareJobs = (a: Job, b: Job) => {
      if (sortBy === "匹配度") return b.matchScore - a.matchScore;
      if (sortBy === "最近截止") return (a.applicationDeadline || "9999-12-31").localeCompare(b.applicationDeadline || "9999-12-31");
      if (sortBy === "最近更新") return b.updatedAt.localeCompare(a.updatedAt);
      if (sortBy === "优先级") return (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1) || (a.applicationDeadline || "9999-12-31").localeCompare(b.applicationDeadline || "9999-12-31") || b.matchScore - a.matchScore;
      return a.jobOrder - b.jobOrder || b.updatedAt.localeCompare(a.updatedAt);
    };
    return groupJobsByCompany(filteredJobs).map((group) => ({ ...group, jobs: [...group.jobs].sort(compareJobs) }));
  }, [filteredJobs, sortBy]);

  const canReorder = boardView === "公司分组" && sortBy === "自定义顺序" && statusFilter === "全部状态" && !query.trim();
  const jobBoardActive = boardView === "公司分组" || boardView === "流程看板" || boardView === "日程";

  const counts = useMemo(() => ({ total: jobs.length, todo: jobs.filter((job) => ["未投递", "准备中"].includes(job.status)).length, progressing: jobs.filter((job) => ["笔试", "面试", "Offer"].includes(job.status)).length, reminders: reminderJobs.length, averageMatch: jobs.length ? Math.round(jobs.reduce((sum, job) => sum + job.matchScore, 0) / jobs.length) : 0 }), [jobs, reminderJobs]);

  async function persistCustomOrder(previous: Job[], next: Job[], message: string) {
    setJobs(next);
    setReordering(true);
    try {
      const groups = groupJobsByCompany(next).map((group) => ({ jobIds: group.jobs.map((job) => job.id) }));
      const response = await fetch("/api/jobs/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groups }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "排序保存失败");
      toast.success(message);
    } catch (reorderError) {
      setJobs(previous);
      toast.error(reorderError instanceof Error ? reorderError.message : "排序保存失败");
    } finally { setReordering(false); }
  }

  function moveCompany(groupKey: string, offset: -1 | 1) {
    if (!canReorder || reordering) return;
    const groups = groupJobsByCompany(jobs);
    const index = groups.findIndex((group) => group.key === groupKey);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= groups.length) return;
    [groups[index], groups[target]] = [groups[target], groups[index]];
    void persistCustomOrder(jobs, numberGroupedJobs(groups), "公司顺序已保存");
  }

  function moveJob(groupKey: string, jobId: number, offset: -1 | 1) {
    if (!canReorder || reordering) return;
    const groups = groupJobsByCompany(jobs);
    const group = groups.find((item) => item.key === groupKey);
    if (!group) return;
    const index = group.jobs.findIndex((job) => job.id === jobId);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= group.jobs.length) return;
    [group.jobs[index], group.jobs[target]] = [group.jobs[target], group.jobs[index]];
    void persistCustomOrder(jobs, numberGroupedJobs(groups), "岗位顺序已保存");
  }

  function openCreate() { setEditingId(null); setDraft(EMPTY_DRAFT); setDialogOpen(true); }
  function openEdit(job: Job) { setEditingId(job.id); setDraft({ company: job.company, role: job.role, location: job.location, nature: job.nature, status: job.status, responsibilities: job.responsibilities, requirements: job.requirements, competencies: job.competencies, sourceUrl: job.sourceUrl, rawText: job.rawText, priority: job.priority, applicationDeadline: job.applicationDeadline, reminderAt: job.reminderAt, resumeVersion: job.resumeVersion }); setDialogOpen(true); }

  async function saveJob() {
    const parsed = parseJobText(draft.rawText) as Partial<JobDraft>;
    const normalizedDraft = mergeParsedJob(draft, parsed) as JobDraft;
    if (!normalizedDraft.company.trim() || !normalizedDraft.role.trim()) { toast.error("请填写公司名称和岗位名称"); return; }
    setSaving(true);
    try { if (editingId) await updateJob(editingId, normalizedDraft); else await createJob(normalizedDraft); setDialogOpen(false); toast.success(editingId ? "岗位信息已更新" : "岗位已加入清单"); }
    catch (saveError) { toast.error(saveError instanceof Error ? saveError.message : "保存失败，请稍后重试"); }
    finally { setSaving(false); }
  }
  async function changeStatus(job: Job, status: Status) {
    const previous = job.status; setJobs((current) => current.map((item) => item.id === job.id ? { ...item, status } : item));
    try { await updateJob(job.id, { status }); toast.success(`已更新为“${status}”`); }
    catch (statusError) { setJobs((current) => current.map((item) => item.id === job.id ? { ...item, status: previous } : item)); toast.error(statusError instanceof Error ? statusError.message : "状态更新失败"); }
  }
  async function deleteJob() {
    if (!deleting) return;
    const job = deleting; setDeleting(null);
    try { const response = await fetch(`/api/jobs/${job.id}`, { method: "DELETE" }); if (!response.ok) { const data = await response.json() as { error?: string }; throw new Error(data.error || "删除失败"); } setJobs((current) => current.filter((item) => item.id !== job.id)); toast.success("岗位已删除"); }
    catch (deleteError) { toast.error(deleteError instanceof Error ? deleteError.message : "删除失败"); }
  }
  async function reanalyze(job: Job) {
    setAnalyzing(true);
    try { const response = await fetch(`/api/jobs/${job.id}/analyze`, { method: "POST" }); const data = await response.json() as { job?: Job; error?: string }; if (!response.ok || !data.job) throw new Error(data.error || "分析失败"); setJobs((current) => current.map((item) => item.id === job.id ? data.job! : item)); setAnalysisJob((current) => current?.id === job.id ? data.job! : current); toast.success("岗位匹配度与准备清单已更新"); }
    catch (analysisError) { toast.error(analysisError instanceof Error ? analysisError.message : "分析失败，请稍后重试"); }
    finally { setAnalyzing(false); }
  }
  async function toggleChecklist(job: Job, itemId: string) {
    const nextChecklist = job.prepChecklist.map((item) => item.id === itemId ? { ...item, done: !item.done } : item);
    const optimistic = { ...job, prepChecklist: nextChecklist };
    setChecklistSavingId(itemId); setAnalysisJob(optimistic); setJobs((current) => current.map((item) => item.id === job.id ? optimistic : item));
    try { const updated = await updateJob(job.id, { prepChecklist: nextChecklist }); setAnalysisJob((current) => current?.id === job.id ? updated : current); }
    catch (error) { setAnalysisJob((current) => current?.id === job.id ? job : current); setJobs((current) => current.map((item) => item.id === job.id ? job : item)); toast.error(error instanceof Error ? error.message : "清单保存失败"); }
    finally { setChecklistSavingId(""); }
  }
  async function saveProcessRecords(job: Job, records: ProcessRecord[]) {
    try { await updateJob(job.id, { processRecords: records }); toast.success("流程记录已保存"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "流程记录保存失败"); throw error; }
  }

  if (!loading && !error && accessState === "anonymous") return <AccessGate onRetry={() => void loadJobs()} />;
  if (!loading && !error && accessState === "forbidden") return <AccessGate forbidden onRetry={() => void loadJobs()} />;

  return <main className="workspace-bg min-h-screen text-slate-950">
    <Toaster position="top-center" richColors />
    <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/95 text-white shadow-lg shadow-slate-950/10 backdrop-blur-xl"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8"><div className="flex min-w-0 items-center gap-3"><div className="size-10 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-slate-900 shadow-sm"><img src="/offer-tower-illustrated-192.png" alt="" className="size-full object-cover" /></div><div className="min-w-0"><h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">EasyToGetGoodJob</h1><p className="hidden text-sm text-slate-400 sm:block">岗位整理 · 简历适配 · 流程准备</p></div></div><div className="flex items-center gap-2"><span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-emerald-300 lg:flex"><ShieldCheck className="size-3.5" />数据仅你可见</span><PwaInstallButton /><Button variant="outline" onClick={() => setResumeManagerOpen(true)} className="hidden h-10 rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white md:flex"><FileText className="size-4" />简历版本</Button><Button onClick={openCreate} className="h-10 rounded-xl bg-indigo-500 px-4 hover:bg-indigo-400"><Plus className="size-4" />新增岗位</Button></div></div></header>
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-indigo-600">{boardView === "面试题库" ? "INTERVIEW PREP" : boardView === "数据备份" ? "DATA SAFETY" : "MY INTERNSHIP BOARD"}</p><h2 className="mt-1 text-2xl font-bold tracking-tight">{boardView === "面试题库" ? "面试准备" : boardView === "数据备份" ? "数据中心" : "岗位看板"}</h2></div><p className="hidden text-sm text-slate-500 md:block">{boardView === "面试题库" ? "练习近三年真题方向，沉淀自己的回答与复盘" : boardView === "数据备份" ? "导出、迁移并安全恢复你的求职资料" : "按优先级、截止日期和匹配度安排投递准备"}</p></div>
      <div className="mb-5 overflow-x-auto pb-1"><nav aria-label="工作区视图" className="flex w-max gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">{(["公司分组", "流程看板", "日程", "面试题库", "数据备份"] as const).map((view) => <Button key={view} type="button" size="sm" variant="ghost" onClick={() => setBoardView(view)} className={`rounded-lg px-4 ${boardView === view ? "bg-slate-950 text-white hover:bg-slate-900 hover:text-white" : "text-slate-500"}`}>{view}</Button>)}<Button type="button" size="sm" variant="ghost" onClick={() => setResumeManagerOpen(true)} className="rounded-lg text-indigo-600 sm:hidden">简历版本</Button></nav></div>
      {jobBoardActive && <><section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">{[
        { label: "全部岗位", value: counts.total, icon: BriefcaseBusiness, tone: "bg-slate-950 text-white", subdued: "text-white/75" },
        { label: "待投递", value: counts.todo, icon: Clock3, tone: "bg-white text-slate-950", subdued: "text-slate-500" },
        { label: "有进展", value: counts.progressing, icon: Target, tone: "bg-white text-slate-950", subdued: "text-slate-500" },
        { label: "当前提醒", value: counts.reminders, icon: Bell, tone: counts.reminders ? "bg-amber-500 text-white" : "bg-white text-slate-950", subdued: counts.reminders ? "text-white/80" : "text-slate-500" },
        { label: "平均匹配度", value: `${counts.averageMatch}%`, icon: Gauge, tone: "col-span-2 bg-indigo-600 text-white md:col-span-1", subdued: "text-white/75" },
      ].map(({ label, value, icon: Icon, tone, subdued }) => <div key={label} className={`rounded-[1.25rem] border border-slate-200/70 p-4 shadow-[0_10px_30px_-18px_rgba(15,23,42,.35)] ${tone}`}><div className="mb-3 flex items-center justify-between gap-3"><span className={`text-sm font-medium ${subdued}`}>{label}</span><Icon className="size-4 opacity-75" /></div><p className="text-3xl font-bold tracking-tight">{value}</p></div>)}</section>
      {reminderJobs.length > 0 && <section className="mb-5 flex flex-col gap-3 rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500 text-white"><Bell className="size-5" /></span><div><p className="font-bold text-amber-950">有 {reminderJobs.length} 个岗位需要处理</p><p className="mt-1 text-sm leading-6 text-amber-800">{reminderJobs.slice(0, 3).map((job) => `${job.company}·${job.role}`).join("，")}{reminderJobs.length > 3 ? "等" : ""}</p></div></div><Button variant="outline" size="sm" onClick={() => setSortBy("最近截止")} className="rounded-xl border-amber-300 bg-white text-amber-800 hover:bg-amber-100">按截止日期查看</Button></section>}
      <section className="mb-5 rounded-[1.25rem] border border-white/80 bg-white/90 p-3 shadow-[0_14px_40px_-24px_rgba(15,23,42,.35)] backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索公司、岗位、地点或能力要求" className="h-11 rounded-xl border-0 bg-slate-50 pl-10 text-base shadow-none" />{query && <button type="button" onClick={() => setQuery("")} aria-label="清空搜索" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X className="size-4" /></button>}</div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <div className="flex items-center gap-2"><Filter className="hidden size-4 text-slate-400 sm:block" /><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="h-11 w-full rounded-xl bg-white sm:w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="全部状态">全部状态</SelectItem>{STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
            <Select value={sortBy} onValueChange={setSortBy}><SelectTrigger className="h-11 w-full rounded-xl bg-white sm:w-40"><ArrowUpDown className="size-4" /><SelectValue /></SelectTrigger><SelectContent>{["自定义顺序", "优先级", "最近截止", "匹配度", "最近更新"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>
        {boardView === "公司分组" && sortBy === "自定义顺序" && <p className="mt-2 px-1 text-xs text-slate-400">在未搜索、未筛选时，可用箭头调整公司和岗位顺序。</p>}
      </section></>}

      {boardView === "面试题库" && <InterviewLibrary jobs={jobs.map(({ id, company, role }) => ({ id, company, role }))} />}
      {boardView === "数据备份" && <DataBackupPanel jobCount={jobs.length} onRestored={loadJobs} />}
      {jobBoardActive && <>
      {loading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-72 animate-pulse rounded-2xl bg-white" />)}</div> : error ? <div className="rounded-2xl border border-rose-200 bg-white px-6 py-14 text-center"><p className="font-semibold text-rose-700">暂时无法读取岗位</p><p className="mt-2 text-sm text-slate-500">{error}</p><Button variant="outline" onClick={() => { setLoading(true); void loadJobs(); }} className="mt-5">重新加载</Button></div> : filteredJobs.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><FileText className="size-6" /></div><h2 className="text-lg font-bold">{jobs.length ? "没有符合条件的岗位" : "从第一个意向岗位开始"}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{jobs.length ? "试试调整关键词或筛选条件。" : "粘贴招聘网页链接或岗位文字，系统会自动整理并生成准备计划。"}</p>{!jobs.length && <Button onClick={openCreate} className="mt-5 rounded-xl bg-indigo-600 hover:bg-indigo-700"><Plus className="size-4" />新增岗位</Button>}</div> : boardView === "流程看板" ? <PipelineBoard jobs={filteredJobs} onStatusChange={(job, status) => void changeStatus(job as Job, status as Status)} onOpenDetail={(job) => setDetailJob(job as Job)} /> : boardView === "日程" ? <ScheduleView jobs={filteredJobs} onOpenDetail={(job) => setDetailJob(job as Job)} /> : <div className="space-y-6">{groupedJobs.map((group, companyIndex) => <section key={group.key} className="rounded-[1.5rem] border border-white/90 bg-white/55 p-3 shadow-[0_18px_48px_-32px_rgba(15,23,42,.45)] backdrop-blur sm:p-4"><div className="mb-4 flex items-center justify-between gap-3 px-1"><div className="flex min-w-0 items-center gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-sky-500 text-white shadow-sm"><Building2 className="size-5" /></div><div className="min-w-0"><h2 className="truncate text-xl font-bold tracking-tight">{group.company}</h2><p className="mt-0.5 text-sm text-slate-500">{group.jobs.length} 个岗位</p></div></div>{canReorder && <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"><Button variant="ghost" size="icon-sm" disabled={reordering || companyIndex === 0} onClick={() => moveCompany(group.key, -1)} title="公司整体上移" aria-label={`${group.company}整体上移`}><ArrowUp className="size-4" /></Button><Button variant="ghost" size="icon-sm" disabled={reordering || companyIndex === groupedJobs.length - 1} onClick={() => moveCompany(group.key, 1)} title="公司整体下移" aria-label={`${group.company}整体下移`}><ArrowDown className="size-4" /></Button></div>}</div><div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">{group.jobs.map((job, jobIndex) => { const deadline = deadlineMeta(job, now); const nextProcess = job.processRecords.filter((record) => record.status === "待进行").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0]; const checklistDone = job.prepChecklist.filter((item) => item.done).length; return <article key={job.id} className="group overflow-hidden rounded-[1.25rem] border border-white/90 bg-white shadow-[0_14px_40px_-26px_rgba(15,23,42,.4)] transition hover:-translate-y-0.5 hover:border-indigo-200"><div className="p-5"><div className="mb-4 flex items-start justify-between gap-3"><h3 className="line-clamp-2 min-w-0 text-lg font-bold leading-6">{job.role}</h3><div className="flex shrink-0 flex-col items-end gap-1.5"><button type="button" onClick={() => setAnalysisJob(job)} className="rounded-xl bg-gradient-to-br from-slate-950 to-indigo-900 px-2.5 py-1.5 text-xs font-bold text-white"><span className="text-base">{job.matchScore}%</span> 匹配</button><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[job.status]}`}>{job.status}</span></div></div><div className="mb-3 flex flex-wrap gap-2 text-xs"><span className={`rounded-full border px-2.5 py-1 font-semibold ${PRIORITY_STYLE[job.priority] ?? PRIORITY_STYLE.中}`}>{job.priority}优先级</span>{deadline && <span className={`flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold ${deadline.className}`}><CalendarDays className="size-3.5" />{deadline.label}</span>}<span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700">{job.resumeVersion}</span></div><div className="mb-4 flex flex-wrap gap-2 text-sm text-slate-500"><span className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1.5"><MapPin className="size-3.5 text-indigo-500" />{job.location || "地点待确认"}</span><span className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1.5"><BriefcaseBusiness className="size-3.5 text-indigo-500" />{job.nature}</span></div>{nextProcess && <div className="mb-4 flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-sm text-violet-800"><CalendarClock className="size-4 shrink-0" /><span className="truncate">下一项：{nextProcess.type} · {formatDate(nextProcess.scheduledAt)}</span></div>}<div className="mb-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setAnalysisJob(job)} className="rounded-xl bg-indigo-50 px-3 py-2 text-left"><span className="block text-xs text-slate-500">准备清单</span><span className="mt-0.5 block text-sm font-bold text-indigo-700">{checklistDone}/{job.prepChecklist.length} 已完成</span></button><button type="button" onClick={() => setProcessJob(job)} className="rounded-xl bg-violet-50 px-3 py-2 text-left"><span className="block text-xs text-slate-500">流程记录</span><span className="mt-0.5 block text-sm font-bold text-violet-700">{job.processRecords.length} 条</span></button></div><div><div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-medium text-slate-400">简历匹配度</span><span className="font-bold text-indigo-600">{job.matchLevel}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400" style={{ width: `${job.matchScore}%` }} /></div></div></div><div className="border-t border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/40 px-4 py-3"><Select value={job.status} onValueChange={(value) => void changeStatus(job, value as Status)}><SelectTrigger className="mb-3 h-9 w-full rounded-lg bg-white text-sm"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select><div className="flex items-center justify-between gap-2"><div className="flex"><Button variant="ghost" size="sm" onClick={() => setDetailJob(job)} className="rounded-xl text-slate-600"><FileText className="size-4" />详情</Button><Button variant="ghost" size="sm" onClick={() => setAnalysisJob(job)} className="rounded-xl text-indigo-600"><ClipboardCheck className="size-4" />准备</Button><Button variant="ghost" size="sm" onClick={() => setProcessJob(job)} className="rounded-xl text-violet-600"><NotebookPen className="size-4" />流程</Button></div><div className="flex items-center">{canReorder && <><Button variant="ghost" size="icon-sm" disabled={reordering || jobIndex === 0} onClick={() => moveJob(group.key, job.id, -1)} title="岗位上移" aria-label={`${job.role}上移`}><ArrowUp className="size-4" /></Button><Button variant="ghost" size="icon-sm" disabled={reordering || jobIndex === group.jobs.length - 1} onClick={() => moveJob(group.key, job.id, 1)} title="岗位下移" aria-label={`${job.role}下移`}><ArrowDown className="size-4" /></Button></>}{job.sourceUrl && <Button asChild variant="ghost" size="icon-sm" title="打开岗位链接"><a href={normalizeUrl(job.sourceUrl)} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /></a></Button>}<Button variant="ghost" size="icon-sm" onClick={() => openEdit(job)} title="编辑岗位"><Pencil className="size-4" /></Button><Button variant="ghost" size="icon-sm" onClick={() => setDeleting(job)} title="删除岗位" className="text-slate-400 hover:text-rose-600"><Trash2 className="size-4" /></Button></div></div></div></article>; })}</div></section>)}</div>}
      </>}
    </div>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="[&>[data-slot=dialog-close]]:z-20 max-h-[92vh] overflow-y-auto rounded-[1.75rem] border-slate-200 p-0 shadow-2xl sm:max-w-3xl"><DialogHeader className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur"><DialogTitle className="text-xl">{editingId ? "编辑岗位" : "新增意向岗位"}</DialogTitle><DialogDescription>粘贴网页链接或岗位文字，保存后自动生成匹配分析与准备清单。</DialogDescription></DialogHeader><div className="px-6 py-2"><JobForm draft={draft} setDraft={setDraft} /></div><DialogFooter className="sticky bottom-0 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur"><Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">取消</Button><Button onClick={() => void saveJob()} disabled={saving} className="rounded-xl bg-indigo-600 px-5 hover:bg-indigo-700">{saving ? "保存中…" : "保存并生成分析"}</Button></DialogFooter></DialogContent></Dialog>
    <JobDetailDialog job={detailJob} open={Boolean(detailJob)} onOpenChange={(open) => { if (!open) setDetailJob(null); }} onEdit={(job) => { setDetailJob(null); openEdit(job as Job); }} onPrepare={(job) => { setDetailJob(null); setAnalysisJob(job as Job); }} />
    <ResumeManagerDialog open={resumeManagerOpen} onOpenChange={setResumeManagerOpen} />
    <MatchDialog job={analysisJob} open={Boolean(analysisJob)} onOpenChange={(open) => { if (!open) setAnalysisJob(null); }} onReanalyze={(job) => void reanalyze(job)} onChecklistToggle={(job, itemId) => void toggleChecklist(job, itemId)} analyzing={analyzing} checklistSavingId={checklistSavingId} />
    <ProcessDialog job={processJob} open={Boolean(processJob)} onOpenChange={(open) => { if (!open) setProcessJob(null); }} onSave={saveProcessRecords} />
    <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除这个岗位？</AlertDialogTitle><AlertDialogDescription>“{deleting?.company} · {deleting?.role}”及其投递记录将被永久删除。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void deleteJob()}>确认删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}

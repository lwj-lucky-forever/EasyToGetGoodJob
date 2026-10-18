"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, ArrowUpDown, Bell, BriefcaseBusiness, CalendarClock, CalendarDays, ChevronDown,
  CircleAlert, CircleCheckBig, CircleHelp, FileText,
  Filter, GraduationCap, Link2, ListChecks, Loader2, LockKeyhole, LogIn, MapPin, MoreHorizontal,
  NotebookPen, Plus, RefreshCw, Search, Send, ShieldCheck, Sparkles, Target, X,
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
import { JobDetailDialog, ResumeManagerDialog } from "@/components/job-workspace-views";
import { DataBackupPanel } from "@/components/data-backup-panel";
import { InterviewLibrary } from "@/components/interview-library";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { CompanyLogo } from "@/components/company-logo";
import { JobStatusMenu } from "@/components/job-status-menu";
import { JobCardActions } from "@/components/job-card-actions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScheduleView } from "@/components/schedule-board";
import { scheduleFieldDone } from "@/lib/schedule-events";
import { PipelineHub } from "@/components/pipeline-hub";
import type { PipelineStage } from "@/lib/pipeline-stages";
import { SiteNavigation } from "@/components/site-navigation";
import { WORKSPACE_PATHS, type WorkspaceView } from "@/lib/workspace-routes";
import { JOB_STATUSES, jobStatusLabel } from "@/lib/job-status";
import { JOB_NATURES, mergeParsedJob, parseJobText } from "@/lib/job-parser";
import type { MatchAnalysis, RequirementFit } from "@/lib/resume-matcher";
import { normalizeImportedJob, recognizedImportKeys, safelyParseJobText, type ImportedJob } from "@/lib/job-import";
import { groupJobsByCompany, numberGroupedJobs, orderJobGroups, hasStoredCustomOrder, MANUAL_ORDER_STORAGE_KEY } from "@/lib/job-order";
import { getOptionalBrowserContext, registerOptionalBrowserTools, type BrowserToolDefinition } from "@/lib/optional-browser-tools";
import {
  JOB_PRIORITIES, PROCESS_STATUSES, PROCESS_TYPES, RESUME_VERSIONS, recommendResumeVersion,
  type PrepChecklistItem, type ProcessRecord, type ProcessStatus, type ProcessType, type ResumeVersion,
} from "@/lib/job-workflow";

const STATUSES = JOB_STATUSES;
const NATURES = JOB_NATURES;
type Status = (typeof STATUSES)[number];
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
type ImportFieldKey = TextDraftKey | "applicationDeadline";

const EMPTY_DRAFT: JobDraft = {
  company: "", role: "", location: "", nature: "待确认", status: "未投递", responsibilities: "",
  requirements: "", competencies: "", sourceUrl: "", rawText: "", priority: "中",
  applicationDeadline: "", reminderAt: "", resumeVersion: "通用版",
};

const STATUS_STYLE: Record<Status, string> = {
  未投递: "border-slate-200/70 bg-slate-50 text-slate-500", 准备中: "border-amber-100/80 bg-amber-50/70 text-amber-700",
  已投递: "border-blue-100/80 bg-blue-50/70 text-blue-700", 笔试: "border-violet-100/80 bg-violet-50/70 text-violet-700",
  面试: "border-fuchsia-100/80 bg-fuchsia-50/70 text-fuchsia-700", Offer: "border-emerald-100/80 bg-emerald-50/70 text-emerald-700",
  暂停: "border-rose-100/80 bg-rose-50/70 text-rose-700",
};
const PRIORITY_STYLE: Record<string, string> = {
  高: "border-rose-100/80 bg-rose-50/70 text-rose-700", 中: "border-amber-100/80 bg-amber-50/70 text-amber-700", 低: "border-slate-200/70 bg-slate-50 text-slate-500",
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
  const [importing, setImporting] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  function update<K extends keyof JobDraft>(key: K, value: JobDraft[K]) { setDraft((current) => ({ ...current, [key]: value })); }

  function applyRecognized(parsed: ImportedJob, originalRawText?: string) {
    const keys = recognizedImportKeys(parsed) as ImportFieldKey[];
    if (!keys.length) return 0;
    setDraft((current) => {
      const next: JobDraft = { ...current };
      for (const key of keys) {
        if (key === "applicationDeadline") continue;
        const value = parsed[key];
        if (typeof value === "string" && value) next[key] = value;
      }
      if (typeof parsed.applicationDeadline === "string" && parsed.applicationDeadline) next.applicationDeadline = parsed.applicationDeadline;
      if (originalRawText !== undefined) next.rawText = originalRawText;
      next.resumeVersion = recommendResumeVersion(next);
      return next;
    });
    return keys.length;
  }

  function analyze() {
    try {
      const parsed = safelyParseJobText(draft.rawText);
      const keys = recognizedImportKeys(parsed) as ImportFieldKey[];
      if (!keys.length) { toast.info("已保留原文，但没有识别到明确字段；请检查文本是否包含岗位名称、职责或要求"); return; }
      const count = applyRecognized(parsed, draft.rawText);
      setImportWarnings([]);
      toast.success(`已识别并填充${count}项信息，可在下方继续编辑`);
    } catch {
      toast.error("文本识别没有完成，原文已保留，可手动填写或稍后重试");
    }
  }

  async function importFromUrl() {
    if (!draft.sourceUrl.trim()) { toast.error("请先粘贴招聘网页链接"); return; }
    setImporting(true);
    setImportWarnings([]);
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
      const keys = recognizedImportKeys(parsed) as ImportFieldKey[];
      if (!keys.length) throw new Error("网页已读取，但没有识别到有效岗位字段；请改用文本粘贴");
      const warnings = Array.isArray(data.warnings) ? data.warnings.filter((item): item is string => typeof item === "string").slice(0, 3) : [];
      const count = applyRecognized(parsed, parsed.rawText ?? draft.rawText);
      setImportWarnings(warnings);
      toast.success(`已从网页填充${count}项岗位信息，可在下方继续编辑`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "网页读取失败，请改用文本粘贴"); }
    finally { setImporting(false); }
  }


  return <div className="space-y-5">
    <section className="overflow-hidden rounded-[1.35rem] border border-indigo-200/70 bg-gradient-to-br from-indigo-50 via-white to-sky-50 shadow-sm shadow-indigo-100/60">
      <button type="button" onClick={() => setPasteOpen((open) => !open)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"><span className="flex items-center gap-3 text-sm font-bold text-slate-900"><span className="grid size-8 place-items-center rounded-xl bg-indigo-600 text-white"><Sparkles className="size-4" /></span><span>智能导入岗位<span className="ml-2 hidden text-xs font-medium text-slate-500 sm:inline">支持网页链接或完整文本</span></span></span><ChevronDown className={`size-4 text-indigo-600 transition ${pasteOpen ? "rotate-180" : ""}`} /></button>
      {pasteOpen && <div className="space-y-4 border-t border-indigo-100/80 p-4 sm:p-5">
        <div className="space-y-2"><Label htmlFor="import-url" className="flex items-center gap-2"><Link2 className="size-4 text-indigo-500" />招聘网页链接</Label><div className="flex flex-col gap-2 sm:flex-row"><Input id="import-url" value={draft.sourceUrl} onChange={(event) => update("sourceUrl", event.target.value)} placeholder="粘贴招聘官网、招聘平台的岗位网页" className="h-11 rounded-xl bg-white" /><Button type="button" onClick={() => void importFromUrl()} disabled={importing || !draft.sourceUrl.trim()} className="h-11 shrink-0 rounded-xl bg-slate-950 hover:bg-indigo-700">{importing ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}{importing ? "导入中" : "导入并填充"}</Button></div><p className="text-xs leading-5 text-slate-500">优先读取具体岗位的结构化详情，支持阿里校招、字节、百度、小米、小红书及美团、Moka 等招聘页；登录或安全验证页请改用文本粘贴。</p></div>
        <div className="flex items-center gap-3 text-xs font-medium text-slate-400"><span className="h-px flex-1 bg-indigo-100" />或粘贴岗位文字<span className="h-px flex-1 bg-indigo-100" /></div>
        <Textarea value={draft.rawText} onChange={(event) => { update("rawText", event.target.value); setImportWarnings([]); }} placeholder={"直接粘贴完整招聘信息，无需整理格式。\n系统会识别公司、岗位、地点、岗位性质、工作内容和岗位要求。"} className="min-h-36 resize-y rounded-2xl border-indigo-100 bg-white/90 text-base leading-7" />
        {importWarnings.length > 0 && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{importWarnings.map((warning) => <p key={warning}>• {warning}</p>)}</div>}
        <div className="flex justify-end"><Button type="button" size="sm" onClick={analyze} disabled={importing || !draft.rawText.trim()} className="rounded-xl bg-indigo-600 hover:bg-indigo-700"><Sparkles className="size-4" />识别文本并填充</Button></div>
      </div>}
    </section>

    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="company">公司名称 *</Label><Input id="company" value={draft.company} onChange={(e) => update("company", e.target.value)} placeholder="如：美团" /></div>
      <div className="space-y-2"><Label htmlFor="role">岗位名称 *</Label><Input id="role" value={draft.role} onChange={(e) => update("role", e.target.value)} placeholder="如：产品运营实习生" /></div>
      <div className="space-y-2"><Label htmlFor="location">工作地点</Label><Input id="location" value={draft.location} onChange={(e) => update("location", e.target.value)} placeholder="如：北京 · 朝阳区" /></div>
      <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>岗位性质</Label><Select value={draft.nature} onValueChange={(value) => update("nature", value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{NATURES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>投递状态</Label><Select value={draft.status} onValueChange={(value) => update("status", value as Status)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((item) => <SelectItem key={item} value={item}>{jobStatusLabel(item)}</SelectItem>)}</SelectContent></Select></div></div>
      <div className="space-y-2"><Label>岗位优先级</Label><Select value={draft.priority} onValueChange={(value) => update("priority", value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{JOB_PRIORITIES.map((item) => <SelectItem key={item} value={item}>{item}优先级</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="deadline">投递截止日期</Label><Input id="deadline" type="date" value={draft.applicationDeadline} onChange={(event) => update("applicationDeadline", event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="reminder">提醒时间</Label><Input id="reminder" type="datetime-local" value={draft.reminderAt} onChange={(event) => update("reminderAt", event.target.value)} /><p className="text-xs text-slate-400">到时间后在首页显示站内提醒</p></div>
      <div className="space-y-2"><Label>使用简历版本</Label><Select value={draft.resumeVersion} onValueChange={(value) => update("resumeVersion", value as ResumeVersion)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{RESUME_VERSIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><p className="text-xs text-slate-400">当前推荐：{recommendResumeVersion(draft)}</p></div>
    </div>
    <div className="space-y-2"><Label htmlFor="responsibilities">工作内容</Label><Textarea id="responsibilities" value={draft.responsibilities} onChange={(e) => update("responsibilities", e.target.value)} placeholder="粘贴或概括岗位职责" className="min-h-24 text-base leading-6" /></div>
    <div className="space-y-2"><Label htmlFor="requirements">岗位要求</Label><Textarea id="requirements" value={draft.requirements} onChange={(e) => update("requirements", e.target.value)} placeholder="学历、专业、实习时长、技能等" className="min-h-24 text-base leading-6" /></div>
    <div className="space-y-2"><Label htmlFor="competencies">重点考察能力</Label><p className="text-xs text-slate-500">从岗位职责和要求中归纳，并保留原文依据，可手动调整。</p><Textarea id="competencies" value={draft.competencies} onChange={(e) => update("competencies", e.target.value)} placeholder="如：数据分析、沟通协调、产品思维、英语能力" className="min-h-20 text-base leading-6" /></div>
  </div>;
}

const FIT_STYLE: Record<RequirementFit, { className: string; icon: typeof CircleCheckBig }> = {
  匹配: { className: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: CircleCheckBig },
  部分匹配: { className: "border-blue-200 bg-blue-50 text-blue-700", icon: CircleHelp },
  需补充: { className: "border-rose-200 bg-rose-50 text-rose-700", icon: CircleAlert },
  待确认: { className: "border-amber-200 bg-amber-50 text-amber-700", icon: CircleHelp },
};

function AccessGate({ forbidden = false, onRetry, returnTo }: { forbidden?: boolean; onRetry: () => void; returnTo: string }) {
  return <main className="workspace-bg min-h-screen text-slate-950"><header className="workspace-header relative border-b border-white/15 text-white"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4"><div className="flex min-w-0 items-center gap-2.5"><div className="size-10 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-slate-900"><img src="/offer-tower-illustrated-192.png" alt="" className="size-full object-cover" /></div><div className="min-w-0"><h1 className="truncate font-bold">EasyToGetGoodJob</h1><p className="text-sm text-slate-400">公开入口 · 个人数据受保护</p></div></div><PwaInstallButton /></div></header><div className="mx-auto grid min-h-[calc(100vh-73px)] max-w-5xl place-items-center px-5 py-12"><section className="w-full max-w-xl rounded-[2rem] border border-white bg-white/95 p-7 text-center shadow-2xl shadow-slate-300/50 sm:p-10"><div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-indigo-50 to-sky-100 text-indigo-600">{forbidden ? <ShieldCheck className="size-7" /> : <LockKeyhole className="size-7" />}</div><h2 className="text-2xl font-bold tracking-tight">{forbidden ? "这是刘尉婕的个人工作区" : "登录后进入个人工作区"}</h2><p className="mt-3 text-base leading-7 text-slate-500">{forbidden ? "网站可以公开访问，但简历、岗位记录和匹配分析仅对工作区所有者开放。" : "为保护简历和求职记录，公开页面不会展示任何个人数据。使用你的ChatGPT账号登录后即可继续。"}</p><Button asChild className="mt-7 h-11 rounded-xl bg-indigo-600 px-5 hover:bg-indigo-700"><a href={`${forbidden ? "/signout-with-chatgpt" : "/signin-with-chatgpt"}?return_to=${encodeURIComponent(returnTo)}`} target="_top"><LogIn className="size-4" />{forbidden ? "切换账号" : "登录并进入"}</a></Button><Button variant="outline" onClick={onRetry} className="ml-3 mt-7 h-11 rounded-xl">我已登录，重新检查</Button><div className="mt-7 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-sm text-slate-400"><ShieldCheck className="size-4" />岗位与简历内容不会公开展示</div></section></div></main>;
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
      <section className="relative grid gap-4 overflow-hidden rounded-[1.4rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-800 p-6 text-white shadow-xl shadow-indigo-200/40 sm:grid-cols-[150px_1fr] sm:items-center"><div className="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full bg-sky-400/15 blur-2xl" /><div className="text-center sm:border-r sm:border-white/15"><p className="text-5xl font-bold tracking-tight">{analysis.score}<span className="text-xl text-white/60">%</span></p><p className="mt-2 text-sm font-semibold text-sky-200">{analysis.level}匹配</p></div><div><p className="text-base font-semibold">整体判断</p><p className="mt-2 text-sm leading-6 text-slate-300">{analysis.summary}</p><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white/10 px-2.5 py-1">实际简历：{analysis.resumeSource.name ?? "未上传"}</span><span className="rounded-full bg-sky-400/15 px-2.5 py-1 text-sky-100">建议方向：{analysis.recommendedResumeVersion}</span>{analysis.resumeSource.updatedAt && <span className="rounded-full bg-white/10 px-2.5 py-1">简历保存于：{new Date(analysis.resumeSource.updatedAt).toLocaleString("zh-CN")}</span>}</div></div></section>
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

export default function JobWorkspace({ initialView = "岗位管理", pipelineStage }: { initialView?: WorkspaceView; pipelineStage?: PipelineStage }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessState, setAccessState] = useState<"checking" | "ready" | "anonymous" | "forbidden">("checking");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("全部状态");
  const [sortBy, setSortBy] = useState("默认顺序");
  const [hasManualOrder, setHasManualOrder] = useState(false);
  const [boardView, setBoardView] = useState<WorkspaceView>(initialView);
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
  const [backupOpen, setBackupOpen] = useState(false);
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
      let rememberedManualOrder = false;
      try { rememberedManualOrder = window.localStorage.getItem(MANUAL_ORDER_STORAGE_KEY) === "true"; } catch { /* Storage may be unavailable; existing positions remain usable. */ }
      setHasManualOrder((current) => current || rememberedManualOrder || hasStoredCustomOrder(data.jobs!));
      setJobs(data.jobs); setAccessState("ready");
      setAnalysisJob((current) => current ? data.jobs!.find((job) => job.id === current.id) ?? null : null);
      setDetailJob((current) => current ? data.jobs!.find((job) => job.id === current.id) ?? null : null);
      return data.jobs;
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
    return Boolean((reminderDue && !scheduleFieldDone(job, "reminder")) || (deadlineMeta(job, now)?.urgent && !scheduleFieldDone(job, "deadline")));
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
    const visible = new Set(filteredJobs.map((job) => job.id));
    const groups = orderJobGroups(jobs, hasManualOrder ? "custom" : "match");
    return groups.map((group) => {
      const visibleJobs = group.jobs.filter((job) => visible.has(job.id));
      return { ...group, jobs: sortBy === "默认顺序" ? visibleJobs : [...visibleJobs].sort(compareJobs) };
    }).filter((group) => group.jobs.length > 0);
  }, [jobs, filteredJobs, sortBy, hasManualOrder]);

  const canReorder = boardView === "岗位管理" && sortBy === "默认顺序" && statusFilter === "全部状态" && !query.trim();
  const jobBoardActive = boardView !== "面试题库";
  const showManagementTools = boardView === "岗位管理";
  const returnTo = boardView === "求职进度" && pipelineStage ? `/pipeline/${pipelineStage}` : WORKSPACE_PATHS[boardView];

  const counts = useMemo(() => ({ total: jobs.length, todo: jobs.filter((job) => job.status === "未投递").length, progressing: jobs.filter((job) => ["准备中", "已投递", "笔试", "面试"].includes(job.status)).length, reminders: reminderJobs.length }), [jobs, reminderJobs]);

  async function persistCustomOrder(previous: Job[], next: Job[], message: string) {
    const previousManualOrder = hasManualOrder;
    setHasManualOrder(true);
    setJobs(next);
    setReordering(true);
    try {
      const groups = groupJobsByCompany(next).map((group) => ({ jobIds: group.jobs.map((job) => job.id) }));
      const response = await fetch("/api/jobs/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groups }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "排序保存失败");
      try { window.localStorage.setItem(MANUAL_ORDER_STORAGE_KEY, "true"); } catch { /* Saved positions are still preserved by the existing API. */ }
      toast.success(message);
    } catch (reorderError) {
      setJobs(previous);
      setHasManualOrder(previousManualOrder);
      toast.error(reorderError instanceof Error ? reorderError.message : "排序保存失败");
    } finally { setReordering(false); }
  }

  function moveCompany(groupKey: string, offset: -1 | 1) {
    if (!canReorder || reordering) return;
    const groups = orderJobGroups(jobs, hasManualOrder ? "custom" : "match");
    const index = groups.findIndex((group) => group.key === groupKey);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= groups.length) return;
    [groups[index], groups[target]] = [groups[target], groups[index]];
    void persistCustomOrder(jobs, numberGroupedJobs(groups), "公司顺序已保存");
  }

  function moveJob(groupKey: string, jobId: number, offset: -1 | 1) {
    if (!canReorder || reordering) return;
    const groups = orderJobGroups(jobs, hasManualOrder ? "custom" : "match");
    const group = groups.find((item) => item.key === groupKey);
    if (!group) return;
    const index = group.jobs.findIndex((job) => job.id === jobId);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= group.jobs.length) return;
    [group.jobs[index], group.jobs[target]] = [group.jobs[target], group.jobs[index]];
    void persistCustomOrder(jobs, numberGroupedJobs(groups), "岗位顺序已保存");
  }

  function renderJobCard(job: Job, groupKey = "", jobIndex = 0, groupSize = 0, showCompany = false) {
    const deadline = deadlineMeta(job, now); const nextProcess = job.processRecords.filter((record) => record.status === "待进行").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0]; const checklistDone = job.prepChecklist.filter((item) => item.done).length; return <article key={job.id} className="workspace-job-card group flex h-[248px] w-full flex-col overflow-hidden rounded-xl border bg-white">
              <div className="min-h-0 flex-1 px-4 pt-4 sm:px-5">
                <div className="mb-2 flex h-11 items-start justify-between gap-2"><h3 title={`${job.company} · ${job.role}`} className="line-clamp-2 h-11 min-w-0 text-[17px] font-bold leading-[22px] tracking-tight text-slate-900">{showCompany && <CompanyLogo company={job.company} className="mr-1.5 inline-flex size-5 rounded-md p-0.5 align-text-bottom" />}{job.role}</h3><button type="button" onClick={() => setAnalysisJob(job)} title="查看岗位匹配分析" className="inline-flex h-7 shrink-0 items-center gap-0.5 rounded-lg border border-indigo-100/80 bg-gradient-to-br from-indigo-50 to-violet-50 px-2 text-[10px] font-medium text-indigo-600 transition-colors hover:border-indigo-200 hover:bg-indigo-100/80"><span className="text-sm font-semibold tabular-nums">{job.matchScore}%</span> 匹配</button></div>
                <div className="mb-3 flex h-7 min-w-0 items-center gap-2"><JobStatusMenu value={job.status} onValueChange={(status) => void changeStatus(job, status)} label={`${job.role}的投递状态`} className={STATUS_STYLE[job.status]} /><span className={`inline-flex h-6 shrink-0 items-center rounded-md border px-2 text-[11px] font-medium ${PRIORITY_STYLE[job.priority] ?? PRIORITY_STYLE.中}`}>{job.priority}优先级</span>{deadline && <span title={deadline.label} className={`flex h-6 min-w-0 items-center gap-1 rounded-md border px-2 text-[11px] font-medium ${deadline.className}`}><CalendarDays className="size-3.5 shrink-0" /><span className="truncate">{deadline.label}</span></span>}</div>
                <div className="flex h-4 min-w-0 items-center gap-x-3 text-xs text-slate-500"><span title={job.location || "地点待确认"} className="flex min-w-0 flex-1 items-center gap-1.5"><MapPin className="size-3.5 shrink-0 text-slate-400" /><span className="truncate">{job.location || "地点待确认"}</span></span><span title={job.nature} className="flex max-w-[35%] min-w-0 items-center gap-1.5"><BriefcaseBusiness className="size-3.5 shrink-0" /><span className="truncate">{job.nature}</span></span><span title={job.resumeVersion} className="max-w-[26%] truncate text-slate-500">{job.resumeVersion}</span></div>
                <div className={`mt-3 flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs ${nextProcess ? "bg-indigo-50 text-indigo-600" : "bg-slate-100/80 text-slate-500"}`}><CalendarClock className="size-3.5 shrink-0" /><span className="truncate" title={nextProcess ? `下一项：${nextProcess.type} · ${formatDate(nextProcess.scheduledAt)}` : "下一项：暂未安排"}>{nextProcess ? `下一项：${nextProcess.type} · ${formatDate(nextProcess.scheduledAt)}` : "下一项：暂未安排"}</span></div>
              </div>
              <JobCardActions role={job.role} sourceUrl={normalizeUrl(job.sourceUrl)} onDetail={() => setDetailJob(job)} onPrepare={() => setAnalysisJob(job)} onProcess={() => setProcessJob(job)} onEdit={() => openEdit(job)} onDelete={() => setDeleting(job)} onMoveUp={() => moveJob(groupKey, job.id, -1)} onMoveDown={() => moveJob(groupKey, job.id, 1)} canMoveUp={canReorder && !reordering && jobIndex > 0} canMoveDown={canReorder && !reordering && jobIndex < groupSize - 1} preparationLabel={"准备清单：" + checklistDone + "/" + job.prepChecklist.length} processLabel="新建笔试或面试日程" preparationCount={`${checklistDone}/${job.prepChecklist.length}`} />
            </article>;
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
    try { await updateJob(job.id, { status }); toast.success(`已更新为“${jobStatusLabel(status)}”`); }
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
  async function refreshResumeMatches() {
    // Saving the resume refreshes matches server-side, even when the browser closes.
    return Boolean(await loadJobs());
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

  if (!loading && !error && accessState === "anonymous") return <AccessGate returnTo={returnTo} onRetry={() => void loadJobs()} />;
  if (!loading && !error && accessState === "forbidden") return <AccessGate returnTo={returnTo} forbidden onRetry={() => void loadJobs()} />;

  return <main className="workspace-bg min-h-screen text-slate-950">
    <Toaster position="top-center" richColors />
    <header className="workspace-header sticky top-0 z-30 border-b border-white/15 text-white"><div className="workspace-header-inner mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8"><a href="/" aria-label="返回网站首页" className="flex min-w-0 items-center gap-3 rounded-lg"><div className="size-8 shrink-0 overflow-hidden rounded-lg border border-white/20 bg-white/10"><img src="/offer-tower-illustrated-192.png" alt="" className="size-full object-cover" /></div><div className="min-w-0"><h1 className="truncate text-base font-semibold tracking-tight">EasyToGetGoodJob</h1><p className="mt-0.5 hidden text-[11px] text-indigo-100/80 sm:block">岗位整理 · 简历适配 · 流程准备</p></div></a><SiteNavigation current={boardView} onViewChange={pipelineStage ? undefined : setBoardView} /><div className="workspace-header-actions flex items-center gap-2">{boardView === "岗位管理" && <Button variant="outline" onClick={() => setResumeManagerOpen(true)} className="h-8 rounded-lg border-white/25 bg-white/10 px-3 text-xs text-white shadow-none hover:border-white/40 hover:bg-white/20 hover:text-white"><FileText className="size-4" />上传简历</Button>}<DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="工作区工具" className="size-8 rounded-lg text-indigo-100 hover:bg-white/10 hover:text-white"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="min-w-40 rounded-xl"><DropdownMenuItem onSelect={() => setResumeManagerOpen(true)}>上传简历</DropdownMenuItem><DropdownMenuItem onSelect={() => setBackupOpen(true)}>资料导入与导出</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></div></header>
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-7"><p className="text-[10px] font-semibold tracking-[0.12em] text-indigo-500">{({ 岗位管理: "MY JOBS", 求职进度: "APPLICATION PIPELINE", 日程: "SCHEDULE", 面试题库: "INTERVIEW PREP" })[boardView]}</p><h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{boardView === "日程" ? "日程安排" : boardView}</h2><p className="mt-2 text-base leading-6 text-slate-500">{({ 岗位管理: "整理目标岗位，安排投递优先级", 求职进度: "追踪每一步进展，沉淀求职记录", 日程: "集中查看截止日期与面试安排", 面试题库: "练习真题方向，沉淀回答与复盘" })[boardView]}</p></div>
      {showManagementTools && <><section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">{[
        { label: "全部岗位", value: counts.total, icon: BriefcaseBusiness, iconTone: "border-violet-100/80 bg-violet-50 text-violet-600" },
        { label: "待投递", value: counts.todo, icon: Send, iconTone: "border-sky-100/80 bg-sky-50 text-sky-500" },
        { label: "进行中", value: counts.progressing, icon: Target, iconTone: "border-emerald-100/80 bg-emerald-50 text-emerald-500" },
      ].map(({ label, value, icon: Icon, iconTone }) => <div key={label} className="workspace-surface flex min-h-[104px] items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4"><span className={"grid size-11 shrink-0 place-items-center rounded-2xl border sm:size-12 " + iconTone}><Icon className="size-[22px] sm:size-6" /></span><div className="min-w-0"><p className="text-xs font-medium text-slate-500 sm:text-sm">{label}</p><p className="mt-1.5 text-[30px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums sm:text-[32px]">{value}</p></div></div>)}</section>
      {reminderJobs.length > 0 && <section className="mb-5 flex flex-col gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-amber-100/70 text-amber-600"><Bell className="size-5" /></span><div><p className="font-bold text-amber-950">有 {reminderJobs.length} 个岗位需要处理</p><p className="mt-1 text-sm leading-6 text-amber-800">{reminderJobs.slice(0, 3).map((job) => `${job.company}·${job.role}`).join("，")}{reminderJobs.length > 3 ? "等" : ""}</p></div></div><Button variant="outline" size="sm" onClick={() => { setBoardView("岗位管理"); setSortBy("最近截止"); }} className="rounded-xl border-amber-300 bg-white text-amber-800 hover:bg-amber-100">按截止日期查看</Button></section>}
      <section className="workspace-surface mb-5 rounded-xl border border-slate-200/70 bg-white p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1"><Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input aria-label="搜索岗位" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索公司、岗位、地点或能力要求" className="h-10 rounded-lg border border-slate-200/80 bg-slate-50/80 pl-10 text-sm shadow-inner shadow-slate-900/[0.02] placeholder:text-slate-400 hover:border-slate-300/80" />{query && <button type="button" onClick={() => setQuery("")} aria-label="清空搜索" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X className="size-4" /></button>}</div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2"><Filter className="hidden size-4 text-slate-400 sm:block" /><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger aria-label="按投递状态筛选" className="h-10 w-36 rounded-lg border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03] hover:border-indigo-200 data-[size=default]:h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="全部状态">全部状态</SelectItem>{STATUSES.map((status) => <SelectItem key={status} value={status}>{jobStatusLabel(status)}</SelectItem>)}</SelectContent></Select></div>
            {boardView === "岗位管理" && <Select value={sortBy} onValueChange={setSortBy}><SelectTrigger className="h-10 w-full rounded-lg border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03] hover:border-indigo-200 data-[size=default]:h-10 sm:w-40"><ArrowUpDown className="size-4" /><SelectValue /></SelectTrigger><SelectContent>{["默认顺序", "优先级", "最近截止", "匹配度", "最近更新"].map((item) => <SelectItem key={item} value={item}>{item === "默认顺序" ? (hasManualOrder ? "自定义顺序" : "匹配度优先") : item}</SelectItem>)}</SelectContent></Select>}
            {boardView === "岗位管理" && <Button onClick={openCreate} className="h-10 rounded-lg bg-indigo-600 px-4 shadow-sm shadow-indigo-600/25 hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-600/20 active:bg-indigo-800"><Plus className="size-4" />新增岗位</Button>}
          </div>
        </div>
      </section></>}

      {boardView === "面试题库" && <InterviewLibrary jobs={jobs.map(({ id, company, role }) => ({ id, company, role }))} />}

      {jobBoardActive && <>
      {loading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-[248px] animate-pulse rounded-2xl bg-white" />)}</div> : error ? <div className="rounded-2xl border border-rose-200 bg-white px-6 py-14 text-center"><p className="font-semibold text-rose-700">暂时无法读取岗位</p><p className="mt-2 text-sm text-slate-500">{error}</p><Button variant="outline" onClick={() => { setLoading(true); void loadJobs(); }} className="mt-5">重新加载</Button></div> : boardView === "求职进度" ? <PipelineHub jobs={jobs} stage={pipelineStage} onUpdate={updateJob} onAnalyze={(id) => { const job = jobs.find(item => item.id === id); if (job) setAnalysisJob(job); }} onDetail={(id) => { const job = jobs.find(item => item.id === id); if (job) setDetailJob(job); }} /> : boardView === "日程" ? <ScheduleView jobs={jobs} onUpdate={updateJob} onOpenDetail={(job) => setDetailJob(job as Job)} /> : filteredJobs.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><FileText className="size-6" /></div><h2 className="text-lg font-bold">{jobs.length ? "没有符合条件的岗位" : "从第一个意向岗位开始"}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{jobs.length ? "试试调整关键词或筛选条件。" : "粘贴招聘网页链接或岗位文字，系统会自动整理并生成准备计划。"}</p>{!jobs.length && boardView === "岗位管理" && <Button onClick={openCreate} className="mt-5 rounded-xl bg-indigo-600 hover:bg-indigo-700"><Plus className="size-4" />新增岗位</Button>}</div> : <div className="space-y-6">{groupedJobs.map((group, companyIndex) => <section key={group.key} className="workspace-company-group rounded-2xl border p-3 sm:p-4"><div className="mb-4 flex items-center justify-between gap-3 px-1"><div className="flex min-w-0 items-center gap-3"><CompanyLogo company={group.company} className="size-9 rounded-lg border-slate-200/80 shadow-sm shadow-indigo-950/5" /><div className="min-w-0"><h2 className="truncate text-lg font-semibold tracking-tight text-slate-800">{group.company}</h2><p className="mt-0.5 text-xs text-slate-500">{group.jobs.length} 个岗位</p></div></div>{canReorder && <div className="flex items-center gap-0.5 rounded-lg border border-slate-200/80 bg-white p-0.5 text-slate-500 shadow-sm shadow-slate-900/5"><Button variant="ghost" size="icon-sm" disabled={reordering || companyIndex === 0} onClick={() => moveCompany(group.key, -1)} title="公司整体上移" aria-label={`${group.company}整体上移`}><ArrowUp className="size-4" /></Button><Button variant="ghost" size="icon-sm" disabled={reordering || companyIndex === groupedJobs.length - 1} onClick={() => moveCompany(group.key, 1)} title="公司整体下移" aria-label={`${group.company}整体下移`}><ArrowDown className="size-4" /></Button></div>}</div><div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">{group.jobs.map((job, jobIndex) => renderJobCard(job, group.key, jobIndex, group.jobs.length))}</div></section>)}</div>}
      </>}
    </div>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="[&>[data-slot=dialog-close]]:z-20 max-h-[92vh] overflow-y-auto rounded-[1.75rem] border-slate-200 p-0 shadow-2xl sm:max-w-3xl"><DialogHeader className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur"><DialogTitle className="text-xl">{editingId ? "编辑岗位" : "新增意向岗位"}</DialogTitle><DialogDescription>粘贴网页链接或岗位文字，保存后自动生成匹配分析与准备清单。</DialogDescription></DialogHeader><div className="px-6 py-2"><JobForm draft={draft} setDraft={setDraft} /></div><DialogFooter className="sticky bottom-0 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur"><Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">取消</Button><Button onClick={() => void saveJob()} disabled={saving} className="rounded-xl bg-indigo-600 px-5 hover:bg-indigo-700">{saving ? "保存中…" : "保存并生成分析"}</Button></DialogFooter></DialogContent></Dialog>
    <JobDetailDialog job={detailJob} open={Boolean(detailJob)} onOpenChange={(open) => { if (!open) setDetailJob(null); }} onEdit={(job) => { setDetailJob(null); openEdit(job as Job); }} onPrepare={(job) => { setDetailJob(null); setAnalysisJob(job as Job); }} />
    <Dialog open={backupOpen} onOpenChange={setBackupOpen}><DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-4xl"><DialogHeader><DialogTitle>资料导入与导出</DialogTitle><DialogDescription>导出、迁移和恢复求职资料。</DialogDescription></DialogHeader><DataBackupPanel jobCount={jobs.length} onRestored={async () => { await loadJobs(); }} /></DialogContent></Dialog>
    <ResumeManagerDialog open={resumeManagerOpen} onOpenChange={setResumeManagerOpen} onSaved={refreshResumeMatches} />
    <MatchDialog job={analysisJob} open={Boolean(analysisJob)} onOpenChange={(open) => { if (!open) setAnalysisJob(null); }} onReanalyze={(job) => void reanalyze(job)} onChecklistToggle={(job, itemId) => void toggleChecklist(job, itemId)} analyzing={analyzing} checklistSavingId={checklistSavingId} />
    <ProcessDialog job={processJob} open={Boolean(processJob)} onOpenChange={(open) => { if (!open) setProcessJob(null); }} onSave={saveProcessRecords} />
    <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除这个岗位？</AlertDialogTitle><AlertDialogDescription>“{deleting?.company} · {deleting?.role}”及其投递记录将被永久删除。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void deleteJob()}>确认删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}

"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, BadgeCheck, ClipboardCheck, FilePenLine, ListChecks, MessageSquareText, Save, Sparkles, Sprout } from "lucide-react";
import { toast } from "sonner";
import { CompanyLogo } from "@/components/company-logo";
import { InterviewLibrary } from "@/components/interview-library";
import { Button } from "@/components/ui/button";
import { PIPELINE_STAGES, findPipelineStage, pipelineStageFor, readPipelineNotes, writePipelineNotes, type PipelineNotes, type PipelineStage } from "@/lib/pipeline-stages";
import type { JobStatus } from "@/lib/job-status";
import type { PrepChecklistItem, ProcessRecord, ResumeVersion } from "@/lib/job-workflow";
import "./pipeline.css";

export type PipelineJob = {
  id: number; company: string; role: string; status: JobStatus; location: string; resumeVersion: ResumeVersion;
  requirements: string; responsibilities: string; matchScore: number;
  processRecords: ProcessRecord[]; prepChecklist: PrepChecklistItem[];
  matchAnalysis: { summary: string; priorities: string[]; requirements: { requirement: string; action: string }[] };
};
type Patch = { status?: JobStatus; processRecords?: ProcessRecord[]; prepChecklist?: PrepChecklistItem[] };
type Props = { jobs: PipelineJob[]; stage?: PipelineStage; onUpdate: (id: number, patch: Patch) => Promise<unknown>; onAnalyze: (id: number) => void; onDetail: (id: number) => void };
const ICONS = [FilePenLine, ListChecks, ClipboardCheck, MessageSquareText, BadgeCheck, Sprout];
const FIELDS: Partial<Record<PipelineStage, { key: keyof PipelineNotes; label: string; placeholder: string }[]>> = {
  assessment: [{ key: "topics", label: "笔试考察了什么", placeholder: "题型、知识点、案例题或编程题……" }, { key: "reflection", label: "答题表现与复习方向", placeholder: "时间分配、没有答好的题、下一次怎么准备……" }],
  offer: [{ key: "location", label: "具体工作地点", placeholder: "城市、园区、办公地址" }, { key: "salary", label: "薪资与福利", placeholder: "如：200 元/天，餐补另计" }, { key: "hours", label: "要求工作时间", placeholder: "如：9:30–18:30，实习至少 3 个月" }, { key: "days", label: "每周到岗天数", placeholder: "如：每周 4 天，可协商远程 1 天" }, { key: "startDate", label: "预计到岗日期", placeholder: "如：2026-11-01，或待协商" }],
  closed: [{ key: "reason", label: "未通过原因", placeholder: "记录收到的明确反馈；不确定时可写“暂未收到反馈”" }, { key: "nextAction", label: "复盘与下一步", placeholder: "哪些经验可以迁移到下一次机会？" }],
};

function StageEditor({ job, stage, onUpdate, onAnalyze }: Pick<Props, "onUpdate" | "onAnalyze"> & { job: PipelineJob; stage: PipelineStage }) {
  const [draft, setDraft] = useState<PipelineNotes>(() => readPipelineNotes(job.processRecords, stage));
  const [saving, setSaving] = useState(false);
  const [loadingResume, setLoadingResume] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(readPipelineNotes(job.processRecords, stage));
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const warnLink = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (link && !event.defaultPrevented && !window.confirm("此岗位有未保存的编辑内容。离开会丢失修改，仍要继续吗？")) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", warnLink, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", warnLink, true); };
  }, [dirty]);
  async function save() {
    setSaving(true);
    try { await onUpdate(job.id, { processRecords: writePipelineNotes(job.processRecords, stage, draft) }); setSaved(true); toast.success("已保存到该岗位"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "保存失败，请重试"); }
    finally { setSaving(false); }
  }
  async function useResume() {
    if (draft.resume?.trim() && !window.confirm("读取当前简历版本会替换编辑框内的草稿，是否继续？")) return;
    setLoadingResume(true);
    try {
      const response = await fetch("/api/resumes", { cache: "no-store" });
      const data = await response.json() as { profiles?: { name: string; content: string }[]; error?: string };
      if (!response.ok || !data.profiles) throw new Error(data.error || "简历读取失败");
      const content = data.profiles.find(profile => profile.name === job.resumeVersion)?.content;
      if (!content) throw new Error("没有找到该版本的简历，请先在简历版本管理中填写。");
      if (content.length > 3500) { toast.error("原简历超过 3500 字，请粘贴与本岗位相关的部分进行编辑。"); return; }
      setDraft(current => ({ ...current, resume: content })); setSaved(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "读取失败"); }
    finally { setLoadingResume(false); }
  }
  const done = job.prepChecklist.filter(item => item.done).length;
  if (stage === "interview") return <InterviewLibrary jobs={[job]} realInterviewJob={job} />;
  if (stage === "prepare") return <div className="pipeline-editor">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h4>岗位准备清单</h4><p className="mt-1 text-sm text-slate-500">来自岗位匹配分析 · {done}/{job.prepChecklist.length} 已完成</p></div><Button variant="outline" onClick={() => onAnalyze(job.id)}>查看分析与更新清单</Button></div>
    <div className="pipeline-progress"><span style={{ width: `${job.prepChecklist.length ? done / job.prepChecklist.length * 100 : 0}%` }} /></div>
    {job.prepChecklist.length ? <div className="space-y-2">{job.prepChecklist.map(item => <label key={item.id} className={`pipeline-check ${item.done ? "is-done" : ""}`}><input type="checkbox" checked={item.done} disabled={saving} onChange={async () => {
      setSaving(true);
      try { await onUpdate(job.id, { prepChecklist: job.prepChecklist.map(row => row.id === item.id ? { ...row, done: !row.done } : row) }); }
      catch (error) { toast.error(error instanceof Error ? error.message : "清单保存失败"); }
      finally { setSaving(false); }
    }} /><span>{item.text}<small>{item.category}</small></span></label>)}</div> : <p className="pipeline-empty">还没有准备清单，点击“查看分析与更新清单”生成。</p>}
  </div>;
  return <form className="pipeline-editor" onSubmit={event => { event.preventDefault(); void save(); }}>
    {stage === "apply" ? <>
      <div className="pipeline-advice"><Sparkles className="size-5 shrink-0" /><div><h4>围绕这个岗位，突出真实经历</h4><p>{job.matchAnalysis?.summary || "对照岗位要求，补充项目证据与可量化的结果。"}</p><ul>{(job.matchAnalysis?.requirements ?? []).slice(0, 4).map((item, index) => <li key={index}><strong>{item.requirement}</strong><br />{item.action}</li>)}</ul><Button type="button" variant="outline" className="mt-3" onClick={() => onAnalyze(job.id)}>查看完整岗位分析</Button></div></div>
      <details className="pipeline-jd"><summary>查看岗位职责与要求</summary><p>{job.responsibilities}</p><p>{job.requirements}</p></details>
      <div className="flex flex-wrap items-center justify-between gap-3"><h4>本岗位专属简历草稿</h4><Button type="button" variant="outline" disabled={loadingResume || saving} onClick={() => void useResume()}>{loadingResume ? "读取中…" : `以${job.resumeVersion}为起点`}</Button></div>
      <textarea aria-label="本岗位专属简历草稿" rows={15} maxLength={3500} value={draft.resume ?? ""} onChange={event => { setDraft({ ...draft, resume: event.target.value }); setSaved(false); }} placeholder="结合上方分析修改简历，保留真实经历，突出与岗位相关的项目和成果。" />
      <p className="text-xs leading-6 text-slate-500">仅保存本岗位的文字草稿，不覆盖通用简历，也不会自动改变匹配度。{draft.resume?.length ?? 0}/3500 字</p>
    </> : <div className="pipeline-fields">{FIELDS[stage]?.map(field => <label key={field.key}><span>{field.label}</span><textarea rows={stage === "offer" ? 2 : 5} maxLength={stage === "offer" ? 500 : 1500} value={draft[field.key] ?? ""} placeholder={field.placeholder} onChange={event => { setDraft({ ...draft, [field.key]: event.target.value }); setSaved(false); }} /></label>)}</div>}
    <div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500" role="status">{saved ? "已保存 · 下次打开可继续编辑" : "编辑后请保存"}</p><Button type="submit" disabled={saving || loadingResume} className="bg-indigo-600 text-white hover:bg-indigo-700"><Save className="size-4" />{saving ? "保存中…" : "保存到该岗位"}</Button></div>
  </form>;
}

function StageJob({ job, stage, onUpdate, onAnalyze, onDetail }: Omit<Props, "jobs" | "stage"> & { job: PipelineJob; stage: PipelineStage }) {
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState(false);
  const [changing, setChanging] = useState(false);
  const config = findPipelineStage(stage)!;
  const notes = readPipelineNotes(job.processRecords, stage);
  const done = job.prepChecklist.filter(item => item.done).length;
  const summary = stage === "prepare" ? `准备进度 ${done}/${job.prepChecklist.length}` : stage === "offer" ? [notes.location, notes.salary, notes.days].filter(Boolean).join(" · ") || "待补充 Offer 条件" : stage === "closed" ? notes.reason || "尚未填写未通过原因" : stage === "assessment" ? notes.topics || "尚未记录笔试考察内容" : stage === "apply" ? notes.resume ? "已保存岗位专属简历草稿" : "从岗位要求出发，准备一份有重点的简历" : "记录问题、回答、反馈与下一步行动";
  return <article className="pipeline-job">
    <div className="pipeline-job-header"><CompanyLogo company={job.company} className="size-12 rounded-xl" /><div className="min-w-0 flex-1"><p className="text-sm text-slate-500">{job.company}</p><h3>{job.role}</h3></div><span className="pipeline-match">{job.matchScore}% 匹配</span></div>
    <div className="pipeline-job-summary"><p>{summary}</p>{stage === "prepare" && <div className="pipeline-progress"><span style={{ width: `${job.prepChecklist.length ? done / job.prepChecklist.length * 100 : 0}%` }} /></div>}{job.status === "已投递" && <p className="mt-2 text-xs text-slate-500">原已投递岗位 · 继续准备后续考核</p>}</div>
    <div className="pipeline-job-actions"><Button onClick={() => { setVisited(true); setOpen(value => !value); }} aria-expanded={open} className="bg-indigo-600 hover:bg-indigo-700">{open ? "收起工作区" : config.action}</Button><Button variant="ghost" onClick={() => onDetail(job.id)}>岗位详情</Button><label className="ml-auto flex items-center gap-2 text-xs text-slate-500">推进阶段<select aria-label={`${job.role}的阶段`} value={stage} disabled={changing} onChange={async event => { const next = findPipelineStage(event.target.value); if (!next) return; if (visited && !window.confirm("请确认已保存本岗位的编辑内容，再切换阶段。继续吗？")) return; setChanging(true); try { await onUpdate(job.id, { status: next.status }); toast.success(`已移至${next.title}`); } catch (error) { toast.error(error instanceof Error ? error.message : "阶段更新失败"); } finally { setChanging(false); } }}>{PIPELINE_STAGES.map(item => <option key={item.slug} value={item.slug}>{item.title}</option>)}</select></label></div>
    {visited && <div hidden={!open}><StageEditor job={job} stage={stage} onUpdate={onUpdate} onAnalyze={onAnalyze} /></div>}
  </article>;
}

export function PipelineHub({ jobs, stage, ...actions }: Props) {
  const current = stage ? findPipelineStage(stage) : undefined;
  const items = current ? jobs.filter(job => pipelineStageFor(job.status) === current.slug) : [];
  return <div className="pipeline-hub">
    {!current ? <>
      <section className="pipeline-guide" aria-label="阶段使用指引"><span className="pipeline-guide-icon"><ListChecks aria-hidden="true" /></span><div><h2>按阶段推进，专注当前任务</h2><p>选择下方阶段，继续完善简历、准备考核或记录复盘。</p></div><span className="pipeline-guide-note"><span aria-hidden="true" />每个阶段，都有专属工作区</span></section>
      <div className="pipeline-stage-grid">{PIPELINE_STAGES.map((item, index) => { const Icon = ICONS[index]; const count = jobs.filter(job => pipelineStageFor(job.status) === item.slug).length; return <a key={item.slug} href={`/pipeline/${item.slug}`} className={`pipeline-stage-card pipeline-tone-${item.color}`}><div className="flex items-center justify-between"><span className="pipeline-stage-icon"><Icon /></span><span className="pipeline-stage-number">0{index + 1}</span></div><p className="pipeline-eyebrow">{item.eyebrow}</p><h3>{item.title}<span>{count} 个岗位</span></h3><p>{item.description}</p><div className="pipeline-stage-link"><span>{item.action}</span><ArrowUpRight className="size-5" /></div></a>; })}</div>
    </> : <>
      <a href="/pipeline" className="pipeline-back"><ArrowLeft className="size-4" />返回求职进度</a>
      <section className={`pipeline-stage-banner pipeline-tone-${current.color}`}><p className="pipeline-eyebrow">{current.eyebrow}</p><h2>{current.title}<span>{items.length} 个岗位</span></h2><p>{current.description}</p></section>
      <nav className="pipeline-stage-nav" aria-label="求职阶段">{PIPELINE_STAGES.map(item => <a key={item.slug} href={`/pipeline/${item.slug}`} aria-current={item.slug === stage ? "page" : undefined}>{item.title}</a>)}</nav>
      <div className="space-y-5">{items.length ? items.map(job => <StageJob key={job.id} job={job} stage={current.slug} {...actions} />) : <div className="pipeline-empty"><Sparkles className="mx-auto mb-3 size-8 text-indigo-300" /><h3>这个阶段还没有岗位</h3><p>在岗位管理或其他阶段中调整岗位状态后，会显示在这里。</p><a href="/jobs">前往岗位管理 →</a></div>}</div>
    </>}
  </div>;
}

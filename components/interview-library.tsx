"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, Building2, CalendarDays, CheckCircle2, ExternalLink, FilePenLine, Filter, Lightbulb, MessageSquareText, Plus, Search, Sparkles, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { INTERVIEW_BANK_LAST_UPDATED, INTERVIEW_QUESTIONS, type InterviewQuestion } from "@/lib/interview-question-bank";

type JobOption = { id: number; company: string; role: string };
type InterviewReview = {
  id: number;
  questionKey: string;
  company: string;
  role: string;
  category: string;
  question: string;
  answer: string;
  selfScore: number;
  reviewNotes: string;
  nextAction: string;
  sourceType: "模拟练习" | "真实面试";
  interviewRound: string;
  interviewDate: string;
  jobId: number | null;
  createdAt: string;
  updatedAt: string;
};
type ReviewDraft = Omit<InterviewReview, "id" | "createdAt" | "updatedAt">;

const EMPTY_REVIEW: ReviewDraft = {
  questionKey: "", company: "", role: "", category: "综合", question: "", answer: "", selfScore: 0,
  reviewNotes: "", nextAction: "", sourceType: "模拟练习", interviewRound: "", interviewDate: "", jobId: null,
};
const ROLE_FILTERS = ["全部方向", "产品", "运营", "设计", "测试开发", "用户研究"] as const;
const COMPANY_FILTERS = ["全部公司", "美团", "百度"] as const;
const YEAR_FILTERS = ["近三年", "2026", "2025", "2024"] as const;

function formatDate(value: string) {
  if (!value) return "未填写日期";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function scoreTone(score: number) {
  if (score >= 4) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (score >= 2) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-500";
}

function QuestionCard({ question, practiced, onPractice }: { question: InterviewQuestion; practiced: number; onPractice: (question: InterviewQuestion) => void }) {
  return <article className="overflow-hidden rounded-[1.35rem] border border-white/90 bg-white shadow-[0_16px_45px_-30px_rgba(15,23,42,.5)] transition hover:border-indigo-200">
    <div className="p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className={`rounded-full px-2.5 py-1 ${question.company === "美团" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{question.company}</span>
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">{question.category}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">{question.recruitmentSeason}</span>
      </div>
      <h3 className="text-lg font-bold leading-7 text-slate-950">{question.question}</h3>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500"><span>{question.round}</span><span>{question.roleTags.join(" / ")}</span>{practiced > 0 && <span className="flex items-center gap-1 font-semibold text-emerald-600"><CheckCircle2 className="size-4" />已复盘 {practiced} 次</span>}</div>
      <Accordion type="single" collapsible className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 px-3">
        <AccordionItem value="guide" className="border-0"><AccordionTrigger className="py-3 text-sm font-semibold text-slate-700 hover:no-underline">查看追问与回答框架</AccordionTrigger><AccordionContent className="space-y-4 pb-4">
          <div><p className="text-xs font-bold text-slate-400">可能追问</p><ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-600">{question.followUps.map((item) => <li key={item}>• {item}</li>)}</ul></div>
          <div><p className="text-xs font-bold text-slate-400">回答框架</p><ol className="mt-2 space-y-1.5 text-sm leading-6 text-slate-600">{question.answerFramework.map((item, index) => <li key={item}>{index + 1}. {item}</li>)}</ol></div>
          <div className="flex flex-wrap gap-2">{question.signals.map((item) => <span key={item} className="rounded-full border border-indigo-100 bg-white px-2.5 py-1 text-xs font-medium text-indigo-600">考察：{item}</span>)}</div>
        </AccordionContent></AccordionItem>
      </Accordion>
    </div>
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3">
      <a href={question.source.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600"><ExternalLink className="size-3.5 shrink-0" /><span className="truncate">来源：{question.source.title}</span></a>
      <Button size="sm" onClick={() => onPractice(question)} className="shrink-0 rounded-xl bg-indigo-600 hover:bg-indigo-700"><FilePenLine className="size-4" />开始练习</Button>
    </div>
  </article>;
}

function ReviewEditor({ draft, setDraft, jobs }: { draft: ReviewDraft; setDraft: React.Dispatch<React.SetStateAction<ReviewDraft>>; jobs: JobOption[] }) {
  const selectedJob = draft.jobId ? jobs.find((job) => job.id === draft.jobId) : null;
  function update<K extends keyof ReviewDraft>(key: K, value: ReviewDraft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  function chooseJob(value: string) {
    if (value === "none") { update("jobId", null); return; }
    const job = jobs.find((item) => item.id === Number(value));
    if (!job) return;
    setDraft((current) => ({ ...current, jobId: job.id, company: job.company, role: job.role }));
  }
  return <div className="space-y-5 px-6 py-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label>记录类型</Label><Select value={draft.sourceType} onValueChange={(value) => update("sourceType", value as ReviewDraft["sourceType"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="模拟练习">模拟练习</SelectItem><SelectItem value="真实面试">真实面试</SelectItem></SelectContent></Select></div>
      <div className="space-y-2"><Label>关联岗位</Label><Select value={selectedJob ? String(selectedJob.id) : "none"} onValueChange={chooseJob}><SelectTrigger><SelectValue placeholder="可选" /></SelectTrigger><SelectContent><SelectItem value="none">不关联岗位</SelectItem>{jobs.map((job) => <SelectItem key={job.id} value={String(job.id)}>{job.company} · {job.role}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>公司</Label><Input value={draft.company} onChange={(event) => update("company", event.target.value)} placeholder="如：美团" /></div>
      <div className="space-y-2"><Label>岗位方向</Label><Input value={draft.role} onChange={(event) => update("role", event.target.value)} placeholder="如：产品经理" /></div>
      <div className="space-y-2"><Label>轮次</Label><Input value={draft.interviewRound} onChange={(event) => update("interviewRound", event.target.value)} placeholder="如：业务一面" /></div>
      <div className="space-y-2"><Label>练习/面试日期</Label><Input type="date" value={draft.interviewDate} onChange={(event) => update("interviewDate", event.target.value)} /></div>
    </div>
    <div className="space-y-2"><Label>面试题 *</Label><Textarea value={draft.question} onChange={(event) => update("question", event.target.value)} className="min-h-24 text-base leading-7" placeholder="记录面试官的原问题或练习题" /></div>
    <div className="space-y-2"><Label>我的回答</Label><Textarea value={draft.answer} onChange={(event) => update("answer", event.target.value)} className="min-h-40 text-base leading-7" placeholder="建议按结论—证据—行动—结果组织回答" /></div>
    <div className="space-y-2"><Label>自评分</Label><div className="grid grid-cols-6 gap-2">{[0, 1, 2, 3, 4, 5].map((score) => <button type="button" key={score} onClick={() => update("selfScore", score)} className={`rounded-xl border px-2 py-2 text-sm font-bold transition ${draft.selfScore === score ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-indigo-200"}`}>{score === 0 ? "未评" : `${score}分`}</button>)}</div></div>
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>复盘记录</Label><Textarea value={draft.reviewNotes} onChange={(event) => update("reviewNotes", event.target.value)} className="min-h-28" placeholder="哪里没答好、遗漏了什么、面试官如何追问" /></div><div className="space-y-2"><Label>下一步行动</Label><Textarea value={draft.nextAction} onChange={(event) => update("nextAction", event.target.value)} className="min-h-28" placeholder="如：补充漏斗指标案例，并重新录音练习" /></div></div>
  </div>;
}

export function InterviewLibrary({ jobs }: { jobs: JobOption[] }) {
  const [tab, setTab] = useState<"题库" | "我的复盘">("题库");
  const [reviews, setReviews] = useState<InterviewReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<(typeof COMPANY_FILTERS)[number]>("全部公司");
  const [role, setRole] = useState<(typeof ROLE_FILTERS)[number]>("全部方向");
  const [year, setYear] = useState<(typeof YEAR_FILTERS)[number]>("近三年");
  const [query, setQuery] = useState("");
  const [practiceState, setPracticeState] = useState("全部题目");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ReviewDraft>(EMPTY_REVIEW);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<InterviewReview | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/interview-reviews", { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as { reviews?: InterviewReview[]; error?: string };
      if (!response.ok || !data.reviews) throw new Error(data.error || "复盘读取失败");
      if (active) setReviews(data.reviews);
    }).catch((error) => { if (active) toast.error(error instanceof Error ? error.message : "复盘读取失败"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const reviewCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const review of reviews) if (review.questionKey) map.set(review.questionKey, (map.get(review.questionKey) ?? 0) + 1);
    return map;
  }, [reviews]);
  const filteredQuestions = useMemo(() => INTERVIEW_QUESTIONS.filter((item) => {
    const normalized = query.trim().toLowerCase();
    const practiced = (reviewCounts.get(item.id) ?? 0) > 0;
    return (company === "全部公司" || item.company === company)
      && (role === "全部方向" || item.roleTags.includes(role))
      && (year === "近三年" || item.year === Number(year))
      && (practiceState === "全部题目" || (practiceState === "已复盘" ? practiced : !practiced))
      && (!normalized || [item.question, item.category, item.company, item.roleTags.join(" "), item.followUps.join(" ")].join(" ").toLowerCase().includes(normalized));
  }), [company, role, year, query, practiceState, reviewCounts]);

  function startPractice(question: InterviewQuestion) {
    const related = jobs.find((job) => job.company.includes(question.company) && question.roleTags.some((tag) => job.role.includes(tag)));
    setEditingId(null);
    setDraft({ ...EMPTY_REVIEW, questionKey: question.id, company: question.company, role: related?.role ?? question.roleTags[0], category: question.category, question: question.question, sourceType: "模拟练习", interviewRound: question.round, interviewDate: new Date().toISOString().slice(0, 10), jobId: related?.id ?? null });
    setEditorOpen(true);
  }
  function startRealReview() {
    setEditingId(null); setDraft({ ...EMPTY_REVIEW, sourceType: "真实面试", interviewDate: new Date().toISOString().slice(0, 10) }); setEditorOpen(true);
  }
  function editReview(review: InterviewReview) {
    setEditingId(review.id);
    setDraft({ questionKey: review.questionKey, company: review.company, role: review.role, category: review.category, question: review.question, answer: review.answer, selfScore: review.selfScore, reviewNotes: review.reviewNotes, nextAction: review.nextAction, sourceType: review.sourceType, interviewRound: review.interviewRound, interviewDate: review.interviewDate, jobId: review.jobId });
    setEditorOpen(true);
  }
  async function saveReview() {
    if (!draft.question.trim()) { toast.error("请填写面试题"); return; }
    setSaving(true);
    try {
      const response = await fetch(editingId ? `/api/interview-reviews/${editingId}` : "/api/interview-reviews", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await response.json() as { review?: InterviewReview; error?: string };
      if (!response.ok || !data.review) throw new Error(data.error || "复盘保存失败");
      setReviews((current) => editingId ? current.map((item) => item.id === editingId ? data.review! : item) : [data.review!, ...current]);
      setEditorOpen(false); toast.success(editingId ? "复盘已更新" : "复盘已保存");
    } catch (error) { toast.error(error instanceof Error ? error.message : "复盘保存失败"); }
    finally { setSaving(false); }
  }
  async function deleteReview() {
    if (!deleting) return;
    const review = deleting; setDeleting(null);
    try {
      const response = await fetch(`/api/interview-reviews/${review.id}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "删除失败");
      setReviews((current) => current.filter((item) => item.id !== review.id)); toast.success("复盘已删除");
    } catch (error) { toast.error(error instanceof Error ? error.message : "删除失败"); }
  }

  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-800 p-6 text-white shadow-xl shadow-indigo-200/50 sm:p-7"><div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-sky-400/15 blur-3xl" /><div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold text-sky-200">INTERVIEW LAB</p><h2 className="mt-1 text-2xl font-bold sm:text-3xl">面试题与复盘库</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">基于 2024–2026 届公开春招、秋招与实习面经整理，问题均已重新表述；真实面试会因部门、岗位和面试官而变化。</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setTab("我的复盘")} className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"><BookOpenCheck className="size-4" />{reviews.length} 条复盘</Button><Button onClick={startRealReview} className="rounded-xl bg-white text-indigo-950 hover:bg-sky-50"><Plus className="size-4" />记录真实面试</Button></div></div></section>

    <div className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"><Button size="sm" variant="ghost" onClick={() => setTab("题库")} className={`rounded-lg px-4 ${tab === "题库" ? "bg-slate-950 text-white hover:bg-slate-900 hover:text-white" : "text-slate-500"}`}>精选题库</Button><Button size="sm" variant="ghost" onClick={() => setTab("我的复盘")} className={`rounded-lg px-4 ${tab === "我的复盘" ? "bg-slate-950 text-white hover:bg-slate-900 hover:text-white" : "text-slate-500"}`}>我的复盘</Button></div>

    {tab === "题库" ? <>
      <section className="rounded-[1.35rem] border border-white/80 bg-white/90 p-3 shadow-[0_14px_40px_-24px_rgba(15,23,42,.35)]"><div className="flex flex-col gap-3 xl:flex-row"><div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索问题、考察点或岗位方向" className="h-11 rounded-xl border-0 bg-slate-50 pl-10" /></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Select value={company} onValueChange={(value) => setCompany(value as typeof company)}><SelectTrigger className="h-11 rounded-xl"><Building2 className="size-4" /><SelectValue /></SelectTrigger><SelectContent>{COMPANY_FILTERS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Select value={role} onValueChange={(value) => setRole(value as typeof role)}><SelectTrigger className="h-11 rounded-xl"><Target className="size-4" /><SelectValue /></SelectTrigger><SelectContent>{ROLE_FILTERS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Select value={year} onValueChange={(value) => setYear(value as typeof year)}><SelectTrigger className="h-11 rounded-xl"><CalendarDays className="size-4" /><SelectValue /></SelectTrigger><SelectContent>{YEAR_FILTERS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Select value={practiceState} onValueChange={setPracticeState}><SelectTrigger className="h-11 rounded-xl"><Filter className="size-4" /><SelectValue /></SelectTrigger><SelectContent>{["全部题目", "未练习", "已复盘"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div></div><p className="mt-2 px-1 text-xs text-slate-400">共 {INTERVIEW_QUESTIONS.length} 道精选问题 · 资料更新于 {INTERVIEW_BANK_LAST_UPDATED} · 每题保留原始公开分享链接</p></section>
      {filteredQuestions.length ? <div className="grid items-start gap-4 lg:grid-cols-2">{filteredQuestions.map((question) => <QuestionCard key={question.id} question={question} practiced={reviewCounts.get(question.id) ?? 0} onPractice={startPractice} />)}</div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><MessageSquareText className="mx-auto size-9 text-slate-300" /><p className="mt-3 font-semibold text-slate-600">没有符合当前筛选的问题</p><p className="mt-1 text-sm text-slate-400">尝试切换公司、方向或练习状态。</p></div>}
    </> : <section className="space-y-3">
      {loading ? <div className="grid gap-3 md:grid-cols-2">{[0, 1, 2, 3].map((item) => <div key={item} className="h-44 animate-pulse rounded-2xl bg-white" />)}</div> : reviews.length ? <div className="grid items-start gap-4 lg:grid-cols-2">{reviews.map((review) => <article key={review.id} className="rounded-[1.35rem] border border-white/90 bg-white p-5 shadow-[0_16px_45px_-30px_rgba(15,23,42,.5)]"><div className="flex items-start justify-between gap-3"><div className="flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">{review.sourceType}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">{review.company || "未填写公司"}</span><span className={`rounded-full border px-2.5 py-1 ${scoreTone(review.selfScore)}`}>{review.selfScore ? `${review.selfScore}/5 分` : "未评分"}</span></div><button type="button" onClick={() => setDeleting(review)} aria-label="删除复盘" className="text-slate-300 transition hover:text-rose-600"><Trash2 className="size-4" /></button></div><h3 className="mt-4 font-bold leading-7 text-slate-950">{review.question}</h3><p className="mt-2 text-sm text-slate-500">{review.role || "未填写岗位"} · {review.interviewRound || "未填写轮次"} · {formatDate(review.interviewDate)}</p>{review.answer && <p className="mt-4 line-clamp-3 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{review.answer}</p>}{review.nextAction && <div className="mt-3 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800"><Lightbulb className="mt-1 size-4 shrink-0" /><span>{review.nextAction}</span></div>}<Button variant="outline" size="sm" onClick={() => editReview(review)} className="mt-4 rounded-xl"><FilePenLine className="size-4" />继续复盘</Button></article>)}</div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><Sparkles className="mx-auto size-9 text-indigo-300" /><p className="mt-3 font-semibold text-slate-700">还没有面试复盘</p><p className="mt-1 text-sm text-slate-400">从精选题库开始练习，或记录一次真实面试。</p><Button onClick={() => setTab("题库")} className="mt-5 rounded-xl bg-indigo-600 hover:bg-indigo-700">去题库练习</Button></div>}
    </section>}

    <Dialog open={editorOpen} onOpenChange={setEditorOpen}><DialogContent className="[&>[data-slot=dialog-close]]:z-20 max-h-[94vh] overflow-y-auto rounded-[1.75rem] p-0 sm:max-w-4xl"><DialogHeader className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur"><DialogTitle>{editingId ? "继续复盘" : draft.sourceType === "真实面试" ? "记录真实面试" : "模拟练习与复盘"}</DialogTitle><DialogDescription>先保留原始回答，再记录问题和下一次改进动作。</DialogDescription></DialogHeader><ReviewEditor draft={draft} setDraft={setDraft} jobs={jobs} /><DialogFooter className="sticky bottom-0 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur"><Button variant="outline" onClick={() => setEditorOpen(false)}>取消</Button><Button onClick={() => void saveReview()} disabled={saving || !draft.question.trim()} className="bg-indigo-600 hover:bg-indigo-700">{saving ? "保存中…" : "保存复盘"}</Button></DialogFooter></DialogContent></Dialog>
    <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除这条复盘？</AlertDialogTitle><AlertDialogDescription>删除后不会影响题库，但你的回答、评分和改进行动将无法恢复。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void deleteReview()}>确认删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

"use client";

import { useRef, useState } from "react";
import { ArchiveRestore, BriefcaseBusiness, CheckCircle2, DatabaseBackup, Download, FileJson, FileSpreadsheet, ShieldCheck, Upload, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type BackupPreview = {
  app: string;
  schemaVersion: number;
  exportedAt?: string;
  counts?: { jobs?: number; resumes?: number; interviewReviews?: number };
  jobs?: unknown[];
  resumes?: unknown[];
  interviewReviews?: unknown[];
};

function count(snapshot: BackupPreview | null, key: "jobs" | "resumes" | "interviewReviews") {
  if (!snapshot) return 0;
  const declared = snapshot.counts?.[key];
  return typeof declared === "number" ? declared : Array.isArray(snapshot[key]) ? snapshot[key]!.length : 0;
}

function formatExportedAt(value?: string) {
  if (!value) return "未知时间";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function DataBackupPanel({ jobCount, onRestored }: { jobCount: number; onRestored: () => Promise<void> | void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [snapshot, setSnapshot] = useState<BackupPreview | null>(null);
  const [filename, setFilename] = useState("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [restoring, setRestoring] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  async function readFile(file?: File) {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) { toast.error("备份文件超过 12MB，请确认选择了正确文件"); return; }
    try {
      const parsed = JSON.parse(await file.text()) as BackupPreview;
      if (parsed.app !== "EasyToGetGoodJob" || parsed.schemaVersion !== 1 || !Array.isArray(parsed.jobs) || !Array.isArray(parsed.resumes) || !Array.isArray(parsed.interviewReviews)) throw new Error("文件格式不匹配");
      setSnapshot(parsed); setFilename(file.name); toast.success("备份文件已校验，可以选择恢复方式");
    } catch { setSnapshot(null); setFilename(""); toast.error("无法识别该文件，请选择本应用导出的 JSON 备份"); }
    if (fileInput.current) fileInput.current.value = "";
  }

  async function restore() {
    if (!snapshot) return;
    setRestoring(true);
    try {
      const response = await fetch("/api/data-backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, snapshot }) });
      const data = await response.json() as { imported?: { jobs?: number; resumes?: number; interviewReviews?: number }; skipped?: { jobs?: number; interviewReviews?: number }; error?: string };
      if (!response.ok || !data.imported) throw new Error(data.error || "恢复失败");
      await onRestored();
      const imported = `岗位 ${data.imported.jobs ?? 0}、简历 ${data.imported.resumes ?? 0}、复盘 ${data.imported.interviewReviews ?? 0}`;
      const skipped = (data.skipped?.jobs ?? 0) + (data.skipped?.interviewReviews ?? 0);
      toast.success(`恢复完成：${imported}${skipped ? `；跳过重复 ${skipped} 条` : ""}`);
      setSnapshot(null); setFilename("");
    } catch (error) { toast.error(error instanceof Error ? error.message : "恢复失败"); }
    finally { setRestoring(false); setConfirmReplace(false); }
  }

  function requestRestore() {
    if (!snapshot) return;
    if (mode === "replace") setConfirmReplace(true); else void restore();
  }

  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-slate-950 via-cyan-950 to-sky-800 p-6 text-white shadow-xl shadow-sky-200/50 sm:p-7"><div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-cyan-300/15 blur-3xl" /><div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold text-cyan-200">DATA VAULT</p><h2 className="mt-1 text-2xl font-bold sm:text-3xl">数据导出与备份</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">完整备份可恢复岗位、简历版本、准备清单、流程记录和面试复盘。CSV 适合查看和整理，不能用于完整恢复。</p></div><div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3"><ShieldCheck className="size-5 text-cyan-200" /><div><p className="text-sm font-bold">个人数据仅登录后可导出</p><p className="text-xs text-slate-300">当前 {jobCount} 个岗位</p></div></div></div></section>

    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-[1.35rem] border border-white/90 bg-white p-5 shadow-[0_16px_45px_-30px_rgba(15,23,42,.5)]"><span className="grid size-11 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><FileJson className="size-5" /></span><h3 className="mt-4 text-lg font-bold">完整备份</h3><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">生成可恢复的 JSON 快照，包含应用内全部个人数据。</p><Button asChild className="mt-5 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700"><a href="/api/data-backup?format=json" download><Download className="size-4" />下载完整备份</a></Button></section>
      <section className="rounded-[1.35rem] border border-white/90 bg-white p-5 shadow-[0_16px_45px_-30px_rgba(15,23,42,.5)]"><span className="grid size-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><BriefcaseBusiness className="size-5" /></span><h3 className="mt-4 text-lg font-bold">岗位表格</h3><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">导出岗位、状态、日期、匹配度、职责与要求，方便用表格分析。</p><Button asChild variant="outline" className="mt-5 w-full rounded-xl"><a href="/api/data-backup?format=jobs-csv" download><FileSpreadsheet className="size-4" />导出岗位 CSV</a></Button></section>
      <section className="rounded-[1.35rem] border border-white/90 bg-white p-5 shadow-[0_16px_45px_-30px_rgba(15,23,42,.5)]"><span className="grid size-11 place-items-center rounded-2xl bg-violet-50 text-violet-600"><UsersRound className="size-5" /></span><h3 className="mt-4 text-lg font-bold">面试复盘表格</h3><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">导出练习答案、自评分、复盘记录和下一步行动。</p><Button asChild variant="outline" className="mt-5 w-full rounded-xl"><a href="/api/data-backup?format=reviews-csv" download><FileSpreadsheet className="size-4" />导出复盘 CSV</a></Button></section>
    </div>

    <section className="rounded-[1.5rem] border border-white/90 bg-white p-5 shadow-[0_18px_48px_-32px_rgba(15,23,42,.45)] sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="flex items-center gap-2 text-lg font-bold"><ArchiveRestore className="size-5 text-sky-600" />从备份恢复</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">选择本应用导出的 JSON。系统会先校验内容；合并模式跳过重复岗位和复盘，覆盖模式会先清空当前数据。</p></div><input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void readFile(event.target.files?.[0])} /><Button variant="outline" onClick={() => fileInput.current?.click()} className="shrink-0 rounded-xl"><Upload className="size-4" />选择备份文件</Button></div>
      {snapshot ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" /><div className="min-w-0 flex-1"><p className="truncate font-bold text-emerald-900">{filename}</p><p className="mt-1 text-sm text-emerald-700">导出时间：{formatExportedAt(snapshot.exportedAt)}</p></div></div><div className="mt-4 grid grid-cols-3 gap-2">{[{ label: "岗位", value: count(snapshot, "jobs") }, { label: "简历版本", value: count(snapshot, "resumes") }, { label: "面试复盘", value: count(snapshot, "interviewReviews") }].map((item) => <div key={item.label} className="rounded-xl bg-white px-3 py-3 text-center shadow-sm"><p className="text-2xl font-bold text-slate-950">{item.value}</p><p className="mt-1 text-xs text-slate-500">{item.label}</p></div>)}</div><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Select value={mode} onValueChange={(value) => setMode(value as typeof mode)}><SelectTrigger className="h-11 bg-white sm:w-64"><DatabaseBackup className="size-4" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="merge">安全合并（推荐）</SelectItem><SelectItem value="replace">覆盖当前全部数据</SelectItem></SelectContent></Select><Button onClick={requestRestore} disabled={restoring} className={`h-11 rounded-xl ${mode === "replace" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}><ArchiveRestore className="size-4" />{restoring ? "恢复中…" : mode === "replace" ? "确认覆盖恢复" : "开始安全合并"}</Button></div>{mode === "replace" && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-700">覆盖恢复会删除当前岗位、简历和复盘。建议先点击上方“下载完整备份”保存当前版本。</p>}</div> : <div className="mt-5 rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center"><FileJson className="mx-auto size-8 text-slate-300" /><p className="mt-3 font-semibold text-slate-600">尚未选择备份文件</p><p className="mt-1 text-sm text-slate-400">文件只在你确认后上传并恢复。</p></div>}
    </section>

    <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>覆盖当前全部数据？</AlertDialogTitle><AlertDialogDescription>当前岗位、简历版本和面试复盘将被备份文件中的内容替换。这个操作不能在页面内撤销，请确认你已经下载当前完整备份。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>返回检查</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void restore()}>确认覆盖并恢复</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}


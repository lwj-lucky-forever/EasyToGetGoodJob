import type { JobStatus } from "./job-status";
import type { ProcessRecord } from "./job-workflow";

export const PIPELINE_STAGES = [
  { slug: "apply", title: "待投递", status: "未投递", eyebrow: "MAKE IT PERSONAL", description: "对照岗位要求，打磨专属简历。", action: "根据岗位修改简历", color: "indigo" },
  { slug: "prepare", title: "准备中", status: "准备中", eyebrow: "BUILD YOUR CONFIDENCE", description: "把匹配差距变成可以完成的小目标。", action: "推进准备清单", color: "violet" },
  { slug: "assessment", title: "笔试", status: "笔试", eyebrow: "CAPTURE THE CHALLENGE", description: "记录考察内容，沉淀解题思路。", action: "记录笔试考察", color: "sky" },
  { slug: "interview", title: "面试", status: "面试", eyebrow: "TELL YOUR STORY", description: "保存真实问题，复盘每一次回答。", action: "记录真实面试", color: "pink" },
  { slug: "offer", title: "Offer", status: "Offer", eyebrow: "YOUR NEXT CHAPTER", description: "确认薪资、地点与到岗条件。", action: "完善 Offer 信息", color: "amber" },
  { slug: "closed", title: "未通过", status: "暂停", eyebrow: "LEARN AND MOVE FORWARD", description: "记录原因与收获，为下一次积累。", action: "记录未通过原因", color: "rose" },
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number]["slug"];
export function findPipelineStage(slug: string) { return PIPELINE_STAGES.find(stage => stage.slug === slug); }
// Read legacy submitted jobs as preparation; do not rewrite persisted statuses.
export function pipelineStageFor(status: JobStatus): PipelineStage {
  return status === "已投递" ? "prepare" : PIPELINE_STAGES.find(stage => stage.status === status)?.slug ?? "apply";
}

export type PipelineNotes = { resume?: string; topics?: string; reflection?: string; location?: string; salary?: string; hours?: string; days?: string; startDate?: string; reason?: string; nextAction?: string };
export function readPipelineNotes(records: ProcessRecord[], stage: PipelineStage): PipelineNotes {
  const record = records.find(item => item.id === `pipeline-${stage}`);
  if (!record) return {};
  try {
    const value: unknown = JSON.parse(record.notes);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, value]) => typeof value === "string")) as PipelineNotes;
  } catch { return {}; }
}
export function writePipelineNotes(records: ProcessRecord[], stage: PipelineStage, notes: PipelineNotes): ProcessRecord[] {
  const content = JSON.stringify(notes);
  if (content.length > 4000) throw new Error("内容过长，请精简后保存（单岗位阶段记录最多 4000 字符）。");
  const id = `pipeline-${stage}`;
  if (!records.some(item => item.id === id) && records.length >= 50) throw new Error("该岗位流程记录已达 50 条，请先整理已有记录。");
  const record: ProcessRecord = { id, type: stage === "assessment" ? "笔试" : "其他", scheduledAt: "", status: "已完成", notes: content, result: `${findPipelineStage(stage)?.title} · ${new Date().toLocaleDateString("zh-CN")}` };
  return records.some(item => item.id === id) ? records.map(item => item.id === id ? record : item) : [...records, record];
}

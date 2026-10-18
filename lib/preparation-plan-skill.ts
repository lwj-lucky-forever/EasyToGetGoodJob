import schema from "../skills/preparation-plan/output.schema.json" with { type: "json" };
import { validateSkillOutputShape } from "./job-analysis-skill.ts";
import { isResumeTailoringResultCurrent, validateResumeTailoringOutput, type ResumeTailoringInput, type ResumeTailoringResult } from "./resume-tailoring-skill.ts";
import { sanitizePrepChecklist, type PrepChecklistItem } from "./job-workflow.ts";

export const PREPARATION_PLAN_SKILL = {
  name: "preparation-plan", version: "1.0.0", instructionsPath: "skills/preparation-plan/SKILL.md", outputSchema: schema,
} as const;
export type PreparationTask = {
  title: string;
  type: "resume" | "company_research" | "business_research" | "knowledge" | "case_preparation" | "interview" | "mock_interview" | "portfolio" | "follow_up";
  description: string; deliverable: string; reason: string; related_requirement: string;
  priority: "high" | "medium" | "low"; estimated_time_minutes: number;
  due_date: string | null; status: "pending";
  source: { kind: "gap" | "hiring_signal" | "requirement"; ref: string };
  needs_confirmation: boolean;
};
export type PreparationPlanOutput = {
  plan_summary: string; tasks: PreparationTask[];
  risks: { requirement_ref: string; gap_ref: string; description: string }[];
};
export type PreparationPlanInput = {
  skill: "preparation-plan"; version: "1.0.0";
  job_analysis: ResumeTailoringInput["job_analysis"];
  requirements: ResumeTailoringInput["requirements"];
  resume_tailoring: ResumeTailoringResult["output"];
  existing_checklist: PrepChecklistItem[];
  planning: { today: string; target_date: string | null; available_minutes: number | null };
  context: { source: ResumeTailoringResult["context"]; input_key: string };
};
const normalize = (text: string) => text.toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
async function digest(value: unknown) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Validate upstream snapshots locally, then omit raw JD and resume from model input. */
export async function buildPreparationPlanInput(options: {
  tailoringInput: ResumeTailoringInput; tailoringResult: ResumeTailoringResult;
  existingChecklist: PrepChecklistItem[]; planning: PreparationPlanInput["planning"];
}): Promise<PreparationPlanInput> {
  const { tailoringInput, tailoringResult, existingChecklist, planning } = options;
  if (!isResumeTailoringResultCurrent(tailoringResult, tailoringInput)) throw new Error("上游岗位或简历已变化，请先重新生成简历定制结果");
  const checked = validateResumeTailoringOutput(tailoringResult.output, tailoringInput);
  if (!checked.success) throw new Error(`简历定制结果无效：${checked.errors.join("；")}`);
  if (!Array.isArray(existingChecklist) || existingChecklist.length > 40) throw new Error("已有清单无效或超过 40 项");
  const cleaned = sanitizePrepChecklist(existingChecklist);
  if (cleaned.length !== existingChecklist.length || cleaned.some((item, index) => ["id", "text", "done", "category"].some((key) => item[key as keyof PrepChecklistItem] !== existingChecklist[index]?.[key as keyof PrepChecklistItem]))) throw new Error("已有任务不符合清单格式，请先核对；不会静默截断");
  if (new Set(cleaned.map((item) => item.id)).size !== cleaned.length) throw new Error("已有任务 ID 重复，请先核对");
  if (!validDate(planning.today) || (planning.target_date !== null && (!validDate(planning.target_date) || planning.target_date < planning.today))) throw new Error("当前日期或目标日期无效，目标日期不能早于当前日期");
  if (planning.available_minutes !== null && (!Number.isSafeInteger(planning.available_minutes) || planning.available_minutes < 0)) throw new Error("可用时间必须是非负整数分钟或 null");
  const snapshot = structuredClone({
    skill: PREPARATION_PLAN_SKILL.name, version: PREPARATION_PLAN_SKILL.version,
    job_analysis: tailoringInput.job_analysis, requirements: tailoringInput.requirements,
    resume_tailoring: checked.data, existing_checklist: cleaned, planning,
  });
  return { ...snapshot, context: { source: structuredClone(tailoringResult.context), input_key: await digest([snapshot, tailoringResult.context]) } };
}

function taskRank(task: PreparationTask, input: PreparationPlanInput) {
  const ref = task.related_requirement;
  if (ref.startsWith("/must_have/") || ref.startsWith("/constraints/")) return 0;
  if (task.source.kind === "hiring_signal") return 1;
  if (ref.startsWith("/nice_to_have/")) return 4;
  return input.resume_tailoring.gaps.some((gap) => gap.requirement_ref === ref) ? 2 : 3;
}
export function preparationTaskPriority(task: PreparationTask, input: PreparationPlanInput): PreparationTask["priority"] {
  const rank = taskRank(task, input);
  return rank <= 1 ? "high" : rank === 4 ? "low" : "medium";
}
function claimFor(ref: string, input: PreparationPlanInput) {
  // Only caller-approved references in the derived requirement catalog may be resolved.
  if (!input.requirements.some((item) => item.ref === ref)) return undefined;
  const [, group, key] = ref.split("/");
  if (group === "constraints") return input.job_analysis.constraints[key as keyof typeof input.job_analysis.constraints] ?? undefined;
  const claims = input.job_analysis[group as "must_have"];
  return Array.isArray(claims) ? claims[Number(key)] : undefined;
}
const taskKey = (task: PreparationTask) => [task.related_requirement, task.type, normalize(task.deliverable)];
function checklistText(task: PreparationTask, input: PreparationPlanInput) {
  const requirement = input.requirements.find((item) => item.ref === task.related_requirement)?.text ?? "";
  return `${task.title}\n${task.description}\n交付物：${task.deliverable}\n优先级：${{ high: "高", medium: "中", low: "低" }[task.priority]} · 预计 ${task.estimated_time_minutes} 分钟${task.due_date ? ` · 建议完成：${task.due_date}` : ""}\n依据：${task.reason}\n关联要求：${requirement}`;
}

export type PreparationPlanValidation = { success: true; data: PreparationPlanOutput } | { success: false; errors: string[] };
export function validatePreparationPlanOutput(output: unknown, input: PreparationPlanInput): PreparationPlanValidation {
  let value = output;
  if (typeof value === "string") {
    if (value.length > 150_000) return { success: false, errors: ["准备计划输出过长"] };
    try { value = JSON.parse(value); } catch { return { success: false, errors: ["准备计划必须是有效 JSON"] }; }
  }
  const errors = validateSkillOutputShape(value, schema);
  if (errors.length) return { success: false, errors };
  const data = value as PreparationPlanOutput;
  const titles = new Set<string>(); const keys = new Set<string>();
  const gaps = input.resume_tailoring.gaps;
  for (const task of data.tasks) {
    const claim = claimFor(task.related_requirement, input);
    if (!claim) errors.push("任务关联了不存在的岗位要求");
    if (task.source.kind === "gap") {
      const match = /^\/gaps\/(0|[1-9]\d*)$/.exec(task.source.ref);
      if (!match || gaps[Number(match[1])]?.requirement_ref !== task.related_requirement) errors.push("任务引用的缺口不存在或与要求不对应");
    } else if (task.source.kind === "requirement") {
      if (task.source.ref !== task.related_requirement) errors.push("任务来源与岗位要求不对应");
    } else {
      const match = /^\/top_hiring_signals\/(0|[1-9]\d*)$/.exec(task.source.ref);
      const signal = match ? input.job_analysis.top_hiring_signals[Number(match[1])] : undefined;
      if (!signal || !claim || !(signal.text === claim.text || signal.evidence.some((a) => claim.evidence.some((b) => a.source_field === b.source_field && (a.quote.includes(b.quote) || b.quote.includes(a.quote)))))) errors.push("招聘信号不存在或缺少与任务要求的关联依据");
    }
    const relatedGaps = gaps.filter((gap) => gap.requirement_ref === task.related_requirement);
    if ((task.type === "follow_up" || relatedGaps.some((gap) => gap.needs_confirmation)) && !task.needs_confirmation) errors.push("待核实缺口或跟进任务需要用户确认");
    if (relatedGaps.some((gap) => gap.type === "qualification_gap") && (task.type !== "follow_up" || !/核实|核对|确认/.test(task.title + task.description))) errors.push("资格缺口只能提示风险或核实条件，不能生成补齐资格的任务");
    if (task.priority !== preparationTaskPriority(task, input)) errors.push("任务优先级不符合岗位依据");
    if (!Number.isSafeInteger(task.estimated_time_minutes) || task.estimated_time_minutes < 1 || task.estimated_time_minutes > 480) errors.push("任务估时必须为 1–480 分钟的整数");
    if (task.due_date !== null && (!input.planning.target_date || !validDate(task.due_date) || task.due_date < input.planning.today || task.due_date > input.planning.target_date)) errors.push("任务日期必须来自用户目标日期范围，无目标日期时应为 null");
    // Dates embedded in prose cannot bypass the structured date check.
    const prose = [task.title, task.description, task.deliverable, task.reason].join("\n");
    const mentionedDates = prose.match(/\d{4}-\d{2}-\d{2}|(?:\d{4}年)?\d{1,2}月\d{1,2}日/g) ?? [];
    for (const mentioned of mentionedDates) {
      const chinese = /^(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日$/.exec(mentioned);
      const date = chinese ? `${chinese[1] ?? (task.due_date ?? input.planning.today).slice(0, 4)}-${chinese[2].padStart(2, "0")}-${chinese[3].padStart(2, "0")}` : mentioned;
      if (!input.planning.target_date || !validDate(date) || date < input.planning.today || date > input.planning.target_date) errors.push("任务正文中出现了未经时间范围支持的日期");
    }
    if (!/整理|编写|列出|完成|核对|核实|阅读|查阅|梳理|录制|练习|模拟|制作|对照|撰写|联系|复盘|收集|研究|确认|分析/.test(task.title + task.description) || task.description.trim().length < 12 || task.deliverable.trim().length < 6 || /^(?:多了解公司|多准备面试|提升能力|做好准备|完成准备|学习相关知识)[。！!\s]*$/.test(task.deliverable)) errors.push("任务需要明确动作、对象和可检查的交付物");
    const title = normalize(task.title); const key = JSON.stringify(taskKey(task));
    if (titles.has(title) || keys.has(key)) errors.push("新计划包含重复任务");
    titles.add(title); keys.add(key);
    if (checklistText(task, input).length > 1000) errors.push("任务转换后超过清单 1000 字限制，请精简");
  }
  if (input.planning.available_minutes !== null && data.tasks.reduce((sum, task) => sum + task.estimated_time_minutes, 0) > input.planning.available_minutes) errors.push("任务总估时超过用户可用时间");
  const riskRefs = new Set<string>();
  for (const risk of data.risks) {
    const match = /^\/gaps\/(0|[1-9]\d*)$/.exec(risk.gap_ref);
    const gap = match ? gaps[Number(match[1])] : undefined;
    if (!gap || gap.type !== "qualification_gap" || gap.requirement_ref !== risk.requirement_ref) errors.push("资格风险必须来自对应的上游资格缺口");
    if (riskRefs.has(risk.gap_ref)) errors.push("资格风险重复");
    riskRefs.add(risk.gap_ref);
  }
  gaps.forEach((gap, index) => { if (gap.type === "qualification_gap" && !riskRefs.has(`/gaps/${index}`)) errors.push("遗漏了上游资格风险"); });
  return errors.length ? { success: false, errors: [...new Set(errors)] } : { success: true, data };
}

/** Pure conversion. The caller may submit checklist to PATCH only after user adoption. */
export async function prepareChecklistMerge(output: unknown, input: PreparationPlanInput, confirmedTaskIds: string[] = []) {
  const checked = validatePreparationPlanOutput(output, input);
  if (!checked.success) throw new Error(`准备计划无效：${checked.errors.join("；")}`);
  const hasGap = (task: PreparationTask) => input.resume_tailoring.gaps.some((gap) => gap.requirement_ref === task.related_requirement);
  const ordered = [...checked.data.tasks].sort((a, b) => taskRank(a, input) - taskRank(b, input) || Number(hasGap(b)) - Number(hasGap(a)));
  const candidates = await Promise.all(ordered.map(async (task) => ({ task, id: `plan-v1-${await digest(taskKey(task))}` })));
  if (confirmedTaskIds.some((id) => !candidates.some((candidate) => candidate.id === id))) throw new Error("确认列表包含当前计划以外的任务");
  const checklist = structuredClone(input.existing_checklist);
  const added: PrepChecklistItem[] = [];
  const skipped: { id: string; title: string; reason: string }[] = [];
  const pending_confirmation: { id: string; task: PreparationTask }[] = [];
  for (const { task, id } of candidates) {
    const text = checklistText(task, input);
    const duplicate = checklist.some((item) => item.id === id || normalize(item.text) === normalize(text) || normalize(item.text) === normalize(task.title) || normalize(item.text.split(/\r?\n/)[0]) === normalize(task.title) || normalize(item.text) === normalize(task.description));
    if (duplicate) { skipped.push({ id, title: task.title, reason: "已有相同任务，保留原任务及完成状态" }); continue; }
    if (task.needs_confirmation && !confirmedTaskIds.includes(id)) { pending_confirmation.push({ id, task: structuredClone(task) }); continue; }
    if (checklist.length >= 40) throw new Error("合并后超过 40 项，请先整理已有清单；原任务未修改");
    const item: PrepChecklistItem = { id, text, done: false, category: task.type === "knowledge" ? "知识" : "行动" };
    checklist.push(item); added.push(item);
  }
  return { context: structuredClone(input.context), checklist, added, skipped, pending_confirmation, risks: structuredClone(checked.data.risks) };
}

import schema from "../skills/resume-tailoring/output.schema.json" with { type: "json" };
import { JOB_ANALYSIS_SKILL, validateJobAnalysisOutput, validateSkillOutputShape, type JobAnalysisInput, type JobAnalysisOutput } from "./job-analysis-skill.ts";
import { RESUME_MATCH_TERMS, type ResumeSource } from "./resume-profiles.ts";

export const RESUME_TAILORING_SKILL = {
  name: "resume-tailoring", version: "1.0.0",
  instructionsPath: "skills/resume-tailoring/SKILL.md", outputSchema: schema,
} as const;

type Requirement = Pick<JobAnalysisOutput["must_have"][number], "text" | "basis"> & { ref: string };
type ResumeEvidence = { resume_section: string; quote: string };
type Mapping = {
  requirement_ref: string; related_job_requirement: string;
  status: "matched" | "weak_match" | "gap"; reason: string;
  needs_confirmation: boolean; evidence_source: ResumeEvidence[];
};
export type ResumeTailoringOutput = {
  overall_assessment: string;
  requirement_evidence_map: Mapping[];
  rewrite_suggestions: {
    resume_section: string; original_text: string; suggested_text: string; reason: string;
    requirement_ref: string; related_job_requirement: string;
    evidence_source: ResumeEvidence[]; priority: "high" | "medium" | "low";
  }[];
  gaps: {
    requirement_ref: string; type: "expression_gap" | "evidence_gap" | "qualification_gap";
    reason: string; needs_confirmation: boolean; evidence_source: ResumeEvidence[];
  }[];
  final_notes: string[];
};
export type ResumeTailoringInput = {
  skill: "resume-tailoring"; version: "1.0.0";
  context: {
    job_analysis_version: string; job_analysis_fingerprint: string; resume_fingerprint: string;
    requested_resume_version: string; actual_resume_version: string; resume_updated_at: string;
  };
  job_analysis: JobAnalysisOutput; requirements: Requirement[]; resume: ResumeSource;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const fields = Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`);
    return `{${fields.join(",")}}`;
  }
  return JSON.stringify(value);
}
async function fingerprint(value: unknown) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function requirementCatalog(analysis: JobAnalysisOutput): Requirement[] {
  const result: Requirement[] = [];
  for (const key of ["core_responsibilities", "must_have", "nice_to_have", "implicit_requirements", "skills"] as const) {
    analysis[key].forEach((claim, index) => result.push({ ref: `/${key}/${index}`, text: claim.text, basis: claim.basis }));
  }
  for (const [key, claim] of Object.entries(analysis.constraints)) if (claim) {
    result.push({ ref: `/constraints/${key}`, text: claim.text, basis: claim.basis });
  }
  return result;
}

/** The original JD is used only for upstream validation, never returned as model input. */
export async function buildResumeTailoringInput(options: {
  jobInput: JobAnalysisInput; jobAnalysis: unknown; resume: ResumeSource; requestedResumeVersion?: string;
}): Promise<ResumeTailoringInput> {
  const checked = validateJobAnalysisOutput(options.jobAnalysis, options.jobInput);
  if (!checked.success) throw new Error(`岗位解读未通过校验：${checked.errors.join("；")}`);
  const { name, content, updatedAt } = options.resume;
  if (!name || typeof content !== "string" || !content.trim() || !updatedAt) throw new Error("请先保存当前简历，再生成定制建议");
  if (content.length > 50_000) throw new Error("简历内容过长，请先核对原文");
  // Snapshot only the existing source fields; never copy owner info, drafts or old scores.
  const resume: ResumeSource = { name, content: content.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim(), updatedAt };
  if (!resume.content) throw new Error("请先保存当前简历，再生成定制建议");
  const analysis: JobAnalysisOutput = structuredClone(checked.data);
  const context = {
    job_analysis_version: JOB_ANALYSIS_SKILL.version,
    job_analysis_fingerprint: await fingerprint([JOB_ANALYSIS_SKILL.version, analysis]),
    resume_fingerprint: await fingerprint(resume),
    requested_resume_version: options.requestedResumeVersion ?? name,
    actual_resume_version: name, resume_updated_at: updatedAt,
  };
  return { skill: RESUME_TAILORING_SKILL.name, version: RESUME_TAILORING_SKILL.version, context, job_analysis: analysis, requirements: requirementCatalog(analysis), resume };
}

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
const negative = /(?:不(?:会|熟悉|了解|掌握|具备)|未(?:曾|使用|掌握|学习|参与)|没有|尚未|缺乏|计划学习|准备学习|\b(?:not|never|plan to learn)\b)/i;
const toolTerms = RESUME_MATCH_TERMS.filter((term) => /^[a-z]+$/i.test(term));
const hasTerm = (text: string, term: string) => new RegExp(`(?<![a-z0-9])${term}(?![a-z0-9])`, "i").test(text);
const responsibilityRank = (text: string) => /主导|牵头|统筹|全面负责|独立负责|\b(?:led|owned|spearheaded)\b/i.test(text) ? 3 : /负责|独立|\bresponsible\b/i.test(text) ? 2 : /参与|协助|配合|支持|\b(?:participated|assisted|supported)\b/i.test(text) ? 1 : 0;
const proficiencyRank = (text: string) => /精通|专家|\b(?:expert|mastery)\b/i.test(text) ? 4 : /熟练|\bproficient\b/i.test(text) ? 3 : /熟悉/i.test(text) ? 2 : /了解|接触|基础|\bfamiliar\b/i.test(text) ? 1 : 0;

/** Conservative lexical guards, not a semantic guarantee. False positives require review. */
function checkRewrite(original: string, suggested: string, sources: string): string[] {
  const errors: string[] = [];
  const numbers = (text: string) => text.match(/\d+(?:[.,]\d+)*(?:[%％])?/g) ?? [];
  const oldNumbers = new Set(numbers(sources));
  if (numbers(suggested).some((number) => !oldNumbers.has(number))) errors.push("改写增加了无依据的数字或量化结果");
  if (toolTerms.some((term) => hasTerm(suggested, term) && !hasTerm(sources, term))) errors.push("改写增加了无依据的工具或技能名称");
  if (responsibilityRank(suggested) > responsibilityRank(original)) errors.push("改写提升了原文的职责范围");
  if (proficiencyRank(suggested) > proficiencyRank(original)) errors.push("改写提升了原文的熟练程度");
  if (negative.test(original) && !negative.test(suggested)) errors.push("不能通过删除否定或学习意向来声称具备能力");
  // Explicit organization names and quoted project names, not arbitrary entity recognition.
  const names = suggested.match(/[\p{L}\d·]{2,40}(?:有限公司|集团|大学|学院)|[“「『《][^”」』》]{1,60}[”」』》]/gu) ?? [];
  if (names.some((name) => !sources.includes(name))) errors.push("改写增加了无依据的机构或项目名称");
  return errors;
}

export type ResumeTailoringValidation = { success: true; data: ResumeTailoringOutput } | { success: false; errors: string[] };

export function validateResumeTailoringOutput(output: unknown, input: ResumeTailoringInput): ResumeTailoringValidation {
  let value = output;
  if (typeof value === "string") {
    if (value.length > 200_000) return { success: false, errors: ["简历定制输出过长"] };
    try { value = JSON.parse(value); } catch { return { success: false, errors: ["简历定制输出必须是有效 JSON"] }; }
  }
  const errors = validateSkillOutputShape(value, schema);
  if (errors.length) return { success: false, errors };
  const data = value as ResumeTailoringOutput;
  const catalog = new Map(input.requirements.map((item) => [item.ref, item]));
  const mappings = new Map<string, Mapping>();
  const checkEvidence = (evidence: ResumeEvidence[]) => {
    for (const source of evidence) if (!normalize(input.resume.content).includes(normalize(source.quote))) errors.push("证据必须引用当前简历原文");
  };
  const checkRequirement = (ref: string, text?: string) => {
    const requirement = catalog.get(ref);
    if (!requirement) errors.push(`岗位要求引用不存在：${ref}`);
    else if (text !== undefined && text !== requirement.text) errors.push(`岗位要求文本与引用不一致：${ref}`);
  };
  for (const item of data.requirement_evidence_map) {
    checkRequirement(item.requirement_ref, item.related_job_requirement);
    checkEvidence(item.evidence_source);
    if (mappings.has(item.requirement_ref)) errors.push("岗位要求映射重复");
    mappings.set(item.requirement_ref, item);
    if (item.status !== "gap") {
      if (!item.evidence_source.length) errors.push("matched/weak_match 必须有真实简历证据");
      const clauses = item.evidence_source.flatMap((source) => source.quote.split(/[。；;，,\n]/)).filter((line) => line.trim());
      if (clauses.length && clauses.every((line) => negative.test(line))) errors.push("否定或学习意向不能作为正向匹配证据");
      const requiredText = catalog.get(item.requirement_ref)?.text ?? "";
      if (item.status === "matched" && proficiencyRank(requiredText) > Math.max(0, ...clauses.map(proficiencyRank))) errors.push("明确匹配不能超过简历证据描述的熟练程度，请改为部分匹配并核实");
      for (const term of toolTerms.filter((term) => hasTerm(requiredText, term))) {
        const mentions = clauses.filter((line) => hasTerm(line, term));
        if (item.status === "matched" && !mentions.length) errors.push("明确匹配的工具要求必须有对应工具的简历证据");
        if (mentions.length && mentions.every((line) => negative.test(line))) errors.push("不能把明确否定的技能判为已匹配");
      }
    } else if (!item.evidence_source.length && !item.needs_confirmation) errors.push("缺少证据的 gap 必须标记待确认");
  }
  for (const requirement of input.requirements) if (!mappings.has(requirement.ref)) errors.push(`缺少岗位要求映射：${requirement.ref}`);
  for (const item of data.rewrite_suggestions) {
    checkRequirement(item.requirement_ref, item.related_job_requirement);
    checkEvidence(item.evidence_source);
    const mapping = mappings.get(item.requirement_ref);
    if (!mapping || mapping.status === "gap") errors.push("没有支持证据的岗位要求不能生成简历改写");
    if (!item.evidence_source.some((source) => source.resume_section === item.resume_section && source.quote === item.original_text)) errors.push("改写原文必须同时是该简历区域的引用证据");
    if (item.evidence_source.some((source) => !mapping?.evidence_source.some((mapped) => mapped.quote === source.quote && mapped.resume_section === source.resume_section))) errors.push("改写证据必须来自对应岗位要求的证据映射");
    errors.push(...checkRewrite(item.original_text, item.suggested_text, item.evidence_source.map((source) => source.quote).join("\n")));
  }
  for (const item of data.gaps) {
    checkRequirement(item.requirement_ref);
    checkEvidence(item.evidence_source);
    const mapping = mappings.get(item.requirement_ref);
    if (item.type === "expression_gap" && mapping?.status !== "weak_match") errors.push("表达缺口必须对应有证据的 weak_match");
    if (item.type !== "expression_gap" && mapping?.status !== "gap") errors.push("证据或资格缺口必须对应 gap");
    if (item.type === "evidence_gap" && !item.needs_confirmation) errors.push("证据缺失不能直接断定用户不具备能力");
    if (item.type === "qualification_gap" && !item.evidence_source.length) errors.push("资格不符必须有明确简历证据，未填写不等于不达标");
    if (item.evidence_source.some((source) => !mapping?.evidence_source.some((mapped) => mapped.quote === source.quote && mapped.resume_section === source.resume_section))) errors.push("缺口证据必须来自对应映射");
  }
  for (const item of mappings.values()) {
    if (item.status === "weak_match" && !data.gaps.some((gap) => gap.requirement_ref === item.requirement_ref && gap.type === "expression_gap")) errors.push("weak_match 必须记录表达缺口");
    if (item.status === "gap" && !data.gaps.some((gap) => gap.requirement_ref === item.requirement_ref && gap.type !== "expression_gap")) errors.push("gap 必须记录证据或资格缺口");
  }
  if (input.context.actual_resume_version !== input.context.requested_resume_version && !data.final_notes.some((note) => note.includes(input.context.actual_resume_version) && note.includes(input.context.requested_resume_version))) errors.push("使用回退简历时必须说明请求版本和实际版本");
  return errors.length ? { success: false, errors: [...new Set(errors)] } : { success: true, data };
}

export type ResumeTailoringResult = {
  skill: "resume-tailoring"; version: "1.0.0";
  context: ResumeTailoringInput["context"]; output: ResumeTailoringOutput;
};
/** Returns a derived result only; no model, DB writes, file output or draft changes. */
export function createResumeTailoringResult(output: unknown, input: ResumeTailoringInput): ResumeTailoringResult {
  const checked = validateResumeTailoringOutput(output, input);
  if (!checked.success) throw new Error(`简历定制未通过校验：${checked.errors.join("；")}`);
  return structuredClone({ skill: input.skill, version: input.version, context: input.context, output: checked.data });
}
/** Call with a freshly built input before preparation-plan consumes a previous result. */
export function isResumeTailoringResultCurrent(result: ResumeTailoringResult, input: ResumeTailoringInput) {
  return result.skill === input.skill && result.version === input.version && canonical(result.context) === canonical(input.context);
}

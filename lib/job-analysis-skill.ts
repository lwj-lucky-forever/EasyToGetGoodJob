import schema from "../skills/job-analysis/output.schema.json" with { type: "json" };
import type { ParsedJobFields } from "./job-parser.ts";

export const JOB_ANALYSIS_SKILL = {
  name: "job-analysis", version: "1.0.0",
  instructionsPath: "skills/job-analysis/SKILL.md",
  outputSchema: schema,
} as const;

const INPUT_FIELDS = ["company", "role", "location", "nature", "responsibilities", "requirements", "competencies", "sourceUrl", "applicationDeadline", "rawText"] as const satisfies readonly (keyof ParsedJobFields)[];
type InputField = typeof INPUT_FIELDS[number];
export type JobAnalysisInput = { skill: "job-analysis"; version: "1.0.0"; job: Pick<ParsedJobFields, InputField> };
type Evidence = { source_field: InputField; quote: string };
type Claim = { text: string; basis: "explicit" | "inferred"; reason: string; evidence: Evidence[] };
type Constraint = "education" | "major" | "city" | "internship_duration" | "weekly_attendance" | "language" | "experience" | "salary" | "start_date" | "recruitment_type";
export type JobAnalysisOutput = {
  summary: string;
  core_responsibilities: Claim[];
  must_have: Claim[];
  nice_to_have: Claim[];
  implicit_requirements: Claim[];
  skills: Claim[];
  constraints: Record<Constraint, Claim | null>;
  top_hiring_signals: Claim[];
  uncertainties: { field: string; reason: string; evidence: Evidence[] }[];
};

/** A derived input DTO, never a new DB model. No resume, score, network or writes. */
export function buildJobAnalysisInput(job: Partial<ParsedJobFields>): JobAnalysisInput {
  const selected = {} as JobAnalysisInput["job"];
  for (const field of INPUT_FIELDS) {
    const value = job[field];
    if (value != null && typeof value !== "string") throw new Error(`岗位字段 ${field} 必须是文本`);
    const text = (value ?? "").replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim();
    // Reject oversized inputs instead of silently losing a condition at the end.
    if (text.length > (field === "rawText" ? 50_000 : 20_000)) throw new Error(`岗位字段 ${field} 过长`);
    selected[field] = text;
  }
  if (!Object.values(selected).some(Boolean)) throw new Error("岗位信息为空，无法解读");
  return { skill: JOB_ANALYSIS_SKILL.name, version: JOB_ANALYSIS_SKILL.version, job: selected };
}

type SchemaNode = {
  $ref?: string; type?: string; enum?: unknown[]; allOf?: SchemaNode[]; anyOf?: SchemaNode[];
  required?: string[]; properties?: Record<string, SchemaNode>; additionalProperties?: boolean;
  items?: SchemaNode; minItems?: number; maxItems?: number; minLength?: number; maxLength?: number;
};

// Supports the schema constructs used in the checked-in contract only.
// This is not a general JSON Schema engine or a model-provider SDK.
function checkShape(value: unknown, rule: SchemaNode, path: string, errors: string[], definitions: Record<string, SchemaNode>): void {
  if (rule.$ref) {
    const target = rule.$ref.startsWith("#/$defs/") ? definitions[rule.$ref.slice(8)] : undefined;
    if (!target) throw new Error(`不支持的 schema 引用：${rule.$ref}`);
    checkShape(value, target, path, errors, definitions);
    return;
  }
  if (rule.allOf) rule.allOf.forEach((part) => checkShape(value, part, path, errors, definitions));
  if (rule.anyOf && !rule.anyOf.some((part) => {
    const branchErrors: string[] = [];
    checkShape(value, part, path, branchErrors, definitions);
    return branchErrors.length === 0;
  })) errors.push(`${path} 不符合允许的结构`);
  const object = value !== null && typeof value === "object" && !Array.isArray(value);
  if (rule.type && !(rule.type === "null" ? value === null : rule.type === "array" ? Array.isArray(value) : rule.type === "object" ? object : typeof value === rule.type)) {
    errors.push(`${path} 类型应为 ${rule.type}`);
    return;
  }
  if (rule.enum && !rule.enum.includes(value)) errors.push(`${path} 不在允许值中`);
  if (typeof value === "string") {
    const length = Array.from(value).length;
    if (rule.minLength !== undefined && (!value.trim() || length < rule.minLength)) errors.push(`${path} 文本为空或过短`);
    if (rule.maxLength !== undefined && length > rule.maxLength) errors.push(`${path} 文本过长`);
  }
  if (Array.isArray(value)) {
    if (rule.minItems !== undefined && value.length < rule.minItems) errors.push(`${path} 缺少条目`);
    if (rule.maxItems !== undefined && value.length > rule.maxItems) errors.push(`${path} 条目过多`);
    if (rule.items) value.forEach((item, index) => checkShape(item, rule.items!, `${path}[${index}]`, errors, definitions));
  }
  if (object) {
    const record = value as Record<string, unknown>;
    for (const key of rule.required ?? []) if (!Object.hasOwn(record, key)) errors.push(`${path}.${key} 缺失`);
    for (const key of Object.keys(record)) {
      if (rule.properties && Object.hasOwn(rule.properties, key)) checkShape(record[key], rule.properties[key], `${path}.${key}`, errors, definitions);
      else if (rule.additionalProperties === false) errors.push(`${path}.${key} 是未定义字段`);
    }
  }
}

/** Shared by independent skills using the same small JSON Schema subset. */
export function validateSkillOutputShape(value: unknown, contract: unknown): string[] {
  const root = contract as SchemaNode & { $defs?: Record<string, SchemaNode> };
  const errors: string[] = [];
  checkShape(value, root, "$", errors, root.$defs ?? {});
  return errors;
}

export type JobAnalysisValidation = { success: true; data: JobAnalysisOutput } | { success: false; errors: string[] };

/** Structural and quote validation, NOT proof of semantic correctness. */
export function validateJobAnalysisOutput(output: unknown, input: JobAnalysisInput): JobAnalysisValidation {
  let value = output;
  if (typeof value === "string") {
    if (value.length > 100_000) return { success: false, errors: ["岗位解读输出过长"] };
    try { value = JSON.parse(value); } catch { return { success: false, errors: ["岗位解读输出必须是有效 JSON"] }; }
  }
  const errors = validateSkillOutputShape(value, schema);
  if (errors.length) return { success: false, errors };
  const data = value as JobAnalysisOutput;
  const claims = [
    ...data.core_responsibilities, ...data.must_have, ...data.nice_to_have,
    ...data.implicit_requirements, ...data.skills, ...data.top_hiring_signals,
    ...Object.values(data.constraints).filter((item): item is Claim => item !== null),
  ];
  const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
  for (const item of [...claims, ...data.uncertainties]) {
    for (const evidence of item.evidence) {
      if (!normalize(input.job[evidence.source_field]).includes(normalize(evidence.quote))) {
        errors.push(`${evidence.source_field} 中不存在引用的原文`);
      }
    }
  }
  // Existing competencies may themselves be inferred; never use them alone as explicit evidence.
  for (const item of claims) if (item.basis === "explicit" && item.evidence.every((evidence) => evidence.source_field === "competencies")) {
    errors.push("明确结论不能只引用可能由规则推导的 competencies");
  }
  const must = new Set(data.must_have.map((item) => normalize(item.text)));
  if (data.nice_to_have.some((item) => must.has(normalize(item.text)))) errors.push("同一条件不能同时是硬性要求和加分项");
  return errors.length ? { success: false, errors } : { success: true, data };
}

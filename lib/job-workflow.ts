export const JOB_PRIORITIES = ["高", "中", "低"] as const;
export const RESUME_VERSIONS = ["通用版", "产品版", "运营版", "数据分析版", "航空专业版"] as const;
export const PROCESS_TYPES = ["笔试", "一面", "二面", "终面", "HR沟通", "其他"] as const;
export const PROCESS_STATUSES = ["待进行", "已完成", "已取消"] as const;

export type JobPriority = (typeof JOB_PRIORITIES)[number];
export type ResumeVersion = (typeof RESUME_VERSIONS)[number];
export type ProcessType = (typeof PROCESS_TYPES)[number];
export type ProcessStatus = (typeof PROCESS_STATUSES)[number];

export type ProcessRecord = {
  id: string;
  type: ProcessType;
  scheduledAt: string;
  status: ProcessStatus;
  notes: string;
  result: string;
};

export type PrepChecklistItem = {
  id: string;
  text: string;
  done: boolean;
  category: "行动" | "知识";
};

function safeText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function sanitizeProcessRecords(value: unknown): ProcessRecord[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const type = PROCESS_TYPES.includes(row.type as ProcessType) ? row.type as ProcessType : "其他";
    const status = PROCESS_STATUSES.includes(row.status as ProcessStatus) ? row.status as ProcessStatus : "待进行";
    return [{
      id: safeText(row.id, 100) || `record-${Date.now()}-${index}`,
      type,
      scheduledAt: safeText(row.scheduledAt, 40),
      status,
      notes: safeText(row.notes, 4_000),
      result: safeText(row.result, 2_000),
    }];
  });
}

export function sanitizePrepChecklist(value: unknown): PrepChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const text = safeText(row.text, 1_000);
    if (!text) return [];
    return [{
      id: safeText(row.id, 140) || `prep-${index}`,
      text,
      done: Boolean(row.done),
      category: row.category === "知识" ? "知识" : "行动",
    }];
  });
}

export function parseJsonArray<T>(value: string | null | undefined, sanitizer: (input: unknown) => T[]): T[] {
  if (!value) return [];
  try { return sanitizer(JSON.parse(value)); } catch { return []; }
}

export function recommendResumeVersion(job: { role?: unknown; responsibilities?: unknown; requirements?: unknown; competencies?: unknown }): ResumeVersion {
  const text = [job.role, job.responsibilities, job.requirements, job.competencies]
    .map((value) => typeof value === "string" ? value : "")
    .join("\n")
    .slice(0, 50_000);
  const scores: Record<Exclude<ResumeVersion, "通用版">, number> = {
    产品版: (text.match(/产品|需求|用户|功能|原型|PRD|竞品|交互/gi) ?? []).length,
    运营版: (text.match(/运营|增长|活动|内容|推广|留存|转化|社区|商户/gi) ?? []).length,
    数据分析版: (text.match(/数据|SQL|Python|统计|分析|指标|商业分析|Excel/gi) ?? []).length,
    航空专业版: (text.match(/航空|航天|无人机|eVTOL|飞行器|应急救援|仿真|MBSE/gi) ?? []).length,
  };
  const [version, score] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0] as [Exclude<ResumeVersion, "通用版">, number];
  return score > 0 ? version : "通用版";
}

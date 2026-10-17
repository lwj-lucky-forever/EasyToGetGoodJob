import { JOB_NATURES, parseJobText, type ParsedJobFields } from "./job-parser.ts";

export const WEB_DETAIL_LABELS = {
  employmentType: "用工形式", recruitmentType: "招聘类型", datePosted: "发布时间",
  education: "学历要求", major: "专业要求", experience: "工作年限 / 实习要求",
  internshipDuration: "实习时长", weeklyAttendance: "每周出勤要求", salary: "薪资",
  department: "所属部门", otherInformation: "岗位补充信息",
} as const;
export type WebJobDetails = Partial<Record<keyof typeof WEB_DETAIL_LABELS, string>>;
// Additional web fields are previewed separately and retained in the clean rawText.
// Existing job forms and database columns keep their original shape.
export type ImportedJob = Partial<ParsedJobFields> & { webDetails?: WebJobDetails };

const TEXT_LIMITS: Record<keyof ParsedJobFields, number> = {
  company: 160,
  role: 240,
  location: 240,
  nature: 20,
  responsibilities: 18_000,
  requirements: 18_000,
  competencies: 8_000,
  sourceUrl: 2_000,
  applicationDeadline: 40,
  rawText: 50_000,
};

const IMPORT_KEYS = Object.keys(TEXT_LIMITS) as Array<keyof ParsedJobFields>;

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim().slice(0, max);
}

export function normalizeDeadline(value: unknown) {
  const text = cleanText(value, 40);
  const match = text.match(/\b(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})(?:日)?(?=$|[^\d])/);
  if (!match) return "";
  const month = match[2].padStart(2, "0");
  const day = match[3].padStart(2, "0");
  const normalized = `${match[1]}-${month}-${day}`;
  const date = new Date(`${normalized}T12:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized ? "" : normalized;
}

/** Treat everything returned by a remote webpage as untrusted data. */
export function normalizeImportedJob(value: unknown): ImportedJob {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const output: ImportedJob = {};
  for (const key of IMPORT_KEYS) {
    const text = cleanText(input[key], TEXT_LIMITS[key]);
    if (text) output[key] = text as never;
  }
  if (output.nature && !JOB_NATURES.includes(output.nature as (typeof JOB_NATURES)[number])) delete output.nature;
  const deadline = normalizeDeadline(input.applicationDeadline ?? output.applicationDeadline);
  if (deadline) output.applicationDeadline = deadline;
  else delete output.applicationDeadline;
  if (input.webDetails && typeof input.webDetails === "object" && !Array.isArray(input.webDetails)) {
    const details = input.webDetails as Record<string, unknown>;
    output.webDetails = {};
    for (const key of Object.keys(WEB_DETAIL_LABELS) as Array<keyof WebJobDetails>) {
      const text = cleanText(details[key], key === "otherInformation" || key === "experience" ? 4_000 : 500);
      if (text) output.webDetails[key] = text;
    }
  }
  return output;
}

export function safelyParseJobText(value: unknown): ImportedJob {
  const rawText = cleanText(value, TEXT_LIMITS.rawText);
  if (!rawText) return {};
  try {
    return normalizeImportedJob({ ...parseJobText(rawText), rawText });
  } catch {
    return { rawText };
  }
}

export const RECOGNIZED_IMPORT_KEYS = [
  "company", "role", "location", "nature", "responsibilities", "requirements", "competencies", "sourceUrl", "applicationDeadline",
] as const;

export function recognizedImportKeys(value: ImportedJob) {
  return RECOGNIZED_IMPORT_KEYS.filter((key) => Boolean(value[key]));
}

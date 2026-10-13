import { JOB_NATURES, parseJobText, type ParsedJobFields } from "./job-parser";

export type ImportedJob = Partial<ParsedJobFields> & { applicationDeadline?: string };

const TEXT_LIMITS: Record<keyof ParsedJobFields, number> = {
  company: 160,
  role: 240,
  location: 240,
  nature: 20,
  responsibilities: 18_000,
  requirements: 18_000,
  competencies: 8_000,
  sourceUrl: 2_000,
  rawText: 50_000,
};

const IMPORT_KEYS = Object.keys(TEXT_LIMITS) as Array<keyof ParsedJobFields>;

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim().slice(0, max);
}

export function normalizeDeadline(value: unknown) {
  const text = cleanText(value, 40);
  const match = text.match(/\b(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})(?:日)?\b/);
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
  const deadline = normalizeDeadline(input.applicationDeadline);
  if (deadline) output.applicationDeadline = deadline;
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
  "company", "role", "location", "nature", "responsibilities", "requirements", "competencies", "sourceUrl",
] as const;

export function recognizedImportKeys(value: ImportedJob) {
  return RECOGNIZED_IMPORT_KEYS.filter((key) => Boolean(value[key]));
}

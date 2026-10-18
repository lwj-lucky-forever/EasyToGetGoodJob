import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { jobs } from "../../../../db/schema";
import { generatePrepChecklist } from "../../../../lib/resume-matcher";
import { parseJobText } from "../../../../lib/job-parser";
import {
  JOB_PRIORITIES,
  RESUME_VERSIONS,
  parseJsonArray,
  sanitizePrepChecklist,
  sanitizeProcessRecords,
  type JobPriority,
  type ResumeVersion,
} from "../../../../lib/job-workflow";
import { getJobAnalysis, refreshJobAnalysis } from "../../../../lib/resume-profile-server";

const STATUSES = new Set(["未投递", "准备中", "已投递", "笔试", "面试", "Offer", "暂停"]);
const FIELDS = ["company", "role", "location", "nature", "status", "responsibilities", "requirements", "competencies", "sourceUrl", "rawText", "priority", "applicationDeadline", "reminderAt", "resumeVersion"] as const;
const ANALYSIS_FIELDS = new Set(["role", "responsibilities", "requirements", "competencies", "rawText", "resumeVersion"]);

function authorizedOwner(request: Request) {
  const userId = request.headers.get("oai-authenticated-user-id");
  if (!userId) return { error: Response.json({ error: "请登录后进入个人工作区", code: "SIGN_IN_REQUIRED" }, { status: 401 }) };
  if (!env.OWNER_USER_ID || userId !== env.OWNER_USER_ID) return { error: Response.json({ error: "这是刘尉婕的个人求职工作区", code: "OWNER_ONLY" }, { status: 403 }) };
  return { userId };
}

function textValue(value: unknown, max = 20_000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = authorizedOwner(request);
  if (auth.error) return auth.error;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "岗位编号无效" }, { status: 400 });
  try {
    const db = getDb();
    const [existing] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.ownerId, auth.userId))).limit(1);
    if (!existing) return Response.json({ error: "未找到该岗位" }, { status: 404 });
    const payload = (await request.json()) as Record<string, unknown>;
    const values: Record<string, string | number | null> = { updatedAt: new Date().toISOString() };
    for (const field of FIELDS) {
      if (field in payload) values[field] = textValue(payload[field], field === "rawText" ? 50_000 : field === "sourceUrl" ? 2_000 : ["priority", "applicationDeadline", "reminderAt", "resumeVersion"].includes(field) ? 60 : 20_000);
    }
    if ("processRecords" in payload) values.processRecordsJson = JSON.stringify(sanitizeProcessRecords(payload.processRecords));
    if ("prepChecklist" in payload) values.prepChecklistJson = JSON.stringify(sanitizePrepChecklist(payload.prepChecklist));
    if ("rawText" in payload) {
      const parsed = parseJobText(String(values.rawText ?? ""));
      for (const field of ["company", "role", "location", "responsibilities", "requirements", "competencies", "sourceUrl"] as const) {
        if (!(field in payload) && !String(existing[field] ?? "").trim() && parsed[field]) values[field] = parsed[field]!;
      }
      if (!("nature" in payload) && (!existing.nature || existing.nature === "待确认") && parsed.nature) values.nature = parsed.nature;
    }
    if ("company" in values && !values.company) return Response.json({ error: "公司名称不能为空" }, { status: 400 });
    if ("role" in values && !values.role) return Response.json({ error: "岗位名称不能为空" }, { status: 400 });
    if ("company" in values) {
      const previousKey = existing.company.trim().replace(/\s+/g, " ").toLocaleLowerCase();
      const nextCompany = String(values.company ?? "");
      const nextKey = nextCompany.trim().replace(/\s+/g, " ").toLocaleLowerCase();
      if (previousKey !== nextKey) {
        const orderingRows = await db.select({ id: jobs.id, company: jobs.company, companyOrder: jobs.companyOrder, jobOrder: jobs.jobOrder }).from(jobs).where(eq(jobs.ownerId, auth.userId));
        const sameCompany = orderingRows.filter((row) => row.id !== id && row.company.trim().replace(/\s+/g, " ").toLocaleLowerCase() === nextKey);
        values.companyOrder = sameCompany.length ? Math.min(...sameCompany.map((row) => row.companyOrder)) : Math.max(-1, ...orderingRows.map((row) => row.companyOrder)) + 1;
        values.jobOrder = sameCompany.length ? Math.max(-1, ...sameCompany.map((row) => row.jobOrder)) + 1 : 0;
      }
    }
    if ("status" in values) {
      if (!STATUSES.has(String(values.status ?? ""))) return Response.json({ error: "投递状态无效" }, { status: 400 });
      values.appliedAt = ["未投递", "准备中"].includes(String(values.status ?? "")) ? null : new Date().toISOString();
    }
    if ("priority" in values && !JOB_PRIORITIES.includes(String(values.priority) as JobPriority)) return Response.json({ error: "岗位优先级无效" }, { status: 400 });
    if ("resumeVersion" in values && !RESUME_VERSIONS.includes(String(values.resumeVersion) as ResumeVersion)) return Response.json({ error: "简历版本无效" }, { status: 400 });
    if (FIELDS.some((field) => ANALYSIS_FIELDS.has(field) && field in payload)) {
      const selectedResumeVersion = String(values.resumeVersion ?? existing.resumeVersion);
      const analysis = await getJobAnalysis(auth.userId, {
        role: String(values.role ?? existing.role),
        responsibilities: String(values.responsibilities ?? existing.responsibilities),
        requirements: String(values.requirements ?? existing.requirements),
        competencies: String(values.competencies ?? existing.competencies),
        rawText: String(values.rawText ?? existing.rawText),
        resumeVersion: selectedResumeVersion,
      });
      values.matchScore = analysis.score;
      values.matchLevel = analysis.level;
      values.analysisJson = JSON.stringify(analysis);
      values.analysisVersion = analysis.version;
      values.analyzedAt = analysis.analyzedAt;
      if (!("prepChecklist" in payload)) {
        const previousChecklist = parseJsonArray(existing.prepChecklistJson, sanitizePrepChecklist);
        values.prepChecklistJson = JSON.stringify(generatePrepChecklist(analysis, previousChecklist));
      }
    }
    const [job] = await db.update(jobs).set(values).where(and(eq(jobs.id, id), eq(jobs.ownerId, auth.userId))).returning();
    return Response.json({ job: await refreshJobAnalysis(job) });
  } catch {
    return Response.json({ error: "暂时无法更新岗位，请稍后重试" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = authorizedOwner(request);
  if (auth.error) return auth.error;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "岗位编号无效" }, { status: 400 });
  try {
    const rows = await getDb().delete(jobs).where(and(eq(jobs.id, id), eq(jobs.ownerId, auth.userId))).returning({ id: jobs.id });
    if (!rows.length) return Response.json({ error: "未找到该岗位" }, { status: 404 });
    return Response.json({ deleted: true });
  } catch {
    return Response.json({ error: "暂时无法删除岗位，请稍后重试" }, { status: 500 });
  }
}

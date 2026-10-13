import { env } from "cloudflare:workers";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { jobs } from "../../../db/schema";
import { analyzeJob, generatePrepChecklist, presentJob } from "../../../lib/resume-matcher";
import { parseJobText } from "../../../lib/job-parser";
import { JOB_PRIORITIES, RESUME_VERSIONS, type JobPriority, type ResumeVersion } from "../../../lib/job-workflow";
import { getResumeProfileContent } from "../../../lib/resume-profile-server";

const STATUSES = new Set(["未投递", "准备中", "已投递", "笔试", "面试", "Offer", "暂停"]);

function authorizedOwner(request: Request) {
  const userId = request.headers.get("oai-authenticated-user-id");
  if (!userId) return { error: Response.json({ error: "请登录后进入个人工作区", code: "SIGN_IN_REQUIRED" }, { status: 401 }) };
  if (!env.OWNER_USER_ID || userId !== env.OWNER_USER_ID) {
    return { error: Response.json({ error: "这是刘尉婕的个人求职工作区", code: "OWNER_ONLY" }, { status: 403 }) };
  }
  return { userId };
}

function textValue(value: unknown, max = 20_000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table") || message.includes("jobs")) return "岗位数据正在初始化，请稍后刷新";
  return "暂时无法保存岗位，请稍后重试";
}

export async function GET(request: Request) {
  const auth = authorizedOwner(request);
  if (auth.error) return auth.error;
  try {
    const rows = await getDb().select().from(jobs).where(eq(jobs.ownerId, auth.userId)).orderBy(asc(jobs.companyOrder), asc(jobs.jobOrder), desc(jobs.updatedAt), desc(jobs.id));
    return Response.json({ jobs: rows.map(presentJob) });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = authorizedOwner(request);
  if (auth.error) return auth.error;
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const rawText = textValue(payload.rawText, 50_000);
    const parsed = parseJobText(rawText);
    const company = textValue(payload.company, 200) || parsed.company || "";
    const role = textValue(payload.role, 200) || parsed.role || "";
    if (!company || !role) return Response.json({ error: "公司名称和岗位名称不能为空" }, { status: 400 });
    const status = textValue(payload.status, 20);
    const responsibilities = textValue(payload.responsibilities) || parsed.responsibilities || "";
    const requirements = textValue(payload.requirements) || parsed.requirements || "";
    const competencies = textValue(payload.competencies) || parsed.competencies || "";
    const submittedNature = textValue(payload.nature, 50);
    const nature = (!submittedNature || submittedNature === "待确认") && parsed.nature ? parsed.nature : submittedNature || "待确认";
    const submittedPriority = textValue(payload.priority, 20) as JobPriority;
    const priority = JOB_PRIORITIES.includes(submittedPriority) ? submittedPriority : "中";
    const submittedResumeVersion = textValue(payload.resumeVersion, 40) as ResumeVersion;
    const resumeVersion = RESUME_VERSIONS.includes(submittedResumeVersion) ? submittedResumeVersion : "通用版";
    const resumeContent = await getResumeProfileContent(auth.userId, resumeVersion);
    const analysis = analyzeJob({ role, responsibilities, requirements, competencies, rawText, resumeVersion }, resumeContent);
    const prepChecklist = generatePrepChecklist(analysis);
    const now = new Date().toISOString();
    const orderingRows = await getDb().select({ company: jobs.company, companyOrder: jobs.companyOrder, jobOrder: jobs.jobOrder }).from(jobs).where(eq(jobs.ownerId, auth.userId));
    const companyKey = company.trim().replace(/\s+/g, " ").toLocaleLowerCase();
    const sameCompany = orderingRows.filter((row) => row.company.trim().replace(/\s+/g, " ").toLocaleLowerCase() === companyKey);
    const companyOrder = sameCompany.length ? Math.min(...sameCompany.map((row) => row.companyOrder)) : Math.max(-1, ...orderingRows.map((row) => row.companyOrder)) + 1;
    const jobOrder = sameCompany.length ? Math.max(-1, ...sameCompany.map((row) => row.jobOrder)) + 1 : 0;
    const [job] = await getDb().insert(jobs).values({
      ownerId: auth.userId,
      company,
      role,
      location: textValue(payload.location, 500) || parsed.location || "",
      nature,
      status: STATUSES.has(status) ? status : "未投递",
      responsibilities,
      requirements,
      competencies,
      sourceUrl: textValue(payload.sourceUrl, 2_000) || parsed.sourceUrl || "",
      rawText,
      matchScore: analysis.score,
      matchLevel: analysis.level,
      analysisJson: JSON.stringify(analysis),
      analysisVersion: analysis.version,
      analyzedAt: analysis.analyzedAt,
      priority,
      applicationDeadline: textValue(payload.applicationDeadline, 40),
      reminderAt: textValue(payload.reminderAt, 40),
      resumeVersion,
      processRecordsJson: "[]",
      prepChecklistJson: JSON.stringify(prepChecklist),
      companyOrder,
      jobOrder,
      appliedAt: status && status !== "未投递" && status !== "准备中" ? now : null,
      createdAt: now,
      updatedAt: now,
    }).returning();
    return Response.json({ job: presentJob(job) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

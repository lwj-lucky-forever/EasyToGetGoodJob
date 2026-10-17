import { desc, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "../../../db";
import { interviewReviews, jobs, resumeProfiles } from "../../../db/schema";
import { requireOwner, safeText } from "../../../lib/owner-auth";

const SCHEMA_VERSION = 1;
const JOB_LIMIT = 500;
const RESUME_LIMIT = 30;
const REVIEW_LIMIT = 2_000;

function download(body: string, contentType: string, filename: string) {
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csv(rows: unknown[][]) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

function jsonArrayLength(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch { return 0; }
}

function cleanJob(row: typeof jobs.$inferSelect) {
  return {
    id: row.id, backupId: row.id, company: row.company, role: row.role, location: row.location, nature: row.nature, status: row.status,
    responsibilities: row.responsibilities, requirements: row.requirements, competencies: row.competencies, sourceUrl: row.sourceUrl, rawText: row.rawText,
    matchScore: row.matchScore, matchLevel: row.matchLevel, analysisJson: row.analysisJson, analysisVersion: row.analysisVersion, analyzedAt: row.analyzedAt,
    priority: row.priority, applicationDeadline: row.applicationDeadline, reminderAt: row.reminderAt, resumeVersion: row.resumeVersion,
    processRecordsJson: row.processRecordsJson, prepChecklistJson: row.prepChecklistJson, companyOrder: row.companyOrder, jobOrder: row.jobOrder,
    appliedAt: row.appliedAt, createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

function cleanResume(row: typeof resumeProfiles.$inferSelect) {
  return { name: row.name, content: row.content, updatedAt: row.updatedAt };
}

function cleanReview(row: typeof interviewReviews.$inferSelect) {
  return {
    id: row.id, questionKey: row.questionKey, company: row.company, role: row.role, category: row.category, question: row.question,
    answer: row.answer, selfScore: row.selfScore, reviewNotes: row.reviewNotes, nextAction: row.nextAction, sourceType: row.sourceType,
    interviewRound: row.interviewRound, interviewDate: row.interviewDate, jobId: row.jobId, createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const auth = requireOwner(request);
  if (auth.error) return auth.error;
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get("format") || "json";
    const [jobRows, profileRows, reviewRows] = await Promise.all([
      getDb().select().from(jobs).where(eq(jobs.ownerId, auth.userId)).orderBy(jobs.companyOrder, jobs.jobOrder),
      getDb().select().from(resumeProfiles).where(eq(resumeProfiles.ownerId, auth.userId)).orderBy(resumeProfiles.name),
      getDb().select().from(interviewReviews).where(eq(interviewReviews.ownerId, auth.userId)).orderBy(desc(interviewReviews.updatedAt)),
    ]);

    if (format === "jobs-csv") {
      const rows: unknown[][] = [["公司", "岗位", "地点", "性质", "投递状态", "优先级", "截止日期", "提醒时间", "简历版本", "匹配度", "工作内容", "岗位要求", "考察能力", "来源链接", "流程记录数", "准备项总数", "准备项已完成", "创建时间", "更新时间"]];
      for (const job of jobRows) {
        let done = 0;
        try { done = (JSON.parse(job.prepChecklistJson) as Array<{ done?: boolean }>).filter((item) => item.done).length; } catch { done = 0; }
        rows.push([job.company, job.role, job.location, job.nature, job.status, job.priority, job.applicationDeadline, job.reminderAt, job.resumeVersion, job.matchScore ?? "", job.responsibilities, job.requirements, job.competencies, job.sourceUrl, jsonArrayLength(job.processRecordsJson), jsonArrayLength(job.prepChecklistJson), done, job.createdAt, job.updatedAt]);
      }
      return download(csv(rows), "text/csv; charset=utf-8", `EasyToGetGoodJob-jobs-${dateStamp()}.csv`);
    }

    if (format === "reviews-csv") {
      const rows: unknown[][] = [["公司", "岗位", "题目分类", "面试题", "类型", "轮次", "日期", "我的回答", "自评分", "复盘记录", "下一步行动", "更新时间"]];
      for (const review of reviewRows) rows.push([review.company, review.role, review.category, review.question, review.sourceType, review.interviewRound, review.interviewDate, review.answer, review.selfScore, review.reviewNotes, review.nextAction, review.updatedAt]);
      return download(csv(rows), "text/csv; charset=utf-8", `EasyToGetGoodJob-interview-reviews-${dateStamp()}.csv`);
    }

    const snapshot = {
      app: "EasyToGetGoodJob",
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      counts: { jobs: jobRows.length, resumes: profileRows.length, interviewReviews: reviewRows.length },
      jobs: jobRows.map(cleanJob),
      resumes: profileRows.map(cleanResume),
      interviewReviews: reviewRows.map(cleanReview),
    };
    return download(JSON.stringify(snapshot, null, 2), "application/json; charset=utf-8", `EasyToGetGoodJob-backup-${dateStamp()}.json`);
  } catch {
    return Response.json({ error: "暂时无法生成备份，请稍后重试" }, { status: 500 });
  }
}

function objectArray(value: unknown, max: number) {
  if (!Array.isArray(value) || value.length > max || value.some((item) => !item || typeof item !== "object" || Array.isArray(item))) return null;
  return value as Array<Record<string, unknown>>;
}

function intValue(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

function nullableText(value: unknown, max = 20_000) {
  const text = safeText(value, max);
  return text || null;
}

function normalizedJob(row: Record<string, unknown>, ownerId: string, now: string): Omit<typeof jobs.$inferInsert, "id"> | null {
  const company = safeText(row.company, 200);
  const role = safeText(row.role, 200);
  if (!company || !role) return null;
  return {
    ownerId, company, role,
    location: safeText(row.location, 500), nature: safeText(row.nature, 50) || "待确认", status: safeText(row.status, 20) || "未投递",
    responsibilities: safeText(row.responsibilities), requirements: safeText(row.requirements), competencies: safeText(row.competencies),
    sourceUrl: safeText(row.sourceUrl, 2_000), rawText: safeText(row.rawText, 50_000),
    matchScore: row.matchScore === null ? null : Math.max(0, Math.min(100, intValue(row.matchScore, 0))), matchLevel: safeText(row.matchLevel, 20),
    analysisJson: safeText(row.analysisJson, 80_000), analysisVersion: Math.max(1, intValue(row.analysisVersion, 1)), analyzedAt: nullableText(row.analyzedAt, 40),
    priority: safeText(row.priority, 20) || "中", applicationDeadline: safeText(row.applicationDeadline, 40), reminderAt: safeText(row.reminderAt, 40),
    resumeVersion: safeText(row.resumeVersion, 40) || "通用版", processRecordsJson: safeText(row.processRecordsJson, 80_000) || "[]", prepChecklistJson: safeText(row.prepChecklistJson, 80_000) || "[]",
    companyOrder: Math.max(0, intValue(row.companyOrder, 0)), jobOrder: Math.max(0, intValue(row.jobOrder, 0)), appliedAt: nullableText(row.appliedAt, 40),
    createdAt: safeText(row.createdAt, 40) || now, updatedAt: safeText(row.updatedAt, 40) || now,
  };
}

function normalizedReview(row: Record<string, unknown>, ownerId: string, now: string): Omit<typeof interviewReviews.$inferInsert, "id"> | null {
  const question = safeText(row.question, 4_000);
  if (!question) return null;
  return {
    ownerId, questionKey: safeText(row.questionKey, 120), company: safeText(row.company, 200), role: safeText(row.role, 200),
    category: safeText(row.category, 80) || "综合", question, answer: safeText(row.answer, 20_000),
    selfScore: Math.max(0, Math.min(5, intValue(row.selfScore, 0))), reviewNotes: safeText(row.reviewNotes, 20_000), nextAction: safeText(row.nextAction, 4_000),
    sourceType: safeText(row.sourceType, 20) === "真实面试" ? "真实面试" : "模拟练习", interviewRound: safeText(row.interviewRound, 80),
    interviewDate: safeText(row.interviewDate, 40), jobId: null, createdAt: safeText(row.createdAt, 40) || now, updatedAt: safeText(row.updatedAt, 40) || now,
  };
}

function jobIdentity(job: { company: string; role: string; location?: string; sourceUrl?: string }) {
  const url = (job.sourceUrl ?? "").trim().toLowerCase();
  return url ? `url:${url}` : `job:${job.company.trim().toLowerCase()}|${job.role.trim().toLowerCase()}|${(job.location ?? "").trim().toLowerCase()}`;
}

export async function POST(request: Request) {
  const auth = requireOwner(request);
  if (auth.error) return auth.error;
  try {
    const body = await request.json() as Record<string, unknown>;
    const snapshot = body.snapshot && typeof body.snapshot === "object" && !Array.isArray(body.snapshot) ? body.snapshot as Record<string, unknown> : null;
    const mode = body.mode === "replace" ? "replace" : "merge";
    if (!snapshot || snapshot.app !== "EasyToGetGoodJob" || intValue(snapshot.schemaVersion) !== SCHEMA_VERSION) {
      return Response.json({ error: "这不是可识别的 EasyToGetGoodJob 备份文件" }, { status: 400 });
    }
    const inputJobs = objectArray(snapshot.jobs, JOB_LIMIT);
    const inputResumes = objectArray(snapshot.resumes, RESUME_LIMIT);
    const inputReviews = objectArray(snapshot.interviewReviews, REVIEW_LIMIT);
    if (!inputJobs || !inputResumes || !inputReviews) return Response.json({ error: "备份内容损坏或超过允许数量" }, { status: 400 });
    const now = new Date().toISOString();
    const restoredJobs = inputJobs.map((row) => normalizedJob(row, auth.userId, now)).filter((row): row is NonNullable<typeof row> => Boolean(row));
    const restoredReviews = inputReviews.map((row) => normalizedReview(row, auth.userId, now)).filter((row): row is NonNullable<typeof row> => Boolean(row));
    const restoredResumes = inputResumes.map((row) => ({ ownerId: auth.userId, name: safeText(row.name, 40), content: safeText(row.content, 100_000), updatedAt: safeText(row.updatedAt, 40) || now })).filter((row) => row.name);
    if (restoredJobs.length !== inputJobs.length || restoredReviews.length !== inputReviews.length || restoredResumes.length !== inputResumes.length) {
      return Response.json({ error: "备份中存在缺少必要字段的数据，未执行恢复" }, { status: 400 });
    }

    const db = getDb();
    if (mode === "replace") {
      const statements: BatchItem<"sqlite">[] = [
        db.delete(interviewReviews).where(eq(interviewReviews.ownerId, auth.userId)),
        db.delete(jobs).where(eq(jobs.ownerId, auth.userId)),
        db.delete(resumeProfiles).where(eq(resumeProfiles.ownerId, auth.userId)),
        ...restoredJobs.map((row) => db.insert(jobs).values(row)),
        ...restoredResumes.map((row) => db.insert(resumeProfiles).values(row)),
        ...restoredReviews.map((row) => db.insert(interviewReviews).values(row)),
      ];
      await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
      return Response.json({ ok: true, mode, imported: { jobs: restoredJobs.length, resumes: restoredResumes.length, interviewReviews: restoredReviews.length }, skipped: { jobs: 0, interviewReviews: 0 } });
    }

    const [currentJobs, currentReviews] = await Promise.all([
      db.select().from(jobs).where(eq(jobs.ownerId, auth.userId)),
      db.select().from(interviewReviews).where(eq(interviewReviews.ownerId, auth.userId)),
    ]);
    const jobKeys = new Set(currentJobs.map(jobIdentity));
    const reviewKeys = new Set(currentReviews.map((row) => `${row.sourceType}|${row.interviewDate}|${row.company}|${row.role}|${row.question}`));
    let jobsAdded = 0; let jobsSkipped = 0; let reviewsAdded = 0; let reviewsSkipped = 0;
    for (const row of restoredJobs) {
      const key = jobIdentity(row);
      if (jobKeys.has(key)) { jobsSkipped += 1; continue; }
      await db.insert(jobs).values(row); jobKeys.add(key); jobsAdded += 1;
    }
    for (const row of restoredResumes) {
      await db.insert(resumeProfiles).values(row).onConflictDoUpdate({ target: [resumeProfiles.ownerId, resumeProfiles.name], set: { content: row.content, updatedAt: row.updatedAt } });
    }
    for (const row of restoredReviews) {
      const key = `${row.sourceType}|${row.interviewDate}|${row.company}|${row.role}|${row.question}`;
      if (reviewKeys.has(key)) { reviewsSkipped += 1; continue; }
      await db.insert(interviewReviews).values(row); reviewKeys.add(key); reviewsAdded += 1;
    }
    return Response.json({ ok: true, mode, imported: { jobs: jobsAdded, resumes: restoredResumes.length, interviewReviews: reviewsAdded }, skipped: { jobs: jobsSkipped, interviewReviews: reviewsSkipped } });
  } catch {
    return Response.json({ error: "备份恢复失败，现有数据未被自动隐藏；请检查文件后重试" }, { status: 500 });
  }
}

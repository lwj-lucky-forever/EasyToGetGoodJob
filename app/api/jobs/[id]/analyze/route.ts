import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { jobs } from "../../../../../db/schema";
import { analyzeJob, generatePrepChecklist, presentJob } from "../../../../../lib/resume-matcher";
import { parseJsonArray, sanitizePrepChecklist } from "../../../../../lib/job-workflow";
import { getResumeProfileContent } from "../../../../../lib/resume-profile-server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = request.headers.get("oai-authenticated-user-id");
  if (!userId) return Response.json({ error: "请登录后进入个人工作区" }, { status: 401 });
  if (!env.OWNER_USER_ID || userId !== env.OWNER_USER_ID) return Response.json({ error: "这是刘尉婕的个人求职工作区" }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "岗位编号无效" }, { status: 400 });
  try {
    const db = getDb();
    const [existing] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.ownerId, userId))).limit(1);
    if (!existing) return Response.json({ error: "未找到该岗位" }, { status: 404 });
    const resumeContent = await getResumeProfileContent(userId, existing.resumeVersion);
    const analysis = analyzeJob(existing, resumeContent);
    const previousChecklist = parseJsonArray(existing.prepChecklistJson, sanitizePrepChecklist);
    const [job] = await db.update(jobs).set({
      matchScore: analysis.score,
      matchLevel: analysis.level,
      analysisJson: JSON.stringify(analysis),
      analysisVersion: analysis.version,
      analyzedAt: analysis.analyzedAt,
      prepChecklistJson: JSON.stringify(generatePrepChecklist(analysis, previousChecklist)),
      updatedAt: new Date().toISOString(),
    }).where(and(eq(jobs.id, id), eq(jobs.ownerId, userId))).returning();
    return Response.json({ job: presentJob(job) });
  } catch {
    return Response.json({ error: "暂时无法分析岗位，请稍后重试" }, { status: 500 });
  }
}

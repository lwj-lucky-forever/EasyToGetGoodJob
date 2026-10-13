import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { interviewReviews } from "../../../db/schema";
import { requireOwner, safeText } from "../../../lib/owner-auth";

const SOURCE_TYPES = new Set(["模拟练习", "真实面试"]);

function parseScore(value: unknown) {
  const score = Number(value);
  return Number.isInteger(score) && score >= 0 && score <= 5 ? score : 0;
}

export async function GET(request: Request) {
  const auth = requireOwner(request);
  if (auth.error) return auth.error;
  try {
    const reviews = await getDb().select().from(interviewReviews)
      .where(eq(interviewReviews.ownerId, auth.userId))
      .orderBy(desc(interviewReviews.updatedAt), desc(interviewReviews.id));
    return Response.json({ reviews });
  } catch {
    return Response.json({ error: "暂时无法读取面试复盘，请稍后重试" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = requireOwner(request);
  if (auth.error) return auth.error;
  try {
    const payload = await request.json() as Record<string, unknown>;
    const question = safeText(payload.question, 4_000);
    if (!question) return Response.json({ error: "请填写面试题" }, { status: 400 });
    const now = new Date().toISOString();
    const sourceType = safeText(payload.sourceType, 20);
    const jobIdValue = Number(payload.jobId);
    const [review] = await getDb().insert(interviewReviews).values({
      ownerId: auth.userId,
      questionKey: safeText(payload.questionKey, 120),
      company: safeText(payload.company, 200),
      role: safeText(payload.role, 200),
      category: safeText(payload.category, 80) || "综合",
      question,
      answer: safeText(payload.answer, 20_000),
      selfScore: parseScore(payload.selfScore),
      reviewNotes: safeText(payload.reviewNotes, 10_000),
      nextAction: safeText(payload.nextAction, 4_000),
      sourceType: SOURCE_TYPES.has(sourceType) ? sourceType : "模拟练习",
      interviewRound: safeText(payload.interviewRound, 80),
      interviewDate: safeText(payload.interviewDate, 40),
      jobId: Number.isInteger(jobIdValue) && jobIdValue > 0 ? jobIdValue : null,
      createdAt: now,
      updatedAt: now,
    }).returning();
    return Response.json({ review }, { status: 201 });
  } catch {
    return Response.json({ error: "暂时无法保存面试复盘，请稍后重试" }, { status: 500 });
  }
}


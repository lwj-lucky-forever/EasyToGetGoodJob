import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { interviewReviews } from "../../../../db/schema";
import { requireOwner, safeText } from "../../../../lib/owner-auth";

const TEXT_FIELDS = ["questionKey", "company", "role", "category", "question", "answer", "reviewNotes", "nextAction", "sourceType", "interviewRound", "interviewDate"] as const;

function reviewIdFrom(params: { id: string }) {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireOwner(request);
  if (auth.error) return auth.error;
  const id = reviewIdFrom(await context.params);
  if (!id) return Response.json({ error: "复盘编号无效" }, { status: 400 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const values: Record<string, string | number | null> = { updatedAt: new Date().toISOString() };
    for (const field of TEXT_FIELDS) {
      if (field in payload) values[field] = safeText(payload[field], ["answer", "reviewNotes"].includes(field) ? 20_000 : 4_000);
    }
    if ("selfScore" in payload) {
      const score = Number(payload.selfScore);
      if (!Number.isInteger(score) || score < 0 || score > 5) return Response.json({ error: "自评分数应为0到5" }, { status: 400 });
      values.selfScore = score;
    }
    if ("jobId" in payload) {
      const jobId = Number(payload.jobId);
      values.jobId = Number.isInteger(jobId) && jobId > 0 ? jobId : null;
    }
    if ("question" in values && !values.question) return Response.json({ error: "面试题不能为空" }, { status: 400 });
    const [review] = await getDb().update(interviewReviews).set(values)
      .where(and(eq(interviewReviews.id, id), eq(interviewReviews.ownerId, auth.userId))).returning();
    if (!review) return Response.json({ error: "未找到这条复盘" }, { status: 404 });
    return Response.json({ review });
  } catch {
    return Response.json({ error: "暂时无法更新面试复盘，请稍后重试" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = requireOwner(request);
  if (auth.error) return auth.error;
  const id = reviewIdFrom(await context.params);
  if (!id) return Response.json({ error: "复盘编号无效" }, { status: 400 });
  try {
    const rows = await getDb().delete(interviewReviews)
      .where(and(eq(interviewReviews.id, id), eq(interviewReviews.ownerId, auth.userId))).returning({ id: interviewReviews.id });
    if (!rows.length) return Response.json({ error: "未找到这条复盘" }, { status: 404 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "暂时无法删除面试复盘，请稍后重试" }, { status: 500 });
  }
}


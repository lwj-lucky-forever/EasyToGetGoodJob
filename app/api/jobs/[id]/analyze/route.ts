import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { jobs } from "../../../../../db/schema";
import { refreshJobAnalysis } from "../../../../../lib/resume-profile-server";

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
    return Response.json({ job: await refreshJobAnalysis(existing, undefined, true) });
  } catch {
    return Response.json({ error: "暂时无法分析岗位，请稍后重试" }, { status: 500 });
  }
}

import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { jobs } from "../../../../db/schema";

function authorizedOwner(request: Request) {
  const userId = request.headers.get("oai-authenticated-user-id");
  if (!userId) return { error: Response.json({ error: "请登录后进入个人工作区", code: "SIGN_IN_REQUIRED" }, { status: 401 }) };
  if (!env.OWNER_USER_ID || userId !== env.OWNER_USER_ID) return { error: Response.json({ error: "这是刘尉婕的个人求职工作区", code: "OWNER_ONLY" }, { status: 403 }) };
  return { userId };
}

export async function POST(request: Request) {
  const auth = authorizedOwner(request);
  if (auth.error) return auth.error;
  try {
    const payload = await request.json() as Record<string, unknown>;
    if (!Array.isArray(payload.groups) || payload.groups.length > 200) return Response.json({ error: "排序数据无效" }, { status: 400 });
    const placements: Array<{ id: number; companyOrder: number; jobOrder: number }> = [];
    const seen = new Set<number>();
    for (const [companyOrder, group] of payload.groups.entries()) {
      if (!group || typeof group !== "object" || !Array.isArray((group as Record<string, unknown>).jobIds)) return Response.json({ error: "排序数据无效" }, { status: 400 });
      const jobIds = (group as { jobIds: unknown[] }).jobIds;
      if (jobIds.length > 500) return Response.json({ error: "排序数据过多" }, { status: 400 });
      for (const [jobOrder, value] of jobIds.entries()) {
        if (!Number.isInteger(value) || Number(value) <= 0 || seen.has(Number(value))) return Response.json({ error: "岗位排序数据无效" }, { status: 400 });
        const id = Number(value);
        seen.add(id);
        placements.push({ id, companyOrder, jobOrder });
      }
    }
    const existing = await getDb().select({ id: jobs.id }).from(jobs).where(eq(jobs.ownerId, auth.userId));
    if (existing.length !== placements.length || existing.some((row) => !seen.has(row.id))) return Response.json({ error: "岗位列表已发生变化，请刷新后重试" }, { status: 409 });
    const database = env.DB;
    if (!database) throw new Error("Database unavailable");
    if (placements.length) {
      await database.batch(placements.map((item) => database.prepare(
        "UPDATE jobs SET company_order = ?, job_order = ? WHERE id = ? AND owner_id = ?",
      ).bind(item.companyOrder, item.jobOrder, item.id, auth.userId)));
    }
    return Response.json({ reordered: true });
  } catch {
    return Response.json({ error: "暂时无法保存排序，请稍后重试" }, { status: 500 });
  }
}

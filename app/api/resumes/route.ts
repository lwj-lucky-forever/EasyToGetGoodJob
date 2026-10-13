import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { resumeProfiles } from "../../../db/schema";
import { RESUME_VERSIONS, type ResumeVersion } from "../../../lib/job-workflow";
import { DEFAULT_RESUME_PROFILES } from "../../../lib/resume-profiles";

function authorizedOwner(request: Request) {
  const userId = request.headers.get("oai-authenticated-user-id");
  if (!userId) return { error: Response.json({ error: "请登录后进入个人工作区" }, { status: 401 }) };
  if (!env.OWNER_USER_ID || userId !== env.OWNER_USER_ID) return { error: Response.json({ error: "这是刘尉婕的个人求职工作区" }, { status: 403 }) };
  return { userId };
}

export async function GET(request: Request) {
  const auth = authorizedOwner(request);
  if (auth.error) return auth.error;
  try {
    const rows = await getDb().select().from(resumeProfiles).where(eq(resumeProfiles.ownerId, auth.userId));
    const stored = new Map(rows.map((row) => [row.name, row]));
    return Response.json({ profiles: RESUME_VERSIONS.map((name) => ({ name, content: stored.get(name)?.content || DEFAULT_RESUME_PROFILES[name], updatedAt: stored.get(name)?.updatedAt || "" })) });
  } catch {
    return Response.json({ error: "暂时无法读取简历版本" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = authorizedOwner(request);
  if (auth.error) return auth.error;
  try {
    const payload = await request.json() as Record<string, unknown>;
    const name = typeof payload.name === "string" ? payload.name as ResumeVersion : "" as ResumeVersion;
    const content = typeof payload.content === "string" ? payload.content.replace(/\u0000/g, "").trim().slice(0, 50_000) : "";
    if (!RESUME_VERSIONS.includes(name)) return Response.json({ error: "简历版本无效" }, { status: 400 });
    if (content.length < 20) return Response.json({ error: "请填写更完整的简历内容" }, { status: 400 });
    const updatedAt = new Date().toISOString();
    const [profile] = await getDb().insert(resumeProfiles).values({ ownerId: auth.userId, name, content, updatedAt })
      .onConflictDoUpdate({ target: [resumeProfiles.ownerId, resumeProfiles.name], set: { content, updatedAt } }).returning();
    return Response.json({ profile });
  } catch {
    return Response.json({ error: "暂时无法保存简历版本" }, { status: 500 });
  }
}

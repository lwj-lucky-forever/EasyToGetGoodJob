import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { jobs, resumeProfiles } from "../../../db/schema";
import { RESUME_VERSIONS, type ResumeVersion } from "../../../lib/job-workflow";
import { loadResumeProfiles, refreshJobAnalysis } from "../../../lib/resume-profile-server";

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
    return Response.json({ profiles: RESUME_VERSIONS.map((name) => ({ name, content: stored.get(name)?.content || "", updatedAt: stored.get(name)?.updatedAt || "" })) }, { headers: { "Cache-Control": "no-store" } });
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
    const db = getDb();
    const saveProfile = db.insert(resumeProfiles).values({ ownerId: auth.userId, name, content, updatedAt })
      .onConflictDoUpdate({ target: [resumeProfiles.ownerId, resumeProfiles.name], set: { content, updatedAt } }).returning();
    // Applying to all jobs changes their existing version selector, not other saved resumes.
    const [saved] = payload.applyToAllJobs === true
      ? await db.batch([saveProfile, db.update(jobs).set({ resumeVersion: name }).where(eq(jobs.ownerId, auth.userId))])
      : [await saveProfile];
    const profile = saved[0];
    let updatedJobs = 0;
    let refreshPending = false;
    try {
      const profiles = await loadResumeProfiles(auth.userId);
      const rows = await db.select().from(jobs).where(eq(jobs.ownerId, auth.userId));
      for (const row of rows) {
        const result = await refreshJobAnalysis(row, profiles);
        if (result.matchAnalysis.resumeSource.name === name) updatedJobs++;
      }
    } catch { refreshPending = true; } // A subsequent GET validates and repairs stale caches.
    return Response.json({ profile, updatedJobs, refreshPending });
  } catch {
    return Response.json({ error: "暂时无法保存简历版本" }, { status: 500 });
  }
}

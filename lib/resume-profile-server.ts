import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { resumeProfiles } from "../db/schema";
import { DEFAULT_RESUME_PROFILES } from "./resume-profiles";
import { RESUME_VERSIONS, type ResumeVersion } from "./job-workflow";

export async function getResumeProfileContent(ownerId: string, version: string) {
  const normalized = RESUME_VERSIONS.includes(version as ResumeVersion) ? version as ResumeVersion : "通用版";
  const [stored] = await getDb().select({ content: resumeProfiles.content }).from(resumeProfiles)
    .where(and(eq(resumeProfiles.ownerId, ownerId), eq(resumeProfiles.name, normalized))).limit(1);
  return stored?.content.trim() || DEFAULT_RESUME_PROFILES[normalized];
}

import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { jobs, resumeProfiles } from "../db/schema";
import { resolveResumeProfile, type ResumeProfile } from "./resume-profiles";
import { analysisInputKey, analyzeJob, presentJob, type JobForAnalysis } from "./resume-matcher";

export async function loadResumeProfiles(ownerId: string) {
  return getDb().select().from(resumeProfiles).where(eq(resumeProfiles.ownerId, ownerId));
}

export async function getJobAnalysis(ownerId: string, job: JobForAnalysis) {
  const source = resolveResumeProfile(await loadResumeProfiles(ownerId), job.resumeVersion ?? "通用版");
  return analyzeJob(job, source, await analysisInputKey(job, source));
}

// All job entry points use the same source selection and cache validation.
export async function refreshJobAnalysis(job: typeof jobs.$inferSelect, profiles?: ResumeProfile[], force = false) {
  const source = resolveResumeProfile(profiles ?? await loadResumeProfiles(job.ownerId), job.resumeVersion);
  const presented = presentJob(job, source, await analysisInputKey(job, source), force);
  const analysis = presented.matchAnalysis;
  const analysisJson = JSON.stringify(analysis);
  const prepChecklistJson = JSON.stringify(presented.prepChecklist);
  if (analysisJson !== job.analysisJson || prepChecklistJson !== job.prepChecklistJson) {
    await getDb().update(jobs).set({
      analysisJson, prepChecklistJson, matchScore: analysis.score, matchLevel: analysis.level,
      analysisVersion: analysis.version, analyzedAt: analysis.analyzedAt,
    }).where(and(eq(jobs.id, job.id), eq(jobs.ownerId, job.ownerId), eq(jobs.updatedAt, job.updatedAt), eq(jobs.analysisJson, job.analysisJson), eq(jobs.prepChecklistJson, job.prepChecklistJson)));
  }
  // Recalculation does not change updatedAt or manual ordering.
  return { ...presented, analysisVersion: analysis.version, analyzedAt: analysis.analyzedAt };
}

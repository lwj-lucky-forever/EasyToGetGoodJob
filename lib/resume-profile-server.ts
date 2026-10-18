import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { jobs, resumeProfiles } from "../db/schema";
import { resolveResumeProfile, type ResumeProfile } from "./resume-profiles";
import { analysisInputKey, analyzeJob, presentJob, type JobForAnalysis } from "./resume-matcher";
import { mergeParsedJob, parseJobText } from "./job-parser";

export async function loadResumeProfiles(ownerId: string) {
  return getDb().select().from(resumeProfiles).where(eq(resumeProfiles.ownerId, ownerId));
}

export async function getJobAnalysis(ownerId: string, job: JobForAnalysis) {
  const source = resolveResumeProfile(await loadResumeProfiles(ownerId), job.resumeVersion ?? "通用版");
  const normalized = mergeParsedJob(job, job.rawText ? parseJobText(job.rawText) : {});
  return analyzeJob(normalized, source, await analysisInputKey(normalized, source));
}

// All job entry points use the same source selection and cache validation.
export async function refreshJobAnalysis(job: typeof jobs.$inferSelect, profiles?: ResumeProfile[], force = false) {
  const source = resolveResumeProfile(profiles ?? await loadResumeProfiles(job.ownerId), job.resumeVersion);
  const normalized = mergeParsedJob(job, job.rawText ? parseJobText(job.rawText) : {});
  const presented = presentJob(normalized, source, await analysisInputKey(normalized, source), force);
  const analysis = presented.matchAnalysis;
  const analysisJson = JSON.stringify(analysis);
  const prepChecklistJson = JSON.stringify(presented.prepChecklist);
  if (analysisJson !== job.analysisJson || prepChecklistJson !== job.prepChecklistJson || normalized.competencies !== job.competencies) {
    await getDb().update(jobs).set({
      competencies: normalized.competencies, analysisJson, prepChecklistJson, matchScore: analysis.score, matchLevel: analysis.level,
      analysisVersion: analysis.version, analyzedAt: analysis.analyzedAt,
    }).where(and(eq(jobs.id, job.id), eq(jobs.ownerId, job.ownerId), eq(jobs.updatedAt, job.updatedAt), eq(jobs.competencies, job.competencies), eq(jobs.analysisJson, job.analysisJson), eq(jobs.prepChecklistJson, job.prepChecklistJson)));
  }
  // Recalculation does not change updatedAt or manual ordering.
  return { ...presented, analysisVersion: analysis.version, analyzedAt: analysis.analyzedAt };
}

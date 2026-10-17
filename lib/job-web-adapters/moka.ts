import { fetchJobJson } from "../job-web-fetch.ts";
import { recordToJob, selectJobRecord } from "../job-web-extract.ts";
import type { JobWebAdapter } from "./types.ts";

function identity(url: URL) {
  if (!/(?:^|\.)mokahr\.com$/.test(url.hostname)) return null;
  const org = url.pathname.match(/^\/(?:apply|campus_apply|social-recruitment|campus-recruitment)\/([a-z\d_-]{1,80})\//i)?.[1];
  const id = url.hash.match(/^#?\/job\/([a-z\d-]{4,100})/i)?.[1];
  return org && id ? { org, id } : null;
}
// Tenant hints are fallbacks only; a posting's explicit employer takes priority.
const TENANT_COMPANIES: Record<string, string> = { didiglobal: "滴滴" };
export const mokaAdapter: JobWebAdapter = {
  id: "moka",
  canHandle: (url) => Boolean(identity(url)),
  async parse({ url, fetcher, stage }) {
    const job = identity(url);
    if (stage !== "api" || !job) return null;
    const endpoint = new URL(`https://api.mokahr.com/api-platform/v1/jobs/${encodeURIComponent(job.org)}/${encodeURIComponent(job.id)}`);
    const row = selectJobRecord(await fetchJobJson(endpoint, url.toString(), fetcher), job.id);
    if (!row) throw new Error("Moka 未返回对应岗位的完整详情，请确认岗位仍有效");
    return recordToJob(row, url.toString(), "Moka 职位数据接口", { company: TENANT_COMPANIES[job.org.toLowerCase()] });
  },
};

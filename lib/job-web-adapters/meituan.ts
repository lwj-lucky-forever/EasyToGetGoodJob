import { fetchJobJson } from "../job-web-fetch.ts";
import { field, recordToJob, selectJobRecord, valueText } from "../job-web-extract.ts";
import type { JobWebAdapter } from "./types.ts";

const jobId = (url: URL) => url.hostname === "zhaopin.meituan.com" && /^\d{5,30}$/.test(url.searchParams.get("jobUnionId") ?? "") ? url.searchParams.get("jobUnionId") : null;
export const meituanAdapter: JobWebAdapter = {
  id: "meituan",
  canHandle: (url) => Boolean(jobId(url)),
  async parse({ url, fetcher, stage }) {
    const id = jobId(url);
    if (stage !== "api" || !id) return null;
    const payload = await fetchJobJson(new URL("https://zhaopin.meituan.com/api/official/job/getJobDetail"), url.toString(), fetcher, { jobUnionId: id, jobShareType: "1" });
    const row = selectJobRecord(payload, id);
    if (!row) throw new Error("美团未返回对应岗位的完整详情，请确认岗位仍有效");
    const type = valueText(field(row, ["jobTypeName", "jobType", "recruitTypeName"]));
    return recordToJob({ ...row, recruitmentType: ({ "1": "校招", "2": "日常实习", "3": "其他" } as Record<string, string>)[type] ?? type }, url.toString(), "美团职位数据接口");
  },
};

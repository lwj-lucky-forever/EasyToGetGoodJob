import { fetchJobJson } from "../job-web-fetch.ts";
import { asRecord, recordHasJob, recordToJob } from "../job-web-extract.ts";
import type { JobWebAdapter } from "./types.ts";

// These are the public detail routes used by the recruitment website, not lists.
function positionId(url: URL) {
  if (!["job.xiaohongshu.com", "jobs.xiaohongshu.com"].includes(url.hostname)) return null;
  return url.pathname.match(/^\/(?:social\/position|campus\/(?:(?:intern\/(?:theme\/)?)|(?:share\/|theme\/))?position)\/(\d{1,12})\/?$/)?.[1] ?? null;
}

export const xiaohongshuAdapter: JobWebAdapter = {
  id: "xiaohongshu",
  canHandle: (url) => Boolean(positionId(url)),
  async parse({ url, stage, fetcher }) {
    const id = positionId(url);
    if (stage !== "api" || !id) return null;
    const endpoint = new URL("https://job.xiaohongshu.com/websiterecruit/position/queryPositionDetail");
    endpoint.searchParams.set("positionId", id);
    const payload = asRecord(await fetchJobJson(endpoint, url.toString(), fetcher));
    const detail = asRecord(payload?.data);
    if (payload?.success !== true || payload.statusCode !== 200 || !detail || String(detail.positionId) !== id) {
      throw new Error("小红书未返回这个岗位的有效详情，请确认链接和岗位是否仍然有效。");
    }
    if (detail.recruitStatus !== "in_recruitment") throw new Error("这个小红书岗位已停止招聘或状态无法确认，请核对官网。");
    const recruitmentTypes: Record<string, string> = { intern_recruit: "实习", school_recruit: "校招", club_recruit: "社招" };
    // Whitelist job fields: HR contacts, application controls and recommendations
    // from the API must never become part of the saved JD.
    const row = {
      positionId: detail.positionId, positionName: detail.positionName,
      responsibilities: detail.duty, qualifications: detail.qualification,
      workPlace: detail.workplace, education: detail.education,
      experience: detail.workExperience === "no_limit" ? "经验不限" : undefined,
      recruitmentType: recruitmentTypes[String(detail.recruitType)] || "",
    };
    if (!recordHasJob(row)) throw new Error("小红书岗位详情缺少岗位名称或正文，已停止导入。");
    return recordToJob(row, url.toString(), "小红书公开岗位详情接口");
  },
};

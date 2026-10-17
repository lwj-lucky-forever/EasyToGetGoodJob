import { fetchJobJson } from "../job-web-fetch.ts";
import { asRecord, jobRecordId, recordToJob } from "../job-web-extract.ts";
import { identifyJobSite } from "../job-web-sites.ts";
import type { JobWebAdapter } from "./types.ts";

function identity(url: URL) {
  if (identifyJobSite(url).platform !== "feishu") return null;
  const match = url.pathname.match(/^\/(campus|experienced|internship|social|school)\/position\/(\d{10,25})\/detail\/?$/);
  return match ? { id: match[2], channel: match[1] === "experienced" ? "society" : match[1] } : null;
}

export const feishuAdapter: JobWebAdapter = {
  id: "feishu",
  canHandle: (url) => Boolean(identity(url)),
  async parse({ url, fetcher, stage }) {
    const job = identity(url);
    if (stage !== "api" || !job) return null;
    const endpoint = new URL(`/api/v1/job/posts/${job.id}`, `https://${url.hostname}`);
    const payload = asRecord(await fetchJobJson(endpoint, url.toString(), fetcher, undefined, { "website-path": job.channel, "portal-channel": job.channel }));
    if (payload?.code !== 0) throw new Error("招聘平台未返回有效岗位，岗位可能已下线或需要安全验证；请在浏览器核对后粘贴 JD");
    const row = asRecord(asRecord(payload.data)?.job_post_detail);
    if (!row || jobRecordId(row) !== job.id) throw new Error("招聘平台返回的岗位与链接不一致，已停止导入");
    if (row.channel_online_status === 0) throw new Error("该岗位已下线或停止招聘");
    return recordToJob(row, url.toString(), "飞书招聘公开岗位接口", { recruitmentType: job.channel === "internship" ? "实习" : job.channel === "society" ? "社招" : "" });
  },
};

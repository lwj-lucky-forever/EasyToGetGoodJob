import { asRecord, embeddedJobPayloads, expectedJobId, jobRecordId, recordHasJob, recordToJob, valueText } from "../job-web-extract.ts";
import type { JobWebAdapter } from "./types.ts";

export const baiduAdapter: JobWebAdapter = {
  id: "baidu",
  canHandle: (url) => url.hostname === "talent.baidu.com" && /^\/jobs\/detail\//.test(url.pathname),
  async parse({ url, html, stage }) {
    if (stage !== "embedded" || !html) return null;
    for (const payload of embeddedJobPayloads(html)) {
      const detail = asRecord(asRecord(payload)?.detailData);
      if (!detail) continue;
      if (detail.isValid === false) throw new Error("该百度岗位已下线或不存在");
      const row = asRecord(detail.postInfo);
      if (row && recordHasJob(row) && jobRecordId(row) === expectedJobId(url)) {
        return recordToJob(row, url.toString(), "百度内嵌岗位详情", { recruitmentType: valueText(row.projectType) || valueText(detail.recruitType) });
      }
    }
    return null;
  },
};

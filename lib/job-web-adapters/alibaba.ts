import { fetchJobJson } from "../job-web-fetch.ts";
import { asRecord, recordHasJob, recordToJob, valueText } from "../job-web-extract.ts";
import type { JobWebAdapter } from "./types.ts";

const HOSTS = ["campus-talent.alibaba.com", "talent.alibaba.com", "talent-holding.alibaba.com", "talent.taotian.com"];
function position(url: URL) {
  if (!HOSTS.includes(url.hostname)) return null;
  const path = url.pathname.match(/^\/(campus|off-campus)\/(?:position\/(\d{5,20})|position-detail)\/?$/);
  if (!path) return null;
  const id = path[2] || url.searchParams.get("positionId");
  if (!id || !/^\d{5,20}$/.test(id)) return null;
  if (path[2] && url.searchParams.has("positionId") && url.searchParams.get("positionId") !== id) return null;
  return { id, campus: path[1] === "campus" };
}

/** Read only literal config strings from a script, never execute website JS. */
function pageConfig(html: string, campus: boolean) {
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)]
    .map((match) => match[1]).find((text) => /window\.__sysconfig\s*=\s*\{/.test(text));
  if (!script) return null;
  const config = script.slice(script.search(/window\.__sysconfig\s*=/));
  const literal = (name: string) => config.match(new RegExp(`(?:^|[,{])\\s*["']?${name}["']?\\s*:\\s*(["'])([^"'\\\\\\r\\n]+)\\1`))?.[2] ?? "";
  const token = literal("__token__");
  const channel = literal(campus ? "portalCampusChannel" : "portalOfficialChannel");
  return /^[\w.~-]{1,200}$/.test(token) && /^[\w-]{1,100}$/.test(channel) ? { token, channel } : null;
}

function chinaDate(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export const alibabaAdapter: JobWebAdapter = {
  id: "alibaba",
  canHandle: (url) => Boolean(position(url)),
  async parse({ url, html, sessionCookie, stage, fetcher }) {
    const target = position(url);
    if (stage !== "api" || !target || !html) return null;
    const config = pageConfig(html, target.campus);
    if (!config || !sessionCookie) throw new Error("阿里招聘页面未提供有效的匿名会话或岗位接口配置，可能需要安全验证；请稍后重试或粘贴 JD。");
    // Fixed same-origin API: never follow an endpoint supplied by page scripts.
    const endpoint = new URL("/position/detail", url);
    endpoint.searchParams.set("_csrf", config.token);
    const payload = asRecord(await fetchJobJson(endpoint, url.toString(), fetcher,
      { id: target.id, channel: config.channel, language: "zh" }, { Cookie: sessionCookie }));
    if (payload?.relogin === true) throw new Error("阿里招聘要求登录后才能查看该岗位，请改用粘贴 JD。");
    const detail = asRecord(payload?.content);
    if (payload?.success !== true || !detail || String(detail.id) !== target.id) throw new Error("阿里招聘未返回这个岗位的有效详情，请确认链接及岗位是否仍有效。");
    if (detail.status && detail.status !== "recruit") throw new Error("这个阿里岗位已停止招聘或状态无法确认，请核对官网。");
    const graduation = asRecord(detail.graduationTime);
    const graduationFrom = chinaDate(graduation?.from), graduationTo = chinaDate(graduation?.to);
    const degrees: Record<string, string> = { bachelor: "本科", master: "硕士", doctor: "博士", college: "大专", no_limit: "学历不限" };
    // Keep the requested posting only. Application controls and contact details
    // are intentionally excluded, even when returned in the same API payload.
    const row = {
      id: detail.id, name: detail.name, description: detail.description, requirement: detail.requirement,
      workPlace: detail.workLocations, publishDate: chinaDate(detail.publishTime),
      education: degrees[valueText(detail.degree)] || "",
      department: valueText(detail.department) || valueText(detail.circleNames),
      recruitmentType: valueText(detail.batchName) || (target.campus ? "校招" : "社招"),
      jobHighlights: graduationFrom || graduationTo ? `招聘对象毕业时间：${graduationFrom || "未注明起始时间"} 至 ${graduationTo || "未注明结束时间"}` : "",
    };
    if (!recordHasJob(row)) throw new Error("阿里岗位详情缺少岗位名称或正文，已停止导入。");
    return recordToJob(row, url.toString(), "阿里招聘公开岗位详情接口");
  },
};

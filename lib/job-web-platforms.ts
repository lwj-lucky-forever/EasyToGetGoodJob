import { fetchJobPage, normalizeJobUrl, type WebFetch } from "./job-web-fetch.ts";
import { expectedJobId, extractJobRegion, extractStructuredJob, htmlJobText, isListingTitle, type ExtractedWebJob } from "./job-web-extract.ts";
import { identifyJobSite } from "./job-web-sites.ts";
import { JOB_WEB_ADAPTERS } from "./job-web-adapters/index.ts";
import type { JobAdapterContext, JobWebAdapter } from "./job-web-adapters/types.ts";

export async function readJobUrl(input: string, fetcher: WebFetch = fetch, adapters: readonly JobWebAdapter[] = JOB_WEB_ADAPTERS) {
  const url = normalizeJobUrl(input);
  async function adapt(context: JobAdapterContext) {
    for (const adapter of adapters) {
      if (!adapter.canHandle(context.url)) continue;
      const result = await adapter.parse(context);
      if (result) return { result, adapterId: adapter.id };
    }
    return null;
  }
  let page;
  try { page = await fetchJobPage(url.toString(), fetcher); }
  catch (error) {
    // Known public APIs can still work when the HTML shell is unavailable.
    const adapted = await adapt({ url, fetcher, stage: "api" });
    if (adapted) return finish(adapted.result, url.toString(), 0, adapted.adapterId);
    throw error;
  }
  const finalUrl = normalizeJobUrl(page.finalUrl);
  const context = { url: finalUrl, html: page.html, sessionCookie: page.sessionCookie, fetcher };
  const schema = extractStructuredJob(page.html, finalUrl.toString(), "jsonld");
  if (schema) return finish(schema, finalUrl.toString(), page.redirects, "generic-jsonld");
  const embeddedAdapter = await adapt({ ...context, stage: "embedded" });
  if (embeddedAdapter) return finish(embeddedAdapter.result, finalUrl.toString(), page.redirects, embeddedAdapter.adapterId);
  const embedded = extractStructuredJob(page.html, finalUrl.toString(), "embedded");
  if (embedded) return finish(embedded, finalUrl.toString(), page.redirects, "generic-embedded");
  const platform = await adapt({ ...context, stage: "api" });
  if (platform) return finish(platform.result, finalUrl.toString(), page.redirects, platform.adapterId);
  const region = extractJobRegion(page.html, finalUrl.toString());
  if (region) return finish(region, finalUrl.toString(), page.redirects, "generic-dom");
  const visible = htmlJobText(page.html).slice(0, 3_000);
  if (/captcha|verify you are human|人机验证|安全验证|请先登录|登录后查看|access denied/i.test(visible)) throw new Error("招聘网站返回了登录或安全验证页，未导入任何页面杂文；请改用文本粘贴");
  throw new Error(expectedJobId(finalUrl) ? "未找到该岗位的有效详情，页面可能动态加载或岗位已下线；请复制岗位 JD 进行识别" : "请使用一个具体岗位的详情链接，招聘首页或搜索列表不能作为岗位导入");
}

function finish(result: ExtractedWebJob, sourceUrl: string, redirects: number, adapterId: string) {
  if (!result.parsed.role || isListingTitle(result.parsed.role) || (!result.parsed.responsibilities && !result.parsed.requirements)) throw new Error("返回的数据不包含完整岗位正文，已停止导入，请核对原链接");
  if (!result.parsed.company) result.warnings.push("未能确认招聘公司，请在保存前填写。");
  if (!result.parsed.location) result.warnings.push("未识别到工作地点，请在保存前确认。");
  if (!result.parsed.applicationDeadline) result.warnings.push("原页面未提供明确截止日期，已留空。");
  if (redirects >= 4) result.warnings.push(`链接经过 ${redirects} 次跳转，请核对最终岗位。`);
  return { ...result, sourceUrl, redirects, importSource: { ...identifyJobSite(new URL(sourceUrl)), adapterId } };
}

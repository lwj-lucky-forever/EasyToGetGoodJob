import { env } from "cloudflare:workers";
import { readJobUrl } from "../../../../lib/job-web-platforms";

function authorizedOwner(request: Request) {
  const userId = request.headers.get("oai-authenticated-user-id");
  if (!userId) return Response.json({ error: "请登录后使用网页读取功能", code: "SIGN_IN_REQUIRED" }, { status: 401 });
  if (!env.OWNER_USER_ID || userId !== env.OWNER_USER_ID) return Response.json({ error: "这是刘尉婕的个人求职工作区", code: "OWNER_ONLY" }, { status: 403 });
  return null;
}

export async function POST(request: Request) {
  const authError = authorizedOwner(request);
  if (authError) return authError;
  try {
    const payload = await request.json() as Record<string, unknown>;
    const inputUrl = typeof payload?.url === "string" ? payload.url.trim() : "";
    if (!inputUrl) return Response.json({ error: "请粘贴招聘网页链接" }, { status: 400 });
    if (inputUrl.length > 2_000) return Response.json({ error: "招聘链接过长，请使用岗位详情链接" }, { status: 400 });
    const result = await readJobUrl(inputUrl);
    return Response.json({ parsed: result.parsed, rawText: result.parsed.rawText ?? "", sourceUrl: result.sourceUrl,
      applicationDeadline: result.parsed.applicationDeadline ?? "", extractionMethod: result.extractionMethod, warnings: result.warnings, importSource: result.importSource });
  } catch (error) {
    const message = error instanceof Error ? error.message : "网页读取失败";
    const friendly = /abort|timeout/i.test(message) ? "招聘网站读取超时，请稍后重试或粘贴岗位 JD" : /fetch failed|network/i.test(message) ? "暂时无法连接招聘网站，请检查网络后重试" : message;
    return Response.json({ error: friendly }, { status: 422 });
  }
}

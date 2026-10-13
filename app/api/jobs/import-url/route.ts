import { env } from "cloudflare:workers";
import { parseJobText } from "../../../../lib/job-parser";
import { normalizeImportedJob } from "../../../../lib/job-import";

const MAX_HTML_BYTES = 1_500_000;

function authorizedOwner(request: Request) {
  const userId = request.headers.get("oai-authenticated-user-id");
  if (!userId) return Response.json({ error: "请登录后使用网页读取功能", code: "SIGN_IN_REQUIRED" }, { status: 401 });
  if (!env.OWNER_USER_ID || userId !== env.OWNER_USER_ID) return Response.json({ error: "这是刘尉婕的个人求职工作区", code: "OWNER_ONLY" }, { status: 403 });
  return null;
}

function isPrivateIpv4(host: string) {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function validateUrl(input: string) {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("请输入完整的网页链接，例如 https://…"); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("仅支持 http 或 https 网页链接");
  if (url.username || url.password) throw new Error("链接不能包含账号或密码");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("该网页端口不受支持");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.includes(":") || isPrivateIpv4(host)) {
    throw new Error("该链接地址不受支持");
  }
  return url;
}

async function fetchPage(input: string) {
  let url = validateUrl(input);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      headers: {
        "Accept": "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; InternshipTracker/1.0; +https://chatgpt.com)",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("网页跳转地址无效");
      url = validateUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`网页读取失败（${response.status}）`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) throw new Error("该链接不是可读取的招聘网页");
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_HTML_BYTES) throw new Error("网页内容过大，建议复制岗位文字进行识别");
    if (!response.body) throw new Error("网页没有返回可读取内容");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_HTML_BYTES) {
        await reader.cancel();
        throw new Error("网页内容过大，建议复制岗位文字进行识别");
      }
      chunks.push(value);
    }
    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    return { html: new TextDecoder().decode(body), finalUrl: url.toString() };
  }
  throw new Error("网页跳转次数过多");
}

function decodeEntities(text: string) {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return text
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
      if (entity.startsWith("#")) {
        const value = Number.parseInt(entity.slice(entity[1]?.toLowerCase() === "x" ? 2 : 1), entity[1]?.toLowerCase() === "x" ? 16 : 10);
        return Number.isInteger(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : " ";
      }
      return named[entity.toLowerCase()] ?? " ";
    })
    .replace(/\u00a0/g, " ");
}

function htmlToText(html: string) {
  return decodeEntities(html)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|svg|noscript|template)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(?:br|\/p|\/div|\/li|\/section|\/h[1-6]|\/tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function findJobPosting(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) { const found = findJobPosting(item); if (found) return found; }
    return null;
  }
  const object = value as Record<string, unknown>;
  const type = object["@type"];
  if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return object;
  for (const child of Object.values(object)) { const found = findJobPosting(child); if (found) return found; }
  return null;
}

function structuredJobPosting(html: string) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try {
      const posting = findJobPosting(JSON.parse(decodeEntities(match[1]).trim()));
      if (posting) return posting;
    } catch { /* Ignore malformed structured data. */ }
  }
  return null;
}

function objectName(value: unknown): string {
  if (typeof value === "string") return htmlToText(value);
  if (value && typeof value === "object") return typeof (value as Record<string, unknown>).name === "string" ? String((value as Record<string, unknown>).name) : "";
  return "";
}

function contentText(value: unknown): string {
  if (typeof value === "string") return htmlToText(value);
  if (Array.isArray(value)) return value.map(contentText).filter(Boolean).join("\n");
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return contentText(row.description ?? row.name ?? row.value ?? "");
  }
  return "";
}

function locationText(value: unknown): string {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  return items.map((item) => {
    if (!item || typeof item !== "object") return objectName(item);
    const row = item as Record<string, unknown>;
    const address = row.address && typeof row.address === "object" ? row.address as Record<string, unknown> : row;
    return [address.addressRegion, address.addressLocality, address.streetAddress].filter((part) => typeof part === "string" && part).join(" · ");
  }).filter(Boolean).join("；");
}

function employmentNature(value: unknown) {
  const text = Array.isArray(value) ? value.join(" ") : String(value ?? "");
  if (/intern/i.test(text)) return "日常实习";
  if (/part.?time/i.test(text)) return "兼职";
  if (/full.?time/i.test(text)) return "校招";
  return "";
}

function pageTitle(html: string) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return htmlToText(h1 || title || "").slice(0, 200);
}

function deadlineFromText(text: string) {
  const contextual = text.match(/(?:投递|申请|报名|招聘)?\s*(?:截止日期|截止时间|截止至|截止到|截至)\s*[：:]?\s*(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?)/);
  return contextual?.[1] ?? "";
}

function buildReadableJob(html: string) {
  const posting = structuredJobPosting(html);
  const visible = htmlToText(html).slice(0, 45_000);
  if (!posting) return { text: visible, deadline: deadlineFromText(visible) };
  const role = objectName(posting.title) || pageTitle(html);
  const company = objectName(posting.hiringOrganization);
  const location = locationText(posting.jobLocation);
  const nature = employmentNature(posting.employmentType);
  const responsibilities = contentText(posting.responsibilities ?? posting.description ?? "");
  const requirements = contentText(posting.qualifications ?? posting.skills ?? posting.experienceRequirements ?? "");
  const blocks = [
    company && `公司：${company}`,
    role && `岗位：${role}`,
    location && `工作地点：${location}`,
    nature && `岗位性质：${nature}`,
    responsibilities && `工作内容：\n${responsibilities}`,
    requirements && `岗位要求：\n${requirements}`,
  ].filter(Boolean);
  return { text: `${blocks.join("\n")}\n${visible}`.slice(0, 50_000), deadline: contentText(posting.validThrough).slice(0, 40) || deadlineFromText(visible) };
}

export async function POST(request: Request) {
  const authError = authorizedOwner(request);
  if (authError) return authError;
  try {
    const payload = await request.json() as Record<string, unknown>;
    const inputUrl = typeof payload.url === "string" ? payload.url.trim().slice(0, 2_000) : "";
    if (!inputUrl) return Response.json({ error: "请粘贴招聘网页链接" }, { status: 400 });
    const { html, finalUrl } = await fetchPage(inputUrl);
    const readable = buildReadableJob(html);
    const parsed = normalizeImportedJob(parseJobText(readable.text));
    if (!parsed.role) {
      const title = pageTitle(html);
      if (title) parsed.role = title.replace(/[-_|｜].*$/, "").trim();
    }
    parsed.sourceUrl = finalUrl;
    const normalized = normalizeImportedJob({ ...parsed, rawText: readable.text, applicationDeadline: readable.deadline });
    return Response.json({ parsed: normalized, rawText: normalized.rawText ?? "", sourceUrl: finalUrl, applicationDeadline: normalized.applicationDeadline ?? "" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "网页读取失败";
    const friendly = /abort|timeout/i.test(message) ? "网页读取超时，可能需要登录或限制了自动访问；请改用文本粘贴" : message;
    return Response.json({ error: friendly }, { status: 422 });
  }
}

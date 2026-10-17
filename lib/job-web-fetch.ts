/** Bounded, public-URL-only transport shared by HTML and fixed platform APIs. */
export const MAX_WEB_BYTES = 1_500_000;
const AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
export type WebFetch = typeof fetch;

export function validateJobUrl(input: string) {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("请输入完整的网页链接，例如 https://…"); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("仅支持 http 或 https 网页链接");
  if (url.username || url.password) throw new Error("链接不能包含账号或密码");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("该网页端口不受支持");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const parts = host.split(".").map(Number);
  const [a, b] = parts;
  const privateIp = parts.length === 4 && parts.every(Number.isInteger) && (
    a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && [0, 168].includes(b)) || (a === 198 && [18, 19].includes(b))
  );
  if (!host || /(?:^|\.)(?:localhost|local|internal)$/.test(host) || host.includes(":") || privateIp) {
    throw new Error("该链接地址不受支持");
  }
  url.hostname = host;
  return url;
}

/** Remove only known tracking keys; unknown parameters may identify a job. */
export function normalizeJobUrl(input: string) {
  const url = validateJobUrl(input.trim());
  const tracking = /^(?:utm_.+|gclid|fbclid|msclkid|_ga|_gl)$/i;
  const clean = (params: URLSearchParams) => {
    for (const key of [...params.keys()]) if (tracking.test(key)) params.delete(key);
  };
  clean(url.searchParams);
  // `spread` is a referral code on these ATS portals, not the position ID.
  if (url.hostname === "jobs.bytedance.com" || /^[a-z\d-]+\.jobs\.(?:f\.mioffice|feishu)\.cn$/.test(url.hostname)) url.searchParams.delete("spread");
  const hashQuery = url.hash.indexOf("?");
  if (hashQuery >= 0 && /^#!?\//.test(url.hash)) {
    const params = new URLSearchParams(url.hash.slice(hashQuery + 1));
    clean(params);
    url.hash = url.hash.slice(0, hashQuery) + (params.size ? `?${params}` : "");
  }
  return url;
}

async function boundedText(response: Response) {
  if (Number(response.headers.get("content-length") || 0) > MAX_WEB_BYTES) throw new Error("网页内容过大，请改用文本粘贴");
  if (!response.body) throw new Error("网页没有返回可读取内容");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_WEB_BYTES) { await reader.cancel(); throw new Error("网页内容过大，请改用文本粘贴"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const charset = response.headers.get("content-type")?.match(/charset=([^;\s]+)/i)?.[1]?.replace(/["']/g, "") || "utf-8";
  try { return new TextDecoder(charset).decode(bytes); } catch { return new TextDecoder().decode(bytes); }
}

function checkStatus(response: Response) {
  if ([401, 403].includes(response.status)) throw new Error("招聘网站拒绝了自动读取或需要登录，请改用文本粘贴");
  if (response.status === 429) throw new Error("招聘网站访问频率受限，请稍后重试");
  if (!response.ok) throw new Error(`招聘网页读取失败（${response.status}）`);
}

export async function fetchJobPage(input: string, fetcher: WebFetch = fetch) {
  let url = normalizeJobUrl(input);
  const visited = new Set<string>();
  const cookies = new Map<string, Map<string, string>>();
  const signal = AbortSignal.timeout(25_000);
  for (let redirects = 0; redirects <= 10; redirects++) {
    const key = url.toString().replace(/#.*$/, "");
    if (visited.has(key)) throw new Error("网页发生循环跳转，可能需要登录；请改用文本粘贴");
    visited.add(key);
    const jar = cookies.get(url.hostname) ?? new Map<string, string>();
    const response = await fetcher(url, { redirect: "manual", signal, headers: {
      Accept: "text/html,application/xhtml+xml", "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.6",
      "User-Agent": AGENT, ...(jar.size ? { Cookie: [...jar.values()].join("; ") } : {}),
    } });
    for (const item of (response.headers.get("set-cookie") ?? "").split(/,(?=[^;,]+=)/)) {
      const pair = item.split(";", 1)[0]?.trim();
      if (pair?.includes("=")) jar.set(pair.split("=", 1)[0], pair);
    }
    cookies.set(url.hostname, jar);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error("网页跳转地址无效");
      const next = new URL(location, url);
      // Browsers inherit fragments across redirects unless Location supplies one.
      if (!location.includes("#")) next.hash = url.hash;
      url = normalizeJobUrl(next.toString());
      continue;
    }
    checkStatus(response);
    if (!/text\/html|application\/xhtml\+xml/i.test(response.headers.get("content-type") ?? "")) throw new Error("该链接不是招聘详情网页");
    const html = await boundedText(response);
    // Parse refresh attributes independent of ordering; never execute page scripts.
    const refreshTag = [...html.matchAll(/<meta\b[^>]*>/gi)].find(([tag]) => /http-equiv\s*=\s*["']?refresh\b/i.test(tag))?.[0];
    const refresh = refreshTag?.match(/content\s*=\s*["'][^"']*?url\s*=\s*([^"'>;]+)/i)?.[1];
    if (refresh) { url = normalizeJobUrl(new URL(refresh.replace(/&amp;/g, "&").trim(), url).toString()); continue; }
    // Only this final host's anonymous session is available to a site adapter.
    // It is request-local and must never be included in the import response.
    return { html, finalUrl: url.toString(), redirects, sessionCookie: [...jar.values()].join("; ") };
  }
  throw new Error("网页跳转次数过多，请使用最终岗位详情链接");
}

export async function fetchJobJson(url: URL, referer: string, fetcher: WebFetch = fetch, body?: Record<string, unknown>, headers: Record<string, string> = {}) {
  validateJobUrl(url.toString());
  const response = await fetcher(url, { method: body ? "POST" : "GET", redirect: "manual", signal: AbortSignal.timeout(15_000), headers: {
    Accept: "application/json", "Accept-Language": "zh-CN,zh;q=0.9", "User-Agent": AGENT, Referer: referer,
    ...(body ? { "Content-Type": "application/json" } : {}), ...headers,
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if ([301, 302, 303, 307, 308].includes(response.status)) { await response.body?.cancel(); throw new Error("招聘平台接口发生了意外跳转"); }
  checkStatus(response);
  const text = await boundedText(response);
  try { return JSON.parse(text) as unknown; } catch { throw new Error("招聘平台返回的不是岗位 JSON 数据，可能需要安全验证"); }
}

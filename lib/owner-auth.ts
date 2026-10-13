import { env } from "cloudflare:workers";

export function requireOwner(request: Request) {
  const userId = request.headers.get("oai-authenticated-user-id");
  if (!userId) {
    return { error: Response.json({ error: "请登录后进入个人工作区", code: "SIGN_IN_REQUIRED" }, { status: 401 }) };
  }
  if (!env.OWNER_USER_ID || userId !== env.OWNER_USER_ID) {
    return { error: Response.json({ error: "这是刘尉婕的个人求职工作区", code: "OWNER_ONLY" }, { status: 403 }) };
  }
  return { userId };
}

export function safeText(value: unknown, max = 20_000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

